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
        alert(error.message);
    }
});