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

        // redireciona após login
        window.location.href = './inicio.html';

    } catch (error) {
        alert(error.message);
    }
});