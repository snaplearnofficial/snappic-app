const socket = io();

let currentUser = null;
let token = localStorage.getItem('snappic_live_token');
let currentPosts = [];
let currentChats = [];

function showNotification(msg) { 
    const notif = document.getElementById('notification'); 
    document.getElementById('notificationText').innerText = msg; 
    notif.classList.add('show'); 
    setTimeout(() => notif.classList.remove('show'), 3000); 
}

function goToApp() { document.getElementById('homePage').classList.add('hidden'); document.getElementById('guidePage').classList.add('hidden'); document.getElementById('appPage').classList.remove('hidden'); initApp(); }
function goToGuide() { document.getElementById('homePage').classList.add('hidden'); document.getElementById('appPage').classList.add('hidden'); document.getElementById('guidePage').classList.remove('hidden'); }
function backToHome() { document.getElementById('guidePage').classList.add('hidden'); document.getElementById('appPage').classList.add('hidden'); document.getElementById('homePage').classList.remove('hidden'); }
function toggleMenu(e) { e.stopPropagation(); document.getElementById('userMenu').classList.toggle('show'); }
document.addEventListener('click', (e) => { if (!e.target.closest('#userMenu') && !e.target.closest('.icon-btn')) { const menu = document.getElementById('userMenu'); if(menu) menu.classList.remove('show'); } });

async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(endpoint, { method, headers, body: body ? JSON.stringify(body) : null });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
}

async function initApp() {
    if (token) {
        try {
            const data = await apiCall('/api/me');
            currentUser = data.user;
            showMainApp();
            socket.emit('user_join', currentUser);
        } catch(e) {
            token = null; localStorage.removeItem('snappic_live_token');
            showAuthPage();
        }
    } else {
        showAuthPage();
    }
}

