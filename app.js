const socket = io();

let currentUser = null;
let token = localStorage.getItem('snappic_token');
let currentPosts = [];
let activeChatId = null;

// --- CORE ---
async function api(path, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : null });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
}

function showT(m) {
    const t = document.getElementById('toast');
    t.innerText = m; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

// --- AUTH ---
function toggleAuth() {
    document.getElementById('box-login').classList.toggle('hidden');
    document.getElementById('box-signup').classList.toggle('hidden');
}

async function handleLogin() {
    try {
        const email = document.getElementById('in-email').value;
        const password = document.getElementById('in-password').value;
        const d = await api('/api/login', 'POST', { email, password });
        token = d.token; localStorage.setItem('snappic_token', token);
        init();
    } catch (e) { document.getElementById('err-login').innerText = e.message; }
}

async function handleSignup() {
    try {
        const username = document.getElementById('up-user').value;
        const email = document.getElementById('up-email').value;
        const password = document.getElementById('up-pass').value;
        const d = await api('/api/register', 'POST', { username, email, password });
        token = d.token; localStorage.setItem('snappic_token', token);
        init();
    } catch (e) { document.getElementById('err-signup').innerText = e.message; }
}

function handleLogout() {
    localStorage.removeItem('snappic_token');
    location.reload();
}

// --- APP ---
async function init() {
    if (!token) {
        document.getElementById('v-auth').classList.remove('hidden');
        document.getElementById('v-app').classList.add('hidden');
        return;
    }
    try {
        const d = await api('/api/me');
        currentUser = d.user;
        document.getElementById('v-auth').classList.add('hidden');
        document.getElementById('v-app').classList.remove('hidden');
        
        socket.emit('user_join', { id: currentUser.id });
        updateSide();
        loadFeed();
        loadStories();
    } catch (e) { handleLogout(); }
}

function updateSide() {
    document.getElementById('side-av').innerText = currentUser.avatar;
    document.getElementById('side-un').innerText = currentUser.username;
    document.getElementById('side-fn').innerText = currentUser.username;
}

async function loadFeed() {
    try {
        const d = await api('/api/posts');
        currentPosts = d.posts;
        renderFeed();
    } catch (e) { console.error(e); }
}

function renderFeed() {
    const list = document.getElementById('feed-list');
    list.innerHTML = currentPosts.map(p => `
        <article class="post">
            <div class="post-head">
                <div class="post-user" onclick="viewP('${p.author.id}')">
                    <div class="mini-avatar">${p.author.avatar}</div>
                    <div style="font-weight:700; font-size:14px;">${p.author.username}</div>
                </div>
                <i class='bx bx-dots-horizontal-rounded'></i>
            </div>
            ${p.image ? `
                <div class="post-img-box" ondblclick="likeP('${p.id}')">
                    <img src="${p.image}" class="post-img" loading="lazy">
                </div>
            ` : ''}
            <div class="post-body">
                <div class="post-btns">
                    <i class='bx ${p.isLiked ? 'bxs-heart' : 'bx-heart'}' style="${p.isLiked ? 'color:var(--accent);' : ''}" onclick="likeP('${p.id}')"></i>
                    <i class='bx bx-message-rounded' onclick="document.getElementById('i-${p.id}').focus()"></i>
                    <i class='bx bx-paper-plane' onclick="startC('${p.author.id}')"></i>
                </div>
                <div class="likes">${p.likes} likes</div>
                <div class="caption"><b>${p.author.username}</b>${p.caption || ''}</div>
                ${p.commentCount > 0 ? `<div class="view-cmts" onclick="viewP('${p.author.id}')">View all ${p.commentCount} comments</div>` : ''}
            </div>
            <div class="cmt-box">
                <input type="text" placeholder="Add a comment..." id="i-${p.id}" onkeypress="if(event.key==='Enter') addC('${p.id}')">
                <button onclick="addC('${p.id}')">Post</button>
            </div>
        </article>
    `).join('');
}

function loadStories() {
    const list = document.getElementById('stories-list');
    const mock = [
        { name: 'You', av: currentUser.avatar },
        { name: 'Zuck', av: 'MZ' },
        { name: 'Elon', av: 'EM' },
        { name: 'Bezos', av: 'JB' },
        { name: 'Cook', av: 'TC' }
    ];
    list.innerHTML = mock.map(s => `
        <div class="story" onclick="showT('Stories coming soon!')">
            <div class="ring"><div class="avatar">${s.av}</div></div>
            <div class="story-name">${s.name}</div>
        </div>
    `).join('');
}

// --- ACTIONS ---
async function likeP(id) {
    try {
        const d = await api(`/api/posts/${id}/like`, 'POST');
        const p = currentPosts.find(x => x.id === id);
        if (p) { p.isLiked = d.liked; p.likes = d.likes; renderFeed(); }
    } catch (e) { console.error(e); }
}

async function addC(id) {
    const inp = document.getElementById(`i-${id}`);
    const text = inp.value.trim();
    if (!text) return;
    try {
        await api(`/api/posts/${id}/comment`, 'POST', { text });
        inp.value = '';
        loadFeed();
    } catch (e) { console.error(e); }
}

// --- MODALS ---
function openCreate() {
    closeM();
    document.getElementById('overlay').classList.add('show');
    document.getElementById('m-create').classList.remove('hidden');
}

function closeM() {
    document.getElementById('overlay').classList.remove('show');
    document.querySelectorAll('.m-card').forEach(c => c.classList.add('hidden'));
}

function doPrev(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('prev-img').src = e.target.result;
            document.getElementById('prev-box').style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function postIt() {
    const cap = document.getElementById('f-cap').value.trim();
    const file = document.getElementById('f-img').files[0];
    const btn = document.getElementById('btn-share');
    
    if (!cap && !file) return;
    btn.disabled = true; btn.innerText = 'Sharing...';

    let img = null;
    if (file) {
        img = await new Promise((res) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.readAsDataURL(file);
        });
    }

    try {
        await api('/api/posts', 'POST', { caption: cap, image: img });
        closeM();
        document.getElementById('f-cap').value = '';
        document.getElementById('f-img').value = '';
        document.getElementById('prev-box').style.display = 'none';
        showT('Shared!');
        loadFeed();
    } catch (e) { showT(e.message); }
    btn.disabled = false; btn.innerText = 'Share Post';
}

// --- PROFILE ---
async function viewP(uid) {
    closeM();
    try {
        const d = await api(`/api/users/${uid}`);
        const u = d.user;
        
        document.getElementById('p-title').innerText = u.username;
        document.getElementById('p-un').innerText = u.username;
        document.getElementById('p-av').innerText = u.avatar;
        document.getElementById('p-cnt-p').innerText = d.posts.length;
        document.getElementById('p-cnt-fr').innerText = u.followers;
        document.getElementById('p-cnt-fg').innerText = u.following;
        
        const fBtn = document.getElementById('p-follow');
        const mBtn = document.getElementById('p-msg');
        
        if (u.id === currentUser.id) {
            fBtn.innerText = 'Edit Profile';
            fBtn.onclick = () => showT('Edit coming soon!');
            mBtn.style.display = 'none';
        } else {
            mBtn.style.display = 'block';
            fBtn.innerText = u.isFollowing ? 'Following' : 'Follow';
            fBtn.style.background = u.isFollowing ? '#efefef' : 'var(--primary)';
            fBtn.style.color = u.isFollowing ? 'black' : 'white';
            fBtn.onclick = () => toggleF(u.id);
            mBtn.onclick = () => startC(u.id);
        }
        
        document.getElementById('p-grid').innerHTML = d.posts.map(p => `
            <div class="grid-item">
                ${p.image ? `<img src="${p.image}">` : `<div style="padding:10px; font-size:10px;">${p.caption}</div>`}
            </div>
        `).join('');
        
        document.getElementById('overlay').classList.add('show');
        document.getElementById('m-prof').classList.remove('hidden');
    } catch (e) { console.error(e); }
}

async function toggleF(uid) {
    try { await api(`/api/users/${uid}/follow`, 'POST'); viewP(uid); } catch (e) { console.error(e); }
}

function openMe() { if(currentUser) viewP(currentUser.id); }

// --- MESSENGER ---
async function openMsgs() {
    closeM();
    document.getElementById('overlay').classList.add('show');
    document.getElementById('m-msg').classList.remove('hidden');
    try {
        const d = await api('/api/conversations');
        const list = document.getElementById('conv-list');
        list.innerHTML = d.users.map(u => `
            <div class="story" style="min-width:100px; padding:10px;" onclick="selectC('${u.id}', '${u.username}')">
                <div class="mini-avatar" style="margin:0 auto 5px;">${u.avatar}</div>
                <div style="font-size:11px; font-weight:700;">${u.username}</div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function selectC(uid, name) {
    activeChatId = uid;
    document.getElementById('chat-head').innerText = name;
    document.getElementById('chat-in').classList.remove('hidden');
    try {
        const d = await api(`/api/messages/${uid}`);
        const main = document.getElementById('chat-main');
        main.innerHTML = d.messages.map(m => `
            <div class="bubble ${m.senderId === currentUser.id ? 'me' : 'them'}">${m.text}</div>
        `).join('');
        main.scrollTop = main.scrollHeight;
    } catch (e) { console.error(e); }
}

function sendD() {
    const inp = document.getElementById('msg-t');
    const text = inp.value.trim();
    if (!text || !activeChatId) return;
    socket.emit('direct_message', { receiverId: activeChatId, text });
    inp.value = '';
}

function startC(uid) {
    openMsgs().then(() => {
        api(`/api/users/${uid}`).then(d => selectC(uid, d.user.username));
    });
}

// --- SOCKET ---
socket.on('new_post', (p) => { currentPosts.unshift(p); renderFeed(); });
socket.on('post_liked', ({ postId, likes }) => {
    const p = currentPosts.find(x => x.id === postId);
    if (p) { p.likes = likes; renderFeed(); }
});
socket.on('new_direct_message', (m) => {
    const other = m.senderId === currentUser.id ? m.receiverId : m.senderId;
    if (activeChatId === other) {
        const main = document.getElementById('chat-main');
        const div = document.createElement('div');
        div.className = `bubble ${m.senderId === currentUser.id ? 'me' : 'them'}`;
        div.innerText = m.text;
        main.appendChild(div);
        main.scrollTop = main.scrollHeight;
    } else { showT('New message!'); }
});

init();
