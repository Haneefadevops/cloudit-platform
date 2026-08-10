# TheReplyte — Messenger & Instagram Setup Runbook

Use this runbook to connect a client's Facebook Page or Instagram account to
their Chatwoot account. The Chatwoot bridge sends Messenger and Instagram
messages into the AI automatically after the inbox is connected.

## 1. Meta app setup

This is a one-time platform setup using the existing Meta app.

1. In Meta for Developers, open the existing app.
2. Add the **Messenger** and **Instagram** products.
3. Request the permissions `pages_messaging`, `pages_manage_metadata`, and
   `instagram_manage_messages`.
4. Production use with business accounts requires Meta App Review approval for
   these permissions.
5. For Instagram, confirm that the client's account is a professional account
   linked to the client's Facebook Page.

## 2. Chatwoot environment

Set these values in `infra/chatwoot/.env` on the server:

```env
FB_APP_ID=your_meta_app_id
FB_APP_SECRET=your_meta_app_secret
FB_VERIFY_TOKEN=your_messenger_verify_token
IG_VERIFY_TOKEN=your_instagram_verify_token
```

Restart Chatwoot after saving the values:

```bash
cd infra/chatwoot
docker compose up -d
```

When creating a Facebook or Instagram inbox, Chatwoot shows callback and OAuth
redirect URLs. Add the URLs shown in that UI to the Meta app's valid OAuth
redirect URIs. Configure the Meta Page webhook to
`https://inbox.thereplyte.com/webhooks/facebook`; confirm this endpoint in the
Chatwoot UI for the Chatwoot version currently deployed.

## 3. Per-client onboarding

For each client:

1. Open the client's Chatwoot account at `https://inbox.thereplyte.com`.
2. Go to **Settings → Inboxes → Add Inbox**.
3. Select **Facebook** or **Instagram** and complete the OAuth flow for the
   client's Page or Instagram account.
4. Confirm the inbox is connected by sending a customer message.

Nothing is configured in `whatsapp-agent-api` for this step. Once the native
Chatwoot inbox exists, Messenger and Instagram messages flow into the AI
automatically. AI replies and agent replies are both delivered through that
Chatwoot conversation. The existing API inbox named `{Client} WhatsApp` remains
for WhatsApp only.

CSAT messages and WhatsApp template fallbacks are WhatsApp-only by design.

## 4. Limitations (v1)

- Messenger and Instagram support text messages only. Attachments are logged
  and skipped.
- CSAT is not sent on Messenger or Instagram.
- A customer who contacts the business through both WhatsApp and Messenger is
  stored as two customer records because identity is per channel.

## 5. Troubleshooting

### Message arrives in Chatwoot but there is no AI reply

Check the API logs for routing skips. Common causes are an unknown Chatwoot
account, an event from the client's WhatsApp API inbox, or a channel that is
not Facebook or Instagram.

### AI replies do not reach the customer

Check the Facebook Page token and Meta's 24-hour messaging window. Meta allows
Messenger and Instagram replies only within 24 hours of the customer's last
message.
