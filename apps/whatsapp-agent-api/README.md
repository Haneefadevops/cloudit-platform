# TheReplyte API

WhatsApp AI Agent backend for TheReplyte.

## Features

- Receives WhatsApp messages via Meta webhook
- AI replies via Kimi API
- Human handoff
- Agent/supervisor login
- Conversation management

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials.
2. Create database:
   ```bash
   createdb whatsapp_agent
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Seed admin user:
   ```bash
   npx prisma db seed
   ```
6. Start dev server:
   ```bash
   npm run start:dev
   ```

## Webhook URL

Set this in Meta dashboard:

```
https://your-domain.com/api/webhooks/whatsapp
```

Verify token: same as `META_VERIFY_TOKEN` in `.env`

## API Docs

Swagger UI available at:

```
http://localhost:3010/api/docs
```

## Production URL

```
https://api.thereplyte.com/api
```
