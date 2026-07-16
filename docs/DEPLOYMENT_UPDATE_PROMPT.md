# Deployment Update Prompt — TheReplyte

## Context

TheReplyte is a new WhatsApp AI Agent product being added to the existing CloudIT platform monorepo.

- Existing CloudIT platform runs on `cloudit.lk`
- TheReplyte must run on `thereplyte.com`
- Both products live in the same repo and deploy from GitHub Actions

## Goal

Update the deployment infrastructure so that when code is pushed to GitHub, TheReplyte services deploy automatically alongside existing CloudIT services, **without breaking anything on `cloudit.lk`**.

## Important rules

- **Only add TheReplyte services.** Do not change existing CloudIT services.
- **Hardcode `thereplyte.com`** for TheReplyte domains. Do not use `${DOMAIN}` variable.
- **Do not break** existing Traefik, Postgres, Redis, n8n, or other services.
- **Test builds** for `whatsapp-agent-api` and `whatsapp-agent-web` after changes.
- Stop and ask for approval when done.

## Files to modify

### 1. `infra/whatsapp-agent-api/docker-compose.yml`

Change Traefik labels to hardcode `thereplyte.com`:

```yaml
- "traefik.http.routers.whatsapp-agent-api.rule=Host(`api.thereplyte.com`)"
- "traefik.http.routers.whatsapp-agent-api.tls.domains[0].main=thereplyte.com"
- "traefik.http.routers.whatsapp-agent-api.tls.domains[0].sans=*.thereplyte.com"
```

Keep everything else the same.

### 2. `infra/whatsapp-agent-web/docker-compose.yml`

Change Traefik labels to hardcode `thereplyte.com`:

```yaml
- "traefik.http.routers.whatsapp-agent-web.rule=Host(`app.thereplyte.com`)"
- "traefik.http.routers.whatsapp-agent-web.tls.domains[0].main=thereplyte.com"
- "traefik.http.routers.whatsapp-agent-web.tls.domains[0].sans=*.thereplyte.com"
```

Also hardcode the API URLs:

```yaml
- NEXT_PUBLIC_API_URL=https://api.thereplyte.com/api
- API_URL=https://api.thereplyte.com/api
```

### 3. `infra/chatwoot/docker-compose.yml`

Change Traefik labels to hardcode `thereplyte.com`:

```yaml
- "traefik.http.routers.chatwoot.rule=Host(`inbox.thereplyte.com`)"
- "traefik.http.routers.chatwoot.tls.domains[0].main=thereplyte.com"
- "traefik.http.routers.chatwoot.tls.domains[0].sans=*.thereplyte.com"
```

### 4. `infra/chatwoot/.env.example`

Update to:

```env
CHATWOOT_FRONTEND_URL=https://inbox.thereplyte.com
DOMAIN=thereplyte.com
MAILER_SENDER_EMAIL=TheReplyte <noreply@thereplyte.com>
```

### 5. `infra/scripts/deploy.sh`

Add TheReplyte services to the deployment sequence.

After the existing core infrastructure (postgres, redis, traefik, n8n, uptime-kuma), add:

1. Build and start `whatsapp-agent-api`
2. Build and start `whatsapp-agent-web`
3. Start `chatwoot-rails` and `chatwoot-sidekiq`

Use `wait_for_service` for each.

Example additions:

```bash
log "Building TheReplyte API..."
tag_previous_image "whatsapp-agent-api"
build_service "whatsapp-agent-api"
docker compose -f infra/whatsapp-agent-api/docker-compose.yml up -d
wait_for_service "whatsapp-agent-api"

log "Building TheReplyte web..."
tag_previous_image "whatsapp-agent-web"
build_service "whatsapp-agent-web"
docker compose -f infra/whatsapp-agent-web/docker-compose.yml up -d
wait_for_service "whatsapp-agent-web"

log "Starting Chatwoot..."
docker compose -f infra/chatwoot/docker-compose.yml up -d
wait_for_service "chatwoot-rails"
```

### 6. `infra/scripts/health-check.sh`

Add TheReplyte endpoints to the `endpoints` array:

```bash
"https://api.thereplyte.com/api/health"
"https://app.thereplyte.com"
"https://inbox.thereplyte.com"
```

### 7. `apps/whatsapp-agent-api/.env.example`

Ensure it has these Chatwoot env vars:

```env
CHATWOOT_PLATFORM_API_URL=http://chatwoot-rails:3000
CHATWOOT_PLATFORM_API_KEY=your_chatwoot_platform_api_key
CHATWOOT_ADMIN_API_KEY=your_chatwoot_admin_api_key
CHATWOOT_ADMIN_USER_ID=1
```

And update:

```env
CORS_ORIGIN=http://localhost:3011,https://app.thereplyte.com
```

### 8. `apps/whatsapp-agent-web/.env.example`

Update to:

```env
NEXT_PUBLIC_API_URL=https://api.thereplyte.com/api
API_URL=https://api.thereplyte.com/api
```

## Verification

After making changes:

1. Run `cd apps/whatsapp-agent-api && npm run build` — should succeed
2. Run `cd apps/whatsapp-agent-web && npm run build` — should succeed
3. Check that no `cloudit.lk` references remain in TheReplyte files
4. Confirm existing CloudIT files are unchanged

## What NOT to do

- Do not modify existing CloudIT docker-compose files
- Do not change existing CloudIT domain names
- Do not remove any existing services from `deploy.sh`
- Do not deploy or push to GitHub yourself
- Do not add real credentials anywhere

## When done

Stop and tell the user:

> "Deployment files are updated. TheReplyte will deploy to api.thereplyte.com, app.thereplyte.com, and inbox.thereplyte.com without affecting existing cloudit.lk services. Ready for you to review and push."
