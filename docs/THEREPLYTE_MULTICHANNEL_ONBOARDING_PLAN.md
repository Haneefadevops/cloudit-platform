# TheReplyte Multi-Channel Onboarding & Dashboard Update Plan

## Goal

Bring TheReplyte's client onboarding documentation and staff dashboard in line with the multi-channel backend that already supports WhatsApp, Messenger, and Instagram. Fix the remaining backend gaps so staff can safely onboard and operate clients across all three channels.

## Current state

- **Backend:** `apps/whatsapp-agent-api` already routes incoming/outgoing Messenger and Instagram messages through Chatwoot, stores `channel` and `channelSourceId` on `Customer`/`Conversation`, and has `facebookPageId` / `instagramAccountId` on `Client`.
- **Docs:** `docs/THEREPLYTE_CLIENT_ONBOARDING_SOP.md` is still WhatsApp-only. `docs/THEREPLYTE_MESSENGER_INSTAGRAM_SETUP.md` exists as a separate runbook but is not integrated into the main SOP.
- **Dashboard UI:** `apps/whatsapp-agent-web` only shows WhatsApp fields and does not expose channel selection, Facebook/Instagram identifiers, or channel-aware views.
- **Remaining bugs:** `POST /conversations/:id/reply` always sends via WhatsApp regardless of `conversation.channel`, and `pushHandoffToChatwoot` aborts when the customer has no phone number, which breaks Messenger/Instagram handoffs.

---

## Phase 0 — Documentation alignment

**Owner:** Kimi (docs) + Codex review  
**Outcome:** Onboarding SOP describes multi-channel setup; runbooks are cross-linked.

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 0.1 | Rewrite Stage 0 of `THEREPLYTE_CLIENT_ONBOARDING_SOP.md` to collect channel preferences and Page/IG account details. | `docs/THEREPLYTE_CLIENT_ONBOARDING_SOP.md` | Stage 0 lists WhatsApp/Messenger/Instagram selection and required Meta assets per channel. |
| 0.2 | Rename Stage 1 to "Meta setup" and split into 1A (WhatsApp) and 1B (Messenger/Instagram platform setup). | `docs/THEREPLYTE_CLIENT_ONBOARDING_SOP.md` | WhatsApp steps remain intact; Messenger/Instagram steps link to the runbook. |
| 0.3 | Update Stage 2 Section 3 from "WhatsApp Configuration" to "Channel Configuration" and add optional Facebook/Instagram fields. | `docs/THEREPLYTE_CLIENT_ONBOARDING_SOP.md` | Form walkthrough matches the updated dashboard fields. |
| 0.4 | Add Messenger/Instagram inbox creation and testing steps to Stage 2 and Stage 5. | `docs/THEREPLYTE_CLIENT_ONBOARDING_SOP.md` | Staff know they must add native inboxes in Chatwoot after WhatsApp setup. |
| 0.5 | Update `THEREPLYTE_README.md` architecture and feature list to reflect WhatsApp + Messenger + Instagram. | `docs/THEREPLYTE_README.md` | No longer reads as WhatsApp-only. |
| 0.6 | Cross-link `THEREPLYTE_MESSENGER_INSTAGRAM_SETUP.md` from the SOP and README. | `docs/THEREPLYTE_CLIENT_ONBOARDING_SOP.md`, `docs/THEREPLYTE_README.md` | Runbook is discoverable from the main onboarding path. |

---

## Phase 1 — Backend routing fixes (required before live Messenger/Instagram)

