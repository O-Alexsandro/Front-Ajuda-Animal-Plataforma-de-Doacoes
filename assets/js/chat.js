const BACKEND_WS = (function(){
  try{ const u = new URL(BACKEND_BASE_URL); return (u.protocol==='https:'?'wss:':'ws:') + '//' + u.host + '/ws/chat'; }catch(e){ return 'ws://localhost:8080/ws/chat' }
})();

let socket = null;
let socketAvailable = false;
let currentConversation = null; // {id, withUserId, donationId}
const currentUserId = localStorage.getItem('userId') || null;

// Deterministic avatar color for a given string (id or name)
function colorForString(s){
  const palette = ['#FFB4A2','#FFDAC1','#FFE6A7','#D0F0C0','#B6E3E9','#C9BBFF','#F3C4FB','#FDE2F3','#FFD6A5','#E2F0CB'];
  if (!s) return palette[0];
  try{
    let h = 0; for(let i=0;i<s.length;i++) h = ((h<<5)-h) + s.charCodeAt(i);
    const idx = Math.abs(h) % palette.length;
    return palette[idx];
  }catch(e){ return palette[0]; }
}

function connectSocket(){
  if(socket && socket.readyState===WebSocket.OPEN) return socket;
  const token = localStorage.getItem('token');
  socket = new WebSocket(BACKEND_WS + (token?`?token=${token}`:''));

  socket.addEventListener('open', ()=>{
    console.log('chat socket open')
    socketAvailable = true;
    // request conversations list
    try { socket.send(JSON.stringify({type:'list'})); } catch(e){ console.warn('ws send list failed', e); }

    // If some page requested opening a conversation before WS was ready, process it now
    try {
      const pending = localStorage.getItem('chat_open_with');
      if (pending){
        const p = JSON.parse(pending);
        console.debug('connectSocket processing pending chat_open_with:', p);
        if (p && p.userId){
          try {
            // set provisional title if we have a name
            try { if (p.userName) document.getElementById('conv-title').textContent = p.userName; } catch(e){}
            // set provisional donation meta if present
            try { if (p.donationTitle) renderConversationMeta({ name: p.userName, donationTitle: p.donationTitle }); } catch(e){}
            openConversationWith(p.userId, p.donationId, p.userName, p.donationTitle);
            // clear unread badge if any for the conversation that will be opened
            try { const el = document.querySelector(`.contact-item[data-with-user-id="${p.userId}"]`) || document.querySelector(`.contact-item[data-conversation-id="${p.conversationId || ''}"]`); if (el){ const b = el.querySelector('.unread-badge'); if (b) b.remove(); } } catch(e){}
          } catch(e){ console.warn('ws send open failed', e); }
        }
        localStorage.removeItem('chat_open_with');
      }
    } catch(e){ console.warn('processing chat_open_with on ws open failed', e); }
  });

  socket.addEventListener('message', ev=>{
    try{ const data = JSON.parse(ev.data); handleSocketMessage(data); }catch(e){ console.warn('bad ws msg', ev.data) }
  });

  socket.addEventListener('close', ()=>{ console.log('chat socket closed'); socketAvailable = false; });
  socket.addEventListener('error', e=>{ console.error('chat socket error', e); socketAvailable = false; });
  return socket;
}

