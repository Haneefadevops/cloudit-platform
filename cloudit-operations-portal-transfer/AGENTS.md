# AGENTS.md — CloudIT Operations Portal

Read this file and the documents listed below completely before changing
anything:

1. `README.md`
2. `docs/cloudit-operations-portal-phase-0-specification.md`
3. `docs/cloudit-operations-portal-plan.md`
4. `docs/portal-repository-handover.md`
5. The relevant files under `docs/reference/` before touching an integration.

## Project boundary

This is a separate private multi-client operations portal for
`operations.cloudit.lk`. It is not part of the Cavetta application and must not
use the Cavetta Supabase database. The eventual portal and its dedicated Docker
PostgreSQL database are hosted on the CloudIT server.

n8n remains the only provider-integration and automation layer. It may publish
only normalized, sanitized operational evidence to the operations database.

Never expose provider credentials, n8n credentials, database credentials, raw
errors, stack traces, unrestricted execution payloads, request or email bodies,
customer data, landlord data, booking data, inquiry data, backup contents, or
private Google Drive identifiers to the browser.

## Phase gates

- Begin with the first incomplete phase only.
- Phase 0 is not complete until the owner explicitly approves it.
- Phase 1 is visual design only; do not create application code during Phase 1.
- Stop after every phase for tests, screenshots and explicit owner approval.
- Do not publish, deploy, push, alter DNS, mutate production data, or change a
  production n8n workflow without explicit approval.
- Do not approve, reject, regenerate, download, upload, email or resend a real
  maintenance report during construction.
- Do not restore or decrypt a production backup.
- Preserve report-state and idempotency guards, especially `sentAt`.
- Keep ticketing and client notifications disabled unless separately approved.
- Do not leave temporary workflows, endpoints, rows, nodes, connections, mock
  data, pinned data or fixed test clocks behind.

## Repository and deployment safety

- Preserve unrelated working-tree changes.
- Never commit `.env*`, credentials, SSH keys, database dumps, backup archives,
  PDFs containing private information, or provider response payloads.
- Production secrets stay in GitHub encrypted secrets or the server's protected
  environment files; they never enter source control or browser bundles.
- The operations PostgreSQL service must not publish a public database port.
- Use a dedicated database, role, network and volume; never reuse the n8n
  database.
- A Git push or deployment is a separately approved action.

## Known operational gate

The 1 October 2026 Phase 5E acceptance must verify one September snapshot for
each of the seven canonical source keys. The real report stays `DRAFT`.