**Owner:** Codex  
**Outcome:** Staff replies and AI handoffs work correctly across all channels.

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 1.1 | Make `POST /conversations/:id/reply` channel-aware. | `apps/whatsapp-agent-api/src/conversations/conversations.controller.ts` | WhatsApp conversations use `WhatsAppSenderService`; Messenger/Instagram conversations post back into the existing Chatwoot conversation via `chatwootService.sendMessage`. |
| 1.2 | Add echo guard for API-posted Chatwoot messages (if not already present). | `apps/whatsapp-agent-api/src/conversations/conversations.controller.ts` | Messages posted by `CHATWOOT_ADMIN_USER_ID` do not re-trigger processing. |
| 1.3 | Update `pushHandoffToChatwoot` to handle Messenger/Instagram. | `apps/whatsapp-agent-api/src/conversations/conversations.service.ts` | For non-WhatsApp channels, find/create the contact in the correct native Chatwoot inbox using `channelSourceId`; do not abort on missing `phoneNumber`. |
| 1.4 | Extend `ChatwootService.createContact` to accept an optional identifier/source_id for non-WhatsApp contacts. | `apps/whatsapp-agent-api/src/chatwoot/chatwoot.service.ts` | WhatsApp contacts still use `phone_number`; Messenger/Instagram contacts use the channel-specific source identifier where applicable. |
| 1.5 | Add/update specs for channel-aware reply and handoff. | `apps/whatsapp-agent-api/src/conversations/*.spec.ts`, `apps/whatsapp-agent-api/src/chatwoot/*.spec.ts` | WhatsApp path unchanged; Messenger/Instagram paths covered. |
| 1.6 | Run `npm run build` and `npm run test` for `whatsapp-agent-api`. | `apps/whatsapp-agent-api` | Zero TS errors; new + existing tests pass. |

---

## Phase 2 — Dashboard client onboarding (channel-aware form)

**Owner:** Kimi  
**Outcome:** Staff can select channels and enter Facebook/Instagram identifiers when creating or editing a client.

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 2.1 | Add channel toggles (WhatsApp, Messenger, Instagram) to the Add/Edit Client form. | `apps/whatsapp-agent-web/src/app/dashboard/clients/page.tsx` | Checkboxes appear in a new "Channels" section. |
| 2.2 | Conditionally show WhatsApp fields only when WhatsApp is enabled. | `apps/whatsapp-agent-web/src/app/dashboard/clients/page.tsx` | WhatsApp number/Phone Number ID/token hidden when WhatsApp is unchecked. |
| 2.3 | Add optional Facebook Page ID, Facebook Page Access Token, and Instagram Account ID inputs. | `apps/whatsapp-agent-web/src/app/dashboard/clients/page.tsx` | Fields visible when the corresponding channel is enabled; values sent to the API. |
| 2.4 | Update `Client` interface and `form` state to include new channel fields. | `apps/whatsapp-agent-web/src/app/dashboard/clients/page.tsx` | TypeScript compiles; no missing fields. |
| 2.5 | Update client card to show enabled channels and the primary identifier per channel. | `apps/whatsapp-agent-web/src/app/dashboard/clients/page.tsx` | Badges or text show WhatsApp/Messenger/Instagram status. |
| 2.6 | Update the "Meta Setup" modal to include Messenger/Instagram setup guidance when enabled. | `apps/whatsapp-agent-web/src/app/dashboard/clients/page.tsx` | Modal links to `docs/THEREPLYTE_MESSENGER_INSTAGRAM_SETUP.md` steps and the Chatwoot inbox URL. |
| 2.7 | Add minimal DTO/validation on the backend for the new fields (optional but recommended). | `apps/whatsapp-agent-api/src/clients/` | `PUT / POST /api/clients` still accepts the fields but logs/rejects invalid shapes. |

---

## Phase 3 — Dashboard customer and support views

**Owner:** Kimi  
**Outcome:** Staff can see which channel each customer and ticket belongs to.

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 3.1 | Add `channel` and `channelSourceId` to the Customer interface and table. | `apps/whatsapp-agent-web/src/app/dashboard/customers/page.tsx` | Customers page shows Channel and Source ID columns. |
| 3.2 | Handle blank phone numbers gracefully in the Customers table. | `apps/whatsapp-agent-web/src/app/dashboard/customers/page.tsx` | Messenger/Instagram customers show "—" for phone instead of breaking. |
| 3.3 | Add channel-aware lead-source labels (Messenger, Instagram, WhatsApp ad, Organic). | `apps/whatsapp-agent-web/src/app/dashboard/customers/page.tsx` | New badge variants render correctly. |
| 3.4 | Add `channel` to the Support History ticket list and detail view. | `apps/whatsapp-agent-web/src/app/dashboard/support-history/page.tsx` | Ticket row shows the channel badge; detail view shows customer channel and source ID. |
| 3.5 | Update the detail view's customer type to allow missing phoneNumber. | `apps/whatsapp-agent-web/src/app/dashboard/support-history/page.tsx` | No TypeScript errors when phoneNumber is null. |

