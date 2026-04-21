const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['polling', 'websocket']
});

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── DATABASE (JSON FILE) ──────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db = { users: [], posts: [], chats: [] };
if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e) {}
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateId() { return Math.random().toString(36).substr(2, 9) + Date.now().toString(36); }

const JWT_SECRET = process.env.JWT_SECRET || 'snappic_live_secret_2024';

// ─── HELPERS ──────────────────────────────────────────
const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } 
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

// ─── AUTH ROUTES ──────────────────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });

    if (db.users.find(u => u.email === email || u.username === username)) 
        return res.status(400).json({ error: 'Username or email already taken' });

    const hashed = await bcryptjs.hash(password, 10);
    const initials = username.substring(0,2).toUpperCase();
    const user = { id: generateId(), username, email, password: hashed, avatar: initials, bio: '', followers: [], following: [], createdAt: new Date().toISOString() };
    
    db.users.push(user);
    saveDB();

    const token = jwt.sign({ id: user.id, username: user.username, avatar: user.avatar }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio, followers: 0, following: 0 } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email);
    if (!user || !(await bcryptjs.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, username: user.username, avatar: user.avatar }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio, followers: user.followers.length, following: user.following.length } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/me', auth, async (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio, followers: user.followers.length, following: user.following.length } });
});

// ─── POST ROUTES ──────────────────────────────────────
app.get('/api/posts', auth, async (req, res) => {
  try {
    const posts = db.posts.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
    res.json({ posts: posts.map(p => {
      const author = db.users.find(u => u.id === p.authorId) || { id: p.authorId, username: 'Unknown', avatar: '?' };
      return {
          id: p.id, author: { id: author.id, username: author.username, avatar: author.avatar },
          caption: p.caption, image: p.image, likes: p.likes.length,
          isLiked: p.likes.includes(req.user.id),
          comments: p.comments.slice(-3),
          commentCount: p.comments.length, createdAt: p.createdAt
      };
    })});
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', auth, async (req, res) => {
  try {
    const { caption, image } = req.body;
    if (!caption && !image) return res.status(400).json({ error: 'Need caption or image' });
    const post = { id: generateId(), authorId: req.user.id, caption, image: image || null, likes: [], comments: [], createdAt: new Date().toISOString() };
    db.posts.push(post);
    saveDB();
    
    const author = db.users.find(u => u.id === req.user.id);
    const data = { id: post.id, author: { id: author.id, username: author.username, avatar: author.avatar }, caption: post.caption, image: post.image, likes: 0, isLiked: false, comments: [], commentCount: 0, createdAt: post.createdAt };
    io.emit('new_post', data); 
    res.json({ success: true, post: data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/like', auth, async (req, res) => {
  try {
    const post = db.posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const idx = post.likes.indexOf(req.user.id);
    let liked;
    if (idx > -1) { post.likes.splice(idx, 1); liked = false; }
    else { post.likes.push(req.user.id); liked = true; }
    saveDB();
    io.emit('post_liked', { postId: post.id, likes: post.likes.length, liked });
    res.json({ success: true, liked, likes: post.likes.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment text required' });
    const post = db.posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = { username: req.user.username, text, createdAt: new Date().toISOString() };
    post.comments.push(comment);
    saveDB();
    io.emit('new_comment', { postId: post.id, comment, commentCount: post.comments.length });
    res.json({ success: true, comment });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/posts/:id', auth, async (req, res) => {
  try {
    const postIdx = db.posts.findIndex(p => p.id === req.params.id);
    if (postIdx === -1) return res.status(404).json({ error: 'Not found' });
    if (db.posts[postIdx].authorId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    db.posts.splice(postIdx, 1);
    saveDB();
    io.emit('post_deleted', { postId: req.params.id });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── CHAT ROUTES ──────────────────────────────────────
app.get('/api/chat', auth, async (req, res) => {
  const msgs = db.chats.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
  res.json({ messages: msgs.reverse() });
});

// ─── SOCKET.IO (Real-Time) ────────────────────────────
const onlineUsers = {};

io.on('connection', (socket) => {
  socket.on('user_join', ({ id, username, avatar }) => {
    onlineUsers[socket.id] = { id, username, avatar };
    io.emit('online_count', Object.keys(onlineUsers).length);
  });

  socket.on('chat_message', async ({ text, userId, username, avatar }) => {
    try {
      const msg = { id: generateId(), userId, username, avatar, text, createdAt: new Date().toISOString() };
      db.chats.push(msg);
      saveDB();
      io.emit('chat_message', msg);
    } catch(e) { console.error(e); }
  });

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    io.emit('online_count', Object.keys(onlineUsers).length);
  });
});

// ─── START ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Snappic Live running on http://localhost:${PORT}`));
