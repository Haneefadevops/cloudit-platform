# Isolated n8n test instance

This Compose project runs a disposable n8n instance at
`https://n8n-test.cloudit.lk`. It does not reuse the production n8n volume,
PostgreSQL database, Redis data, Gotenberg service, container name, or encryption
key. Its n8n, PostgreSQL, Redis, Gotenberg, and execution-mode configuration
match the production stack. Only the n8n container joins the external `cloudit`
network so the existing Traefik container can route HTTPS traffic to it. The
test PostgreSQL, Redis, and Gotenberg containers are reachable only through the
private `n8n-test-internal` network. Gotenberg has the internal alias
`gotenberg`, matching the URL used by imported production workflows.

## Server setup

From the repository root on the server:

```bash
cd infra/n8n-test
cp .env.example .env
chmod 600 .env
sed -i "s/replace_with_a_unique_encryption_key/$(openssl rand -hex 32)/" .env
sed -i "s/replace_with_a_unique_postgres_password/$(openssl rand -hex 32)/" .env
sed -i "s/replace_with_a_unique_redis_password/$(openssl rand -hex 32)/" .env
docker compose -p n8n-test config --quiet
docker compose -p n8n-test up -d
```

Do not copy the production n8n `.env` into this directory.

## Verification

```bash
docker ps --filter name=n8n --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker inspect n8n-test --format '{{json .HostConfig.Memory}} {{json .HostConfig.NanoCpus}}'
docker logs --tail 100 n8n-test
curl -fsS https://n8n-test.cloudit.lk/healthz
```

Open `https://n8n-test.cloudit.lk` and create a test-only owner account. Import
workflow templates in the inactive state, add only sandbox credentials, and
delete the workflows from the test UI when testing is complete.

## Stop or remove the test instance

Stop it while preserving all test data:

```bash
docker compose -p n8n-test stop
```

Remove its containers while preserving all test volumes:

```bash
docker compose -p n8n-test down
```

Do not add `--volumes` unless the test data is intentionally being destroyed.
