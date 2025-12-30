const isOngCheckbox = document.getElementById('isOng');
const isDoadorCheckbox = document.getElementById('isDoador');
const roleInput = document.getElementById('role');
const roleError = document.getElementById('role-error');

function clearRoleError() {
    if (roleError) {
        roleError.hidden = true;
        roleError.textContent = '';
        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('error'));
    }
}

function showRoleError(msg) {
    if (roleError) {
        roleError.textContent = msg;
        roleError.hidden = false;
    }
    document.querySelectorAll('.role-card').forEach(c => c.classList.add('error'));
}

function updateRoleFromSelection(changed) {
    if (isOngCheckbox && changed === isOngCheckbox && isOngCheckbox.checked) {
        if (isDoadorCheckbox) isDoadorCheckbox.checked = false;
        roleInput.value = 'ONG';
        clearRoleError();
    } else if (isDoadorCheckbox && changed === isDoadorCheckbox && isDoadorCheckbox.checked) {
        if (isOngCheckbox) isOngCheckbox.checked = false;
        // Doador maps to ROLE_USUARIO
        roleInput.value = 'USUARIO';
        clearRoleError();
    } else {
        // none selected -> default to ROLE_USUARIO
        roleInput.value = 'USUARIO';
    }
}

if (isOngCheckbox) {
    isOngCheckbox.addEventListener('change', () => updateRoleFromSelection(isOngCheckbox));
}
if (isDoadorCheckbox) {
    isDoadorCheckbox.addEventListener('change', () => updateRoleFromSelection(isDoadorCheckbox));
}

const formLogin = document.getElementById('form-login');

formLogin.addEventListener('submit', async (event) => {
    event.preventDefault();

    // validação: obrigar seleção de tipo de conta
    const isOngChecked = document.getElementById('isOng').checked;
    const isDoadorChecked = document.getElementById('isDoador').checked;
    if (!isOngChecked && !isDoadorChecked) {
        const roleErrorEl = document.getElementById('role-error');
        if (roleErrorEl) {
            roleErrorEl.hidden = false;
            roleErrorEl.textContent = 'Selecione uma opção.';
        }
        document.querySelectorAll('.role-card').forEach(c => c.classList.add('error'));
        const firstCard = document.querySelector('.role-card');
        if (firstCard) firstCard.focus();
        return;
    }

    const nome = document.getElementById('email').value;
    const email = document.getElementById('email2').value;
    const senha = document.getElementById('password').value;
    const telefone = document.getElementById('telefone').value;
    const rua = document.getElementById('rua').value;
    const bairro = document.getElementById('bairro').value;
    const cidade = document.getElementById('cidade').value;
    const estado = document.getElementById('estado').value;
    const tipoDeConta = document.getElementById('role').value;

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/usuarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: nome,
                email: email,
                senha: senha,
                telefone: telefone,
                rua: rua,
                bairro: bairro,
                cidade: cidade,
                estado: estado,
                tipoDeConta: tipoDeConta

            })
        });

        console.log("Informações do body", nome, email, senha, telefone, rua, bairro, cidade, estado, tipoDeConta);


        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Erro no cadastro');
        }

        alert('Cadastro realizado com sucesso.');
        window.location.href = './login.html';
    } catch (error) {
        alert(error.message || 'Erro ao cadastrar');
    }
});