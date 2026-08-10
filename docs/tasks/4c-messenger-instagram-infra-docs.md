# Task: Messenger/Instagram infra config + setup documentation (spec 4c)

Phase: 3 | App: `infra/chatwoot` + `docs`

## Goal

The code for the Messenger/Instagram bridge is done (4a + 4b). What remains is
operational: Chatwoot needs Meta app credentials in its environment, and the
team needs a runbook for connecting a client's Facebook Page / Instagram
account. This task is env plumbing + documentation only — no application code.

## Context (read these, nothing else)

- `docs/CODEX_PLAYBOOK.md` — workflow and rules (read first, always)
- `infra/chatwoot/docker-compose.yml` — the chatwoot-rails service env section
- `infra/chatwoot/.env.example`
- `docs/WHATSAPP_AGENT_SETUP.md` — existing setup doc style/structure to match
- `docs/THEREPLYTE_CLIENT_ONBOARDING_SOP.md` — onboarding context

Background facts (from the code, already verified — do not re-derive):
- Chatwoot stock image, served at inbox.thereplyte.com, one Chatwoot account
  per client, one API inbox per client named "{Client} WhatsApp".
- The API consumes Chatwoot webhooks at `/api/webhooks/chatwoot`; incoming
  Messenger/IG messages from native channel inboxes are routed into the AI
  pipeline (channel mapped from `Channel::FacebookPage` / `Channel::Instagram`);
  events from the client's WhatsApp API inbox are ignored.
- AI/agent replies to Messenger/IG conversations are posted back into the
  Chatwoot conversation as outgoing messages — Chatwoot delivers them via the
  page token. WhatsApp behavior is unchanged.
- Chatwoot reads Meta credentials from env: `FB_APP_ID`, `FB_APP_SECRET`,
  `FB_VERIFY_TOKEN` (Messenger), and for Instagram the same Facebook app plus
  `IG_VERIFY_TOKEN` on versions that use it.

## Files to create / modify

- MODIFY: `infra/chatwoot/.env.example` — add commented-out entries with
  one-line explanations:
  - `FB_APP_ID`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN`, `IG_VERIFY_TOKEN`
- MODIFY: `infra/chatwoot/docker-compose.yml` — pass these four vars through
  to the `chatwoot-rails` service environment, using the same
  `${VAR:-}` style the file already uses (match its existing conventions;
  do not restructure the file).
- CREATE: `docs/THEREPLYTE_MESSENGER_INSTAGRAM_SETUP.md` — the runbook:

  1. **Meta app setup** (one-time, platform level): add the Messenger and
     Instagram products to the existing Meta app; required permissions
     (`pages_messaging`, `pages_manage_metadata`, `instagram_manage_messages`);
     note that production use for business accounts requires Meta App Review
     for these permissions; Instagram requires a professional account linked
     to a Facebook Page.
  2. **Chatwoot env**: set the four vars, `docker compose up -d` restart;
     note the callback/redirect URLs Chatwoot shows during inbox creation must
     be added to the Meta app's valid OAuth redirect URIs, and the Meta
     webhook for the page must point at Chatwoot's endpoint
     (`https://inbox.thereplyte.com/webhooks/facebook` — verify against the
     Chatwoot version in use and note it in the doc as "confirm in Chatwoot UI").
  3. **Per-client onboarding**: in the client's Chatwoot account, add inbox →
     Facebook / Instagram → OAuth connect the page; nothing to configure in
     the whatsapp-agent API — messages flow into the AI automatically once the
     inbox exists; agent replies and AI replies both work; CSAT and
     WhatsApp-template fallbacks are WhatsApp-only by design.
  4. **Limitations (v1)**: text-only on Messenger/IG (attachments are logged
     and skipped); CSAT not sent on Messenger/IG; a customer who contacts the
     business on both WhatsApp and Messenger is two separate customer records
     (identity is per-channel).
  5. **Troubleshooting**: message arrives in Chatwoot but no AI reply → check
     API logs for the routing skips (unknown account, api-inbox, non-FB/IG
     channel); AI replies not reaching customers → check the page token /
     24-hour window rule (Meta allows replies only within 24h of the
     customer's last message on Messenger/IG).

  Match the tone/structure of `docs/WHATSAPP_AGENT_SETUP.md`. No marketing
  language; this is an ops runbook.

## Do NOT

- No changes to `apps/` code.
- Do not modify real `.env` files (only `.env.example`).
- Do not pin or change the Chatwoot image version in this task.
- Do not invent env var names beyond the four listed.

## Acceptance criteria

- [ ] `docker-compose.yml` is valid (`docker compose -f infra/chatwoot/docker-compose.yml config -q`
      passes if docker is available; otherwise state that validation was skipped).
- [ ] The runbook covers all five sections above and matches reality
      (no claims about features that don't exist in the code).
- [ ] Only the three listed files are created/modified.

## Report back

- Files created/modified
- Whether compose validation ran
- Any deviation from this spec, with the reason
