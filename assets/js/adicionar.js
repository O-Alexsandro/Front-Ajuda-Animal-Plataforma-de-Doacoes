document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('donation-form');
    const message = document.getElementById('form-message');
    const submitBtn = form.querySelector('.create-btn');
    const fileInput = document.querySelector('input[name="imagens"]');
    const previewWrap = document.getElementById('image-preview');
    const addImagesBtn = document.getElementById('add-images-btn');

    // Array to store selected files
    let selectedFiles = [];

    // logout functionality
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = './login.html';
        });
    }

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.style.color = isError ? '#9b2c2c' : '#2d6a4f';
    }

    // Function to update file input with current selected files
    function updateFileInput() {
        // Create a new DataTransfer to update the input
        const dt = new DataTransfer();
        selectedFiles.forEach(file => dt.items.add(file));
        fileInput.files = dt.files;
    }

    // Function to update preview
    function updatePreview() {
        if (selectedFiles.length === 0) {
            previewWrap.innerHTML = '';
            previewWrap.style.display = 'none';
            return;
        }

        const previews = selectedFiles.map((file, index) => {
            const url = URL.createObjectURL(file);
            return `
                <div style="position: relative; display: inline-block; margin: 5px;">
                    <img src="${url}" alt="Preview da imagem" style="max-width: 150px; max-height: 150px;" />
                    <button type="button" class="remove-image" data-index="${index}"
                            style="position: absolute; top: 0; right: 0; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer;">×</button>
                </div>
            `;
        }).join('');

        previewWrap.innerHTML = `<div style="display: flex; flex-wrap: wrap;">${previews}</div>`;
        previewWrap.style.display = 'block';

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                selectedFiles.splice(index, 1);
                updateFileInput();
                updatePreview();
            });
        });
    }

    // Add images button
    addImagesBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Image selection
    fileInput.addEventListener('change', () => {
        const newFiles = Array.from(fileInput.files);

        // Validate new files
        for (let file of newFiles) {
            if (!file.type.startsWith('image/')) {
                showMessage('Por favor envie apenas imagens válidas.', true);
                return;
            }
            // Check for duplicates
            if (selectedFiles.some(existing => existing.name === file.name && existing.size === file.size)) {
                showMessage('Esta imagem já foi selecionada.', true);
                return;
            }
        }

        // Add new files to selected files
        selectedFiles = selectedFiles.concat(newFiles);

        // Clear the input so user can select more files
        fileInput.value = '';

        updatePreview();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        message.textContent = '';

        // Validate that at least one image is selected
        if (selectedFiles.length === 0) {
            showMessage('Por favor, selecione pelo menos uma imagem para a doação.', true);
            return;
        }

        const fd = new FormData();

        // Add all form fields except files
        const formData = new FormData(form);
        for (let [key, value] of formData.entries()) {
            if (key !== 'imagens') { // Skip the file input
                fd.append(key, value);
            }
        }

        // Add all selected images
        selectedFiles.forEach((file, index) => {
            fd.append('imagens', file);
        });

        // helpful debug: list all form-data entries (files show as File objects)
        console.log('FormData entries:', Array.from(fd.entries()));
        console.log('Selected files:', selectedFiles);
        console.log('Number of files:', selectedFiles.length);
        for (let i = 0; i < selectedFiles.length; i++) {
            console.log(`File ${i + 1}:`, selectedFiles[i].name, selectedFiles[i].size, selectedFiles[i].type);
        }

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
            // Don't set Content-Type manually - let browser set it for FormData
            console.log('Sending request to', `${BACKEND_BASE_URL}/doacoes`, 'with token?', !!token);
            console.log('Headers:', headers);

            const res = await fetch(`${BACKEND_BASE_URL}/doacoes`, {
                method: 'POST',
                headers,
                body: fd
            });

            if (res.ok) {
                showMessage('Doação criada com sucesso! ✅');
                form.reset();
                selectedFiles = [];
                updateFileInput();
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