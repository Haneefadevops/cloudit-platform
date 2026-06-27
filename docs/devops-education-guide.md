# CloudIT Platform — DevOps Education Guide

> **For:** New DevOps engineers learning this stack
> **Scope:** Sprint 1 (Infrastructure) + Sprint 2 (Platform API & Web)
> **Last Updated:** 2026-06-27

---

## Table of Contents

1. [What We Built](#what-we-built)
2. [The Big Picture Architecture](#the-big-picture-architecture)
3. [Sprint 1: Infrastructure Layer](#sprint-1-infrastructure-layer)
4. [Sprint 2: Application Layer](#sprint-2-application-layer)
5. [How Docker & Docker Compose Work](#how-docker--docker-compose-work)
6. [How Traefik Routing Works](#how-traefik-routing-works)
7. [How Git & GitHub Work in This Flow](#how-git--github-work-in-this-flow)
8. [Troubleshooting We Learned From](#troubleshooting-we-learned-from)
9. [Common Commands Reference](#common-commands-reference)
10. [Next Steps](#next-steps)

---

## What We Built

We built **CloudIT Platform** — a multi-tenant SaaS platform that can power multiple products (Hospitality OS, OrbitOne, etc.). It's deployed on a Hetzner VPS (8GB RAM) and uses Docker containers for everything.

### Two Sprints:

- **Sprint 1:** Shared infrastructure (PostgreSQL, Redis, Traefik, n8n, Uptime Kuma, backups)
- **Sprint 2:** Platform API (NestJS backend) + Platform Web (Next.js frontend)

---

## The Big Picture Architecture

```
Internet
    │
    ▼
Hetzner VPS (cp-8gb-hel1-1) — Ubuntu Server
┌──────────────────────────────────────────────┐
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Traefik  │  │ Postgres │  │  Redis    │  │
│  │ Port 80  │  │ Port 5432│  │ Port 6379 │  │
│  │ Port 443 │  │ Internal │  │ Internal  │  │
│  └────┬─────┘  └──────────┘  └───────────┘  │
│       │                                      │
│  ┌────┴──────────────────────────┐          │
│  │         Docker Network          │          │
│  │           (cloudit)             │          │
│  └────┬───────────────┬───────────┘          │
│       │               │                       │
│  ┌────┴───┐     ┌────┴───┐                   │
│  │platform│     │platform│  ┌──────────┐     │
│  │  -api  │     │  -web  │  │   n8n    │     │
│  │Port    │     │Port    │  │Port 5678 │     │
│  │3001    │     │3000    │  └──────────┘     │
│  └────────┘     └────────┘  ┌──────────┐     │
│                             │Uptime    │     │
│                             │Kuma      │     │
│                             │Port 3005 │     │
│                             └──────────┘     │
└──────────────────────────────────────────────┘
```

---

## Sprint 1: Infrastructure Layer

### What is "Infrastructure"?

Infrastructure = the shared services that ALL applications need. Think of it as the foundation of a building. Without it, no app can stand.

### Components:

#### 1. Traefik (Reverse Proxy)

**What it does:**
- Receives all incoming HTTP/HTTPS requests
- Routes them to the correct container based on the domain name
- Handles SSL/TLS certificates automatically
- Acts as a single entry point

**Why we use it:**
Instead of exposing each app directly (security risk), Traefik is the only thing exposed on ports 80 and 443.

**Example:**
```
User requests: https://api-platform.cloudit.lk/api/health
  -> Traefik sees "api-platform.cloudit.lk"
  -> Forwards to platform-api container on port 3001
  -> Returns response
```

**Key Labels:**
```yaml
- "traefik.enable=true"
- "traefik.http.routers.platform-api.rule=Host(`api-platform.cloudit.lk`)"
- "traefik.http.routers.platform-api.entrypoints=websecure"
- "traefik.http.services.platform-api.loadbalancer.server.port=3001"
```

#### 2. PostgreSQL (Database)

**What it does:**
- Stores all structured data (users, organizations, etc.)
- Uses SQL (Structured Query Language)
- Version: PostgreSQL 16

**Network:**
- Not exposed to the internet
- Only containers on the `cloudit` network can talk to it
- Port 5432 is NOT mapped to the host

#### 3. Redis (Cache)

**What it does:**
- Fast key-value store (data lives in RAM)
- Used for: sessions, caching, rate limiting
- Version: Redis 7

**Why we use it:**
- 100x faster than PostgreSQL for temporary data
- Perfect for session storage

#### 4. n8n (Automation)

**What it does:**
- Visual workflow builder
- Connects apps together
- Runs on `localhost:5678`

#### 5. Uptime Kuma (Monitoring)

**What it does:**
- Monitors all services every 60 seconds
- Alerts if anything goes down
- Accessible at `http://<SERVER_IP>:3005`

#### 6. Docker Network (`cloudit`)

A virtual network inside Docker. Containers can talk to each other by name:
```
platform-api -> postgres:5432
platform-api -> redis:6379
```

Created with:
```bash
docker network create cloudit
```

---

## Sprint 2: Application Layer

### platform-api (NestJS Backend)

**What it does:**
- REST API that serves JSON data
- Handles: auth, users, organizations, roles, audit logs
- Swagger docs at `/api/docs`
- Health check at `/api/health`

**Technology Stack:**
- **NestJS:** Node.js framework
- **TypeScript:** JavaScript with types
- **Prisma:** ORM (Object-Relational Mapper)
- **PostgreSQL:** Database
- **Redis:** Cache
- **Passport + JWT:** Authentication
- **Swagger:** API documentation

**Architecture Pattern:**
```
HTTP Request -> Controller -> Service -> Prisma -> PostgreSQL
                    |
              Guards (JWT auth)
                    |
              Interceptors (audit)
```

**Key Files:**
| File | Purpose |
|------|---------|
| `src/main.ts` | App entry point |
| `src/prisma/prisma.service.ts` | Database connection |
| `src/auth/` | Login, register, JWT |
| `src/users/` | User CRUD |
| `src/organizations/` | Multi-tenancy |
| `src/roles/` | RBAC |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Initial data |

**Dockerfile:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production && npm cache clean --force
RUN npx prisma generate
EXPOSE 3001
CMD ["node", "dist/src/main"]
```

**Why Alpine?**
Alpine Linux is minimal (~5MB vs ~900MB for Ubuntu). We needed `openssl` for Prisma.

### platform-web (Next.js Frontend)

**What it does:**
- Web application users interact with
- Connects to platform-api via HTTP
- Server-side rendering (SSR)

**Technology Stack:**
- **Next.js:** React framework with SSR
- **TypeScript:** Type safety
- **Tailwind CSS:** Utility-first CSS
- **shadcn/ui:** Pre-built UI components

**Pages:**
- `/login` — Login
- `/register` — Registration
- `/dashboard` — Main dashboard
- `/dashboard/users` — Admin users
- `/dashboard/settings` — Settings

---

## How Docker & Docker Compose Work

### Docker
Packages apps into **containers** — isolated environments with everything the app needs.

**Analogy:** A shipping container. Has everything inside, works the same anywhere.

### Docker Compose
Defines and runs multiple containers with one YAML file.

```bash
docker compose up -d
```

### Key Docker Concepts

| Concept | Explanation |
|---------|-------------|
| **Image** | Blueprint for containers |
| **Container** | Running instance of an image |
| **Volume** | Persistent storage |
| **Network** | Virtual LAN for containers |
| **Port** | Exposes container to host |

### The `--build` Flag
```bash
docker compose up -d --build
```
Rebuilds the image from the Dockerfile when code changes.

---

## How Traefik Routing Works

### Step-by-Step

```
1. User types: https://api-platform.cloudit.lk/api/health
2. DNS resolves to: 168.119.70.107
3. Traefik (port 443) receives the request
4. Checks: "Any container with Host(`api-platform.cloudit.lk`)?"
5. Finds platform-api with that label
6. Forwards to: platform-api:3001/api/health
7. Returns response to user
```

### Without vs With Traefik

| Without Traefik | With Traefik |
|-----------------|--------------|
| `api.cloudit.lk:3001` | `api-platform.cloudit.lk` |
| No auto SSL | Auto HTTPS |
| Multiple ports exposed | Only 80/443 |
| Manual config | Docker labels |

---

## How Git & GitHub Work in This Flow

### Git Basics

```
Working Dir -> git add -> Staging -> git commit -> Local Repo -> git push -> GitHub
```

### Our Workflow

```
1. Developer writes code locally
2. git add -A
3. git commit -m "description"
4. git push origin master
5. GitHub Actions auto-deploys to server
```

### GitHub Actions (Auto-Deploy)

When you push to `master`:
```
Push -> GitHub Actions -> SSH into server -> git pull -> docker compose up -d --build
```

This is **CI/CD** (Continuous Integration / Continuous Deployment).

---

## Troubleshooting We Learned From

### 1. JWT AuthGuard Error

**Error:** `Nest can't resolve dependencies of the JwtAuthGuard`

**Cause:** `JwtAuthGuard` needs `JwtService`, but the module using it didn't import `JwtModule`.

**Fix:** Add `JwtModule.register({})` to every module that uses `@UseGuards(JwtAuthGuard)`.

**Files fixed:** `users.module.ts`, `organizations.module.ts`, `roles.module.ts`, `audit-logs.module.ts`, `settings.module.ts`

### 2. Prisma OpenSSL Error

**Error:** `Error loading shared library libssl.so.1.1`

**Cause:** Alpine Linux needs `openssl` package for Prisma's compiled binary.

**Fix:** Add `RUN apk add --no-cache openssl` to Dockerfile.

### 3. Database Authentication Error

**Error:** `Authentication failed against database server`

**Cause:** `.env` had placeholder password, didn't match actual Postgres password.

**Fix:** Match `DATABASE_URL` password to actual `POSTGRES_PASSWORD`.

**Lesson:** `.env` files are local (gitignored). Create on each server.

### 4. Database Doesn't Exist

**Error:** `Database platform does not exist`

**Fix:**
```bash
docker exec postgres psql -U cloudit -d postgres -c "CREATE DATABASE platform;"
```

### 5. Missing Port Exposure

**Error:** `curl: (7) Failed to connect to localhost port 3001`

**Fix:** Add to `docker-compose.yml`:
```yaml
ports:
  - "3001:3001"
```

### 6. Container Restart Loop

**Symptom:** Container keeps restarting

**Fix:** Check logs immediately:
```bash
docker logs <container-name> --tail 50
```

---

## Common Commands Reference

### Docker

```bash
# List running containers
docker ps

# List all containers
docker ps -a

# View logs
docker logs <name> --tail 50
docker logs <name> -f  # follow

# Restart container
docker restart <name>

# Stop container
docker stop <name>

# Remove container
docker rm <name>

# Execute command in container
docker exec <name> <command>

# Open shell in container
docker exec -it <name> sh

# View env vars
docker exec <name> env

# View networks
docker network ls
docker network inspect cloudit
```

### Docker Compose

```bash
# Start services
docker compose up -d

# Rebuild and start
docker compose up -d --build

# Stop services
docker compose down

# View logs
docker compose logs

# Restart service
docker compose restart <service>

# Execute in service
docker compose exec <service> <command>
```

### Git

```bash
# Check status
git status

# Stage all
git add -A

# Commit
git commit -m "message"

# Push
git push origin master

# Pull
git pull origin master

# View history
git log --oneline -10

# View remotes
git remote -v
```

### PostgreSQL

```bash
# Connect
docker exec -it postgres psql -U cloudit -d platform

# List databases
\l

# List tables
\dt

# Exit
\q

# Create database
docker exec postgres psql -U cloudit -d postgres -c "CREATE DATABASE platform;"
```

### Prisma

```bash
# Run migrations
docker exec platform-api npx prisma migrate deploy

# Seed database
docker exec platform-api npx prisma db seed

# Generate client
docker exec platform-api npx prisma generate

# Open GUI
docker exec platform-api npx prisma studio
```

### NestJS

```bash
# Dev mode
npm run start:dev

# Build
npm run build

# Tests
npm run test
```

### System Health

```bash
# Disk space
df -h

# Memory
free -h

# CPU
top

# Docker usage
docker system df

# Cleanup
docker system prune -f
```

---

## Next Steps

### What Comes After Sprint 2?

1. **Hospitality OS** (Sprint 3) — Hospitality-specific features
2. **OrbitOne** (Sprint 4) — CRM platform
3. **Monitoring & Alerting** — Set up alerts
4. **Backups** — Automated database backups
5. **Scaling** — Load balancing, multiple servers

### Learning Path

1. Docker fundamentals
2. Docker Compose
3. Reverse proxies (Traefik, Nginx)
4. SSL/TLS
5. CI/CD (GitHub Actions)
6. Monitoring (Prometheus, Grafana)
7. Cloud providers (AWS, Hetzner, etc.)

### Resources

| Resource | What It Covers |
|----------|---------------|
| [Docker Docs](https://docs.docker.com/) | Docker & Compose |
| [Traefik Docs](https://doc.traefik.io/traefik/) | Reverse proxy |
| [NestJS Docs](https://docs.nestjs.com/) | Backend framework |
| [Next.js Docs](https://nextjs.org/docs) | Frontend framework |
| [Prisma Docs](https://www.prisma.io/docs) | Database ORM |
| [Learn Git Branching](https://learngitbranching.js.org/) | Interactive Git tutorial |

---

## Glossary

| Term | Definition |
|------|------------|
| **Container** | Lightweight, isolated environment |
| **Image** | Blueprint for creating containers |
| **Volume** | Persistent storage |
| **Network** | Virtual LAN for container communication |
| **Reverse Proxy** | Server that forwards requests |
| **SSL/TLS** | Encryption for HTTPS |
| **JWT** | JSON Web Token — auth token |
| **ORM** | Object-Relational Mapper |
| **Migration** | Database schema change |
| **Seed** | Initial/population data |
| **CI/CD** | Continuous Integration / Deployment |
| **API** | Application Programming Interface |
| **Endpoint** | Specific URL for an API function |
| **Guard** | Auth check in NestJS |
| **Module** | NestJS code organization |
| **Service** | Business logic layer |
| **Controller** | HTTP request handler |
| **DTO** | Data Transfer Object |
| **Schema** | Database structure |
| **DNS** | Domain Name System |
| **VPS** | Virtual Private Server |
| **SaaS** | Software as a Service |
| **Multi-tenant** | One app serving multiple customers |
| **RBAC** | Role-Based Access Control |
| **SSR** | Server-Side Rendering |
| **REST API** | API using HTTP methods |
| **Swagger** | API documentation |
| **Alpine** | Minimal Linux for Docker |
| **Shell** | Command-line interface |
| **SSH** | Secure remote server access |
| **Port** | Network communication endpoint |
| **Protocol** | Communication rules |
| **Load Balancer** | Distributes traffic |
| **Health Check** | Automated service check |
| **Git** | Version control |
| **Repository** | Git project |
| **Branch** | Parallel code version |
| **Commit** | Saved code snapshot |
| **Push** | Send code to remote |
| **Pull** | Fetch latest code |
| **Environment** | Deployment stage (dev/staging/prod) |
| **Production** | Live environment |
| **Staging** | Pre-production testing |
| **Development** | Local coding environment |
| **Rollback** | Revert to previous version |
| **Zero Downtime** | Deploy without interruption |
| **IaC** | Infrastructure as Code |
| **Kubernetes** | Container orchestration |
| **Observability** | Monitoring + logging + tracing |
| **SRE** | Site Reliability Engineering |
| **DevOps** | Development + Operations |
| **GitOps** | Infrastructure managed via Git |
