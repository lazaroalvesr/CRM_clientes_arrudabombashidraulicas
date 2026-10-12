# Plataforma Arruda Bombas

A aplicação funcional está na pasta [plataforma](plataforma/README.md). Ela está preparada para Vercel + Neon e não utiliza Docker. Os arquivos do modelo inicial nesta pasta superior foram preservados e não são usados pela aplicação.

1. Importe o repositório na Vercel e selecione `plataforma` como Root Directory.
2. Instale Neon pelo Marketplace e conecte o banco ao projeto.
3. Configure `DATABASE_URL`, `APP_ORIGIN`, as variáveis SMTP e `SEED_USERS_JSON` com os três e-mails autorizados.
4. Execute `npm run migrate:neon` e depois `npm run seed:users` com a `DATABASE_URL` para criar as tabelas e as três contas.
5. Faça o deploy. Cada pessoa usa **Esqueceu sua senha?** para receber o primeiro link e definir a própria senha.

Não há login ou senha padrão. A base começa vazia e somente os três e-mails configurados no seed podem entrar. Não existe cadastro de usuários na plataforma. A recuperação usa SMTP comum, sem Resend. É possível cadastrar empresas verificadas, pesquisar na base e salvar leads. A fonte externa de empresas ainda será definida; a integração não foi ativada.

O guia de instalação e o contrato do provedor estão em `plataforma/`.
