# CloudIT Operations Portal — Phase 1 Visual Design

Status: **APPROVED BY OWNER**  
Date: 10 September 2026  
Scope: static visual design only

Owner approval was received in the continuation session before Phase 2 began.

This package contains no portal application, database migration, Docker service,
Traefik route, GitHub Actions change, DNS change, n8n workflow, production
integration, credential, or live data. All values in the artboards are
illustrative design data.

## Review exports

- `desktop/`: 1440 × 1024 SVG artboards and matching PNG screenshots.
- `mobile/`: 390 × 844 SVG artboards and matching PNG screenshots.
- `desktop-contact-sheet.png` and `mobile-contact-sheet.png`: complete visual
  indexes for fast review.
- `render-designs.mjs`: design-only renderer for the static exports; it is not
  included in any workspace or runtime.

## Visual direction

- Dark operations console with CloudIT's pink-to-purple brand accent.
- Dense but calm information hierarchy: page title, freshness context, summary
  metrics, then evidence details.
- GREEN, AMBER, RED and NO DATA always use a dot/icon and text, never colour
  alone.
- Live-service health is visually separated from analytics availability so
  missing analytics cannot imply an outage.
- All timestamps name the client timezone or UTC context.
- Every data surface carries freshness/as-of language.

## Screen inventory

| Screen | Desktop | Mobile | Key design decision |
| --- | --- | --- | --- |
| Login | `desktop/login.png` | `mobile/login.png` | No client information before authentication; MFA/session policy message. |
| Multi-client overview | `desktop/overview.png` | `mobile/overview.png` | Client status, incidents, backup, report and freshness at a glance. |
| Client dashboard | `desktop/client-dashboard.png` | `mobile/client-dashboard.png` | Live service and optional analytics are explicitly separated. |
| Clients | `desktop/clients.png` | `mobile/clients.png` | Owner-only tenant catalogue and private data boundary. |
| Workflows | `desktop/workflows.png` | `mobile/workflows.png` | Curated read-only flow, schedule, run and safe failure evidence. |
| Infrastructure | `desktop/infrastructure.png` | `mobile/infrastructure.png` | Website/PostgreSQL/connection evidence with units and sampling cadence. |
| Vercel | `desktop/vercel.png` | `mobile/vercel.png` | Supported API metrics only; unsupported usage is honest NO DATA. |
| ImageKit | `desktop/imagekit.png` | `mobile/imagekit.png` | Provider-cache/as-of treatment and quota visibility. |
| Backups | `desktop/backups.png` | `mobile/backups.png` | Encrypted pair, checksum, Drive round trip and restore test; no download/decrypt. |
| Report list | `desktop/reports.png` | `mobile/reports.png` | Historical exceptions remain labelled and cannot seed health. |
| Report viewer | `desktop/report-viewer.png` | `mobile/report-viewer.png` | Read-only, server-mediated PDF concept; no approve/reject/send control. |
| Incidents | `desktop/incidents.png` | `mobile/incidents.png` | Sanitized categories, occurrence count and recovery timeline. |
| Audit log | `desktop/audit-log.png` | `mobile/audit-log.png` | Append-only events without raw payloads or personal data. |
| Settings | `desktop/settings.png` | `mobile/settings.png` | Owner-only policy visibility, integrations off by default. |
| System states | `desktop/system-states.png` | `mobile/system-states.png` | Loading, empty, no-data, stale, partial, permission and safe error. |
| Navigation map | `desktop/navigation-map.png` | `mobile/navigation-map.png` | Complete route hierarchy and the mobile More destination. |

## Responsive navigation

Desktop uses a persistent eleven-item sidebar. Mobile uses a four-item bottom
bar for Overview, Clients, Workflows and More; More opens the remaining areas in
the eventual implementation. Client dashboard and report viewer are nested
detail routes reached from Clients and Reports respectively.

## Interaction and accessibility specification

- Minimum touch target: 44 × 44 px in implementation.
- Visible keyboard focus: 2 px white inner ring plus 2 px purple outer ring.
- Reading order follows the visual hierarchy; navigation precedes the page
  heading, summary, then detail evidence.
- Status labels must expose both status text and icon semantics to assistive
  technology.
- Charts must expose a table/text alternative and identify unit, period,
  timezone, sampling interval, gaps and threshold legend.
- Motion is optional and must respect `prefers-reduced-motion`.
- Loading retains page context with skeleton blocks. Stale and partial states
  retain the last safe value while clearly showing observation time.
- Permission and error screens reveal no tenant metadata, provider response,
  raw error, stack, execution payload, identifier or secret.

## Architecture alignment for later phases

The design assumes the existing monorepo and deployment shape only; nothing is
implemented in this phase:

```text
Cloudflare / operations.cloudit.lk
              ↓
Traefik on the shared private `cloudit` Docker network
              ↓
Operations portal service (future phase)
              ↓
Shared private PostgreSQL container
  └─ separate `operations` database
  └─ dedicated least-privilege operations role
```

PostgreSQL remains without a published host port. The portal must not use the
n8n database or Cavetta Supabase. Later CI/CD changes must fit the existing PR
checks, gated GitHub Actions deployment, predeployment migration, health-check
and rollback approach, and require separate approval.

## Phase 1 approval checklist

- [ ] Approve visual direction, colour, typography and density.
- [ ] Approve desktop sidebar and 390 px bottom navigation.
- [ ] Approve all sixteen desktop artboards.
- [ ] Approve all sixteen mobile artboards.
- [ ] Approve status definitions and non-happy states.
- [ ] Approve read-only report presentation with no Phase 10 actions.
- [ ] Approve the separate `operations` database and dedicated least-privilege
  role as the design's later-phase infrastructure assumption.
- [ ] Explicitly authorize Phase 2 before any application scaffold or runtime
  work begins.

Phase 2 has not started.
