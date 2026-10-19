// Lê as configurações locais sem colocar credenciais diretamente no código.
require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');

const app = express();
// Render termina HTTPS no proxy e encaminha a requisição ao Node por HTTP.
// Confiar no primeiro proxy permite detectar HTTPS e emitir o cookie Secure da sessão.
app.set('trust proxy', 1);

const port = process.env.PORT || 3000;
const sessionCookieName = 'rpg.sid';

// O pool reutiliza conexões MySQL em vez de abrir uma conexão por requisição.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});
const cookieOptions = {
  httpOnly: true,
  secure: app.get('env') === 'production',
  sameSite: 'strict',
  maxAge: 30 * 60 * 1000,
  path: '/'
};

// Converte JSON recebido pela API e habilita sessões autenticadas por cookie.
app.use(express.json({ limit: '10kb' }));
app.use(session({
  name: sessionCookieName,
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: cookieOptions
}));

function servePage(page) {
  return (request, response) => response.sendFile(path.join(__dirname, page));
}

// Entrega as páginas e os recursos estáticos do frontend.
app.get('/', servePage('index.html'));
app.get('/index.html', servePage('index.html'));
app.get('/cadastro.html', servePage('cadastro.html'));
app.get('/styles.css', servePage('styles.css'));
app.get('/login.js', servePage('login.js'));
app.get('/cadastro.js', servePage('cadastro.js'));
app.get('/rpg.js', servePage('rpg.js'));

function requireLogin(request, response, next) {
  // Só permite acessar rotas protegidas quando o login criou uma sessão.
  if (!request.session.usuario) {
    return response.redirect('/index.html');
  }

  return next();
}

app.get('/rpg.html', requireLogin, servePage('rpg.html'));

// Cria a tabela se ainda não existir. O save fica em LONGTEXT com JSON serializado,
// pois o MySQL disponibilizado pelo provedor não aceita a coluna JSON.
async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      usuario VARCHAR(30) NOT NULL,
      usuario_normalizado VARCHAR(30) NOT NULL,
      senha VARCHAR(255) NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      save_json LONGTEXT DEFAULT NULL,
      save_atualizado_em TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY usuarios_usuario_normalizado_unique (usuario_normalizado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// Valida os dados e insere a conta; o índice UNIQUE do banco impede nomes duplicados.
app.post('/api/cadastro', async (request, response, next) => {
  const body = request.body || {};
  const username = typeof body.usuario === 'string' ? body.usuario.trim() : '';
  const password = typeof body.senha === 'string' ? body.senha : '';

  if (username.length < 3 || username.length > 30) {
    return response.status(400).json({
      mensagem: 'O usuário deve ter entre 3 e 30 caracteres.'
    });
  }

  if (password.length < 8) {
    return response.status(400).json({
      mensagem: 'A senha deve ter pelo menos 8 caracteres.'
    });
  }

  try {
    const normalizedUsername = username.toLocaleLowerCase('pt-BR');
    // Os placeholders evitam montar SQL concatenando dados enviados pelo usuário.
    await pool.execute(
      'INSERT INTO usuarios (usuario, usuario_normalizado, senha) VALUES (?, ?, ?)',
      [username, normalizedUsername, password]
    );
    return response.status(201).json({ mensagem: 'Cadastro realizado com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ mensagem: 'Esse usuário já está cadastrado.' });
    }
    return next(error);
  }
});

// Retorna apenas o save ligado à conta da sessão atual.
app.get('/api/save', requireLogin, async (request, response, next) => {
  try {
    const normalizedUsername = request.session.usuario.toLocaleLowerCase('pt-BR');
    const [rows] = await pool.execute(
      'SELECT save_json FROM usuarios WHERE usuario_normalizado = ? LIMIT 1',
      [normalizedUsername]
    );
    const save = rows[0] ? rows[0].save_json : null;
    return response.json({ save: typeof save === 'string' ? JSON.parse(save) : save });
  } catch (error) {
    return next(error);
  }
});

// Confere a estrutura do progresso antes de gravá-lo no registro do usuário.
app.put('/api/save', requireLogin, async (request, response, next) => {
  const body = request.body || {};
  const validScenes = ['vila', 'final', 'fim'];
  const validState = typeof body === 'object'
    && !Array.isArray(body)
    && validScenes.includes(body.cena)
    && typeof body.chave === 'boolean'
    && typeof body.aliada === 'boolean'
    && typeof body.verso === 'boolean';

  if (!validState) {
    return response.status(400).json({ mensagem: 'Estado do jogo inválido.' });
  }

  try {
    const normalizedUsername = request.session.usuario.toLocaleLowerCase('pt-BR');
    const [users] = await pool.execute(
      'SELECT id FROM usuarios WHERE usuario_normalizado = ? LIMIT 1',
      [normalizedUsername]
    );
    if (users.length === 0) {
      return response.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    // O save é serializado como JSON e associado ao usuário autenticado, não ao cliente.
    await pool.execute(
      'UPDATE usuarios SET save_json = ?, save_atualizado_em = CURRENT_TIMESTAMP WHERE usuario_normalizado = ?',
      [JSON.stringify(body), normalizedUsername]
    );
    return response.json({ mensagem: 'Jogo salvo.' });
  } catch (error) {
    return next(error);
  }
});

// Consulta o usuário pelo nome normalizado e valida as credenciais enviadas.
app.post('/api/login', async (request, response, next) => {
  const body = request.body || {};
  const username = typeof body.usuario === 'string' ? body.usuario.trim() : '';
  const password = typeof body.senha === 'string' ? body.senha : '';

  if (!username || !password) {
    return response.status(400).json({ mensagem: 'Informe usuário e senha.' });
  }

  try {
    const normalizedUsername = username.toLocaleLowerCase('pt-BR');
    const [rows] = await pool.execute(
      'SELECT usuario, senha FROM usuarios WHERE usuario_normalizado = ? LIMIT 1',
      [normalizedUsername]
    );
    const user = rows[0];
    if (!user || user.senha !== password) {
      return response.status(401).json({ mensagem: 'Usuário ou senha inválidos.' });
    }

    // Troca o identificador da sessão após autenticar para evitar reaproveitar uma sessão antiga.
    return request.session.regenerate((sessionError) => {
      if (sessionError) return next(sessionError);

      request.session.usuario = user.usuario;
      return request.session.save((saveError) => {
        if (saveError) return next(saveError);
        return response.json({ mensagem: 'Login realizado com sucesso.', usuario: user.usuario });
      });
    });
  } catch (error) {
    return next(error);
  }
});

// Encerra a sessão no servidor e remove o cookie do navegador.
app.post('/api/logout', (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);

    response.clearCookie(sessionCookieName, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path
    });
    return response.status(204).end();
  });
});

// Centraliza erros das rotas e evita expor detalhes internos ao navegador.
app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({ mensagem: 'Não foi possível concluir a operação.' });
});

// O servidor só começa a aceitar requisições depois de validar a conexão e preparar a tabela.
async function startServer() {
  const requiredSettings = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingSettings = requiredSettings.filter((setting) => !process.env[setting]);

  if (missingSettings.length) {
    throw new Error(`Configure no arquivo .env: ${missingSettings.join(', ')}`);
  }

  await pool.query('SELECT 1');
  await createTables();
  app.listen(port, () => {
    console.log(`Servidor disponível em http://localhost:${port}`);
  });
}

startServer().catch(async (error) => {
  console.error('Não foi possível iniciar o servidor MySQL:', error.message);
  await pool.end();
  process.exitCode = 1;
});