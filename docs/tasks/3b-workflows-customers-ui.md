# Task: Dashboard UI for AI Workflows + Customers/Leads (spec 2 of 2)

Phase: 1 | App: `apps/whatsapp-agent-web`

## Goal

Give the dashboard two new pages so clients' workflows and AI-qualified leads are
visible and editable:

1. **`/dashboard/workflows`** — manage the plain-language AI workflows created by
   the API built in spec 3a.
2. **`/dashboard/customers`** — the CRM view: customers with their AI-assigned
   category, lead source, and a category manager.

The API already exists (branch `codex/ai-workflows-api`): `workflows`,
`categories`, `customers` controllers with `:clientId`-scoped routes.

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `apps/whatsapp-agent-web/src/app/dashboard/canned-responses/page.tsx` —
  **copy this page's exact shape**: client fetch + selector, list + form,
  `apiFetch`, `useToast`, UI imports from `@/components/ui`, portal-user redirect
- `apps/whatsapp-agent-web/src/lib/api.ts` — `apiFetch`
- `apps/whatsapp-agent-web/src/app/dashboard/portal.ts` — `isPortalUser`
- `apps/whatsapp-agent-web/src/components/ui/` — check which components exist
  (Button, Card, Input, Select, Table, Textarea, EmptyState, useToast, badges, etc.)
  and use only those
- `apps/whatsapp-agent-web/src/app/dashboard/layout.tsx` — add nav entries the same
  way existing entries are declared
- API shapes (from spec 3a, already built — do not modify the API):
  - `GET/POST /api/workflows/:clientId`, `PUT/DELETE /api/workflows/:clientId/:id`
    - workflow: `{ id, name, trigger, instructions, description?, collectFields?: string[], endAction: 'handoff'|'booking'|'order'|'none', categoryId?, category?, isActive, priority, createdAt }`
  - `GET/POST /api/categories/:clientId`, `PUT/DELETE /api/categories/:clientId/:id`
    - category: `{ id, name, description?, color? }`
  - `GET /api/customers/:clientId?categoryId=` — customer:
    `{ id, phoneNumber, name?, email?, leadSource?, categoryId?, category?, createdAt }`
  - `PUT /api/customers/:clientId/:id/category` — body `{ categoryId: string | null }`

## Files to create / modify

- CREATE: `src/app/dashboard/workflows/page.tsx`
- CREATE: `src/app/dashboard/customers/page.tsx`
- MODIFY: `src/app/dashboard/layout.tsx` — add "Workflows" and "Customers" nav
  entries, matching how existing entries are declared (same icons style/placement
  logic; place them near canned-responses / bookings)

## Page 1: `/dashboard/workflows`

Same shell as canned-responses (client selector at top, portal redirect, token
guard). Below the selector:

- **List** of workflows for the selected client, ordered as the API returns them.
  Each row/card shows: name, trigger (truncated), category badge (name + color if
  set), `endAction`, priority, active/inactive state.
- **Create/edit form** (same page, like canned-responses) with fields:
  - `name` (Input, required)
  - `trigger` (Textarea, required) — placeholder hint: "When should the AI start
    this workflow? e.g. Customer asks about visa services"
  - `instructions` (Textarea, required) — placeholder hint: "Steps the AI should
    follow, in plain language"
  - `description` (Input, optional)
  - `collectFields` (Textarea, optional) — **one field name per line**; convert
    to/from the `string[]` the API expects
  - `endAction` (Select: handoff / booking / order / none; default handoff)
  - `categoryId` (Select populated from the categories API; "— none —" option)
  - `priority` (Input, number, default 0)
  - `isActive` (checkbox or Select; default active)
- Edit loads the row into the form; delete asks for confirmation (follow the
  canned-responses page's delete UX); toasts on success/error.

## Page 2: `/dashboard/customers`

Same shell again. Layout:

- **Categories panel** (top): list the client's categories as badges/chips (use
  `color` when set), with an inline create form (name, optional color, optional
  description) and delete per category. Keep it compact — one Card.
- **Customers table** below: columns Name, Phone, Category (badge, or "—"),
  Lead source (`leadSource`, render `ctwa_ad` as "WhatsApp ad", null as "Organic/
  unknown"), Created date.
- **Category filter**: a Select above the table (all categories + "All"); refetch
  with `?categoryId=` when changed.
- **Per-row category assignment**: a Select in the Category column to assign/clear
  (`PUT .../category` with `{ categoryId: id | null }`), toast on success, update
  the row in place.
- EmptyState when the client has no customers.

## Do NOT

- Do not modify the API app in any way.
- Do not restyle shared UI components or the layout beyond the two nav entries.
- No new dependencies. Tailwind classes + existing `@/components/ui` only.
- Do not build workflow-session/progress UI — that comes with the AI runtime later.
- Keep the portal-user redirect identical to canned-responses on both pages.

## Acceptance criteria

- [ ] Both pages render, CRUD round-trips work against the existing API routes
      (workflows, categories, customer category assignment, category filter).
- [ ] `collectFields` round-trips correctly (one-per-line textarea ↔ string array).
- [ ] Nav shows both entries and routing works.
- [ ] `npm run build` passes — paste real output. (Lint is known-broken; ignore.)
- [ ] No files outside the three listed above are modified.

## Report back

- Files created/modified (full list)
- Verbatim build output
- Any deviation from this spec, with the reason