function handleSocketMessage(msg){
  switch(msg.type){
    case 'list': renderContacts(msg.conversations||[]); break;
    case 'history': if(msg.conversationId===currentConversation?.id) renderMessages(msg.messages||[]); break;
    case 'message': {
      // message payload may include conversationId either at top-level or inside message
      const m = msg.message || msg;
      const convId = msg.conversationId || m.conversationId || m.conversationId || m.conversation || null;
      console.debug('ws incoming message for conv:', convId, 'message:', m);
      // If the incoming message is not for the currently open conversation, mark it unread and update contacts list instead
      if (convId && currentConversation?.id !== convId){
        try {
          // find the contact item with that conversation id
          const it = document.querySelector(`.contact-item[data-conversation-id="${convId}"]`);
          if (it){
            const badge = it.querySelector('.unread-badge');
            if (badge){
              // increment numeric badge if possible
              const val = parseInt(badge.textContent||'0') || 0;
              badge.textContent = String(val + 1);
              // pulse to draw attention
              try{ badge.classList.add('pulse'); setTimeout(()=> badge.classList.remove('pulse'), 900); }catch(e){}
            } else {
              const meta = it.querySelector('.contact-meta');
              if (meta){
                const newBadge = document.createElement('div'); newBadge.className = 'unread-badge pulse'; newBadge.textContent = '1'; meta.appendChild(newBadge);
                setTimeout(()=> newBadge.classList.remove('pulse'), 900);
              }
            }
          }
        } catch(e){ console.warn('increment unread badge failed', e); }
        return;
      }
      // belongs to current conversation — append to view
      appendMessage(m);
      break;
    }
    case 'opened': // server responded to open request with conversation details
      if(msg.conversation){
        console.debug('ws opened conversation payload:', msg.conversation);
        currentConversation = {id: msg.conversation.id, withUserId: msg.conversation.withUserId, donationId: msg.conversation.donationId};
        // only override title if server provided an explicit name
        try {
          if (msg.conversation.name) document.getElementById('conv-title').textContent = msg.conversation.name;
        } catch(e){}
        // render conversation meta (user info) if available
        renderConversationMeta(msg.conversation);
        // clear unread badge for this conversation in contacts list
        try { const el = document.querySelector(`.contact-item[data-conversation-id="${currentConversation.id}"]`); if (el){ const b = el.querySelector('.unread-badge'); if (b) b.remove(); } } catch(e){}
        socket.send(JSON.stringify({type:'history', conversationId: currentConversation.id}));
      }
      break;
    default: console.log('ws unknown', msg);
  }
}

function renderConversationMeta(conv){
  console.debug('renderConversationMeta called with:', conv);
  const metaEl = document.getElementById('conv-meta');
  if (!metaEl) return;
  // conv may include name, withUserId, donationId, avatar, email
  const name = conv.name || conv.withUserName || '';
  const userId = conv.withUserId || '';
  const donationId = conv.donationId || '';
  const donationTitle = conv.donationTitle || conv.donationName || '';
  const email = conv.withUserEmail || conv.email || '';
  const avatar = conv.avatar || conv.withUserAvatar || '';
  // Only render meta when we have useful information to show.
  if (!avatar && !name && !userId && !donationId && !donationTitle && !email) {
    metaEl.innerHTML = '';
    return;
  }

  let html = '';
  if (avatar) html += `<div class="conv-avatar"><img src="${avatar}" alt="avatar"/></div>`;
  html += `<div class="conv-info">`;
  if (name) html += `<div class="conv-name">${escapeHtml(name)}</div>`;
  // show email in bold below the name (preferred) — if not available, do not show ID inline
  if (email) html += `<div class="conv-email"><strong>${escapeHtml(email)}</strong></div>`;
  if (donationTitle) html += `<div class="conv-donation">${escapeHtml(donationTitle)}</div>`;
  html += `</div>`;
  metaEl.innerHTML = html;
}

function ensureMetaFromMessage(m){
  const metaEl = document.getElementById('conv-meta');
  if (!metaEl) return;
  if (metaEl.innerHTML && metaEl.innerHTML.trim() !== '') return; // already set
  const name = m.fromName || m.fromDisplayName || '';
  const userId = m.from || '';
  if (!name && !userId) return;
  const conv = { name, withUserId: userId };
  renderConversationMeta(conv);
}

// Wait until socket becomes open or timeout (ms)
function waitForSocketOpen(timeoutMs){
  return new Promise((resolve) => {
    if (socket && socket.readyState === WebSocket.OPEN && socketAvailable) return resolve(true);
    let resolved = false;
    function onOpen(){ if (resolved) return; resolved = true; resolve(true); }
    function onEnd(){ if (resolved) return; resolved = true; resolve(false); }
    try {
      socket?.addEventListener('open', onOpen, {once:true});
    } catch(e){}
    setTimeout(()=>{ onEnd(); }, timeoutMs || 1000);
  });
}

// Try to create a conversation via HTTP POST to common endpoints. Returns conversation object or null.
async function createConversationHttp(userId, donationId){
  if (!userId) return null;
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type':'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const payload = { withUserId: userId, donationId };
  const endpoints = ['/conversations','/conversa','/conversation','/conversas'];
  for (let ep of endpoints){
    try {
      const url = (BACKEND_BASE_URL.replace(/\/+$/,'')) + ep;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) continue;
      const data = await res.json();
      return data;
    } catch(e){ console.warn('createConversationHttp failed for', ep, e); continue; }
  }
  return null;
}

