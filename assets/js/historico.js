document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.panel');
    const interessesList = document.getElementById('interesses-list');
    const minhasList = document.getElementById('minhas-list');
    const modal = document.getElementById('donation-modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.querySelector('.modal-close');

    // logout functionality
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = './login.html';
        });
    }

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
            // each interest contains doacaoResumo
            const donation = it.doacaoResumo;
            const card = document.createElement('div');
            card.className = 'card';
            const descricao = donation.descricao ? donation.descricao.substring(0, 100) + (donation.descricao.length > 100 ? '...' : '') : '';
            const statusClass = it.statusInteresse ? `status-badge ${String(it.statusInteresse).toLowerCase()}` : '';
                const _rawStatus = it.statusInteresse || '';
                const statusText = _rawStatus ? String(_rawStatus)
                    .toLowerCase()
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase())
                    : 'Pendente';
                const conditionClass = statusText.toLowerCase().replace(/\s+/g, '-');
            let mediaHtml = '';
            if (donation.imagens && donation.imagens.length > 0) {
                const displayControls = donation.imagens.length > 1 ? '' : 'style="display:none"';
                mediaHtml = `
                    <div class="card-media">
                        <img src="${resolveImageUrl(donation.imagens[0])}" alt="img" class="card-img" />
                        <button class="carousel-btn prev" aria-label="Previous image" ${displayControls}>&#10094;</button>
                        <button class="carousel-btn next" aria-label="Next image" ${displayControls}>&#10095;</button>
                        <div class="carousel-counter" ${displayControls}>1/${donation.imagens.length}</div>
                    </div>
                `;
            }

            card.innerHTML = `
                ${mediaHtml}
                <div class="card-body">
                    <div class="card-tags">
                        <span class="tag">${donation.categoria || ''}</span>
                        <span class="condition-pill ${conditionClass}">${statusText}</span>
                    </div>
                    <div class="title">${donation.titulo || 'Sem título'}</div>
                    <div class="description">${descricao}</div>
                    <div class="card-meta">
                        <span>${donation.cidade || ''}</span>
                    </div>
                </div>
            `;
            // add carousel functionality if multiple images
            if (donation.imagens && donation.imagens.length > 1) {
                const imgEl = card.querySelector('.card-img');
                const prevBtn = card.querySelector('.carousel-btn.prev');
                const nextBtn = card.querySelector('.carousel-btn.next');
                const counter = card.querySelector('.carousel-counter');
                let index = 0;
                function updateImage() {
                    imgEl.style.opacity = 0;
                    setTimeout(() => {
                        imgEl.src = resolveImageUrl(donation.imagens[index]);
                        counter.textContent = `${index + 1}/${donation.imagens.length}`;
                        imgEl.style.opacity = 1;
                    }, 200);
                }
                prevBtn.onclick = (e) => { e.stopPropagation(); index = (index - 1 + donation.imagens.length) % donation.imagens.length; updateImage(); };
                nextBtn.onclick = (e) => { e.stopPropagation(); index = (index + 1) % donation.imagens.length; updateImage(); };
            }
            card.addEventListener('click', () => openModal(it, false, true));
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
            let statusText = d.status ? d.status : 'Ativo';
            if (d.status) {
                statusText = d.status.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                if (statusText === 'Em Andamento') statusText = 'Em andamento';
            }
            const conditionClass = statusText.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
            let mediaHtml = '';
            if (d.imagens && d.imagens.length > 0) {
                const displayControls = d.imagens.length > 1 ? '' : 'style="display:none"';
                mediaHtml = `
                    <div class="card-media">
                        <img src="${resolveImageUrl(d.imagens[0])}" alt="img" class="card-img" />
                        <button class="carousel-btn prev" aria-label="Previous image" ${displayControls}>&#10094;</button>
                        <button class="carousel-btn next" aria-label="Next image" ${displayControls}>&#10095;</button>
                        <div class="carousel-counter" ${displayControls}>1/${d.imagens.length}</div>
                    </div>
                `;
            }

            card.innerHTML = `
                ${mediaHtml}
                <div class="card-body">
                    <div class="card-tags">
                        <span class="tag">${d.categoria || ''}</span>
                        <span class="condition-pill ${conditionClass}">${statusText}</span>
                    </div>
                    <div class="title">${d.titulo || 'Sem título'}</div>
                    <div class="description">${descricao}</div>
                    <div class="card-meta">
                        <span>${d.cidade || ''}</span>
                    </div>
                </div>
            `;
            // add carousel functionality if multiple images
            if (d.imagens && d.imagens.length > 1) {
                const imgEl = card.querySelector('.card-img');
                const prevBtn = card.querySelector('.carousel-btn.prev');
                const nextBtn = card.querySelector('.carousel-btn.next');
                const counter = card.querySelector('.carousel-counter');
                let index = 0;
                function updateImage() {
                    imgEl.style.opacity = 0;
                    setTimeout(() => {
                        imgEl.src = resolveImageUrl(d.imagens[index]);
                        counter.textContent = `${index + 1}/${d.imagens.length}`;
                        imgEl.style.opacity = 1;
                    }, 200);
                }
                prevBtn.onclick = (e) => { e.stopPropagation(); index = (index - 1 + d.imagens.length) % d.imagens.length; updateImage(); };
                nextBtn.onclick = (e) => { e.stopPropagation(); index = (index + 1) % d.imagens.length; updateImage(); };
            }
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
        // add carousel functionality for modal if multiple images
        const modalDonation = isInterest ? donation.doacaoResumo : donation;
        if (modalDonation.imagens && modalDonation.imagens.length > 1) {
            const imgEl = modalContent.querySelector('.modal-img');
            const prevBtn = modalContent.querySelector('.carousel-btn.prev');
            const nextBtn = modalContent.querySelector('.carousel-btn.next');
            const counter = modalContent.querySelector('.carousel-counter');
            let index = 0;
            function updateImage() {
                imgEl.style.opacity = 0;
                setTimeout(() => {
                    imgEl.src = resolveImageUrl(modalDonation.imagens[index]);
                    counter.textContent = `${index + 1}/${modalDonation.imagens.length}`;
                    imgEl.style.opacity = 1;
                }, 200);
            }
            prevBtn.onclick = (e) => { e.stopPropagation(); index = (index - 1 + modalDonation.imagens.length) % modalDonation.imagens.length; updateImage(); };
            nextBtn.onclick = (e) => { e.stopPropagation(); index = (index + 1) % modalDonation.imagens.length; updateImage(); };
        }
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
                        <div class="card interesse-item" data-interest-id="${escapeHtml(interestId)}" data-user-id="${escapeHtml(idUsuario)}" data-user-name="${escapeHtml(nome)}" data-index="${idx}" style="width:100%;margin-bottom:10px;padding:12px;border-radius:8px;">
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
                        const idDoacao = donation.id || donation._id || donation.codigo || donation.idDoacao || '';
                        const idUsuarioLocal = it.dataset.userId || idUsuario || '';
                        const nome = it.dataset.userName || '';
                        // navigate to chat page with conversation details
                        location.href = `chat.html?userId=${encodeURIComponent(idUsuarioLocal)}&donationId=${encodeURIComponent(idDoacao)}&userName=${encodeURIComponent(nome)}&donationTitle=${encodeURIComponent(donation.titulo)}`;
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
        const donation = isInterest ? d.doacaoResumo : d;
        let imgHtml = '';
        if (donation.imagens && donation.imagens.length > 0) {
            const displayControls = donation.imagens.length > 1 ? '' : 'style="display:none"';
            imgHtml = `
                <div class="card-media">
                    <img class="modal-img" src="${resolveImageUrl(donation.imagens[0])}" alt="img"/>
                    <button class="carousel-btn prev" aria-label="Previous image" ${displayControls}>&#10094;</button>
                    <button class="carousel-btn next" aria-label="Next image" ${displayControls}>&#10095;</button>
                    <div class="carousel-counter" ${displayControls}>1/${donation.imagens.length}</div>
                </div>
            `;
        }
        const statusValue = isInterest ? d.statusInteresse : donation.status;
        let statusText = statusValue || '';
        if (statusValue) {
            statusText = statusValue.replace(/_/g, ' ');
            if (statusText === 'Em Andamento') statusText = 'Em andamento';
        }
        const conditionClass = statusText ? statusText.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-') : '';
        const statusHtml = statusText ? `<span class="condition-pill ${conditionClass}">${statusText}</span>` : '';
        
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
                <div class="modal-actions" style="justify-content: flex-start;">
                    <button id="modal-recusar-btn" class="btn danger">Cancelar Interesse</button>
                </div>
            `;
        }

        return `
            <div class="modal-card-inner">
                <div style="display:flex; gap:14px; align-items:flex-start">
                    ${imgHtml}
                    <div class="modal-body">
                        <div class="title">${donation.titulo || ''}</div>
                        <div class="card-tags">
                            <span class="tag">${donation.categoria || ''}</span>
                            ${statusHtml}
                            <span class="condition-pill">${donation.estadoConservacao || ''}</span>
                        </div>
                        <p style="margin-top:10px">${donation.descricao || ''}</p>
                        <div style="margin-top:10px">Local: ${donation.cidade || ''} - ${donation.estado || ''}</div>
                        ${editButtons}
                    </div>
                </div>
            </div>
        `;
    }

    function enableEdit(donation){
        // transform modal content into an edit form
        modalContent.innerHTML = buildEditForm(donation);
        // file preview + remove support
        const fileInput = modalContent.querySelector('input[name="imagens"]');
        const preview = modalContent.querySelector('#image-preview') || modalContent.querySelector('.image-preview') || modalContent.querySelector('.preview-wrap');
        // track removed existing images and newly selected files
        modalContent._removedImages = new Set();
        modalContent._newFiles = [];

        function renderExistingPreviews(){
            if (!preview) return;
            preview.innerHTML = '';
            const existingImgs = donation.imagens && donation.imagens.length > 0 ? donation.imagens : (donation.imagem ? [donation.imagem] : []);
            existingImgs.forEach((src, idx) => {
                if (modalContent._removedImages.has(src)) return;
                const url = resolveImageUrl(src);
                const item = document.createElement('div');
                item.className = 'preview-item';
                item.style.position = 'relative';
                item.innerHTML = `<img src="${url}" class="modal-img" data-src="${escapeHtml(src)}"/>`;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'remove-image';
                btn.title = 'Remover imagem';
                btn.textContent = '×';
                btn.style.position = 'absolute';
                btn.style.top = '6px';
                btn.style.right = '6px';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    modalContent._removedImages.add(src);
                    item.remove();
                });
                item.appendChild(btn);
                preview.appendChild(item);
            });
        }

        function renderNewFilePreviews(){
            if (!preview) return;
            // if there are new files, show them after clearing preview
            if (!modalContent._newFiles || modalContent._newFiles.length === 0) return;
            preview.innerHTML = '';
            modalContent._newFiles.forEach((f, i) => {
                const item = document.createElement('div');
                item.className = 'preview-item';
                item.style.position = 'relative';
                const imgUrl = URL.createObjectURL(f);
                item.innerHTML = `<img src="${imgUrl}" class="modal-img" data-file-index="${i}"/>`;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'remove-image';
                btn.title = 'Remover imagem selecionada';
                btn.textContent = '×';
                btn.style.position = 'absolute';
                btn.style.top = '6px';
                btn.style.right = '6px';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // remove from newFiles array and re-render
                    modalContent._newFiles.splice(i, 1);
                    renderNewFilePreviews();
                });
                item.appendChild(btn);
                preview.appendChild(item);
            });
        }

        // initial render of existing images
        renderExistingPreviews();

        if (fileInput){
            fileInput.addEventListener('change', () => {
                const files = Array.from(fileInput.files || []);
                modalContent._newFiles = files.slice();
                // when new files selected, we clear removedExisting set (new replaces existing)
                modalContent._removedImages = new Set();
                renderNewFilePreviews();
            });
            // wire add-images button
            modalContent.querySelector('#add-images-btn')?.addEventListener('click', () => fileInput.click());
        }
        modalContent.querySelector('.cancel-edit')?.addEventListener('click', () => openModal(donation, true));
        modalContent.querySelector('.save-edit')?.addEventListener('click', (ev) => submitEdit(ev, donation));
    }

    function buildEditForm(d){
        const imgUrl = resolveImageUrl(d.imagens && d.imagens.length > 0 ? d.imagens[0] : null);
        return `
            <div class="form-card" style="max-width:700px;margin:0;">
                <h2>Editar Doação</h2>
                <form id="edit-donation-form" enctype="multipart/form-data">
                    <input type="hidden" name="usuarioId" value="${escapeHtml(d.usuarioId||localStorage.getItem('userId')||'')}" />
                    <div id="form-fields">
                        <div class="field">
                            <label class="label">Título</label>
                            <input name="titulo" type="text" value="${escapeHtml(d.titulo||'')}" />
                        </div>

                        <div class="field">
                            <label class="label">Categoria</label>
                            <select name="categoria">
                                <option ${d.categoria==='RACAO'?'selected':''} value="RACAO">Ração</option>
                                <option ${d.categoria==='MEDICAMENTOS'?'selected':''} value="MEDICAMENTOS">Medicamentos</option>
                                <option ${d.categoria==='ACESSORIOS'?'selected':''} value="ACESSORIOS">Acessórios</option>
                                <option ${d.categoria==='OUTROS'?'selected':''} value="OUTROS">Outros</option>
                            </select>
                        </div>

                        <div class="field">
                            <label class="label">Estado de conservação</label>
                            <select name="estadoConservacao">
                                <option ${d.estadoConservacao==='NOVO'?'selected':''} value="NOVO">Novo</option>
                                <option ${d.estadoConservacao==='USADO'?'selected':''} value="USADO">Usado</option>
                                <option ${d.estadoConservacao==='BOAS_CONDICOES'?'selected':''} value="BOAS_CONDICOES">Em boas condições</option>
                            </select>
                        </div>

                        <div class="field">
                            <label class="label">Estado</label>
                            <input name="estado" type="text" value="${escapeHtml(d.estado||'')}" />
                        </div>

                        <div class="field">
                            <label class="label">Cidade</label>
                            <input name="cidade" type="text" value="${escapeHtml(d.cidade||'')}" />
                        </div>

                        <div class="field">
                            <label class="label">Bairro</label>
                            <input name="bairro" type="text" value="${escapeHtml(d.bairro||'')}" />
                        </div>

                        <div class="field">
                            <label class="label">CEP</label>
                            <input name="cep" type="text" value="${escapeHtml(d.cep||'')}" />
                        </div>

                        <div class="field">
                            <label class="label">Descrição</label>
                            <textarea name="descricao">${escapeHtml(d.descricao||'')}</textarea>
                        </div>

                        <div class="field full-width">
                            <label class="label">Imagens</label>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <input name="imagens" type="file" multiple style="display:none;" />
                                <button type="button" id="add-images-btn">Adicionar Imagens</button>
                            </div>
                            <small style="color:#666;margin-top:5px;display:block;">Clique em "Adicionar Imagens" para selecionar múltiplas fotos (substitui as atuais)</small>
                        </div>

                        <div class="preview-wrap" style="margin-top:10px;">${imgUrl ? (d.imagens && d.imagens.length > 1 ? d.imagens.map(u=>`<img src="${resolveImageUrl(u)}" class="modal-img edit-preview" />`).join('') : `<img src="${imgUrl}" class="modal-img edit-preview" />`) : ''}</div>

                        <div class="form-actions" style="margin-top:12px;display:flex;justify-content:flex-end;gap:12px;">
                            <button class="btn cancel-edit" type="button">Cancelar</button>
                            <button class="btn primary save-edit" type="button">Salvar</button>
                        </div>
                    </div>
                </form>
            </div>
        `;
    }

    function escapeHtml(str){
        return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]||s));
    }

    async function submitEdit(ev, donation){
        ev.preventDefault();
        // form body is inside our modal markup; select the form container
        const formEl = modalContent.querySelector('div.modal-body') || modalContent.querySelector('form#edit-donation-form') || modalContent;
        const titulo = formEl.querySelector('input[name="titulo"]').value;
        const descricao = formEl.querySelector('textarea[name="descricao"]').value;
        const categoria = formEl.querySelector('select[name="categoria"]').value;
        const estadoConservacao = formEl.querySelector('select[name="estadoConservacao"]').value;
        const estado = formEl.querySelector('input[name="estado"]').value;
        const cidade = formEl.querySelector('input[name="cidade"]').value;
        const bairro = formEl.querySelector('input[name="bairro"]').value;
        const cep = formEl.querySelector('input[name="cep"]').value;
        const imagensInput = formEl.querySelector('input[name="imagens"]');
        const removedSet = modalContent._removedImages || new Set();
        const newFiles = modalContent._newFiles || [];

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
        if (bairro && String(bairro).trim()) fd.append('bairro', bairro);
        if (cep && String(cep).trim()) fd.append('cep', cep);
        // handle multiple images: if new files provided (selected in modal), append them; otherwise preserve existing references except removed ones
        if (newFiles && newFiles.length > 0) {
            for (let i = 0; i < newFiles.length; i++) {
                fd.append('imagens', newFiles[i]);
            }
        } else if (donation && donation.imagens && donation.imagens.length > 0) {
            donation.imagens.forEach(imgRef => {
                if (!removedSet.has(imgRef)) fd.append('imagens', imgRef);
            });
        } else if (donation && donation.imagem) {
            if (!removedSet.has(donation.imagem)) fd.append('imagens', donation.imagem);
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
            if (!res.ok) throw new Error('Falha ao excluir, recuse todos os interessados antes de excluir.');
            showModalMessage('Doação excluída.');
            await loadMinhasDoacoes();
            closeModal();
        } catch (err){
            showModalMessage('Erro: ' + err.message, true);
        }
    }

    async function confirmRecusar(donation){
        if (!confirm('Confirma que deseja cancelar seu interesse nesta doação?')) return;
        // try to determine interesse id and usuario id
        const interesseId = donation.interesseId || '';
        const usuarioId = donation.usuarioId || localStorage.getItem('userId') || (donation.usuario && (donation.usuario.id || donation.usuario.usuarioId)) || '';
        if (!interesseId){ showModalMessage('ID do interesse ausente. Não foi possível cancelar.', true); return; }

        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : { 'Content-Type': 'application/json' };
        try {
            let res;
            if (usuarioId) {
                // route: /interesse/cancelar/{idUsuario}/{idInteresse}
                res = await fetch(`${BACKEND_BASE_URL}/interesse/cancelar/${encodeURIComponent(usuarioId)}/${encodeURIComponent(interesseId)}`, { method: 'DELETE', headers });
            } else {
                // fallback
                res = await fetch(`${BACKEND_BASE_URL}/interesse/${encodeURIComponent(interesseId)}`, { method: 'DELETE', headers });
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