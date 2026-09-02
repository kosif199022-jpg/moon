# Installation

## Browser application

Requirements: Node.js 20 or later.

```bash
corepack enable
pnpm install
pnpm dev
```

The local server binds to `127.0.0.1:4173` by default. Override with `HOST` and `PORT` when required.

## Optional API and database

Requirements: Docker Compose and PostgreSQL-compatible client access.

1. Copy `.env.example` to `.env` and replace every development credential.
2. Keep the PostgreSQL password in `.env` and `docker-compose.yml` consistent.
3. Start services and initialize the schema:

```bash
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

4. Verify:

```bash
curl http://localhost:3001/health
```

The seed command creates a development organization and manager. It is idempotent and must never be used as a production identity bootstrap.