---

## Phase 4 — Analytics, AI settings, and playground

**Owner:** Kimi + Codex  
**Outcome:** Reporting and AI testing reflect multi-channel reality.

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 4.1 | Add channel breakdown to analytics API. | `apps/whatsapp-agent-api/src/analytics/analytics.controller.ts` | Response includes `byChannel` with conversation/message counts per channel. |
| 4.2 | Render channel breakdown in the Analytics UI. | `apps/whatsapp-agent-web/src/app/dashboard/analytics/page.tsx` | New stat cards or table show WhatsApp/Messenger/Instagram split. |
| 4.3 | Update AI settings page subtitle and add per-channel welcome/fallback message overrides (optional). | `apps/whatsapp-agent-web/src/app/dashboard/ai-settings/page.tsx`, `apps/whatsapp-agent-api/src/clients/clients.controller.ts` | Subtitle no longer says "WhatsApp message handler"; optional per-channel messages stored and used. |
| 4.4 | Add a channel selector to the Playground. | `apps/whatsapp-agent-web/src/app/dashboard/playground/page.tsx`, `apps/whatsapp-agent-api/src/playground/playground.service.ts` | Staff can simulate WhatsApp, Messenger, or Instagram messages. |
| 4.5 | Add channel-aware tests for analytics and playground. | `apps/whatsapp-agent-api/src/analytics/`, `apps/whatsapp-agent-api/src/playground/` | New specs pass. |

---

## Phase 5 — CloudIT go-live and regression

**Owner:** Kimi + Codex together  
**Outcome:** CloudIT is live on WhatsApp + Messenger + Instagram with no regressions.

| # | Task | Files / Systems | Acceptance criteria |
|---|------|-----------------|---------------------|
| 5.1 | Run the updated Messenger/Instagram runbook for CloudIT. | `docs/THEREPLYTE_MESSENGER_INSTAGRAM_SETUP.md`, Meta Developers, Chatwoot | CloudIT's Facebook Page and Instagram account are connected as native Chatwoot inboxes. |
| 5.2 | Set `FB_APP_ID`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN`, `IG_VERIFY_TOKEN` in `infra/chatwoot/.env` and restart. | `infra/chatwoot/.env`, server | Chatwoot can authenticate Messenger/Instagram OAuth flows. |
| 5.3 | Populate `facebookPageId` and `instagramAccountId` on CloudIT's `Client` record. | Database / dashboard | Record reflects the connected assets. |
| 5.4 | End-to-end test: send messages from WhatsApp, Messenger, and Instagram; verify AI replies and agent handoffs. | WhatsApp + Messenger + Instagram accounts | Each channel reaches the AI; agent replies return; handoffs land in the correct Chatwoot inbox. |
| 5.5 | Regression test existing WhatsApp clients. | At least one existing client | WhatsApp onboarding, replies, handoffs, CSAT, and analytics remain unchanged. |
| 5.6 | Update onboarding checklist and archive any completed task docs. | `docs/THEREPLYTE_CLIENT_ONBOARDING_SOP.md`, `docs/tasks/` | Docs match the deployed state. |

---

## Out of scope for this plan

- Billing/pricing changes per channel.
- Social comments expansion (already works for Facebook/Instagram post comments).
- New channel types beyond WhatsApp/Messenger/Instagram.
- App Review submission to Meta (tracked separately with the client).

---

## Suggested start order

1. **Phase 0** — update docs first so the team has a single source of truth while coding.
2. **Phase 1** — fix backend routing/handoff before any Messenger/Instagram traffic is expected.
3. **Phase 2** — update the client form so staff can record Facebook/Instagram assets.
4. **Phase 3** — make customers and tickets channel-visible.
5. **Phase 4** — analytics and playground channel support.
6. **Phase 5** — CloudIT go-live and regression.

This order minimises risk: the dangerous backend bugs are fixed before the dashboard exposes multi-channel features, and docs lead the work rather than trailing it.
