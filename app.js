const socket = io();

let currentUser = null;
let token = localStorage.getItem('snappic_token');
let currentPosts = [];
let activeChatUserId = null;

// --- UTILS ---
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function api(path, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : null });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
}

// --- AUTH ---
function toggleAuth() {
    document.getElementById('loginCard').classList.toggle('hidden');
    document.getElementById('signupCard').classList.toggle('hidden');
}

async function handleLogin() {
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const data = await api('/api/login', 'POST', { email, password });
        token = data.token; localStorage.setItem('snappic_token', token);
        currentUser = data.user;
        initApp();
    } catch (e) {
        const err = document.getElementById('loginError');
        err.innerText = e.message; err.style.display = 'block';
    }
}

async function handleSignup() {
    try {
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const data = await api('/api/register', 'POST', { username, email, password });
        token = data.token; localStorage.setItem('snappic_token', token);
        currentUser = data.user;
        initApp();
    } catch (e) {
        const err = document.getElementById('signupError');
        err.innerText = e.message; err.style.display = 'block';
    }
}

function handleLogout() {
    token = null; localStorage.removeItem('snappic_token');
    currentUser = null;
    location.reload();
}

// --- APP CORE ---
async function initApp() {
    if (!token) return;
    try {
        const data = await api('/api/me');
        currentUser = data.user;
        document.getElementById('authPage').classList.add('hidden');
        document.getElementById('appPage').classList.remove('hidden');
        
        socket.emit('user_join', { id: currentUser.id });
        updateSidebar();
        loadFeed();
    } catch (e) {
        handleLogout();
    }
}

function updateSidebar() {
    if (!currentUser) return;
    document.getElementById('creatorAvatar').innerText = currentUser.avatar;
    document.getElementById('sideAvatar').innerText = currentUser.avatar;
    document.getElementById('sideName').innerText = currentUser.username;
    document.getElementById('sideUsername').innerText = '@' + currentUser.username;
    document.getElementById('sideFollowers').innerText = currentUser.followers.length;
}

async function loadFeed() {
    try {
        const data = await api('/api/posts');
        currentPosts = data.posts;
        renderFeed();
        document.getElementById('sidePosts').innerText = currentPosts.filter(p => p.author.id === currentUser.id).length;
    } catch (e) { console.error(e); }
}

function renderFeed() {
    const feed = document.getElementById('feed');
    feed.innerHTML = currentPosts.map(post => `
        <div class="post-card">
            <div class="post-header">
                <div class="post-author" onclick="viewProfile('${post.author.id}')">
                    <div class="avatar">${post.author.avatar}</div>
                    <div class="author-info">
                        <div style="font-weight: 700; font-size: 14px;">${post.author.username}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">@${post.author.username}</div>
                    </div>
                </div>
            </div>
            ${post.image ? \`<img src="\${post.image}" class="post-image" loading="lazy">\` : ''}
            <div class="post-actions">
                <i class='bx \${post.isLiked ? 'bxs-heart' : 'bx-heart'}' style="\${post.isLiked ? 'color: red;' : ''}" onclick="likePost('\${post.id}')"></i>
                <i class='bx bx-message-rounded' onclick="document.getElementById('input-\${post.id}').focus()"></i>
            </div>
            <div class="post-stats">\${post.likes} likes</div>
            <div class="post-caption"><span style="font-weight: 700;">\${post.author.username}</span> \${post.caption || ''}</div>
            <div class="post-comments" id="comments-\${post.id}">
                \${post.comments.map(c => \`<div><span style="font-weight: 700;">@\${c.username}</span> \${c.text}</div>\`).join('')}
            </div>
            <div class="comment-input-box">
                <input type="text" placeholder="Add a comment..." id="input-\${post.id}" onkeypress="if(event.key==='Enter') addComment('\${post.id}')">
            </div>
        </div>
    `).join('');
}