function showAuthPage() {
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('signupContainer').classList.add('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('signupContainer').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    updateUserCard();
    fetchPosts();
    fetchChats();
}

async function handleLogin(e) {
    e.preventDefault();
    try {
        const data = await apiCall('/api/login', 'POST', {
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
        });
        token = data.token; localStorage.setItem('snappic_live_token', token);
        currentUser = data.user;
        showNotification('Welcome back!');
        showMainApp();
        socket.emit('user_join', currentUser);
    } catch(e) {
        const err = document.getElementById('loginError'); err.innerText = e.message; err.style.display = 'block';
    }
}

function demoLogin(email, pwd) {
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = pwd;
    handleLogin(new Event('submit'));
}

function switchToSignup() { document.getElementById('loginError').style.display = 'none'; document.getElementById('authContainer').classList.add('hidden'); document.getElementById('signupContainer').classList.remove('hidden'); }
function switchToLogin() { document.getElementById('signupError').style.display = 'none'; document.getElementById('signupContainer').classList.add('hidden'); document.getElementById('authContainer').classList.remove('hidden'); }

async function handleSignup(e) {
    e.preventDefault();
    const pw = document.getElementById('signupPassword').value;
    if (pw !== document.getElementById('confirmPassword').value) {
        document.getElementById('signupError').innerText = 'Passwords do not match'; 
        document.getElementById('signupError').style.display = 'block'; return; 
    }
    try {
        const data = await apiCall('/api/register', 'POST', {
            username: document.getElementById('username').value,
            email: document.getElementById('signupEmail').value,
            password: pw
        });
        token = data.token; localStorage.setItem('snappic_live_token', token);
        currentUser = data.user;
        showNotification('Account created!');
        showMainApp();
        socket.emit('user_join', currentUser);
    } catch(e) {
        document.getElementById('signupError').innerText = e.message; document.getElementById('signupError').style.display = 'block';
    }
}

function handleLogout() {
    token = null; currentUser = null; localStorage.removeItem('snappic_live_token');
    document.getElementById('userMenu').classList.remove('show');
    showAuthPage();
}

function updateUserCard() {
    if (!currentUser) return;
    document.getElementById('userAvatar').innerText = currentUser.avatar;
    document.getElementById('userName').innerText = currentUser.username;
    document.getElementById('userUsername').innerText = '@' + currentUser.username;
    document.getElementById('postCount').innerText = currentPosts.filter(p => p.author.id === currentUser.id).length;
}

function openProfileModal() {
    document.getElementById('profileAvatar').innerText = currentUser.avatar;
    document.getElementById('profileName').innerText = currentUser.username;
    document.getElementById('profileUsername').innerText = '@' + currentUser.username;
    const userPosts = currentPosts.filter(p => p.author.id === currentUser.id);
    document.getElementById('profilePostsCount').innerText = userPosts.length;
    
    const grid = document.getElementById('profileGrid');
    if(userPosts.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px; background: var(--bg-color); border-radius: 12px;">No posts yet.</div>';
    } else {
        grid.innerHTML = userPosts.map(p => `
            <div style="aspect-ratio: 1; background: var(--bg-color); border-radius: 12px; overflow: hidden; position: relative; border: 1px solid var(--border);">
                ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="padding: 16px; font-size: 14px; color: var(--text-main); height: 100%; display: flex; align-items: center; justify-content: center; text-align: center;">${p.caption.substring(0, 50)}...</div>`}
            </div>
        `).join('');
    }
    document.getElementById('userMenu').classList.remove('show');
    document.getElementById('profileModal').classList.add('show');
}
function closeProfileModal() { document.getElementById('profileModal').classList.remove('show'); }

async function fetchPosts() {
    try {
        const data = await apiCall('/api/posts');
        currentPosts = data.posts;
        renderFeed();
    } catch(e) { console.error(e); }
}

function renderFeed() {
    const feed = document.getElementById('feed');
    let html = `<div class="post-creator" onclick="openCreateModal()" style="cursor: pointer;"><div class="creator-top"><div class="avatar">${currentUser.avatar}</div><div class="create-input" style="color: var(--text-muted); display: flex; align-items: center;">What's on your mind, ${currentUser.username}?</div></div></div>`;

    if (currentPosts.length === 0) html += `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No posts yet. Be the first to share!</div>`;
    else {
        currentPosts.forEach(post => {
            html += `
            <div class="post-card" id="post-${post.id}">
                <div class="post-header">
                    <div class="post-author">
                        <div class="avatar">${post.author.avatar}</div>
                        <div class="author-details"><div class="author-name">${post.author.username}</div><div class="post-time">@${post.author.username}</div></div>
                    </div>
                    ${post.author.id === currentUser.id ? `<button class="icon-btn" onclick="deletePost('${post.id}')"><i class='bx bx-trash' style="font-size: 18px;"></i></button>` : ''}
                </div>
                ${post.caption ? `<div class="post-caption">${post.caption}</div>` : ''}
                ${post.image ? `<img src="${post.image}" class="post-image" loading="lazy">` : ''}
                <div class="post-actions">
                    <div class="action-icon ${post.isLiked ? 'liked' : ''}" onclick="likePost('${post.id}')" id="like-btn-${post.id}"><i class='bx ${post.isLiked ? 'bxs-heart' : 'bx-heart'}'></i></div>
                    <div class="action-icon" onclick="document.getElementById('comment-input-${post.id}').focus()"><i class='bx bx-message-rounded'></i></div>
                </div>
                <div class="post-stats" id="like-count-${post.id}">${post.likes} ${post.likes === 1 ? 'like' : 'likes'}</div>
                <div class="post-comments" id="comments-${post.id}">
                    ${post.comments.map(c => `<div class="comment"><span class="comment-username">@${c.username}</span>${c.text}</div>`).join('')}
                </div>
                <div class="comment-input-box"><input type="text" id="comment-input-${post.id}" placeholder="Add a comment..." onkeypress="if(event.key==='Enter') addComment('${post.id}')"><button class="comment-post-btn" onclick="addComment('${post.id}')">Post</button></div>
            </div>`;
        });
    }
    feed.innerHTML = html;
    updateUserCard();
}

async function likePost(id) {
    try {
        const data = await apiCall(`/api/posts/${id}/like`, 'POST');
        const post = currentPosts.find(p => p.id === id);
        if(post) { 
            post.isLiked = data.liked; 
            post.likes = data.likes;
            const btn = document.getElementById(`like-btn-${id}`);
            if (btn) {
                if (data.liked) { btn.classList.add('liked'); btn.innerHTML = "<i class='bx bxs-heart'></i>"; }
                else { btn.classList.remove('liked'); btn.innerHTML = "<i class='bx bx-heart'></i>"; }
                document.getElementById(`like-count-${id}`).innerText = `${data.likes} ${data.likes === 1 ? 'like' : 'likes'}`;
            } else {
                renderFeed();
            }
        }
    } catch(e) { console.error(e); }
}

async function addComment(id) {
    const input = document.getElementById(`comment-input-${id}`);
    const text = input.value.trim(); if(!text) return;
    try {
        await apiCall(`/api/posts/${id}/comment`, 'POST', { text });
        input.value = '';
    } catch(e) { console.error(e); }
}

async function deletePost(id) {
    if(!confirm('Delete this post?')) return;
    try {
        await apiCall(`/api/posts/${id}`, 'DELETE');
    } catch(e) { console.error(e); }
}

function openCreateModal() { document.getElementById('createModal').classList.add('show'); }
function closeCreateModal() { document.getElementById('createModal').classList.remove('show'); clearImage(); document.getElementById('postCaption').value = ''; }
function clearImage() { document.getElementById('imageInput').value = ''; document.getElementById('previewContainer').classList.add('hidden'); document.getElementById('uploadArea').classList.remove('hidden'); window.currentImageData = null; }

function handleImageSelect(e) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; const MAX_HEIGHT = 800; let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('imagePreview').src = dataUrl;
            document.getElementById('previewContainer').classList.remove('hidden');
            document.getElementById('uploadArea').classList.add('hidden');
            window.currentImageData = dataUrl;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

async function createPost() {
    const caption = document.getElementById('postCaption').value.trim();
    const image = window.currentImageData;
    if(!caption && !image) return showNotification('Add a photo or a caption!');
    try {
        await apiCall('/api/posts', 'POST', { caption, image });
        closeCreateModal(); showNotification('Post shared successfully!');
    } catch(e) { showNotification(e.message); }
}

function toggleChat() {
    const w = document.getElementById('chatWidget');
    w.classList.toggle('minimized');
    document.getElementById('chatToggleIcon').className = w.classList.contains('minimized') ? 'bx bx-chevron-up' : 'bx bx-chevron-down';
    if(!w.classList.contains('minimized')) setTimeout(() => { const b = document.getElementById('chatBody'); b.scrollTop = b.scrollHeight; }, 50);
}

async function fetchChats() {
    try {
        const data = await apiCall('/api/chat');
        currentChats = data.messages;
        renderChat();
    } catch(e) { console.error(e); }
}

function renderChat() {
    const b = document.getElementById('chatBody');
    const isAtBottom = b.scrollHeight - b.scrollTop <= b.clientHeight + 50;
    
    if (currentChats.length === 0) {
        b.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding-top: 20px; font-size: 13px;">No messages yet. Say hi!</div>';
    } else {
        b.innerHTML = currentChats.map(c => `
            <div class="chat-msg ${c.userId === currentUser.id ? 'mine' : 'others'}">
                ${c.userId !== currentUser.id ? `<div class="msg-author">${c.username}</div>` : ''}
                ${c.text}
            </div>
        `).join('');
    }
    if (isAtBottom) b.scrollTop = b.scrollHeight;
}

function sendChatMessage() {
    const i = document.getElementById('chatInput');
    const text = i.value.trim();
    if(!text) return;
    socket.emit('chat_message', { text, userId: currentUser.id, username: currentUser.username, avatar: currentUser.avatar });
    i.value = '';
}

socket.on('new_post', (post) => {
    currentPosts.unshift(post);
    renderFeed();
});

socket.on('post_deleted', ({ postId }) => {
    currentPosts = currentPosts.filter(p => p.id !== postId);
    renderFeed();
});

socket.on('post_liked', ({ postId, likes, liked }) => {
    const post = currentPosts.find(p => p.id === postId);
    if(post) {
        post.likes = likes;
        // Don't override if current user liked it because the optimistic update already handled it
        const btn = document.getElementById(`like-btn-${postId}`);
        if(btn && document.getElementById(`like-count-${postId}`)) {
            document.getElementById(`like-count-${postId}`).innerText = `${likes} ${likes === 1 ? 'like' : 'likes'}`;
        }
    }
});

socket.on('new_comment', ({ postId, comment, commentCount }) => {
    const post = currentPosts.find(p => p.id === postId);
    if(post) {
        post.comments.push(comment);
        renderFeed();
    }
});

socket.on('chat_message', (msg) => {
    currentChats.push(msg);
    renderChat();
});
