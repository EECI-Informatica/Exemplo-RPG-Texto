// Reúne os elementos usados no formulário e nas mensagens de retorno.
const loginForm = document.getElementById('loginForm');
const usuario = document.getElementById('usuario');
const senha = document.getElementById('senha');
const errorMessage = document.getElementById('errorMessage');
const loginButton = loginForm.querySelector('button[type="submit"]');

// Exibe o aviso após o cadastro e retorna o foco para o fluxo de login.
if (new URLSearchParams(window.location.search).get('cadastro') === 'sucesso') {
  errorMessage.textContent = 'Cadastro realizado com sucesso. Faça login para continuar.';
  errorMessage.classList.add('success-message');
  errorMessage.style.display = 'block';
}

// Envia as credenciais ao backend; só navega ao RPG se o servidor autenticá-las.
loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();

  const usuarioValido = usuario.value.trim();
  const senhaValida = senha.value;

  if (!usuarioValido || !senhaValida) {
    errorMessage.classList.remove('success-message');
    errorMessage.textContent = 'Preencha usuário e senha para continuar.';
    errorMessage.style.display = 'block';
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = 'Validando...';
  errorMessage.classList.remove('success-message');
  errorMessage.style.display = 'none';

  try {
    // fetch envia JSON e recebe a mensagem de sucesso ou erro da API.
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: usuarioValido, senha: senhaValida })
    });
    const result = await response.json();

    if (!response.ok) {
      errorMessage.textContent = result.mensagem;
      errorMessage.style.display = 'block';
      return;
    }

    localStorage.setItem('rpgUsuario', result.usuario);
    window.location.href = 'rpg.html';
  } catch (error) {
    errorMessage.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
    errorMessage.style.display = 'block';
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Login';
  }
});