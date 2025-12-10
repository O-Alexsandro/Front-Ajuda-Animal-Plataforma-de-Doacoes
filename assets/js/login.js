document.getElementById('form-login').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('password').value;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/login`
, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      if (!response.ok) {
        // 400‒499 → erro de credencial; 500+ → erro do servidor
        const msg = response.status === 401 ? 'Credenciais inválidas!' : 'Erro ao fazer login.';
        showToast(msg, 'error');
        return;
      }

      const { token } = await response.json();
      localStorage.setItem('token', token);         // grava token
      const payload = parseJwt(token);   
      console.log("Esse é o payload" + payload?.role)           // extrai dados do JWT
      const role = payload?.role || 'user';    

      // guarda o papel para usar depois
      localStorage.setItem('role', role);

      console.log("A role é essa: " + role)

      // Redireciona para a tela da aplicação
      localStorage.setItem('lastLoginEmail', payload.sub || email);
    
      window.location.href = 'inicio.html?login=success'; // Adiciona parâmetro na URL
      // Exibe mensagem de boas-vindas
      showToast(`Bem‑vindo, ${payload.sub || email}!`, 'success');
  } catch (err) {
      console.error(err);
      showToast('Não foi possível entrar. Tente novamente.', 'error');
  }
});


function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  
  // Cria o toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`; // Usando suas classes
  toast.textContent = message;
  
  // Adiciona o toast ao container
  container.appendChild(toast);
  
  // Animação de entrada
  toast.style.transform = 'translateY(100%)';
  toast.style.opacity = '0';
  setTimeout(() => {
      toast.style.transition = 'all 0.3s ease';
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
  }, 10);
  
  // Remove após 3 segundos
  setTimeout(() => {
      toast.style.transform = 'translateY(100%)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
  }, 3000);
}