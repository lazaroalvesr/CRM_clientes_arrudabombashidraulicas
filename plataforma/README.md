# Arruda Bombas — Plataforma de prospecção

Aplicação independente com login próprio, banco de dados compartilhado e CMS interno de usuários. Esta é a implementação funcional; os arquivos do modelo inicial na pasta superior não fazem parte dela.

## Vercel + Neon

Não há Docker nesta versão. Publique o diretório `plataforma` na Vercel como Root Directory. No Marketplace da Vercel, instale a integração [Neon](https://vercel.com/integrations/neon) e conecte o banco ao projeto.

Cadastre estas variáveis na Vercel: `SUPABASE_DB_URL` fornecida pelo Supabase, `APP_ORIGIN` com a URL final do projeto, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` e `GOOGLE_MAPS_API_KEY`. O e-mail usa SMTP comum, sem Resend.

Depois de disponibilizar `SUPABASE_DB_URL` no ambiente local, execute `npm run migrate:supabase` uma vez e `npm run seed:users` uma única vez. O seed lê `SEED_USERS_JSON`, exige exatamente três e-mails diferentes e um administrador. Uma senha inicial opcional permite o primeiro login, mas cada conta precisa trocá-la antes de usar a plataforma. Isso cria tabelas para usuários, sessões, recuperação de senha, empresas, leads e auditoria no Postgres. A função `api/[...route].mjs` atende a API na Vercel e a pasta `public` contém a interface.

O painel **Usuários** mostra as três contas fixas da operação. Não há cadastro de usuários na plataforma nem necessidade de CMS externo.

## Iniciar

Requer Node.js 22.13 ou superior. Para o modo local SQLite, não depende de instalação de pacotes. Para migration, seed e deploy Vercel, execute `npm install` para instalar os clientes Neon e SMTP declarados no projeto.

```powershell
cd C:\Users\lazar\Documents\ChatGPT\CRM\plataforma
node --env-file-if-exists=.env server.mjs
```

Abra http://127.0.0.1:3000 e crie o primeiro administrador. Não há credenciais padrão. A criação inicial é encerrada assim que existe um usuário. Por padrão o servidor aceita apenas acesso local.

## Funcionalidades

- Login e senha próprios; senhas derivadas com scrypt e salt exclusivo; sessões de 8 horas em cookies HttpOnly/SameSite.
- Administração de vendedores e administradores; desativação, redefinição de senha provisória e troca obrigatória no primeiro acesso.
- Cadastro de empresas com fonte pública obrigatória, CNPJ opcional validado, localização, segmento, porte, contatos e estrutura.
- Pesquisa na base compartilhada por estado, cidade, segmento e porte; filtro de prioridade e ordenação.
- Prioridades A/B/C e pontuação explicável. Dados desconhecidos permanecem desconhecidos e não somam pontos.
- Meus Leads compartilhados, com autor, status e notas. Deduplicação no banco e proteção contra sobrescrever alterações de outra pessoa.
- WhatsApp abre em outra aba apenas quando o número foi informado. Nenhuma mensagem automática.
- Registro de eventos de acesso e alterações, disponível no banco para auditoria técnica.

## Dependências pendentes para operação externa

1. Escolher a fonte de empresas reais. **A busca na internet não está conectada.** O contrato do adaptador está em [docs/PROVIDER.md](docs/PROVIDER.md). Não há empresas fictícias no banco operacional.
2. Criar o projeto Vercel, provisionar Neon e executar a migration. A versão ainda não foi publicada para a equipe.
3. Definir os três e-mails em `SEED_USERS_JSON`, configurar SMTP e validar os pesos com a equipe comercial.

## Acesso da equipe em produção

Na Vercel, configure `APP_ORIGIN` com o domínio final, o SMTP e os três e-mails do seed antes do primeiro deploy. Execute a migration e o seed a partir de um terminal com as mesmas variáveis. A API não permite criar novas contas.

O Neon gerencia banco, backups e recuperação conforme o plano escolhido. Não há container, volume SQLite ou proxy para manter. Para uma equipe pequena, o Postgres garante sessões, leads compartilhados e deduplicação. A recuperação de senha envia um link SMTP de uso único e expira em 30 minutos.

Os controles de acesso são verificados no servidor, incluindo revogação de sessões após mudanças de usuário. Formulários exigem origem exata e cabeçalho próprio. SQL usa parâmetros. Conteúdo de empresas é escapado no navegador, links aceitam apenas HTTP/HTTPS, e CSP bloqueia scripts externos e inline.

## WhatsApp dentro do CRM

O CRM usa a biblioteca não oficial Baileys para conectar **um número da empresa** por QR Code. Depois de iniciar o servidor, o administrador abre **Configurações → WhatsApp da empresa** e lê o QR no celular em **Aparelhos conectados → Conectar aparelho**. Em um lead salvo que tenha WhatsApp, o responsável ou administrador pode ler e enviar mensagens de texto dentro dos detalhes. Cada envio guarda o usuário responsável; respostas do número cadastrado são associadas ao lead.

No computador local, as credenciais do aparelho conectado ficam em .data/whatsapp-auth e as mensagens ficam no SQLite. Para a VPS, configure WHATSAPP_AUTH_DIR=/data/whatsapp-auth, monte esse diretório como volume persistente, proteja-o contra acesso de outros usuários e rode **uma única instância** do servidor Node. O banco Postgres guarda as mensagens. Sem um diretório persistente, a conexão do WhatsApp interno fica indisponível. Hospedagem serverless, como Vercel Functions, não mantém a sessão WebSocket necessária.

Esta integração é apenas para mensagens de texto e envio manual. Não sincroniza todo o histórico antigo, mídia, áudio ou chamadas. Bibliotecas não oficiais podem parar de funcionar quando o WhatsApp muda o protocolo e podem contrariar os [termos do WhatsApp Business](https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App); há risco de restrição da conta. Para operação estável em produção, considere a API oficial do WhatsApp Business.

## Backup

Use o painel do Neon para configurar backup e recuperação. O administrador pode redefinir senhas no painel; cada usuário também pode solicitar o link de recuperação por e-mail.

## Testes

```powershell
node --test tests/*.test.mjs
```

Os testes usam bancos temporários separados e nunca alteram a base operacional. Cobrem autenticação, CSRF, senha provisória, permissões, deduplicação, concorrência de leads, persistência e pontuação.

## Critérios iniciais de potencial

Segmento: bombeamento 30, concreteira 25, construtora/locadora 15. Porte: grande 20, médio 12, pequeno 5. Bombeamento confirmado 25, frota confirmada 15, múltiplas unidades confirmadas 10. Prioridade A ≥75, B ≥45, C abaixo de 45. Estes pesos são uma proposta de regra comercial, não um modelo de probabilidade de compra.

## Fontes técnicas

[Neon no Marketplace da Vercel](https://vercel.com/integrations/neon), [armazenamento no Marketplace da Vercel](https://vercel.com/docs/marketplace-storage) e [criptografia no Node.js](https://nodejs.org/api/crypto.html).

Validação de CNPJ numérico e alfanumérico conforme o [manual de dígitos verificadores da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).
