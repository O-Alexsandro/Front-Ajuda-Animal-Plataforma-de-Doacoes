// Base REST URL used by frontend. Keep in sync with your backend.
var BACKEND_BASE_URL = 'http://localhost:8080';

// Derive a default WebSocket URL from BACKEND_BASE_URL. You can still override
// this at runtime by setting `window.BACKEND_WS_URL` before other scripts run.
try{
	const u = new URL(BACKEND_BASE_URL);
	window.BACKEND_WS_URL = (u.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + u.host + '/ws/chat';
}catch(e){
	window.BACKEND_WS_URL = 'ws://localhost:8080/ws/chat';
}