function openConversationWith(userId, donationId, userName, donationTitle){
  // If socket is available and open, ask server to open or create a convo
  if (socket && socket.readyState === WebSocket.OPEN && socketAvailable){
    try {
      socket.send(JSON.stringify({type:'open', withUserId:userId, donationId}));
    } catch(e){ console.warn('ws open send failed', e); }
    if(location.pathname.split('/').pop() !== 'chat.html') location.href = 'chat.html';
    // set provisional title while waiting server response
    try { if (userName) document.getElementById('conv-title').textContent = userName; } catch(e){}
    // set provisional donation title in meta if available
    try { if (donationTitle) renderConversationMeta({ name: userName, donationTitle }); } catch(e){}
    return;
  }

  // No WS available: create a local conversation placeholder so the UI can open immediately
  const localId = 'local-' + (userId||'unknown') + '-' + Date.now();
  currentConversation = { id: localId, withUserId: userId, donationId };
  // if on chat page, render empty conversation UI
  if (location.pathname.split('/').pop() === 'chat.html'){
    try { document.getElementById('conv-title').textContent = userName || 'Conversa'; } catch(e){}
    renderMessages([]);
    return;
  }

  // not on chat page: store intent so chat page can open placeholder after navigation
  try { localStorage.setItem('chat_open_with', JSON.stringify({ userId, donationId, localFallback: true, conversationId: localId, userName, donationTitle })); } catch(e){}
  location.href = 'chat.html';
}

function sendMessage(text){
  if(!currentConversation) return;
  const payload = {type:'message', conversationId: currentConversation.id, text};
  socket.send(JSON.stringify(payload));
}

// UI rendering helpers (expecting chat.html structure)
function el(q){ return document.querySelector(q) }
function renderContacts(list){
  const wrap = el('#contacts-list'); if(!wrap) return;
  wrap.innerHTML = '';
  // helper to clear unread badge visually
  function clearUnreadForConversationId(id){
    try{
      const it = wrap.querySelector(`.contact-item[data-conversation-id="${id}"]`);
      if (!it) return;
      const badge = it.querySelector('.unread-badge');
      if (badge) badge.remove();
    }catch(e){/* ignore */}
  }
  list.forEach(c=>{
      const it = document.createElement('div'); it.className='contact-item'; it.dataset.conversationId = c.id; it.dataset.withUserId = c.withUserId || c.userId || c.with; 
      // apply deterministic background color to contact avatar
      const key = String(c.withUserId || c.id || c.name || '');
      const av = it.querySelector('.contact-avatar');
      if (av) av.style.background = colorForString(key);
    const unread = c.unreadCount? `<div class="unread-badge">${c.unreadCount}</div>` : '';
    const last = c.lastMessage ? escapeHtml(c.lastMessage) : '';
    const avatarText = (c.name||'').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
    it.innerHTML = `<div class="contact-avatar">${avatarText}</div><div class="contact-info"><div class="contact-name">${escapeHtml(c.name||'Contato')}</div><div class="contact-last">${last}</div></div><div class="contact-meta">${unread}</div>`;
    // now set avatar background color based on user key
    try { const avAfter = it.querySelector('.contact-avatar'); if (avAfter) avAfter.style.background = colorForString(String(c.withUserId || c.id || c.name || '')); } catch(e){}
    it.addEventListener('click', ()=>{
      currentConversation = {id:c.id, withUserId: it.dataset.withUserId, donationId:c.donationId};
      document.getElementById('conv-title').textContent = c.name || 'Conversa';
      // visually clear unread badge for this conversation
      clearUnreadForConversationId(c.id);
      // optionally notify server that we've read this conversation
      try { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'read', conversationId: c.id })); } catch(e){}
      // request history
      try { socket.send(JSON.stringify({type:'history', conversationId:c.id})); } catch(e){}
    });
    wrap.appendChild(it);
    // animate contact entry
    try{ it.classList.add('enter'); setTimeout(()=> it.classList.remove('enter'), 380); }catch(e){}
  })

  // wire search input
  const search = el('#contacts-search');
  if(search){
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      Array.from(wrap.children).forEach(ch => {
        const name = ch.querySelector('.contact-name')?.textContent?.toLowerCase() || '';
        ch.style.display = (!q || name.includes(q)) ? '' : 'none';
      });
    }
  }
}

