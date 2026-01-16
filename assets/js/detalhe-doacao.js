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
        // image — update or create image element only, keep overlays (back button, badges)
        const imgWrap = el('detail-image');
        const imgSrc = resolveImage(d.imagem || d.images || (d.imagens && d.imagens[0]));
        const existingImg = imgWrap ? imgWrap.querySelector('.detail-main-img') : null;
        if (imgSrc) {
            if (existingImg) {
                if (existingImg.src !== imgSrc) existingImg.src = imgSrc;
                existingImg.alt = d.titulo || 'Imagem';
            } else if (imgWrap) {
                const img = document.createElement('img');
                img.src = imgSrc;
                img.alt = d.titulo || 'Imagem';
                img.className = 'detail-main-img';
                imgWrap.appendChild(img);
            }
        } else {
            if (existingImg) existingImg.remove();
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
        // populate owner name/email/avatar into new owner card
        const ownerNameEl = el('detail-owner-name');
        const ownerEmailEl = el('detail-owner-email');
        const ownerAvatarEl = el('owner-avatar');
        if (ownerNameEl) ownerNameEl.textContent = donorName || '';
        // try to find an email in possible fields
        const donorEmail = (function(){
            if (!d) return '';
            if (d.email) return d.email;
            if (d.usuario && (d.usuario.email || d.usuario.usuarioEmail)) return d.usuario.email || d.usuario.usuarioEmail;
            if (d.proprietario && d.proprietario.email) return d.proprietario.email;
            if (d.ong && d.ong.email) return d.ong.email;
            if (d.ownerEmail) return d.ownerEmail;
            return '';
        })();
        if (ownerEmailEl) ownerEmailEl.textContent = donorEmail || '';
        // avatar: use available image or initials
        if (ownerAvatarEl){
            let avatarSrc = null;
            if (d.usuario && (d.usuario.avatar || d.usuario.foto)) avatarSrc = d.usuario.avatar || d.usuario.foto;
            if (d.foto || d.avatar) avatarSrc = avatarSrc || d.foto || d.avatar;
            if (avatarSrc) {
                const url = resolveImage(avatarSrc);
                ownerAvatarEl.style.backgroundImage = `url('${url}')`;
                ownerAvatarEl.style.backgroundSize = 'cover';
                ownerAvatarEl.textContent = '';
            } else {
                // initials
                const parts = (donorName||'').split(' ').filter(Boolean);
                const initials = (parts[0]?parts[0][0]:'') + (parts[1]?parts[1][0]:'');
                ownerAvatarEl.textContent = (initials||'A').toUpperCase();
            }
        }

        // category badge
        const catBadge = el('cat-badge');
        if (catBadge){ if (d.categoria) { catBadge.textContent = d.categoria; catBadge.style.display='inline-block'; } else { catBadge.style.display='none'; }}

        // tags under description (cidade, categoria)
        const tagList = el('tag-list');
        if (tagList){
            tagList.innerHTML = '';
            const items = [];
            if (d.cidade) items.push({ type: 'location', text: d.cidade });
            if (d.categoria) items.push({ type: 'category', text: d.categoria });
            items.forEach(it=>{
                const s = document.createElement('span');
                s.className = 'tag-pill ' + (it.type==='location'? 'location':'category');
                const icon = document.createElement('span'); icon.className='icon';
                icon.textContent = it.type==='location'? '📍' : '📦';
                s.appendChild(icon);
                const txt = document.createElement('span'); txt.textContent = it.text;
                s.appendChild(txt);
                tagList.appendChild(s);
            });
        }

        const interestBox = el('interest-box');
        interestBox.innerHTML = '';
        // determine if current user is owner (kept for potential future use)
        function getOwnerId(obj){
            if (!obj) return null;
            if (obj.usuario && (obj.usuario.id || obj.usuario._id)) return obj.usuario.id || obj.usuario._id;
            if (obj.proprietario && (obj.proprietario.id || obj.proprietario._id)) return obj.proprietario.id || obj.proprietario._id;
            if (obj.ownerId) return obj.ownerId;
            if (obj.usuarioId) return obj.usuarioId;
            if (obj.owner) return obj.owner;
            return null;
        }
        const ownerId = getOwnerId(d);
        const currentUserId = getUserIdFromToken();

        if (d.interesseMsg) {
            const p = document.createElement('div');
            p.className = 'interest-note';
            p.textContent = d.interesseMsg;
            interestBox.appendChild(p);
        } else {
            // Always show the "Se interessou?" card to visitors (including owners when logged in)
            const token = localStorage.getItem('token');
            if (!token) {
                const a = document.createElement('a');
                a.href = 'login.html';
                a.textContent = 'Faça login para manifestar interesse';
                interestBox.appendChild(a);
            } else {
                // build a small card with title, description and the interest button
                const wrapper = document.createElement('div');
                wrapper.className = 'interest-card';

                const header = document.createElement('div');
                header.className = 'interest-title';
                header.textContent = 'Se interessou?';

                const desc = document.createElement('div');
                desc.className = 'interest-desc';
                desc.textContent = 'Clique no botão abaixo para notificar seu interesse';

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
                            const already = (res.status === 403) || (txt && /interess/i.test(txt)) || (txt && /already/i.test(txt));
                            if (already) {
                                wrapper.innerHTML = '';
                                const note = document.createElement('div');
                                note.className = 'interest-note';
                                const contactName = donorName || 'responsável';
                                note.textContent = `Você já manifestou interesse nesta doação. Aguarde o ${contactName} a entrar em contato.`;
                                wrapper.appendChild(note);
                                return;
                            }
                            throw new Error('Falha ao enviar interesse: ' + res.status + (txt?(' - '+txt):''));
                        }
                        wrapper.innerHTML = '';
                        const ok = document.createElement('div');
                        ok.className = 'interest-note';
                        ok.textContent = 'Interesse registrado. O responsável entrará em contato em breve.';
                        wrapper.appendChild(ok);
                    } catch (err) {
                        alert(err.message || 'Erro ao registrar interesse');
                        btn.disabled = false;
                        btn.textContent = 'Tenho interesse';
                    }
                };

                wrapper.appendChild(header);
                wrapper.appendChild(desc);
                wrapper.appendChild(btn);
                interestBox.appendChild(wrapper);
            }
        }
            // initialize or update map after rendering content
            try { initMapForDetail(d); } catch(e){ console.warn('Map init failed', e); }
        }

        /* Map helpers: try to extract coordinates from common fields, else geocode via Nominatim */
        function extractCoords(d){
            if (!d) return null;
            const maybe = (k)=>{ if (d[k]===0 || d[k]) return d[k]; return null; };
            const latKeys = ['latitude','lat','y','coordY','latitudine'];
            const lngKeys = ['longitude','lon','lng','x','coordX','longitudine'];
            for (const lk of latKeys){
                for (const rk of lngKeys){
                    const la = maybe(lk); const lo = maybe(rk);
                    if (la!=null && lo!=null && !isNaN(Number(la)) && !isNaN(Number(lo))){
                        return { lat: Number(la), lng: Number(lo) };
                    }
                }
            }
            if (Array.isArray(d.coordenadas) && d.coordenadas.length>=2){ return { lat: Number(d.coordenadas[0]), lng: Number(d.coordenadas[1]) }; }
            if (d.coordenada && typeof d.coordenada === 'object' && d.coordenada.lat && d.coordenada.lng) return { lat: Number(d.coordenada.lat), lng: Number(d.coordenada.lng) };
            return null;
        }

        async function geocodeAddress(query){
            if (!query || !String(query).trim()) return null;
            const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
            try {
                const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
                if (!res.ok) return null;
                const arr = await res.json();
                if (!arr || !arr.length) return null;
                const item = arr[0];
                return { lat: Number(item.lat), lng: Number(item.lon), display_name: item.display_name };
            } catch (err){ return null; }
        }

        async function initMapForDetail(d){
            const mapCard = el('map-card');
            const mapEl = el('map');
            if (!mapCard || !mapEl) return;

            if (window._detail_map){ try{ window._detail_map.remove(); } catch(e){}; window._detail_map = null; }

            mapCard.style.display = 'block';

            let coords = extractCoords(d);
            if (!coords){
                const parts = [];
                if (d.endereco) parts.push(d.endereco);
                if (d.bairro) parts.push(d.bairro);
                if (d.cidade) parts.push(d.cidade);
                if (d.estado) parts.push(d.estado);
                if (d.cep) parts.push(d.cep);
                if (!parts.length && d.titulo) parts.push(d.titulo + ' ' + (d.cidade||''));
                const q = parts.join(', ');
                if (q) coords = await geocodeAddress(q);
            }

            if (!coords){
                mapCard.style.display = 'none';
                return;
            }

            const map = L.map('map', { scrollWheelZoom: true }).setView([coords.lat, coords.lng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            // explicit icon so it always shows (use Leaflet CDN asset)
            const defaultIcon = L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            const popupText = (d.titulo?('<strong>'+ (d.titulo) +'</strong><br/>'):'') + (d.endereco? d.endereco + (d.cidade?(', '+d.cidade):'') : (coords.display_name||''));
            const marker = L.marker([coords.lat, coords.lng], { icon: defaultIcon }).addTo(map).bindPopup(popupText).openPopup();

            // Leaflet sometimes renders with wrong size if container was hidden / styled — force a resize
            setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 200);
            // also once tile layer loaded, ensure layout
            map.once('load', ()=>{ try{ map.invalidateSize(); }catch(e){} });
            window.addEventListener('resize', ()=>{ try{ map.invalidateSize(); }catch(e){} });

            window._detail_map = map;
        }

        document.addEventListener('DOMContentLoaded', () => {
            const id = qs('id');
            loadDetail(id);
        });
})();
