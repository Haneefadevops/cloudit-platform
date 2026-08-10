# Task: API keys management UI (spec 6b)

Phase: 6 | App: `apps/whatsapp-agent-web`

## Goal

A dashboard page to manage the transactional API keys built in 6a, so keys can
be issued and revoked without touching the API directly.

The API already exists:
- `POST /api/clients/:clientId/api-keys` — body `{ name }` → returns
  `{ id, name, prefix, key }` — **`key` is the full plaintext key, returned
  only at creation**
- `GET /api/clients/:clientId/api-keys` →
  `[{ id, name, prefix, lastUsedAt, revokedAt, createdAt }]` (never the hash)
- `DELETE /api/clients/:clientId/api-keys/:id` → revokes (sets `revokedAt`)

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/whatsapp-agent-web/src/app/dashboard/customers/page.tsx` — copy this
  page's shell (client selector, toasts, `@/components/ui`)
- `apps/whatsapp-agent-web/src/app/dashboard/layout.tsx` — nav entries
- `apps/whatsapp-agent-web/src/components/ui/` — use only existing components

## Files to create / modify

- CREATE: `src/app/dashboard/api-keys/page.tsx`
- MODIFY: `src/app/dashboard/layout.tsx` — nav entry "API Keys"
  (`/dashboard/api-keys`), same pattern as the existing entries (icon case +
  title + nav item)

## Page behavior

Same shell as the customers page: token guard, portal-user redirect, client
selector Card at top. Below, for the selected client:

- **Create form** (one Card): a single Input for the key name (placeholder
  e.g. "Production ERP") + "Create key" Button.
- **Newly created key reveal** (the important part): after creation, show a
  prominent block with:
  - the full `key` in a read-only Input or code-style box
  - a "Copy" button (`navigator.clipboard.writeText`, toast "Copied")
  - a warning line: "This is the only time the full key is shown — store it
    securely."
  - a "Done" button that clears the reveal and refetches the list
- **Keys table**: Name, Prefix (e.g. `trk_a1b2c3d4…`), Last used
  (`lastUsedAt` locale date or "Never"), Created, Status badge
  ("Active" / "Revoked" when `revokedAt` set), and a **Revoke** button on
  active keys (confirm dialog, then DELETE, toast, refetch).
- Revoked rows stay visible but greyed/read-only (no revoke button).
- EmptyState when the client has no keys.

## Do NOT

- No API changes. No new dependencies. Existing `@/components/ui` only.
- Do not display or store the full key anywhere except the post-creation
  reveal block (component state only — no localStorage).
- Only the two listed files change.

## Acceptance criteria

- [ ] Create → one-time reveal with copy → list refresh works.
- [ ] Revoke confirms and updates the row to Revoked.
- [ ] The full key never appears in the list or after dismissing the reveal.
- [ ] `npm run build` passes — paste real output.

## Report back

- Files created/modified
- Verbatim build output
- Any deviation from this spec, with the reason