function renderMessages(msgs){
  const wrap = el('#messages'); if(!wrap) return; wrap.innerHTML='';
  if(!msgs || !msgs.length){ wrap.innerHTML = `<div class="no-conversation">Sem mensagens nesta conversa.</div>`; return; }
  // Ensure messages are ordered oldest -> newest so the latest message
  // is rendered last and visible when we scroll to the bottom.
  try {
    msgs = msgs.slice().sort((a,b)=>{
      const ta = a.ts || a.createdAt || a.date || 0;
      const tb = b.ts || b.createdAt || b.date || 0;
      const na = (typeof ta === 'string') ? Date.parse(ta) : (ta || 0);
      const nb = (typeof tb === 'string') ? Date.parse(tb) : (tb || 0);
      return (na || 0) - (nb || 0);
    });
  } catch(e){ /* if sorting fails, fall back to provided order */ }

  msgs.forEach(m=> appendMessage(m));
  wrap.scrollTop = wrap.scrollHeight;
}

function appendMessage(m){
  const wrap = el('#messages'); if(!wrap) return;
  // ensure conv meta shows who we're talking to when messages arrive
  ensureMetaFromMessage(m);
  // Prevent duplicate rendering: compute a stable key and skip if already present
  try {
    const keyRaw = m.id ? String(m.id) : `${m.from||''}|${m.ts||''}|${(m.text||'').slice(0,200)}`;
    const key = encodeURIComponent(keyRaw);
    if (wrap.querySelector(`[data-msg-key="${key}"]`)) return; // already rendered
  } catch(e) { /* ignore and continue */ }
  const fromMe = (typeof m.fromMe !== 'undefined') ? m.fromMe : (m.from === currentUserId || m.from === String(currentUserId));
  const row = document.createElement('div'); row.className = 'msg-wrap';
  try { if (m.id) row.dataset.msgKey = encodeURIComponent(String(m.id)); else row.dataset.msgKey = encodeURIComponent(`${m.from||''}|${m.ts||''}|${(m.text||'').slice(0,200)}`); } catch(e){}
  const initials = (m.fromName||'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
  const avatarHtml = `<div class="msg-avatar">${initials}</div>`;
  const msgDiv = document.createElement('div'); msgDiv.className = 'msg ' + (fromMe? 'me':'incoming');
  const textHtml = `<div class="text">${escapeHtml(m.text)}</div><span class="time">${formatTime(m.ts)}</span>`;
  msgDiv.innerHTML = textHtml;
  if(fromMe){ row.appendChild(msgDiv); }
  else {
    // create avatar element so we can apply color
    const avDiv = document.createElement('div'); avDiv.className = 'msg-avatar'; avDiv.textContent = initials;
    try{ avDiv.style.background = colorForString(String(m.from || m.fromName || initials)); }catch(e){}
    row.appendChild(avDiv);
    row.appendChild(msgDiv);
  }
  wrap.appendChild(row);
  // animate message entry
  try { row.classList.add('msg-enter'); setTimeout(()=> row.classList.remove('msg-enter'), 380); } catch(e){}
  wrap.scrollTop = wrap.scrollHeight;
}

function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function formatTime(ts){ try{ const d = ts ? new Date(ts) : new Date(); return d.toLocaleString(); }catch(e){ return '' } }

document.addEventListener('DOMContentLoaded', ()=>{
  // ensure page doesn't show global scrollbars: measure header and set #container height
  try{
    const header = document.getElementById('header');
    const cont = document.getElementById('container');
    if (header && cont){
      const h = header.offsetHeight || 0;
      // expose CSS var for container height calc if needed
      document.documentElement.style.setProperty('--header-height', h + 'px');
      cont.style.height = `calc(100vh - ${h}px)`;
      cont.style.margin = '0 auto';
      cont.style.overflow = 'hidden';
    }
  }catch(e){}
  // If page was opened with intent to chat, show the userName immediately
  try {
    const pendingQuick = localStorage.getItem('chat_open_with');
    if (pendingQuick){
      const pq = JSON.parse(pendingQuick);
      console.debug('DOMContentLoaded found chat_open_with:', pq);
      if (pq && pq.userName){
        try { document.getElementById('conv-title').textContent = pq.userName; } catch(e){}
      }
      // also set donation meta immediately when available so the donation title appears below the name
      try { if (pq && pq.donationTitle) renderConversationMeta({ name: pq.userName, donationTitle: pq.donationTitle }); } catch(e){}
    }
  } catch(e){}

  connectSocket();
  // Recompute container height on window resize to remain responsive
  try{ window.addEventListener('resize', ()=>{
    const header = document.getElementById('header');
    const cont = document.getElementById('container');
    if (header && cont){ const h = header.offsetHeight || 0; cont.style.height = `calc(100vh - ${h}px)`; document.documentElement.style.setProperty('--header-height', h + 'px'); }
  }); }catch(e){}
  // If another page requested to open a conversation, process it now (WS -> HTTP -> local fallback)
  (async function(){
    try {
      const pending = localStorage.getItem('chat_open_with');
      if (!pending) return;
      const p = JSON.parse(pending);
      if (!p) { localStorage.removeItem('chat_open_with'); return; }

      // restore earlier placeholder immediately
      if (p.localFallback && p.conversationId){
        currentConversation = { id: p.conversationId, withUserId: p.userId, donationId: p.donationId };
        try { document.getElementById('conv-title').textContent = p.userName || 'Conversa'; } catch(e){}
        try { if (p.donationTitle) renderConversationMeta({ name: p.userName, donationTitle: p.donationTitle }); } catch(e){}
        renderMessages([]);
        localStorage.removeItem('chat_open_with');
        return;
      }

      // wait briefly for websocket to become available
      const opened = await waitForSocketOpen(1500);
      if (opened && socketAvailable){
        openConversationWith(p.userId, p.donationId, p.userName, p.donationTitle);
        localStorage.removeItem('chat_open_with');
        return;
      }

      // try HTTP fallback to create conversation server-side
      const conv = await createConversationHttp(p.userId, p.donationId);
      if (conv && (conv.id || conv.conversationId || conv._id)){
        const cid = conv.id || conv.conversationId || conv._id;
        currentConversation = { id: cid, withUserId: conv.withUserId || p.userId, donationId: conv.donationId || p.donationId };
        try { document.getElementById('conv-title').textContent = conv.name || p.userName || 'Conversa'; } catch(e){}
        try { renderConversationMeta(Object.assign({}, conv, { donationTitle: conv.donationTitle || p.donationTitle })); } catch(e){}
        renderMessages([]);
        localStorage.removeItem('chat_open_with');
        return;
      }

      // last resort: local placeholder
      const localId = 'local-' + (p.userId||'unknown') + '-' + Date.now();
      currentConversation = { id: localId, withUserId: p.userId, donationId: p.donationId };
      try { document.getElementById('conv-title').textContent = p.userName || 'Conversa'; } catch(e){}
      try { if (p.donationTitle) renderConversationMeta({ name: p.userName, donationTitle: p.donationTitle }); } catch(e){}
      renderMessages([]);
      localStorage.removeItem('chat_open_with');
    } catch(e){ console.warn('chat open pending parse failed', e); }
  })();
  const form = document.getElementById('message-form'); if(form){
    form.addEventListener('submit', e=>{
      e.preventDefault(); const input = document.getElementById('message-input'); if(!input||!input.value) return; sendMessage(input.value); input.value='';
    })
  }
  // initial placeholder
  const msgs = el('#messages'); if(msgs) msgs.innerHTML = `<div class="no-conversation">Selecione uma conversa para começar a enviar mensagens.</div>`;
});

// Expose helper to be called from other pages
window.chatOpenWith = function(userId, donationId, userName, donationTitle){
  // If we're not on chat page, store request and navigate so the chat page can open it after socket connects
  if (location.pathname.split('/').pop() !== 'chat.html'){
    try { localStorage.setItem('chat_open_with', JSON.stringify({userId, donationId, userName, donationTitle})); } catch(e){}
    location.href = 'chat.html';
    return;
  }
  openConversationWith(userId, donationId, userName, donationTitle);
}

// logout functionality
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = './login.html';
        });
    }
});