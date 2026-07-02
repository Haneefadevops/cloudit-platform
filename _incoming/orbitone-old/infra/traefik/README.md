# OrbitOne Traefik Notes

OrbitOne v3 uses a dedicated OrbitOne SaaS Server with Traefik as the reverse proxy.

CloudIT/n8n infrastructure must stay separate from OrbitOne infrastructure.

Expected routes:

- `https://to1.cloudit.lk` -> test frontend
- `https://to1.cloudit.lk/api` -> test backend
- `https://po1.cloudit.lk` -> production frontend
- `https://po1.cloudit.lk/api` -> production backend

The backend Compose files include Traefik labels for `/api`. Kimi should add matching frontend labels when the frontend Dockerfile exists.
