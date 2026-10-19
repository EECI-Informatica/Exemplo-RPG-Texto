# RPG de Texto

Aplicação web de RPG narrativo com cadastro, login por sessão e progresso salvo no MySQL.

## Requisitos

- Node.js 20 ou superior
- Um banco MySQL acessível pelo servidor, como o banco criado no FreeSQLDatabase
- Credenciais do banco configuradas localmente

## Configuração

1. Instale as dependências:

   ```sh
   npm install
   ```

2. Crie o arquivo local `.env` a partir do exemplo:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Preencha `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` com os dados do painel do provedor. Substitua também `SESSION_SECRET` por uma chave aleatória longa.

   O `.env` contém credenciais e está listado no `.gitignore`; não o envie ao Git. O arquivo `.env.example` contém somente valores fictícios e deve ser versionado.

4. Inicie o servidor:

   ```sh
   npm start
   ```

5. Abra [http://localhost:3000](http://localhost:3000).

Na inicialização, o servidor testa a conexão e cria a tabela `usuarios` se ela ainda não existir. O save da história é armazenado como JSON serializado em uma coluna `LONGTEXT` para compatibilidade com a versão MySQL do provedor.

## Comandos

- `npm start`: inicia o servidor e exige as variáveis MySQL no `.env`.
- `npm run check`: verifica a sintaxe dos arquivos JavaScript do servidor e das páginas.

## Estrutura

- `server.js`: servidor Express, sessão, conexão MySQL e endpoints da API.
- `index.html` e `login.js`: tela e fluxo de login.
- `cadastro.html` e `cadastro.js`: tela e fluxo de cadastro.
- `rpg.html` e `rpg.js`: interface, história e interação do RPG.
- `styles.css`: estilos compartilhados das páginas.
- `.env.example`: modelo das variáveis de ambiente, sem credenciais reais.

## API

- `POST /api/cadastro`: cria uma conta.
- `POST /api/login`: valida as credenciais e cria a sessão.
- `POST /api/logout`: encerra a sessão.
- `GET /api/save`: carrega o save da conta autenticada.
- `PUT /api/save`: salva o progresso da conta autenticada.

Os endpoints de save exigem uma sessão válida. O acesso direto a `/rpg.html` também redireciona para o login quando não há sessão.

## Segurança e limitações

Este projeto está em desenvolvimento. Atualmente, as senhas são armazenadas e comparadas em texto puro, conforme a implementação atual. **Não use essa configuração em produção nem em um banco com contas reais.** Antes de publicar ou disponibilizar o serviço, migre para hash de senha com salt, configure HTTPS e use um armazenamento de sessão persistente apropriado. O `MemoryStore` padrão do Express não é recomendado para produção e as sessões são perdidas ao reiniciar o servidor.

O save é associado ao usuário autenticado no MySQL; o navegador mantém apenas o nome usado para exibição.