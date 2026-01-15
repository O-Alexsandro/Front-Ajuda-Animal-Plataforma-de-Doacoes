// detalhe-doacao.js
(function(){
    function qs(name){
        const u = new URL(window.location.href);
        return u.searchParams.get(name);
    }

    function base64ToDataUrl(b64){
        if (!b64) return null;
        if (/^data:/i.test(b64)) return b64;
        const clean = String(b64).trim();
        if (/^iVBOR/.test(clean)) return 'data:image/png;base64,' + clean;
        if (clean.startsWith('/9j/')) return 'data:image/jpeg;base64,' + clean;
        if (/^R0lGOD/.test(clean)) return 'data:image/gif;base64,' + clean;
        return 'data:image/png;base64,' + clean;
    }

    function resolveImage(src){
        if (!src) return null;
        if (/^data:/i.test(src)) return src;
        if (/^https?:\/\//i.test(src)) return src;
        if (/^[A-Za-z0-9+/=\s]+$/.test(src) && src.length > 100) return base64ToDataUrl(src);
        const base = (window.BACKEND_BASE_URL || '').replace(/\/+$/,'');
        if (!base) return src;
        if (src.startsWith('/')) return base + src;
        return base + '/' + src;
    }

    function el(id){ return document.getElementById(id); }
    let currentId = null;

    function getUserIdFromToken(){
        try {
            // prefer cached numeric userId set at login
            const cached = localStorage.getItem('userId');
            if (cached && String(cached).trim()) return Number(cached);
            let token = localStorage.getItem('token');
            if (!token) return null;
            // strip possible 'Bearer ' prefix
            if (token.toLowerCase().startsWith('bearer ')) token = token.slice(7).trim();
            const parts = token.split('.');
            if (parts.length < 2) return null;
            const payload = parts[1];
            const b64 = payload.replace(/-/g,'+').replace(/_/g,'/');
            const pad = b64.length % 4;
            const padded = b64 + (pad ? '='.repeat(4 - pad) : '');
            const json = atob(padded);
            const obj = JSON.parse(json);
            return obj.id ?? obj.userId ?? obj.usuarioId ?? obj.sub ?? null;
        } catch (err){
            return null;
        }
    }

    async function loadDetail(id){
        currentId = id;
        if (!id) return showError('ID da doação ausente.');
        try {
            const res = await fetch(`${BACKEND_BASE_URL}/doacoes/id/${encodeURIComponent(id)}`);
            if (!res.ok) throw new Error('Falha ao buscar doação: ' + res.status);
            const d = await res.json();
            render(d);
        } catch (err){
            showError(err.message);
        }
    }

    function showError(msg){
        const container = el('detail-title');
        if (container) container.textContent = 'Erro: ' + msg;
    }

    function render(d){
        // image
        const imgWrap = el('detail-image');
        imgWrap.innerHTML = '';
        const imgSrc = resolveImage(d.imagem || d.images || (d.imagens && d.imagens[0]));
        if (imgSrc) {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.alt = d.titulo || 'Imagem';
            img.className = 'detail-main-img';
            imgWrap.appendChild(img);
        }

        el('detail-title').textContent = d.titulo || d.title || 'Sem título';
        el('detail-desc').textContent = d.descricao || d.description || '';

        const meta = [];
        if (d.categoria) meta.push(d.categoria);
        if (d.cidade) meta.push(d.cidade);
        if (d.estado) meta.push(d.estado);
        el('detail-meta').textContent = meta.join(' • ');

        // show donor name if provided. handle possible nested structures
        const donorName = (function(){
            if (!d) return '';
            if (typeof d.nome === 'string' && d.nome.trim()) return d.nome;
            if (typeof d.proprietario === 'string' && d.proprietario.trim()) return d.proprietario;
            if (typeof d.ong === 'string' && d.ong.trim()) return d.ong;
            if (typeof d.owner === 'string' && d.owner.trim()) return d.owner;
            // nested object cases
            if (d.proprietario && typeof d.proprietario === 'object'){
                if (d.proprietario.nome) return d.proprietario.nome;
                if (d.proprietario.name) return d.proprietario.name;
            }
            if (d.ong && typeof d.ong === 'object'){
                if (d.ong.nome) return d.ong.nome;
                if (d.ong.name) return d.ong.name;
            }
            if (d.usuario && typeof d.usuario === 'object'){
                if (d.usuario.nome) return d.usuario.nome;
                if (d.usuario.name) return d.usuario.name;
            }
            return '';
        })();
        el('detail-owner').textContent = donorName || '';

        const interestBox = el('interest-box');
        interestBox.innerHTML = '';
        if (d.interesseMsg) {
            const p = document.createElement('div');
            p.className = 'interest-note';
            p.textContent = d.interesseMsg;
            interestBox.appendChild(p);
        } else {
            const token = localStorage.getItem('token');
            if (!token) {
                const a = document.createElement('a');
                a.href = 'login.html';
                a.textContent = 'Faça login para manifestar interesse';
                interestBox.appendChild(a);
            } else {
                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.textContent = 'Tenho interesse';
                btn.disabled = false;
                btn.onclick = async () => {
                    try {
                        btn.disabled = true;
                        btn.textContent = 'Enviando...';
                        const usuarioId = getUserIdFromToken();
                        if (!usuarioId) throw new Error('Usuário não identificado no token.');
                        const doacaoId = currentId || d.id || d._id || d.codigo || d.idDoacao || null;
                        if (!doacaoId) throw new Error('ID da doação ausente.');
                        const payload = { usuarioId: Number(usuarioId), doacaoId: Number(doacaoId) };
                        const headers = { 'Content-Type': 'application/json' };
                        if (token) headers['Authorization'] = 'Bearer ' + token;
                        const res = await fetch(`${BACKEND_BASE_URL}/interesse`, { method: 'POST', headers, body: JSON.stringify(payload) });
                        if (!res.ok) {
                            const txt = await res.text().catch(()=>null);
                            throw new Error('Falha ao enviar interesse: ' + res.status + (txt?(' - '+txt):''));
                        }
                        interestBox.innerHTML = '';
                        const ok = document.createElement('div');
                        ok.className = 'interest-note';
                        ok.textContent = 'Interesse registrado. O responsável entrará em contato em breve.';
                        interestBox.appendChild(ok);
                    } catch (err) {
                        alert(err.message || 'Erro ao registrar interesse');
                        btn.disabled = false;
                        btn.textContent = 'Tenho interesse';
                    }
                };
                interestBox.appendChild(btn);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const id = qs('id');
        loadDetail(id);
    });
})();
