# Proposed Deployment Architecture

Status: planning only; do not implement before the relevant phase is approved.

## Runtime boundary

```text
Cavetta Supabase cloud project (unchanged)

CloudIT server
├── existing n8n services
├── existing reverse proxy
├── CloudIT Operations Portal container
└── dedicated Operations PostgreSQL container and volume
```

The portal database is not the Cavetta Supabase database and is not the n8n
database. PostgreSQL remains reachable only over the private Docker network.

## Proposed repositories

1. The private portal repository owns application source, tests, Dockerfile and
   database migrations.
2. The existing private server/platform repository owns production Compose,
   reverse-proxy configuration and the server-side deployment script.
3. Production secrets exist only in protected GitHub secrets and protected
   server environment files.

## Proposed deployment flow

1. A pull request runs lint, type checking, tests and a container build.
2. An approved merge builds an immutable image and pushes it to GitHub Container
   Registry.
3. A separately approved deployment job authenticates as a restricted deploy
   user and invokes the server repository's deployment script.
4. The server pulls the immutable image, runs controlled forward migrations,
   starts the service and checks a non-sensitive health endpoint.
5. A failed health check stops promotion and records sanitized deployment
   evidence. It must not print environment values.

Do not implement this flow until the server repository, proxy, current Compose
layout, deployment user and rollback method have been inspected.

## Availability limitation

The portal, n8n and database share one server failure domain. Same-server Uptime
Kuma cannot prove that the server is reachable. An externally hosted probe such
as Grafana Cloud Synthetic Monitoring remains required before final production
acceptance.

