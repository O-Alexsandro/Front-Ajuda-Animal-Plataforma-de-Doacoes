document.addEventListener('DOMContentLoaded', () => {
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

        // entrance
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
    const form = document.getElementById('form-esqueci') || document.getElementById('form-login');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = (form.querySelector('input[name="nome"]') || {}).value.trim();
        const email = (form.querySelector('input[name="email"]') || {}).value.trim();
        const novaSenha = (form.querySelector('input[name="senha"]') || {}).value || '';

        if (!nome) { showPopup('Informe seu nome completo.', 'error'); return; }
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showPopup('Informe um e-mail válido.', 'error'); return; }
        if (!novaSenha || novaSenha.length < 8 || novaSenha.length > 128) { showPopup('A nova senha deve ter entre 8 e 128 caracteres.', 'error'); return; }

        const btn = form.querySelector('button[type="submit"]');
        const prevText = btn ? btn.textContent : null;
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

        try {
            const res = await fetch(`${BACKEND_BASE_URL}/usuarios/reset-senha`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, novaSenha })
            });

            if (res.ok) {
                showPopup('Senha redefinida com sucesso. Faça login com a nova senha.', 'success');
                setTimeout(() => { location.href = './login.html'; }, 800);
                return;
            }

            // try to parse error message
            let errText = 'Erro ao redefinir a senha.';
            try { const j = await res.json(); if (j && j.message) errText = j.message; } catch(e){ /* ignore */ }
            showPopup(errText, 'error');
        } catch (err) {
            console.error(err);
            showPopup('Ocorreu um erro de rede. Tente novamente mais tarde.', 'error');
        } finally {
            if (btn) { btn.disabled = false; if (prevText) btn.textContent = prevText; }
        }
    });
});
