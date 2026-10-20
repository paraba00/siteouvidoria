# Ouvidoria Acadêmica

Site de ouvidoria para uma faculdade, com interface em português, React e Vite, API em Node.js e persistência em SQLite.

## Funcionalidades

- Envio de reclamações anônimas ou identificadas, com categoria, assunto e descrição.
- Geração de protocolo e chave de acesso para consultar o andamento e a resposta da ouvidoria.
- Login administrativo, listagem e consulta dos chamados, registro da solução e reabertura.
- Senhas protegidas com scrypt e sessões em cookies HttpOnly. Não há senha administrativa padrão nem cadastro público de administradores.

No modo anônimo, o servidor descarta nome e e-mail, mesmo que sejam enviados. O banco e os logs da aplicação não registram IPs; a infraestrutura de hospedagem pode manter seus próprios registros. O conteúdo da reclamação ainda pode identificar alguém: evite informações pessoais desnecessárias.

A chave de consulta é entregue no comprovante de envio e somente seu hash é armazenado. Guarde o protocolo e a chave; uma chave perdida não pode ser recuperada. A consulta pública não expõe os dados de identificação, e o administrador acessa os contatos apenas quando a pessoa escolhe se identificar.

## Instalação e desenvolvimento

Use **Node.js 24**; a versão de referência está em `.node-version` (24.19.0). O SQLite já faz parte do Node: não é necessário instalar um banco separado.

Na pasta do repositório:

```sh
npm ci
npm run dev
```

No ambiente de nuvem, use um cache gravável para a instalação:

```sh
cd /workspace/siteouvidoria
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
```

O modo de desenvolvimento inicia o Vite na porta 5173 e a API na porta 3000, com atualização durante a edição. Use o checkout existente; cada tarefa de nuvem já tem seu próprio ambiente isolado.

## Criar um administrador

Execute no mesmo diretório e com o mesmo `DATA_DIR` utilizado pelo servidor:

```sh
npm run admin:create
```

O terminal solicita o e-mail, uma senha de 12 a 256 caracteres e sua confirmação. A digitação da senha fica oculta. Depois, entre pela área administrativa do site. Execute novamente com outro e-mail para cadastrar outro administrador; o comando não sobrescreve contas existentes.

Para automação, o comando aceita as variáveis locais `ADMIN_EMAIL` e `ADMIN_PASSWORD` ou a opção `--stdin-json`. Forneça credenciais por um mecanismo seguro, sem colocá-las no histórico do terminal, no repositório ou nos scripts de instalação. Essas variáveis são usadas pelos comandos de cadastro e redefinição, não são necessárias para iniciar a aplicação e não são preenchidas pelo projeto.

## Redefinir a senha de um administrador

No terminal, dentro da pasta que contém `package.json`, execute:

```sh
npm run admin:reset-password
```

No PowerShell do Windows, use `npm.cmd run admin:reset-password`. Informe o e-mail da conta existente, a nova senha (12 a 256 caracteres) e a confirmação. A senha fica oculta durante a digitação. O comando mantém o e-mail, os chamados e as outras contas; encerra todas as sessões desse administrador. A conta deverá entrar novamente com a nova senha. Um e-mail sem conta cadastrada gera um erro e não cria um administrador.

Use o mesmo `DATA_DIR` do servidor. A redefinição exige acesso ao terminal da máquina que guarda o banco; não há recuperação por e-mail na tela de login. Para automação, o comando também aceita `--stdin-json` ou as variáveis locais `ADMIN_EMAIL` e `ADMIN_PASSWORD`, com os mesmos cuidados do cadastro.

Se baixou uma versão anterior do projeto, baixe o ZIP atualizado e copie os arquivos para a pasta atual, substituindo os arquivos de código quando solicitado. **Preserve a pasta `.data` e o arquivo `.env`**, se existirem: eles guardam seus dados e sua configuração. Pare o site antes da atualização e inicie novamente depois. Não execute o comando em uma pasta nova sem o seu banco, pois sua conta pertence ao banco original.

## Build e validação

```sh
npm test
npm run build
npm start
```

`npm test` executa testes de integração HTTP com bancos temporários, incluindo anonimato, consulta protegida, autenticação, resolução, reabertura e persistência após reiniciar. Não altera os dados da aplicação.

`npm run build` gera `dist/`. `npm start` atende o site compilado e a API na porta 3000. Os dados e as contas permanecem no banco ao reiniciar; os processos precisam ser iniciados novamente em uma nova instância. O endpoint `GET /api/health` confirma a resposta do servidor e o acesso ao banco.

Após gerar o build, `npm run test:browser` valida o fluxo completo no Chromium, com banco e administrador temporários. O teste inclui envio nas duas modalidades, comprovante, consulta, login, resolução, filtros, navegação por teclado no modal e uso em celular. Usa `/usr/bin/chromium` quando disponível; em outra máquina, defina `CHROMIUM_PATH` ou instale o navegador com `npx playwright install chromium`.

## Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta do servidor em `npm start`. |
| `HOST` | `127.0.0.1` | Interface de escuta. Defina `0.0.0.0` se a hospedagem precisar acessar o processo por outra interface. |
| `DATA_DIR` | `.data/` no repositório | Diretório do arquivo `ouvidoria.sqlite`. Use um volume persistente na hospedagem. |
| `COOKIE_SECURE` | `false` | Defina `true` ao servir a aplicação por HTTPS. |
| `APP_ORIGIN` | Origem da requisição | Origem pública exata, incluindo esquema e eventual porta, sem caminho ou barra final; configure atrás de um proxy reverso. |

O arquivo `.env.example` contém somente opções sem credenciais. A aplicação não carrega `.env` automaticamente. Exporte as variáveis no ambiente ou, para iniciar o servidor compilado com um arquivo local:

```sh
cp .env.example .env
# Edite .env conforme o ambiente.
node --env-file=.env server/index.js
```

Se usar um `DATA_DIR` personalizado, forneça o mesmo valor ao criar administradores. Os arquivos `.env`, o banco, as dependências e os builds estão ignorados pelo Git.

## Hospedagem e dados

O projeto não foi publicado automaticamente. Para uso institucional, configure domínio, HTTPS, `COOKIE_SECURE=true`, `APP_ORIGIN` e armazenamento persistente para o banco. Mantenha o diretório de dados com acesso restrito e fora de diretórios públicos.

Há limites de tentativas por endereço de conexão para envio, consulta e login. Atrás de um proxy ou em uma rede compartilhada, usuários podem compartilhar essa cota; ajuste essa política na implantação conforme a infraestrutura da faculdade.

Faça backups consistentes com a SQLite Online Backup API ou com o comando `.backup` do cliente SQLite. Não copie apenas o arquivo principal enquanto o banco está ativo: o modo WAL pode manter alterações nos arquivos auxiliares. Guarde backups fora do repositório e verifique a restauração.

A identidade visual usa o nome genérico “Ouvidoria Acadêmica”. O escopo atual inclui login apenas para administradores; não inclui envio de e-mail, anexos nem contas de alunos.
