// Elementos do formulário usados para validar os campos e informar o resultado.
const form = document.getElementById('registerForm');
const feedback = document.getElementById('feedback');
const submitButton = document.getElementById('submitButton');

// Intercepta o envio para conferir a confirmação e chamar a API de cadastro.
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  feedback.textContent = '';

  const usuario = document.getElementById('usuario').value.trim();
  const senha = document.getElementById('senha').value;
  const confirmarSenha = document.getElementById('confirmar-senha').value;

  if (senha !== confirmarSenha) {
    feedback.textContent = 'As senhas não coincidem.';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Cadastrando...';

  try {
    // O backend valida novamente os dados e grava o usuário no MySQL.
    const response = await fetch('/api/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha })
    });
    const result = await response.json();
    feedback.textContent = result.mensagem;

    if (response.ok) {
      form.reset();
      window.location.href = 'index.html?cadastro=sucesso';
    }
  } catch (error) {
    feedback.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Cadastrar';
  }
});