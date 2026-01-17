const BACKEND_WS = (function(){
  try{ const u = new URL(BACKEND_BASE_URL); return (u.protocol==='https:'?'wss:':'ws:') + '//' + u.host + '/ws/chat'; }catch(e){ return 'ws://localhost:8080/ws/chat' }
})();

let socket = null;
let currentConversation = null; // {id, withUserId, donationId}
const currentUserId = localStorage.getItem('userId') || null;

function connectSocket(){
  if(socket && socket.readyState===WebSocket.OPEN) return socket;
  const token = localStorage.getItem('token');
  socket = new WebSocket(BACKEND_WS + (token?`?token=${token}`:''));

  socket.addEventListener('open', ()=>{
    console.log('chat socket open')
    // request conversations list
    socket.send(JSON.stringify({type:'list'}));
  });

  socket.addEventListener('message', ev=>{
    try{ const data = JSON.parse(ev.data); handleSocketMessage(data); }catch(e){ console.warn('bad ws msg', ev.data) }
  });

  socket.addEventListener('close', ()=>console.log('chat socket closed'));
  socket.addEventListener('error', e=>console.error('chat socket error', e));
  return socket;
}

function handleSocketMessage(msg){
  switch(msg.type){
    case 'list': renderContacts(msg.conversations||[]); break;
    case 'history': if(msg.conversationId===currentConversation?.id) renderMessages(msg.messages||[]); break;
    case 'message': appendMessage(msg.message); break;
    case 'opened': // server responded to open request with conversation details
      if(msg.conversation){
        currentConversation = {id: msg.conversation.id, withUserId: msg.conversation.withUserId, donationId: msg.conversation.donationId};
        document.getElementById('conv-title').textContent = msg.conversation.name || 'Conversa';
        socket.send(JSON.stringify({type:'history', conversationId: currentConversation.id}));
      }
      break;
    default: console.log('ws unknown', msg);
  }
}

function openConversationWith(userId, donationId){
  connectSocket();
  // ask server to open or create a convo
  socket.send(JSON.stringify({type:'open', withUserId:userId, donationId}));
  // navigate to chat page if not already there
  if(location.pathname.split('/').pop() !== 'chat.html') location.href = 'chat.html';
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
  list.forEach(c=>{
    const it = document.createElement('div'); it.className='contact-item'; it.dataset.conversationId = c.id; it.dataset.withUserId = c.withUserId || c.userId || c.with;
    const unread = c.unreadCount? `<div class="unread-badge">${c.unreadCount}</div>` : '';
    const last = c.lastMessage ? escapeHtml(c.lastMessage) : '';
    const avatarText = (c.name||'').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
    it.innerHTML = `<div class="contact-avatar">${avatarText}</div><div class="contact-info"><div class="contact-name">${escapeHtml(c.name||'Contato')}</div><div class="contact-last">${last}</div></div><div class="contact-meta">${unread}</div>`;
    it.addEventListener('click', ()=>{
      currentConversation = {id:c.id, withUserId: it.dataset.withUserId, donationId:c.donationId};
      document.getElementById('conv-title').textContent = c.name || 'Conversa';
      // request history
      socket.send(JSON.stringify({type:'history', conversationId:c.id}));
    });
    wrap.appendChild(it);
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
  msgs.forEach(m=> appendMessage(m));
  wrap.scrollTop = wrap.scrollHeight;
}

function appendMessage(m){
  const wrap = el('#messages'); if(!wrap) return;
  const fromMe = (typeof m.fromMe !== 'undefined') ? m.fromMe : (m.from === currentUserId || m.from === String(currentUserId));
  const row = document.createElement('div'); row.className = 'msg-wrap';
  const avatarHtml = `<div class="msg-avatar">${(m.fromName||'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div>`;
  const msgDiv = document.createElement('div'); msgDiv.className = 'msg ' + (fromMe? 'me':'incoming');
  const textHtml = `<div class="text">${escapeHtml(m.text)}</div><span class="time">${formatTime(m.ts)}</span>`;
  msgDiv.innerHTML = textHtml;
  if(fromMe){ row.appendChild(msgDiv); }
  else { row.appendChild(document.createElement('div')); row.querySelector('div').outerHTML = avatarHtml; row.appendChild(msgDiv); }
  wrap.appendChild(row);
  wrap.scrollTop = wrap.scrollHeight;
}

function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function formatTime(ts){ try{ const d = ts ? new Date(ts) : new Date(); return d.toLocaleString(); }catch(e){ return '' } }

document.addEventListener('DOMContentLoaded', ()=>{
  connectSocket();
  const form = document.getElementById('message-form'); if(form){
    form.addEventListener('submit', e=>{
      e.preventDefault(); const input = document.getElementById('message-input'); if(!input||!input.value) return; sendMessage(input.value); input.value='';
    })
  }
  // initial placeholder
  const msgs = el('#messages'); if(msgs) msgs.innerHTML = `<div class="no-conversation">Selecione uma conversa para começar a enviar mensagens.</div>`;
});

// Expose helper to be called from other pages
window.chatOpenWith = function(userId, donationId){ openConversationWith(userId, donationId); }

// Demo helpers: populate UI with fake data when no backend available
function runChatDemo(){
  const demoConvos = [
    { id: 'demo-1', withUserId: 'u100', name: 'Mariana Silva', lastMessage: 'Perfeito, eu passo aí amanhã', unreadCount: 2, donationId: 'd1' },
    { id: 'demo-2', withUserId: 'u101', name: 'Carlos Pereira', lastMessage: 'Tem como enviar hoje?', unreadCount: 0, donationId: 'd2' }
  ];
  renderContacts(demoConvos);
  // open first conversation
  currentConversation = { id: demoConvos[0].id, withUserId: demoConvos[0].withUserId, donationId: demoConvos[0].donationId };
  document.getElementById('conv-title').textContent = demoConvos[0].name;
  const demoMessages = [
    { from: demoConvos[0].withUserId, fromName: demoConvos[0].name, text: 'Olá! Ainda precisa da doação?', ts: Date.now() - 1000*60*60*4 },
    { from: currentUserId || 'me', fromName: 'Você', text: 'Sim, por favor. Posso buscar amanhã?', ts: Date.now() - 1000*60*60*3, fromMe: true },
    { from: demoConvos[0].withUserId, fromName: demoConvos[0].name, text: 'Perfeito, que horas?', ts: Date.now() - 1000*60*30 },
    { from: currentUserId || 'me', fromName: 'Você', text: 'Posso às 18h.', ts: Date.now() - 1000*60*20, fromMe: true }
  ];
  renderMessages(demoMessages);
}

// If after a short delay no contacts were loaded (no backend), show demo
setTimeout(()=>{
  const wrap = el('#contacts-list');
  if (!wrap) return;
  if (wrap.children.length === 0) {
    runChatDemo();
  }
}, 600);

// expose demo trigger
window.chatDemo = runChatDemo;
