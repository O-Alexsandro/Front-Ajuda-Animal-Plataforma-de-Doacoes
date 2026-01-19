function ensurePopupContainer() {
    let container = document.getElementById('popup-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'popup-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none'
        });
        document.body.appendChild(container);
    }
    return container;
}

function showPopup(message, type = 'info', timeout = 4000) {
    const container = ensurePopupContainer();
    const box = document.createElement('div');
    box.className = 'popup-message ' + type;
    Object.assign(box.style, {
        pointerEvents: 'auto',
        minWidth: '260px',
        maxWidth: '360px',
        padding: '12px 14px',
        borderRadius: '8px',
        color: '#fff',
        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        opacity: '0',
        transform: 'translateY(-6px)',
        transition: 'opacity 220ms ease, transform 220ms ease',
        fontFamily: 'sans-serif',
        fontSize: '14px'
    });

    if (type === 'success') box.style.background = '#2e7d32';
    else if (type === 'error') box.style.background = '#c62828';
    else box.style.background = '#1565c0';

    box.textContent = message;
    container.appendChild(box);

    requestAnimationFrame(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });

    const remove = () => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(-6px)';
        setTimeout(() => { try { container.removeChild(box); } catch(e){} }, 260);
    };

    const timer = setTimeout(remove, timeout);
    box.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

const formLogin = document.getElementById('form-login');

formLogin.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const senha = document.getElementById('password').value;

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                senha: senha
            })
        });

        if (!response.ok) {
            throw new Error('Usuário ou senha inválidos');
        }

        const data = await response.json();

        // supondo que o backend retorne algo como:
        // { token: "eyJhbGciOi..." }
        localStorage.setItem('token', data.token);

        // extract id from token if present and cache it for convenience
        try{
            const parseJwt = (token) => {
                const parts = (token||'').split('.'); if (parts.length < 2) return null;
                const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
                return JSON.parse(atob(padded));
            };
            const payload = parseJwt(data.token);
            if (payload){
                // prefer numeric 'sub' when the backend sets it to the user id
                if (payload.sub && /^\d+$/.test(String(payload.sub))){
                    localStorage.setItem('userId', String(payload.sub));
                } else {
                    let idClaim = payload.USER_ID || payload.user_id || payload.id || payload.userId || payload._id || payload.codigo || payload.email || payload.usuario || payload.sub;
                    if (idClaim){
                        if (String(idClaim).includes('@')){
                            // backend should set numeric id in token 'sub' or 'id' claims; do not perform email lookups here
                            console.warn('login: token contains email as id claim; backend should include numeric id in token sub or id claims');
                        } else {
                            // non-email id-like claim - store it
                            if (/^\d+$/.test(String(idClaim))){
                                localStorage.setItem('userId', String(idClaim));
                            } else {
                                console.warn('login: id-like claim present but not numeric, ignoring:', idClaim);
                            }
                        }
                    }
                }
            }
        }catch(e){ console.warn('Could not parse token after login', e); }

        // redireciona após login
        window.location.href = './homepage.html';

    } catch (error) {
        showPopup(error.message || 'Erro no login', 'error');
    }
});