// --- ACTIONS ---
async function likePost(id) {
    try {
        const data = await api(\`/api/posts/\${id}/like\`, 'POST');
        const post = currentPosts.find(p => p.id === id);
        if (post) { post.isLiked = data.liked; post.likes = data.likes; renderFeed(); }
    } catch (e) { console.error(e); }
}

async function addComment(id) {
    const input = document.getElementById(\`input-\${id}\`);
    const text = input.value.trim();
    if (!text) return;
    try {
        await api(\`/api/posts/\${id}/comment\`, 'POST', { text });
        input.value = '';
    } catch (e) { console.error(e); }
}

// --- SEARCH ---
let searchTimeout;
function handleSearch(q) {
    clearTimeout(searchTimeout);
    const box = document.getElementById('searchResults');
    if (!q.trim()) { box.style.display = 'none'; return; }
    
    searchTimeout = setTimeout(async () => {
        try {
            const data = await api(\`/api/users/search?q=\${q}\`);
            if (data.users.length > 0) {
                box.innerHTML = data.users.map(u => \`
                    <div class="search-result-item" onclick="viewProfile('\${u.id}')">
                        <div class="avatar" style="width: 32px; height: 32px; font-size: 12px;">\${u.avatar}</div>
                        <span>\${u.username}</span>
                    </div>
                \`).join('');
                box.style.display = 'block';
            } else { box.style.display = 'none'; }
        } catch (e) { console.error(e); }
    }, 300);
}

// --- PROFILE ---
async function viewProfile(userId) {
    document.getElementById('searchResults').style.display = 'none';
    try {
        const data = await api(\`/api/users/\${userId}\`);
        const user = data.user;
        
        document.getElementById('profName').innerText = user.username;
        document.getElementById('profUsername').innerText = '@' + user.username;
        document.getElementById('profAvatar').innerText = user.avatar;
        document.getElementById('profPosts').innerText = data.posts.length;
        document.getElementById('profFollowers').innerText = user.followers;
        document.getElementById('profFollowing').innerText = user.following;
        
        const followBtn = document.getElementById('followBtn');
        const msgBtn = document.getElementById('messageBtn');
        if (user.id === currentUser.id) {
            followBtn.style.display = 'none';
            msgBtn.style.display = 'none';
        } else {
            followBtn.style.display = 'block';
            msgBtn.style.display = 'block';
            followBtn.innerText = user.isFollowing ? 'Following' : 'Follow';
            followBtn.className = user.isFollowing ? 'btn-follow following' : 'btn-follow';
            followBtn.onclick = () => toggleFollow(user.id);
            msgBtn.onclick = () => startChat(user.id);
        }
        
        document.getElementById('profGrid').innerHTML = data.posts.map(p => \`
            <div style="aspect-ratio: 1; background: #eee; overflow: hidden; border-radius: 8px;">
                \${p.image ? \`<img src="\${p.image}" style="width: 100%; height: 100%; object-fit: cover;">\` : \`<div style="padding: 10px; font-size: 10px; color: #666;">\${p.caption.substring(0, 30)}...</div>\`}
            </div>
        \`).join('');
        
        document.getElementById('profileModal').classList.add('show');
    } catch (e) { console.error(e); }
}

async function toggleFollow(userId) {
    try {
        const data = await api(\`/api/users/\${userId}/follow\`, 'POST');
        const btn = document.getElementById('followBtn');
        btn.innerText = data.isFollowing ? 'Following' : 'Follow';
        btn.className = data.isFollowing ? 'btn-follow following' : 'btn-follow';
        document.getElementById('profFollowers').innerText = data.followers;
        initApp(); // Refresh sidebar count
    } catch (e) { console.error(e); }
}

function openMyProfile() { if(currentUser) viewProfile(currentUser.id); }

// --- CREATE POST ---
function openCreateModal() { document.getElementById('createModal').classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

async function handleCreatePost() {
    const caption = document.getElementById('postCaption').value.trim();
    const file = document.getElementById('postImage').files[0];
    
    let imageBase64 = null;
    if (file) {
        imageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    if (!caption && !imageBase64) return;
    
    try {
        await api('/api/posts', 'POST', { caption, image: imageBase64 });
        closeModal('createModal');
        document.getElementById('postCaption').value = '';
        document.getElementById('postImage').value = '';
        showToast('Post shared!');
    } catch (e) { showToast(e.message); }
}

// --- MESSENGER (TEXTING) ---
async function openMessenger() {
    document.getElementById('messengerModal').classList.add('show');
    document.getElementById('msgBadge').style.display = 'none';
    try {
        const data = await api('/api/conversations');
        renderConversations(data.users);
    } catch (e) { console.error(e); }
}

function renderConversations(users) {
    const list = document.getElementById('convList');
    if (users.length === 0) {
        list.innerHTML = '<div style="padding: 20px; font-size: 12px; color: #999; text-align: center;">No chats yet</div>';
        return;
    }
    list.innerHTML = users.map(u => \`
        <div class="conv-item \${activeChatUserId === u.id ? 'active' : ''}" onclick="selectConversation('\${u.id}')">
            <div class="avatar" style="width: 32px; height: 32px; font-size: 12px;">\${u.avatar}</div>
            <div style="font-size: 13px; font-weight: 600;">\${u.username}</div>
        </div>
    \`).join('');
}

async function selectConversation(userId) {
    activeChatUserId = userId;
    document.getElementById('noChat').classList.add('hidden');
    document.getElementById('activeChat').classList.remove('hidden');
    
    // Refresh conversation list highlights
    const items = document.querySelectorAll('.conv-item');
    items.forEach(i => i.classList.remove('active'));
    
    try {
        const data = await api(\`/api/messages/\${userId}\`);
        const msgs = document.getElementById('chatMsgs');
        msgs.innerHTML = data.messages.map(m => \`
            <div class="msg \${m.senderId === currentUser.id ? 'mine' : 'others'}">\${m.text}</div>
        \`).join('');
        msgs.scrollTop = msgs.scrollHeight;
    } catch (e) { console.error(e); }
}

function sendDM() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || !activeChatUserId) return;
    socket.emit('direct_message', { receiverId: activeChatUserId, text });
    input.value = '';
}

function startChat(userId) {
    closeModal('profileModal');
    activeChatUserId = userId;
    openMessenger().then(() => selectConversation(userId));
}

// --- SOCKETS ---
socket.on('new_post', (post) => {
    currentPosts.unshift(post);
    renderFeed();
});

socket.on('post_liked', ({ postId, likes, liked }) => {
    const post = currentPosts.find(p => p.id === postId);
    if (post) { post.likes = likes; renderFeed(); }
});

socket.on('new_comment', ({ postId, comment }) => {
    const post = currentPosts.find(p => p.id === postId);
    if (post) { post.comments.push(comment); renderFeed(); }
});

socket.on('new_direct_message', (msg) => {
    const otherId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
    if (activeChatUserId === otherId) {
        const msgs = document.getElementById('chatMsgs');
        msgs.innerHTML += \`<div class="msg \${msg.senderId === currentUser.id ? 'mine' : 'others'}">\${msg.text}</div>\`;
        msgs.scrollTop = msgs.scrollHeight;
    } else {
        const badge = document.getElementById('msgBadge');
        if(badge) badge.style.display = 'block';
        showToast(\`New message from user!\`);
    }
});

// Start
initApp();
