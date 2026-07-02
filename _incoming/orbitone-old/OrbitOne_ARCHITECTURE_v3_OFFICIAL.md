# OrbitOne Architecture v3 (Official)

## IMPORTANT

This document is the single source of truth for OrbitOne.

This supersedes all previous architecture and deployment files.

Ignore previous architecture documents.

---

# 1. Core Principle

OrbitOne is built locally first.

Goals:

- Keep infrastructure simple
- Keep costs low
- Ship features quickly
- Easy maintenance for a solo founder
- Scale only when real users arrive

Development flow:

Local Development
→ GitHub
→ Test Environment
→ Production Environment

---

# 2. Infrastructure Separation

## Server 1 - CloudIT Automation Server

Purpose:

- n8n
- AI automations
- Client automations
- Internal CloudIT workflows
- Webhooks

OrbitOne must NOT run here.

---

## Server 2 - OrbitOne SaaS Server

Purpose:

- OrbitOne test environment
- OrbitOne production environment

Architecture:

OrbitOne VPS
│
├── Traefik Reverse Proxy
│
├── Test Environment
│   ├── Frontend
│   ├── Backend
│   ├── PostgreSQL
│   └── Redis
│
└── Production Environment
    ├── Frontend
    ├── Backend
    ├── PostgreSQL
    └── Redis

---

# 3. Why n8n Is Separate

n8n belongs to CloudIT.

OrbitOne is a SaaS product.

Benefits:

- OrbitOne stays independent.
- n8n failures won't affect OrbitOne.
- OrbitOne traffic won't affect automations.
- Better security.
- Easier scaling.

---

# 4. Local Development

Services:

Frontend:
localhost:3000

Backend:
localhost:8000

PostgreSQL:
localhost:5432

Redis:
localhost:6379

Run:

Docker Compose

---

# 5. Domains

Current:

Test:
https://to1.cloudit.lk

Production:
https://po1.cloudit.lk

Future:

https://app.orbitone.com
https://api.orbitone.com
https://staging.orbitone.com

---

# 6. Git Strategy

main
= production

develop
= test

feature/*
= feature development

Workflow:

feature
→ develop
→ test deployment
→ validation
→ main
→ production deployment

---

# 7. Project Structure

orbitone/
│
├── frontend/
├── backend/
├── infra/
├── docs/
├── docker-compose.local.yml
├── docker-compose.test.yml
├── docker-compose.prod.yml
├── .env.example
└── README.md

---

# 8. Environment Files

.env.local
.env.test
.env.prod

Commit only:

.env.example

Never commit secrets.

---

# 9. Database Rules

Separate databases.

orbitone_test
orbitone_prod

Rules:

- Never share databases.
- Never use production credentials locally.
- Test migrations before production.
- Backup production database.

---

# 10. Reverse Proxy

Use Traefik.

Routes:

to1.cloudit.lk
→ Test Frontend

to1.cloudit.lk/api
→ Test Backend

po1.cloudit.lk
→ Production Frontend

po1.cloudit.lk/api
→ Production Backend

---

# 11. API URLs

Local:

http://localhost:8000

Test:

https://to1.cloudit.lk/api

Production:

https://po1.cloudit.lk/api

---

# 12. Deployment Flow

Developer Machine
↓
GitHub
↓
Develop Branch
↓
Deploy Test
↓
Validate
↓
Main Branch
↓
Deploy Production
↓
Validate

---

# 13. Future n8n Integration

Allowed only through APIs or webhooks.

Correct:

OrbitOne API
→ CloudIT n8n Server
→ Automation Workflow

Never:

OrbitOne VPS
→ Internal n8n container

---

# 14. Current Technology Stack

Use:

- Docker
- Docker Compose
- Traefik
- PostgreSQL
- Redis
- GitHub
- Hetzner VPS

Do NOT use yet:

- Kubernetes
- Microservices
- Multiple production servers

---

# 15. Product Evolution

Phase 1
Digital Business Card

Phase 2
Professional Networking

Phase 3
Relationship Management

Phase 4
Event Networking

Phase 5
Light CRM

---

# 16. Final Rule

CloudIT Infrastructure != OrbitOne Infrastructure

Keep them separate at all times.
