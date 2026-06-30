# OrbitOne Frontend

Kimi owns this app.

Expected local URL:

- `http://localhost:3000`

The root `docker-compose.local.yml` can run the frontend together with the backend, PostgreSQL, and Redis once Docker Desktop is available.

Expected API base URLs:

- Local: `http://localhost:8000/api/v1`
- Test: `https://to1.cloudit.lk/api/v1`
- Production: `https://po1.cloudit.lk/api/v1`

Public profile and QR/share URLs come from `NEXT_PUBLIC_APP_URL`:

- Local: `http://localhost:3000`
- Test: `https://to1.cloudit.lk`
- Production: `https://po1.cloudit.lk`

Use the backend contracts in `docs/backend-contracts.md` and shared types in `contracts/orbitone.ts`.
