# WOW Tax Event

Landing page, voucher de inscrição e painel operacional do evento.

## Rodar com Docker

```bash
docker compose up --build -d
```

Abra `http://localhost:10333`.

Painel:

- `http://localhost:10333/crm.html` — visão geral
- `http://localhost:10333/leads.html` — leads e exportação
- `http://localhost:10333/leitor.html` — leitor de QR e backup
- `http://localhost:10333/admins.html` — administradores

Nesta etapa, leads, vouchers e administradores ficam persistidos no `localStorage` do navegador. Para operação multiusuário real, conecte `app-data.js` a uma API/autenticação.
