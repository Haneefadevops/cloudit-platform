# Task: Social comment moderation queue UI (spec 5c)

Phase: 5 | App: `apps/whatsapp-agent-web`

## Goal

A dashboard page where a client reviews incoming Facebook/Instagram comments,
sees the AI-drafted public reply, and acts: approve (send as-is), edit + send,
dismiss, or hide (Facebook only). This completes the comment moderation loop.

The API already exists (specs 5a/5b):
- `GET /api/social-comments/:clientId?status=` — comment:
  `{ id, channel: 'facebook'|'instagram', externalId, postId?, authorName?, text, status: 'pending'|'replied'|'dismissed'|'hidden', aiDraft?, replyText?, repliedAt?, createdAt }`
- `POST /api/social-comments/:clientId/:id/reply` — body `{ text }`; 400 carries
  Meta's error message when the Graph post fails
- `POST /api/social-comments/:clientId/:id/dismiss`
- `POST /api/social-comments/:clientId/:id/hide` — 400 on instagram

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/whatsapp-agent-web/src/app/dashboard/customers/page.tsx` — copy this
  page's shape (client selector, filter select, toasts, `@/components/ui`)
- `apps/whatsapp-agent-web/src/app/dashboard/layout.tsx` — nav entries
- `apps/whatsapp-agent-web/src/components/ui/` — use only existing components

## Files to create / modify

- CREATE: `src/app/dashboard/social-comments/page.tsx`
- MODIFY: `src/app/dashboard/layout.tsx` — nav entry "Comments"
  (`/dashboard/social-comments`), same pattern as the Workflows/Customers
  entries (icon case + title + nav item)

## Page behavior

Same shell as customers page: token guard, portal-user redirect, client
selector Card at top.

Below, for the selected client:

- **Status filter** Select: Pending (default) / Replied / Dismissed / Hidden /
  All — refetches with `?status=` (empty for All).
- **Comment list** (Cards or Table, your judgment to match the codebase):
  each row shows channel badge ("Facebook" / "Instagram"), author name,
  comment text, age (e.g. locale date), status badge.
- **Pending rows** show:
  - the AI draft in an editable Textarea (prefilled with `aiDraft`; empty
    textarea with placeholder "Write a public reply…" when no draft)
  - **Send reply** button → POST reply with the textarea content; disabled
    when empty; on success toast + refetch; on 400 show Meta's error in an
    error toast
  - **Dismiss** button → confirm, POST dismiss, refetch
  - **Hide** button (facebook rows only) → confirm, POST hide, refetch
- **Non-pending rows**: read-only; replied rows show the `replyText`.
- EmptyState when no comments for the filter.

## Do NOT

- No API changes. No new dependencies. Existing `@/components/ui` only.
- Do not add auto-reply settings or scheduling — manual approval only (by design).
- Only the two listed files change.

## Acceptance criteria

- [ ] Page renders; filter, send/edit-send, dismiss, hide all round-trip
      against the existing API; Meta 400 errors surface as error toasts.
- [ ] Hide button appears only for facebook-channel rows.
- [ ] `npm run build` passes — paste real output.

## Report back

- Files created/modified
- Verbatim build output
- Any deviation from this spec, with the reason
