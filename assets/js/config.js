// Base REST URL used by frontend. Keep in sync with your backend.
var BACKEND_BASE_URL = 'http://localhost:8080';

// Explicit WS URL for chat. Set to your backend WebSocket endpoint (no token).
// If you prefer, override at runtime with `window.BACKEND_WS_URL = 'wss://...'` or
// by setting localStorage.setItem('BACKEND_WS_URL', 'wss://...')
window.BACKEND_WS_URL = 'ws://localhost:8080/ws/chat';