(function(){
    function $(sel){ return document.querySelector(sel); }

    function showToast(msg){
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(()=>{ t.remove(); }, 2400);
    }

    function parseJwt(token){
        try{
            const parts = String(token || '').split('.');
            if (parts.length < 2) return null;
            const payload = parts[1];
            // base64url to base64
            const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
            const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
            const json = atob(padded);
            return JSON.parse(json);
        }catch(e){ console.warn('parseJwt error', e); return null; }
    }

    async function resolveUserId(){
        try{
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token){
                const payload = parseJwt(token);
                if (payload){
                    if (payload.sub && /^\d+$/.test(String(payload.sub))){
                        const id = String(payload.sub);
                        localStorage.setItem('userId', id);
                        console.log('resolveUserId: using numeric sub from token', id);
                        return id;
                    }

                    const rawId = payload.USER_ID || payload.user_id || payload.id || payload.userId || payload.usuarioId || payload._id || payload.codigo || null;
                    if (rawId && /^\d+$/.test(String(rawId))){
                        localStorage.setItem('userId', String(rawId));
                        console.log('resolveUserId: using numeric id claim from token', rawId);
                        return String(rawId);
                    }
                }
            }

            let id = localStorage.getItem('userId') || sessionStorage.getItem('userId');
            if (id) return String(id);

            const raw = localStorage.getItem('profileData');
            if (raw){ try{ const p = JSON.parse(raw); id = p && (p.id || p._id || p.codigo); if (id) return String(id); }catch(e){ console.warn('parse profileData failed', e); } }
            const params = new URLSearchParams(window.location.search); id = params.get('id');
            if (id) return String(id);

            console.warn('resolveUserId: id not found');
            return null;
        }catch(e){ console.warn('resolveUserId', e); return null; }
    }

    async function fetchUser(id){
        try{
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const headers = { 'Accept': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;
            const res = await fetch(`${BACKEND_BASE_URL}/usuarios/${id}`, { headers });
            if (res.status === 401 || res.status === 403){ showToast('Sessão inválida. Faça login novamente.'); return null; }
            if (!res.ok) throw new Error('fetch error: ' + res.status);
            const data = await res.json();
            return (data && (data.data || data.usuario || data)) || null;
        }catch(e){ console.warn('Could not fetch user', e); return null; }
    }

    function applyPlaceholders(payload){
        if (!payload) return;
        const set = (id, val) => { const el = $("#"+id); if (!el) return; el.placeholder = val || ''; el.value = ''; };
        set('nome', payload.nome || payload.name || payload.fullName);
        set('email', payload.email || payload.usuarioEmail || '');
        const hasPassword = Boolean(payload.senha || payload.password || payload.pass);
        set('senha', hasPassword ? '••••••' : '');
        set('telefone', payload.telefone || payload.phone || '');
        set('rua', payload.rua || payload.street || '');
        set('cidade', payload.cidade || payload.city || '');
        set('estado', payload.estado || payload.state || '');
    }

    function valueOrPlaceholder(id){ const el = document.getElementById(id); if (!el) return ''; const v = el.value && el.value.trim(); return v ? v : (el.placeholder || ''); }

    document.addEventListener('DOMContentLoaded', async function(){
        try{
            const form = $('#profile-form');
            const id = await resolveUserId();
            console.log('Profile page for user id (resolved):', id);
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token){
                console.log('Found auth token, jwt payload:', parseJwt(token));
            } else {
                console.warn('No auth token found in storage');
            }
            if (id){
                const user = await fetchUser(id);
                if (user) applyPlaceholders(user);
                else {
                    const raw = localStorage.getItem('profileData');
                    if (raw){ try{ applyPlaceholders(JSON.parse(raw)); }catch(e){} }
                }
            } else {
                const raw = localStorage.getItem('profileData');
                if (raw){ try{ applyPlaceholders(JSON.parse(raw)); }catch(e){} }
            }

            if (form){
                form.addEventListener('submit', async function(ev){
                    ev.preventDefault();
                    try{
                        const uid = await resolveUserId();
                        if (!uid){ showToast('User id not found. Open page with ?id=<id> or log in'); return; }
                        const payload = {
                            id: uid,
                            nome: valueOrPlaceholder('nome'),
                            email: valueOrPlaceholder('email'),
                            telefone: valueOrPlaceholder('telefone'),
                            rua: valueOrPlaceholder('rua'),
                            cidade: valueOrPlaceholder('cidade'),
                            estado: valueOrPlaceholder('estado')
                        };
                        const senhaInput = document.getElementById('senha');
                        if (senhaInput && senhaInput.value.trim()) payload.senha = senhaInput.value.trim();

                        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                        const headers = { 'Content-Type': 'application/json' };
                        if (token) headers['Authorization'] = 'Bearer ' + token;
                        const res = await fetch(`${BACKEND_BASE_URL}/usuarios`, {
                            method: 'PUT',
                            headers,
                            body: JSON.stringify(payload)
                        });
                        if (res.status === 401 || res.status === 403){ showToast('Sessão inválida. Faça login novamente.'); return; }
                        if (!res.ok){ const txt = await res.text(); throw new Error('Status '+res.status+' '+txt); }
                        const updated = await res.json();
                        showToast('Perfil atualizado com sucesso');
                        try{ applyPlaceholders(updated); }catch(e){ console.warn('applyPlaceholders failed', e); }
                    }catch(err){ console.error('Profile save failed', err); showToast('Erro ao atualizar perfil'); }
                });
            }
        }catch(err){ console.error('Profile init failed', err); showToast('Erro ao carregar perfil'); }
    });

})();