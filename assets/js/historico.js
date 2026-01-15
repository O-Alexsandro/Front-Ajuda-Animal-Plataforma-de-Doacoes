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
            const statusText = donation.statusInteresse ? donation.statusInteresse : 'Pendente';
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
        document.getElementById('modal-recusar-btn')?.addEventListener('click', () => confirmRecusar(donation));
        document.getElementById('modal-close-btn')?.addEventListener('click', () => closeModal());
        const closeBtns = modal.querySelectorAll('.modal-close');
        closeBtns.forEach(b => b.addEventListener('click', closeModal));
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
                    <button id="modal-edit-btn" class="btn primary">Editar</button>
                    <button id="modal-delete-btn" class="btn danger">Excluir</button>
                </div>
            `;
        } else if (isInterest) {
            editButtons = `
                <div class="modal-actions">
                    <button id="modal-recusar-btn" class="btn danger">Recusar Interesse</button>
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

        const fd = new FormData();
        fd.append('id', donation.id || donation._id || donation.codigo || donation.idDoacao || '');
        fd.append('titulo', titulo);
        fd.append('descricao', descricao);
        fd.append('categoria', categoria);
        fd.append('estadoConservacao', estadoConservacao);
        fd.append('estado', estado);
        fd.append('cidade', cidade);
        if (imagemInput && imagemInput.files && imagemInput.files[0]) fd.append('imagem', imagemInput.files[0]);

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
        if (!confirm('Confirma que deseja recusar seu interesse nesta doação?')) return;
        const id = donation.id || donation._id || donation.codigo || donation.idDoacao || '';
        if (!id){ showModalMessage('ID da doação ausente. Não foi possível recusar.', true); return; }
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : { 'Content-Type': 'application/json' };
        try {
            const res = await fetch(`${BACKEND_BASE_URL}/interesse/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
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