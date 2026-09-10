# Portal Repository Handover

Date: 10 September 2026

## Completed before transfer

- Phase 0 inventory, publishing contract, proposed schema/security model,
  frequencies, thresholds, retention, screens and acceptance gates were drafted.
- The separately authorized Cavetta n8n production-safety correction completed
  through Phase 9 and was published on 9 September 2026.
- The three corrected canonical hashes match and all ten n8n exports parse; all
  54 Code nodes pass syntax validation.
- No portal code, schema, DNS, credentials or deployment was created.

## Selected hosting direction

The portal and a dedicated Docker PostgreSQL database will run on the CloudIT
server. Cavetta remains in its separate Supabase cloud project. Deployment will
later integrate with the owner's separate server/platform repository and GitHub
Actions after that repository is inspected.

## First action in the destination repository

1. Inspect `git status` and preserve existing changes.
2. Read the required files listed in `AGENTS.md` completely.
3. Confirm that the transfer contains no secret values or production payloads.
4. Present the remaining Phase 0 decisions to the owner.
5. Obtain explicit Phase 0 approval.
6. Begin Phase 1 visual design only.
7. Stop with desktop and 390 px mobile screenshots for owner approval.

Do not create the application scaffold, database schema, GitHub Actions workflow,
server deployment script or production containers before their planned phases.

## Continuation prompt

> Continue the CloudIT Operations Portal from this repository. Read `AGENTS.md`,
> `README.md`, `docs/cloudit-operations-portal-phase-0-specification.md`,
> `docs/cloudit-operations-portal-plan.md`, and
> `docs/portal-repository-handover.md` completely. Inspect git status and preserve
> all existing changes. The Cavetta n8n production-safety correction is complete;
> do not repeat or modify it unless a new defect is found. The portal and its
> dedicated Docker PostgreSQL database will be hosted on the CloudIT server;
> Cavetta Supabase remains separate. Identify the first incomplete phase and stop
> at every phase gate. Do not publish, deploy, push, mutate production data,
> enable ticketing, notify clients, act on a real report, or restore/decrypt a
> production backup without explicit approval.

