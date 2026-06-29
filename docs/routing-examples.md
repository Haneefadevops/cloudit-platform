# CloudIT Platform — Routing Examples

This document shows how the platform routes public traffic to individual apps using **Traefik** inside Docker Compose.

---

## How Traefik Routes Work

Traefik runs as a reverse proxy on the shared `cloudit` Docker network. Each app exposes its own Docker Compose labels that define routing rules, TLS settings, and middleware. Traefik discovers these labels automatically via the Docker provider.

A typical app service declares:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.<router-name>.rule=Host(`subdomain.${DOMAIN}`)"
  - "traefik.http.routers.<router-name>.entrypoints=websecure"
  - "traefik.http.routers.<router-name>.tls.certresolver=cloudflare"
  - "traefik.http.services.<service-name>.loadbalancer.server.port=<container-port>"
```

- `Host(...)` — matches the request hostname.
- `entrypoints=websecure` — listens on HTTPS (port 443).
- `tls.certresolver=cloudflare` — requests/renews an SSL certificate via Cloudflare DNS.
- `loadbalancer.server.port` — the internal container port Traefik forwards to.

---

## Host-Based Routing (Subdomain)

This is the pattern used by every CloudIT app.

### Example: OrbitOne Web

```yaml
# infra/orbitone-web/docker-compose.yml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.orbitone-web.rule=Host(`orbitone.${DOMAIN:-cloudit.lk}`)"
  - "traefik.http.routers.orbitone-web.entrypoints=websecure"
  - "traefik.http.routers.orbitone-web.tls.certresolver=cloudflare"
  - "traefik.http.routers.orbitone-web.tls.domains[0].main=${DOMAIN:-cloudit.lk}"
  - "traefik.http.routers.orbitone-web.tls.domains[0].sans=*.${DOMAIN:-cloudit.lk}"
  - "traefik.http.services.orbitone-web.loadbalancer.server.port=3005"
```

Public URL:

```
https://orbitone.cloudit.lk
```

Internal target:

```
http://orbitone-web:3005
```

### Example: OrbitOne API

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.orbitone-api.rule=Host(`api-orbitone.${DOMAIN:-cloudit.lk}`)"
  - "traefik.http.routers.orbitone-api.entrypoints=websecure"
  - "traefik.http.routers.orbitone-api.tls.certresolver=cloudflare"
  - "traefik.http.services.orbitone-api.loadbalancer.server.port=3004"
```

Public URL:

```
https://api-orbitone.cloudit.lk
```

---

## Adding a New Subdomain (Step-by-Step)

Suppose you add a CRM app on `crm.cloudit.lk` with API `api-crm.cloudit.lk`.

### 1. DNS Records in Cloudflare

Create A (or CNAME) records pointing to the server IP:

| Type | Name | Target |
|------|------|--------|
| A | `crm` | `<SERVER_IP>` |
| A | `api-crm` | `<SERVER_IP>` |

Enable the orange cloud (proxied) if you want Cloudflare caching/WAF.

### 2. Docker Compose Labels

```yaml
# infra/crm-web/docker-compose.yml
services:
  crm-web:
    image: cloudit/crm-web:latest
    networks:
      - cloudit
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.crm-web.rule=Host(`crm.${DOMAIN:-cloudit.lk}`)"
      - "traefik.http.routers.crm-web.entrypoints=websecure"
      - "traefik.http.routers.crm-web.tls.certresolver=cloudflare"
      - "traefik.http.services.crm-web.loadbalancer.server.port=3008"
```

```yaml
# infra/crm-api/docker-compose.yml
services:
  crm-api:
    image: cloudit/crm-api:latest
    networks:
      - cloudit
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.crm-api.rule=Host(`api-crm.${DOMAIN:-cloudit.lk}`)"
      - "traefik.http.routers.crm-api.entrypoints=websecure"
      - "traefik.http.routers.crm-api.tls.certresolver=cloudflare"
      - "traefik.http.services.crm-api.loadbalancer.server.port=3007"
```

### 3. SSL Certificate Auto-Generation

Because the labels request a wildcard certificate via Cloudflare:

```yaml
- "traefik.http.routers.crm-web.tls.domains[0].main=${DOMAIN:-cloudit.lk}"
- "traefik.http.routers.crm-web.tls.domains[0].sans=*.${DOMAIN:-cloudit.lk}"
```

Traefik automatically creates/renews `*.cloudit.lk` as soon as the container starts. No manual certificate step is needed.

### 4. Deploy

```bash
DOMAIN=cloudit.lk ./infra/scripts/deploy.sh
```

---

## Path-Based Routing

If you ever want one domain to host multiple apps by path, use a `PathPrefix` rule (or combine `Host` + `PathPrefix`).

### Example: API Gateway Style

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.crm-api.rule=Host(`api.${DOMAIN:-cloudit.lk}`) && PathPrefix(`/crm`)"
  - "traefik.http.routers.crm-api.entrypoints=websecure"
  - "traefik.http.routers.crm-api.tls.certresolver=cloudflare"
  - "traefik.http.middlewares.crm-stripprefix.stripprefix.prefixes=/crm"
  - "traefik.http.routers.crm-api.middlewares=crm-stripprefix"
  - "traefik.http.services.crm-api.loadbalancer.server.port=3007"
```

Request:

```
https://api.cloudit.lk/crm/health
```

Forwarded to the CRM API as:

```
http://crm-api:3007/health
```

> **Note:** CloudIT currently uses subdomain routing for isolation and simplicity. Path-based routing is documented here for future use cases.

---

## Middleware Usage

Middlewares are defined in `infra/traefik/dynamic/middlewares.yml` and referenced by name in app labels.

### Security Headers

```yaml
labels:
  - "traefik.http.routers.orbitone-web.middlewares=security-headers@file"
```

### Basic Auth (Dashboards)

```yaml
labels:
  - "traefik.http.routers.traefik-dashboard.middlewares=auth@file"
```

The `auth` middleware uses credentials from the `DASHBOARD_AUTH` env var.

### Rate Limiting

Application-level rate limiting is handled by `@nestjs/throttler` inside each API. Traefik can add a simple rate limit middleware if needed:

```yaml
labels:
  - "traefik.http.middlewares.public-ratelimit.ratelimit.average=100"
  - "traefik.http.middlewares.public-ratelimit.ratelimit.burst=50"
  - "traefik.http.routers.orbitone-api.middlewares=public-ratelimit"
```

---

## Internal vs External Routing

| Type | Example | Used By |
|------|---------|---------|
| Public subdomain | `https://app.cloudit.lk` | Platform Web |
| Public API subdomain | `https://api-platform.cloudit.lk` | Platform API |
| Internal container name | `http://platform-api:3001/api` | App-to-app calls inside Docker network |

Apps should use internal container names (e.g. `http://postgres:5432`) for database/cache calls and public DNS names only when called from a browser or external system.

---

## Troubleshooting

- **404 / no route:** Check that the container is on the `cloudit` network and `traefik.enable=true` is set.
- **Certificate errors:** Verify the Cloudflare API token and that DNS records exist.
- **Wrong port:** Ensure `loadbalancer.server.port` matches the container's `PORT` env var.
- **Labels not applied:** Confirm the service is restarted after label changes (`docker compose up -d --force-recreate`).

---

## See Also

- `infra/traefik/traefik.yml` — static Traefik configuration
- `infra/traefik/dynamic/middlewares.yml` — middleware definitions
- `docs/new-app-guide.md` — full checklist for adding an app
