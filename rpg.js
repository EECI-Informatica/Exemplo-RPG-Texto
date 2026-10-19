// Referências à janela de texto e aos controles da tela do RPG.
const output = document.getElementById('gameOutput');
const input = document.getElementById('commandInput');
const button = document.getElementById('sendCommand');
const logoutBtn = document.querySelector('.logout-btn');

const usuario = localStorage.getItem('rpgUsuario') || 'Jogador';
// Estado atual da história; é salvo no banco por meio da API autenticada.
let historia = { cena: 'menu', chave: false, aliada: false, verso: false };
// Mantém gravações consecutivas na ordem e evita que um save antigo termine por último.
let saveQueue = Promise.resolve();

// Acrescenta uma fala à área de texto e mantém a mensagem mais recente visível.
function appendMessage(message) {
  const line = document.createElement('p');
  line.textContent = message;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function appendCommandDivider() {
  const divider = document.createElement('hr');
  divider.className = 'command-divider';
  output.appendChild(divider);
  output.scrollTop = output.scrollHeight;
}

// Copia o estado atual e coloca a requisição na fila de saves para preservar a ordem.
function salvarHistoria() {
  const snapshot = { ...historia };
  saveQueue = saveQueue.then(async () => {
    const response = await fetch('/api/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    });

    if (!response.ok) throw new Error('Não foi possível salvar a aventura.');
  }).catch(() => {
    appendMessage('Não foi possível salvar seu progresso no servidor.');
  });
}

function mostrarMenu() {
  historia.cena = 'menu';
  appendMessage('');
  appendMessage('Escolha como deseja começar:');
  appendMessage('1 - Novo jogo');
  appendMessage('2 - Carregar jogo salvo');
}

// Reinicia o estado da aventura e apresenta a introdução da história.
function iniciarNovoJogo() {
  historia = { cena: 'vila', chave: false, aliada: false, verso: false };
  salvarHistoria();
  appendMessage('');
  appendMessage('AS CINZAS DE BRUMAFRIA');
  appendMessage('A chuva cai sobre Brumafria quando o sino da torre toca pela terceira vez. O som é tão grave que apaga as luzes da vila.');
  appendMessage('Quando a claridade volta, Mira, a aprendiz da torre, desapareceu. Do alto da colina, uma sombra observa a vila.');
  appendMessage('Você decide encontrar Mira antes que o sino toque novamente.');
  mostrarVila();
}

async function carregarJogo() {
  try {
    // O servidor identifica a conta pela sessão e devolve apenas o save desse usuário.
    const response = await fetch('/api/save');
    const result = await response.json();
    if (!response.ok) throw new Error(result.mensagem || 'Não foi possível carregar o jogo.');

    const dados = result.save;
    if (!dados) {
      appendMessage('Nenhum jogo salvo foi encontrado. Digite "1" para começar uma nova aventura.');
      mostrarMenu();
      return;
    }

    if (!['vila', 'final', 'fim'].includes(dados.cena)) throw new Error('Save inválido.');
    historia = dados;
    appendMessage('');
    appendMessage('A aventura de Brumafria foi retomada.');
    if (historia.cena === 'fim') {
      appendMessage('Esta história já chegou ao fim. Digite "novo" para começar outra aventura.');
    } else if (historia.cena === 'final') {
      mostrarEscolhaFinal();
    } else {
      appendMessage('Mira ainda está desaparecida e o sino da torre continua ameaçando a vila.');
      mostrarVila();
    }
  } catch (error) {
    appendMessage('Não foi possível carregar o jogo salvo. Tente novamente.');
  }
}

function mostrarVila() {
  historia.cena = 'vila';
  salvarHistoria();
  appendMessage('');
  appendMessage('Brumafria espera por você. A taverna ainda tem as janelas acesas, a floresta esconde luzes azuis e as ruínas da capela ficam junto ao caminho da torre.');
  appendMessage('1 - Visitar a taverna');
  appendMessage('2 - Procurar na floresta');
  appendMessage('3 - Investigar a capela em ruínas');
  appendMessage('4 - Subir até a torre do sino');
}

// Cada local concede uma pista ou personagem; as descobertas ficam no estado salvo.
function visitarTaverna() {
  appendMessage('Na taverna, o velho anfitrião Baltasar reconhece o desenho que você encontrou na porta da torre.');
  if (!historia.chave) {
    historia.chave = true;
    appendMessage('Ele entrega uma chave de ferro: "Mira deixou isto comigo. A torre não deve ser aberta quando o sino chama."');
  } else {
    appendMessage('Baltasar repete o aviso: "A torre não deve ser aberta quando o sino chama."');
  }
  mostrarVila();
}

function procurarFloresta() {
  appendMessage('Entre os pinheiros, pequenas luzes azuis conduzem você até uma clareira. Mira está escondida sob as raízes de uma árvore antiga.');
  if (!historia.aliada) {
    historia.aliada = true;
    appendMessage('Você a ajuda a escapar. Mira conta que a sombra nasceu do sino e decide acompanhar você até a torre.');
  } else {
    appendMessage('Mira caminha ao seu lado. Ela conhece uma passagem segura até a torre.');
  }
  mostrarVila();
}

function investigarCapela() {
  appendMessage('Na capela, há um verso gravado sob o altar: "A porta cede à chave; a sombra recua diante da verdade; o sino dorme quando seu nome é lembrado."');
  if (!historia.verso) {
    historia.verso = true;
    appendMessage('Você memoriza o verso. As letras brilham por um instante e depois viram pó.');
  } else {
    appendMessage('Você repete o verso em voz baixa. Agora sabe como enfrentar o sino.');
  }
  mostrarVila();
}

function subirTorre() {
  // Impede o final até o jogador reunir os três requisitos da história.
  const faltam = [];
  if (!historia.chave) faltam.push('a chave de ferro da taverna');
  if (!historia.aliada) faltam.push('Mira, que está na floresta');
  if (!historia.verso) faltam.push('o verso antigo da capela');

  if (faltam.length) {
    appendMessage('A porta da torre vibra com cada toque do sino. Para entrar, ainda falta: ' + faltam.join(', ') + '.');
    mostrarVila();
    return;
  }

  historia.cena = 'final';
  mostrarEscolhaFinal();
  salvarHistoria();
}

function mostrarEscolhaFinal() {
  appendMessage('A chave gira na fechadura. No alto da torre, a sombra envolve o sino e sussurra o nome de Mira.');
  appendMessage('Mira segura a mão de você. O verso da capela volta à memória. A decisão é sua:');
  appendMessage('1 - Dizer o verdadeiro nome do sino e tentar libertar a sombra');
  appendMessage('2 - Quebrar o sino para salvar a vila, mesmo sem saber o que será libertado');
}

// A lista de ajuda acompanha a cena atual, para mostrar apenas escolhas disponíveis.
function mostrarAjuda() {
  appendMessage('Ajuda do momento:');
  if (historia.cena === 'menu') {
    appendMessage('1 - Começar uma nova aventura');
    appendMessage('2 - Carregar o jogo salvo');
  } else if (historia.cena === 'vila') {
    appendMessage('1 - Visitar a taverna para procurar a chave');
    appendMessage('2 - Procurar Mira na floresta');
    appendMessage('3 - Investigar a capela e descobrir o verso');
    appendMessage('4 - Ir à torre do sino');
  } else if (historia.cena === 'final') {
    appendMessage('1 - Dizer o verdadeiro nome do sino');
    appendMessage('2 - Quebrar o sino');
  } else {
    appendMessage('Digite "novo" para começar uma nova aventura ou "ajuda" para ver as opções.');
  }
}

function processCommand(command) {
  const text = command.trim().toLocaleLowerCase('pt-BR');

  if (!text) {
    appendMessage('Você não digitou nenhuma ação.');
    return;
  }

  if (text === 'ajuda' || text === 'help') {
    mostrarAjuda();
    return;
  }

  if (historia.cena === 'menu') {
    if (text === '1' || text.includes('novo')) {
      iniciarNovoJogo();
    } else if (text === '2' || text.includes('carregar')) {
      carregarJogo();
    } else {
      appendMessage('Escolha "1 - Novo jogo" ou "2 - Carregar jogo salvo".');
    }
    return;
  }

  if (historia.cena === 'vila') {
    if (text === '1' || text.includes('taverna')) {
      visitarTaverna();
    } else if (text === '2' || text.includes('floresta') || text.includes('mira')) {
      procurarFloresta();
    } else if (text === '3' || text.includes('capela') || text.includes('ruina')) {
      investigarCapela();
    } else if (text === '4' || text.includes('torre') || text.includes('sino')) {
      subirTorre();
    } else {
      appendMessage('Escolha uma das opções da vila ou digite "ajuda".');
    }
    return;
  }

  if (historia.cena === 'final') {
    if (text === '1' || text.includes('nome') || text.includes('libertar')) {
      historia.cena = 'fim';
      appendMessage('Você pronuncia o nome esquecido: Elarion. A sombra se desfaz em milhares de pontos de luz. O sino toca uma última vez, agora suave.');
      appendMessage('Mira volta para Brumafria, e a vila acende suas lanternas. Na manhã seguinte, todos se lembram do próprio nome.');
      appendMessage('FINAL: A luz que voltou.');
    } else if (text === '2' || text.includes('quebrar')) {
      historia.cena = 'fim';
      appendMessage('Você ergue uma pedra e golpeia o sino. O metal se parte; a sombra desaparece, mas uma onda de silêncio cobre a vila.');
      appendMessage('Mira está salva. Brumafria também, embora ninguém volte a ouvir música naquela noite.');
      appendMessage('FINAL: O preço do silêncio.');
    } else {
      appendMessage('Escolha "1" para dizer o nome do sino ou "2" para quebrá-lo.');
      return;
    }
    salvarHistoria();
    appendMessage('Digite "novo" para jogar novamente.');
    return;
  }

  if (historia.cena === 'fim' && (text === '1' || text.includes('novo'))) {
    iniciarNovoJogo();
    return;
  }

  appendMessage('A aventura chegou ao fim. Digite "novo" para começar novamente ou "ajuda" para ver as opções.');
}

// Mensagem inicial; a pessoa escolhe começar uma aventura ou carregar o progresso.
appendMessage('Bem-vindo, ' + usuario + '!');
appendMessage('');
mostrarMenu();

button.addEventListener('click', function () {
  const command = input.value;
  appendCommandDivider();
  appendMessage('> ' + command);
  processCommand(command);
  input.value = '';
  input.focus();
});

// O logout encerra primeiro a fila de saves e depois destrói a sessão no servidor.
logoutBtn.addEventListener('click', async function () {
  logoutBtn.disabled = true;

  try {
    await saveQueue;
    const response = await fetch('/api/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Falha ao encerrar a sessão.');

    localStorage.removeItem('rpgUsuario');
    window.location.href = 'index.html';
  } catch (error) {
    appendMessage('Não foi possível encerrar a sessão. Tente novamente.');
    logoutBtn.disabled = false;
  }
});

input.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    const command = input.value;
    appendCommandDivider();
    appendMessage('> ' + command);
    processCommand(command);
    input.value = '';
    input.focus();
  }
});