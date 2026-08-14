# WOW Tax Event

Landing page, voucher de inscrição e painel operacional do evento.

## Rodar com Docker

Copie `.env.example` para `.env`, defina as credenciais do administrador e do PostgreSQL e execute:

```bash
docker compose up --build -d
```

Abra `http://localhost:10333`.

## URLs

- `http://localhost:10333/` — landing page pública
- `http://localhost:10333/obrigado` — voucher de inscrição
- `http://localhost:10333/login` — acesso do painel
- `http://localhost:10333/crm` — visão geral
- `http://localhost:10333/leads` — leads e exportação
- `http://localhost:10333/leitor` — leitor de QR e backup
- `http://localhost:10333/administradores` — administradores

As páginas do painel são protegidas por sessão HttpOnly. As URLs antigas com `.html` redirecionam para as rotas limpas.

## Credenciais e produção

O servidor exige `ADMIN_EMAIL` e `ADMIN_PASSWORD`, ou `ADMIN_PASSWORD_HASH`. Para gerar um hash scrypt:

```bash
node server.js --hash "sua-senha"
```

## SMTP local e comprovante

Cada inscricao gera um comprovante por e-mail com o QR Code inline, o voucher e o codigo backup. O envio usa SMTP diretamente, sem provedor de e-mail embutido na aplicacao. Configure no `.env`:

```env
PUBLIC_URL=https://evento.wowtaxmoment.com
SMTP_HOST=host.docker.internal
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-reply@wowtaxmoment.com
```

`SMTP_HOST` deve apontar para o servidor SMTP local acessivel pelo container. Em uma VPS, substitua `host.docker.internal` pelo hostname ou IP do MTA local. Se o SMTP estiver indisponivel, a inscricao continua salva no PostgreSQL e o CRM registra `email_status=failed` para permitir diagnostico.

Em produção, use `NODE_ENV=production`, HTTPS e segredos definidos fora do repositório. Leads, vouchers, check-ins, administradores e sessões são persistidos no PostgreSQL. O volume `wow_tax_postgres_data` mantém os dados entre reinicializações do Docker.

O banco não publica a porta `5432` no host; ela fica disponível somente para a aplicação dentro da rede Docker. A única porta publicada é `10333`.
