document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.panel');
    const interessesList = document.getElementById('interesses-list');
    const minhasList = document.getElementById('minhas-list');
    const modal = document.getElementById('donation-modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.querySelector('.modal-close');

    function switchTab(tabName){
        tabButtons.forEach(b => {
            if (b.dataset.tab === tabName) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        panels.forEach(p => {
            if (p.id === tabName) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });
        // always reload data when switching tabs
        if (tabName === 'interesses') {
            // clear other panel to avoid stale items
            minhasList.innerHTML = '';
            loadInteresses();
        }
        if (tabName === 'minhas') {
            // clear other panel to avoid stale items
            interessesList.innerHTML = '';
            loadMinhasDoacoes();
        }
    }

    function resolveImageUrl(src){
        if (!src) return null;
        src = String(src).trim();
        // already a data URL
        if (/^data:/i.test(src)) return src;
        // already absolute
        if (/^https?:\/\//i.test(src)) return src;

        // detect raw base64 payloads (no data: prefix)
        // common signatures: PNG -> iVBORw0K, JPEG -> /9j/, GIF -> R0lGOD
        const clean = src.replace(/\s+/g, '');
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(clean) && clean.length > 100;
        if (isBase64) {
            let mime = 'image/png';
            if (/^iVBORw0K/.test(clean)) mime = 'image/png';
            else if (/^\/9j/.test(clean) || clean.startsWith('/9j')) mime = 'image/jpeg';
            else if (/^R0lGOD/.test(clean)) mime = 'image/gif';
            return `data:${mime};base64,${clean}`;
        }

        // otherwise treat as relative path and prefix backend base url
        const base = BACKEND_BASE_URL.replace(/\/+$/,'');
        if (src.startsWith('/')) return base + src;
        return base + '/' + src;
    }

    tabButtons.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // fetch interests (by user)
    async function loadInteresses(){
        interessesList.innerHTML = '';
        try {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
            let url;
            if (userId) {
                url = `${BACKEND_BASE_URL}/interesse/usuario/${encodeURIComponent(userId)}`;
            } else {
                url = `${BACKEND_BASE_URL}/interesse`;
            }
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Falha ao carregar interesses: ' + res.status);
            const data = await res.json();
            renderInteresses(data || []);
        } catch (err){
            interessesList.innerHTML = `<div class="card">Erro: ${err.message}</div>`;
        }
    }

    function renderInteresses(items){
        if (!items.length) return interessesList.innerHTML = '<div class="card">Nenhum interesse encontrado.</div>';
        interessesList.innerHTML = '';
        items.forEach(it => {
            // each interest may contain a donation payload or an id pointing to donation
            const donation = it.doacao || it; // adapt based on API shape
            const card = document.createElement('div');
            card.className = 'card';
            const descricao = donation.descricao ? donation.descricao.substring(0, 100) + (donation.descricao.length > 100 ? '...' : '') : '';
            const statusClass = donation.statusInteresse ? `status-badge ${String(donation.statusInteresse).toLowerCase()}` : '';
                const _rawStatus = donation.statusInteresse || it.statusInteresse || '';
                const statusText = _rawStatus ? String(_rawStatus)
                    .toLowerCase()
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase())
                    : 'Pendente';
            const imgUrl = resolveImageUrl(donation.imagem);

            card.innerHTML = `
                ${imgUrl ? `<img src="${imgUrl}" alt="img" class="card-img" />` : ''}
                <div class="title">${donation.titulo || 'Sem título'}</div>
                <div class="description">${descricao}</div>
                <div class="meta">
                    <span>${donation.categoria || ''}</span>
                    <span>${donation.cidade || ''}</span>
                </div>
                ${donation.status ? `<span class="${statusClass}">${statusText}</span>` : ''}
            `;
            card.addEventListener('click', () => openModal(donation, false, true));
            interessesList.appendChild(card);
        });
    }

    // fetch my donations (by user)
    async function loadMinhasDoacoes(){
        minhasList.innerHTML = '';
        try {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
            if (!userId && !token){
                minhasList.innerHTML = '<div class="card">Faça login para ver suas doações.</div>';
                return;
            }
            let url;
            if (userId) {
                url = `${BACKEND_BASE_URL}/doacoes/usuario/${encodeURIComponent(userId)}`;
            } else {
                url = `${BACKEND_BASE_URL}/doacoes`;
            }
            const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Falha ao carregar suas doações: ' + res.status);
            const data = await res.json();
            renderMinhas(data || []);
        } catch (err){
            minhasList.innerHTML = `<div class="card">Erro: ${err.message}</div>`;
        }
    }

    function renderMinhas(items){
        if (!items.length) return minhasList.innerHTML = '<div class="card">Você não cadastrou doações.</div>';
        minhasList.innerHTML = '';
        items.forEach(d => {
            const card = document.createElement('div');
            card.className = 'card';
            const descricao = d.descricao ? d.descricao.substring(0, 100) + (d.descricao.length > 100 ? '...' : '') : '';
            const statusClass = d.status ? `status-badge ${d.status.toLowerCase()}` : '';
            const statusText = d.status ? d.status : 'Ativo';
            const imgUrl = resolveImageUrl(d.imagem);

            card.innerHTML = `
                ${imgUrl ? `<img src="${imgUrl}" alt="img" class="card-img" />` : ''}
                <div class="title">${d.titulo || 'Sem título'}</div>
                <div class="description">${descricao}</div>
                <div class="meta">
                    <span>${d.categoria || ''}</span>
                    <span>${d.cidade || ''}</span>
                </div>
                ${d.status ? `<span class="${statusClass}">${statusText}</span>` : ''}
            `;
            card.addEventListener('click', () => openModal(d, true, false));
            minhasList.appendChild(card);
        });
    }

    // Modal: show donation details, allow edit/delete if owner
    function openModal(donation, editable, isInterest){
        modal.setAttribute('aria-hidden', 'false');
        modalContent.innerHTML = buildModalView(donation, editable, isInterest);
        // attach listeners
        document.getElementById('modal-edit-btn')?.addEventListener('click', () => enableEdit(donation));
        document.getElementById('modal-delete-btn')?.addEventListener('click', () => confirmDelete(donation));
        document.getElementById('modal-interesses-btn')?.addEventListener('click', () => showInteressesList(donation));
        document.getElementById('modal-recusar-btn')?.addEventListener('click', () => confirmRecusar(donation));
        document.getElementById('modal-close-btn')?.addEventListener('click', () => closeModal());
        const closeBtns = modal.querySelectorAll('.modal-close');
        closeBtns.forEach(b => b.addEventListener('click', closeModal));
    }

    async function showInteressesList(donation){
        const id = donation.id || donation._id || donation.codigo || donation.idDoacao || '';
        if (!id){ showModalMessage('ID da doação ausente. Não foi possível carregar interessados.', true); return; }
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        try {
            const res = await fetch(`${BACKEND_BASE_URL}/interesse/status/doacao/${encodeURIComponent(id)}`, { headers });
            if (!res.ok) throw new Error('Falha ao carregar interessados: ' + res.status);
            const data = await res.json();

            // container uses full available width of modal, with max-height and scroll
            // set width to 164% as requested to expand the list inside the modal
            let html = `<div class="interesses-list" style="width:215%;box-sizing:border-box;max-height:80vh;overflow:auto;margin:0;padding:12px;background:#fff;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.08);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h3 style="margin:0">Interessados</h3>
                    <div><button id="interesses-back-btn" class="btn">Voltar</button></div>
                </div>`;
            if (!data || !data.length) html += '<div class="card">Nenhum interessado encontrado.</div>';
            else {
                data.forEach((item, idx) => {
                    const u = item.usuario || item.user || item;
                    const nome = u?.nome || u?.nomeUsuario || u?.username || '';
                    const email = u?.email || '';
                    const telefone = u?.telefone || u?.celular || '';
                    const comentario = item.comentario || item.mensagem || '';
                    const status = item.status || item.statusInteresse || '';
                    const interestId = item.id || item._id || item.codigo || item.idInteresse || '';
                    const idUsuario = u?.id || u?.usuarioId || u?._id || u?.codigo || item.usuarioId || item.idUsuario || '';

                    html += `
                        <div class="card interesse-item" data-interest-id="${escapeHtml(interestId)}" data-user-id="${escapeHtml(idUsuario)}" data-index="${idx}" style="width:100%;margin-bottom:10px;padding:12px;border-radius:8px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                                <div style="flex:1;min-width:0">
                                    <div class="title" style="font-weight:600">${escapeHtml(nome)}</div>
                                    <div class="description" style="color:#666;font-size:0.95rem">${escapeHtml(email)}${telefone? ' • ' + escapeHtml(telefone):''}</div>
                                    <div style="margin-top:6px;color:#444">${escapeHtml(comentario)}</div>
                                    ${status? `<div style="margin-top:6px"><span class="status-badge ${String(status).toLowerCase()}">${escapeHtml(status)}</span></div>`: ''}
                                </div>
                                <div style="display:flex;flex-direction:column;gap:8px">
                                    <button class="btn btn-message" type="button" style="background:#FF6B35;color:#fff;border:none">Mensagem</button>
                                    <button class="btn btn-confirm" type="button" style="background:#37b24d;color:#fff;border:none">Confirmar</button>
                                    <button class="btn danger btn-refuse" type="button">Recusar</button>
                                </div>
                            </div>
                        </div>`;
                });
            }
            html += '</div>';
            // ensure modalContent uses flex so the list can expand to fill available space
            modalContent.style.display = 'flex';
            modalContent.style.flexDirection = 'row';
            modalContent.style.justifyContent = 'center';
            modalContent.style.alignItems = 'stretch';

            // layout: left column is the list (60% width), right column fills remaining space
            modalContent.innerHTML = `
                <div style="display:flex; width:100%; gap:12px;">
                    <div style="flex:0 0 60%;">
                        ${html}
                    </div>
                    <div style="flex:1"></div>
                </div>
            `;

            // attach back listener
            document.getElementById('interesses-back-btn')?.addEventListener('click', () => openModal(donation, true, false));

            // attach action listeners per item
            const items = modalContent.querySelectorAll('.interesse-item');
            items.forEach(it => {
                const interestId = it.dataset.interestId;
                const emailText = it.querySelector('.description')?.textContent || '';
                const btnMsg = it.querySelector('.btn-message');
                const btnConfirm = it.querySelector('.btn-confirm');
                const btnRefuse = it.querySelector('.btn-refuse');

                if (btnMsg){
                    btnMsg.addEventListener('click', () => {
                        // try open mail client if email present, else try tel, else notify
                        const parts = emailText.split('•').map(s => s.trim());
                        const possibleEmail = parts[0] || '';
                        if (possibleEmail && possibleEmail.includes('@')){
                            window.location.href = `mailto:${possibleEmail}`;
                        } else if (parts[1]){
                            const tel = parts[1];
                            window.location.href = `tel:${tel}`;
                        } else {
                            alert('Contato não disponível para este usuário.');
                        }
                    });
                }

                if (btnConfirm){
                    btnConfirm.addEventListener('click', async () => {
                        if (!confirm('Confirma a doação para este usuário?')) return;
                        // read user id from DOM dataset (set when rendering)
                        const idUsuario = it.dataset.userId || '';
                        const idDoacao = donation.id || donation._id || donation.codigo || donation.idDoacao || '';
                        if (!idUsuario || !idDoacao) { alert('IDs necessários ausentes.'); return; }

                        const token = localStorage.getItem('token');
                        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
                        try {
                            const url = `${BACKEND_BASE_URL}/doacoes/confirmar/${encodeURIComponent(idUsuario)}/${encodeURIComponent(idDoacao)}`;
                            const res = await fetch(url, { method: 'POST', headers });
                            if (!res.ok) throw new Error('Falha ao confirmar: ' + res.status);
                            alert('Doação confirmada.');
                            // refresh list
                            showInteressesList(donation);
                        } catch (err){
                            alert('Erro: ' + err.message);
                        }
                    });
                }

                if (btnRefuse){
                    btnRefuse.addEventListener('click', async () => {
                        if (!confirm('Confirma recusar o interesse deste usuário?')) return;
                        const token = localStorage.getItem('token');
                        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
                        try {
                            const res = await fetch(`${BACKEND_BASE_URL}/interesse/${encodeURIComponent(interestId)}`, { method: 'DELETE', headers });
                            if (!res.ok) throw new Error('Falha ao recusar: ' + res.status);
                            alert('Interesse recusado.');
                            showInteressesList(donation);
                        } catch (err){
                            alert('Erro: ' + err.message);
                        }
                    });
                }
            });
        } catch (err){
            modalContent.innerHTML = `<div class="card">Erro: ${escapeHtml(err.message)}</div><button id="interesses-back-btn" class="btn">Voltar</button>`;
            document.getElementById('interesses-back-btn')?.addEventListener('click', () => openModal(donation, true, false));
        }
    }

    function closeModal(){
        modal.setAttribute('aria-hidden','true');
        modalContent.innerHTML = '';
    }

    function buildModalView(d, editable, isInterest){
        const imgHtml = resolveImageUrl(d.imagem) ? `<img class="modal-img" src="${resolveImageUrl(d.imagem)}" alt="img"/>` : '';
        const statusValue = isInterest ? d.statusInteresse : d.status;
        const statusHtml = statusValue ? `<div style="margin-top:8px"><span class="status-badge ${String(statusValue).toLowerCase()}">${statusValue}</span></div>` : '';
        
        let editButtons = '';
        if (editable) {
            editButtons = `
                <div class="modal-actions">
                    <button id="modal-interesses-btn" class="btn">Ver Interessados</button>
                    <button id="modal-edit-btn" class="btn primary">Editar</button>
                    <button id="modal-delete-btn" class="btn danger">Excluir</button>
                </div>
            `;
        } else if (isInterest) {
            editButtons = `
                <div class="modal-actions">
                    <button id="modal-recusar-btn" class="btn danger">Cancelar Interesse</button>
                </div>
            `;
        }

        return `
            <div class="modal-card-inner">
                <div style="display:flex; gap:14px; align-items:flex-start">
                    ${imgHtml}
                    <div class="modal-body">
                        <div class="title">${d.titulo || ''}</div>
                        <div class="meta">${d.categoria || ''} • ${d.estadoConservacao || ''}</div>
                        <p style="margin-top:10px">${d.descricao || ''}</p>
                        <div style="margin-top:10px">Local: ${d.cidade || ''} - ${d.estado || ''}</div>
                        ${statusHtml}
                        ${editButtons}
                    </div>
                </div>
            </div>
        `;
    }

    function enableEdit(donation){
        // transform modal content into an edit form
        modalContent.innerHTML = buildEditForm(donation);
        // file preview
        const fileInput = modalContent.querySelector('input[name="imagem"]');
        const preview = modalContent.querySelector('.preview-wrap');
        // show existing image preview if available
        if (preview) {
            const existing = resolveImageUrl(donation.imagem);
            if (existing) preview.innerHTML = `<img src="${existing}" class="modal-img" />`;
        }
        if (fileInput){
            fileInput.addEventListener('change', () => {
                const f = fileInput.files[0];
                if (!f) { preview.innerHTML = ''; return; }
                preview.innerHTML = `<img src="${URL.createObjectURL(f)}" class="modal-img" />`;
            });
        }
        modalContent.querySelector('.cancel-edit')?.addEventListener('click', () => openModal(donation, true));
        modalContent.querySelector('.save-edit')?.addEventListener('click', (ev) => submitEdit(ev, donation));
    }

    function buildEditForm(d){
        const imgUrl = resolveImageUrl(d.imagem);
        return `
            <div style="display:flex; gap:14px; align-items:center">
                <div class="modal-body">
                    <div class="form-row"><label>Título <input type="text" name="titulo" value="${escapeHtml(d.titulo||'')}" /></label></div>
                    <div class="form-row"><label>Descrição <textarea name="descricao">${escapeHtml(d.descricao||'')}</textarea></label></div>
                    <div class="form-row"><label>Categoria <select name="categoria">
                        <option ${d.categoria==='RACAO'?'selected':''} value="RACAO">Ração</option>
                        <option ${d.categoria==='MEDICAMENTOS'?'selected':''} value="MEDICAMENTOS">Medicamentos</option>
                        <option ${d.categoria==='ACESSORIOS'?'selected':''} value="ACESSORIOS">Acessórios</option>
                        <option ${d.categoria==='OUTROS'?'selected':''} value="OUTROS">Outros</option>
                    </select></label></div>

                    <div class="form-row"><label>Estado de conservação <select name="estadoConservacao">
                        <option ${d.estadoConservacao==='NOVO'?'selected':''} value="NOVO">Novo</option>
                        <option ${d.estadoConservacao==='USADO'?'selected':''} value="USADO">Usado</option>
                        <option ${d.estadoConservacao==='BOAS_CONDICOES'?'selected':''} value="BOAS_CONDICOES">Em boas condições</option>
                    </select></label></div>

                    <div class="form-row"><label>Estado <input type="text" name="estado" value="${escapeHtml(d.estado||'')}" /></label></div>
                    <div class="form-row"><label>Cidade <input type="text" name="cidade" value="${escapeHtml(d.cidade||'')}" /></label></div>
                    <div class="form-row"><label>Imagem (opcional) <input type="file" name="imagem" accept="image/*" /></label></div>
                    <div class="preview-wrap">${imgUrl ? `<img src="${imgUrl}" class="modal-img" />` : ''}</div>

                    <div class="modal-actions">
                        <button class="btn cancel-edit" type="button">Cancelar</button>
                        <button class="btn primary save-edit" type="button">Salvar</button>
                    </div>
                </div>
            </div>
        `;
    }

    function escapeHtml(str){
        return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]||s));
    }

    async function submitEdit(ev, donation){
        ev.preventDefault();
        const formEl = modalContent.querySelector('div.modal-body');
        const titulo = formEl.querySelector('input[name="titulo"]').value;
        const descricao = formEl.querySelector('textarea[name="descricao"]').value;
        const categoria = formEl.querySelector('select[name="categoria"]').value;
        const estadoConservacao = formEl.querySelector('select[name="estadoConservacao"]').value;
        const estado = formEl.querySelector('input[name="estado"]').value;
        const cidade = formEl.querySelector('input[name="cidade"]').value;
        const imagemInput = formEl.querySelector('input[name="imagem"]');

        // determine id and usuarioId (required)
        const idValue = donation.id || donation._id || donation.codigo || donation.idDoacao || '';
        const usuarioId = donation.usuarioId || localStorage.getItem('userId') || '';
        if (!idValue || !usuarioId) {
            showModalMessage('Campos obrigatórios ausentes: id e usuarioId', true);
            return;
        }

        // always send FormData so backend @ModelAttribute + MultipartFile works
        const fd = new FormData();
        fd.append('id', idValue);
        fd.append('usuarioId', usuarioId);

        // optional fields appended only if provided
        if (titulo && String(titulo).trim()) fd.append('titulo', titulo);
        if (descricao && String(descricao).trim()) fd.append('descricao', descricao);
        if (categoria && String(categoria).trim()) fd.append('categoria', categoria);
        if (estadoConservacao && String(estadoConservacao).trim()) fd.append('estadoConservacao', estadoConservacao);
        if (estado && String(estado).trim()) fd.append('estado', estado);
        if (cidade && String(cidade).trim()) fd.append('cidade', cidade);
        if (imagemInput && imagemInput.files && imagemInput.files[0]) fd.append('imagem', imagemInput.files[0]);
        else if (donation && donation.imagem) {
            // no new file selected — include existing image reference so backend can keep it
            fd.append('imagem', donation.imagem);
        }

        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

        try {
            const res = await fetch(`${BACKEND_BASE_URL}/doacoes`, { method: 'PUT', headers, body: fd });
            if (!res.ok) throw new Error('Erro ao atualizar: ' + res.status);
            showModalMessage('Doação atualizada com sucesso.');
            // refresh lists
            await loadMinhasDoacoes();
            closeModal();
        } catch (err){
            showModalMessage('Erro: ' + err.message, true);
        }
    }

    async function confirmDelete(donation){
        if (!confirm('Confirma a exclusão desta doação?')) return;
        const id = donation.id || donation._id || donation.codigo || donation.idDoacao || '';
        if (!id){ showModalMessage('ID da doação ausente. Não foi possível excluir.', true); return; }
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        try {
            const res = await fetch(`${BACKEND_BASE_URL}/doacoes/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Falha ao excluir: ' + res.status);
            showModalMessage('Doação excluída.');
            await loadMinhasDoacoes();
            closeModal();
        } catch (err){
            showModalMessage('Erro: ' + err.message, true);
        }
    }

    async function confirmRecusar(donation){
        if (!confirm('Confirma que deseja cancelar seu interesse nesta doação?')) return;
        // try to determine interest id and usuario id
        const interestId = donation.id || donation._id || donation.codigo || donation.idDoacao || donation.idInteresse || donation.idInteresse || '';
        const usuarioId = donation.usuarioId || localStorage.getItem('userId') || (donation.usuario && (donation.usuario.id || donation.usuario.usuarioId)) || '';
        if (!interestId){ showModalMessage('ID do interesse ausente. Não foi possível recusar.', true); return; }

        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : { 'Content-Type': 'application/json' };
        try {
            let res;
            if (usuarioId) {
                // new route: /interesse/cancelar/{idUsuario}/{idInteresse}
                res = await fetch(`${BACKEND_BASE_URL}/interesse/cancelar/${encodeURIComponent(usuarioId)}/${encodeURIComponent(interestId)}`, { method: 'DELETE', headers });
            } else {
                // fallback to older route if usuarioId not known
                res = await fetch(`${BACKEND_BASE_URL}/interesse/${encodeURIComponent(interestId)}`, { method: 'DELETE', headers });
            }

            if (!res.ok) throw new Error('Falha ao recusar interesse: ' + res.status);
            showModalMessage('Interesse removido.');
            await loadInteresses();
            closeModal();
        } catch (err){
            showModalMessage('Erro: ' + err.message, true);
        }
    }

    function showModalMessage(text, isError){
        const el = modalContent.querySelector('.modal-msg') || document.createElement('div');
        el.className = 'modal-msg';
        el.style.color = isError ? '#9b2c2c' : '#2d6a4f';
        el.textContent = text;
        modalContent.prepend(el);
    }

    // close handlers
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);
    modalClose?.addEventListener('click', closeModal);

    // initial load: only load the active tab (interesses)
    // `interesses` tab is active by default in the HTML
    loadInteresses();
});