document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('donation-form');
    const message = document.getElementById('form-message');
    const submitBtn = form.querySelector('.create-btn');
    const fileInput = form.querySelector('input[name="imagem"]');
    const previewWrap = document.getElementById('image-preview');

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.style.color = isError ? '#9b2c2c' : '#2d6a4f';
    }

    // Image preview
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) {
            previewWrap.innerHTML = '';
            previewWrap.style.display = 'none';
            return;
        }
        if (!file.type.startsWith('image/')) {
            showMessage('Por favor envie uma imagem válida.', true);
            return;
        }
        const url = URL.createObjectURL(file);
        previewWrap.innerHTML = `<img src="${url}" alt="Preview da imagem" />`;
        previewWrap.style.display = 'block';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        message.textContent = '';

        const fd = new FormData(form);
        // helpful debug: list all form-data entries (files show as File objects)
        console.log('FormData entries:', Array.from(fd.entries()));

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
            // ensure usuarioId is present and prefer logged-in user id
            const storedUserId = localStorage.getItem('userId');
            if (storedUserId) fd.set('usuarioId', storedUserId);
            console.log('Final FormData entries before sending:', Array.from(fd.entries()));

            // send Authorization if token available
            const token = localStorage.getItem('token');
            const headers = {};
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            console.log('Sending request to', `${BACKEND_BASE_URL}/doacoes`, 'with token?', !!token);

            const res = await fetch(`${BACKEND_BASE_URL}/doacoes`, {
                method: 'POST',
                headers,
                body: fd
            });

            if (res.ok) {
                showMessage('Doação criada com sucesso! ✅');
                form.reset();
                previewWrap.innerHTML = '';
                previewWrap.style.display = 'none';
            } else if (res.status === 403) {
                showMessage('Acesso negado (403). Verifique se você está autenticado e se o token é válido.', true);
            } else {
                // try to parse error body
                let txt = '';
                try { txt = await res.text(); } catch(e) { txt = res.statusText; }
                showMessage('Falha ao criar: ' + (txt || res.status), true);
            }
        } catch (err) {
            showMessage('Erro de rede: ' + err.message, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Criar doação';
        }
    });
});