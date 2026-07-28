# TheReplyte — Chatwoot User Manual

How to create staff accounts, assign conversations, and set up auto-assignment
in Chatwoot (`inbox.thereplyte.com`). Two audiences:

- **Part A — CloudIT staff** (you): how the pieces fit and what you configure per client
- **Part B — Client guide**: hand this to clients; plain language, no internals

---

## PART A — CLOUDIT STAFF

## A1. How the pieces fit (read once)

```
Client's WhatsApp customers
        ↓
TheReplyte AI (answers automatically)
        ↓ (handoff: customer asks for human, AI unsure, allowance exhausted, after hours)
Chatwoot account for that client
        ↓
Client's agents reply (or CloudIT staff, if you manage it for them)
        ↓
Reply travels back through TheReplyte → customer's WhatsApp
```

- Every client gets their **own Chatwoot account** (created automatically
  during onboarding via `POST /clients/:id/chatwoot-setup`). Accounts are
  fully isolated — one client never sees another's chats.
- Inside that account: one **inbox** (API type, e.g. "CloudIT WhatsApp").
  All AI handoffs and forwarded messages land there.
- TheReplyte also creates the **client admin user** automatically (the
  `adminEmail` from onboarding) and auto-confirms it — no email verification
  needed for that first user.
- Handed-off conversations arrive pre-labeled: `ai-handoff`,
  `in-hours` / `after-hours`, and `urgent` when the reason matches urgent
  keywords. Use labels for filtering and prioritization.

## A2. Logging into a client's Chatwoot account

1. Go to `https://inbox.thereplyte.com`.
2. Log in as the **client admin** (the email used at client onboarding), or
   as your platform super-admin if you manage accounts yourself.
3. The account switcher (top-left) lists accounts you belong to — make sure
   you're inside the right client's account before changing anything.

## A3. Creating staff/agent accounts (per client)

Agents are managed **inside Chatwoot, not in TheReplyte dashboard** (by
design — TheReplyte only owns onboarding and AI configuration).

1. In the client's account, go to **Settings → Agents**.
2. Click **Add Agent**.
3. Fill in: **Name**, **Email**, **Role**:
   - **Administrator** — full control of the account (settings, agents,
     inboxes). Give this to the client's owner/manager only.
   - **Agent** — can only work conversations. Give this to regular staff.
4. Save. Chatwoot sends an **invitation email** with a password-setup link.

**If the invitation email does not arrive** (SMTP not configured on your
Chatwoot): the account is created but the agent can't set a password.
Options:
- Configure SMTP on Chatwoot (recommended long-term; also enables password
  resets and notifications), or
- Use the same auto-confirm approach TheReplyte uses for the client admin:
  set `confirmed_at` for the user's email directly in the Chatwoot Postgres
  `users` table, then set the password via a Rails console command
  (`docker exec -it chatwoot-rails bundle exec rails console`, then
  `u = User.find_by(email: 'agent@client.com'); u.update(password:
  'TempPass123!', confirmed_at: Time.now)`). Share the temp password
  securely and have them change it in **Profile Settings**.

## A4. Availability status (how agents become assignable)

Each agent controls their own status (top-right corner of the Chatwoot UI):

- **Online** — receives auto-assigned conversations
- **Busy** — working but should not get new auto-assignments
- **Offline** — out; nothing auto-assigned

Tell every agent: set yourself **Online** when your shift starts and
**Offline** when it ends. Auto-assignment only considers online agents.

## A5. Assigning conversations manually

1. Open the conversation.
2. Top-right of the conversation header: the **assignee dropdown**.
3. Pick an agent (or a team). The conversation moves to that agent's
   "Mine" list.
4. Reassign anytime the same way — e.g. escalate to a senior agent.

## A6. Auto-assignment rules

Chatwoot CE auto-assignment is **round-robin across online agents** on the
inbox. To enable it:

1. **Settings → Inboxes** → open the client's WhatsApp inbox.
2. Find the **Auto Assignment** section.
3. Enable **"Enable auto assignment of conversations"**.
4. Save.

Result: every new conversation (including AI handoffs) is automatically
given to an online agent in rotation — no one has to pick chats manually.

**Recommended setup for most clients:**

- Auto-assignment ON
- All support agents Online during business hours
- One Administrator (owner) who also watches the **Unassigned** view as a
  safety net

**Using Teams (bigger clients):**

1. **Settings → Teams → Add team** (e.g. "Sales", "Support", "Sinhala").
2. Add agents to each team.
3. On a conversation, assign it to a **team** instead of a person — any
   team member can then take it.
4. Typical rule of thumb: AI handoffs with the `urgent` label go to the
   senior team; the rest go to general support. (Assign by label in the
   conversation list — filter by label, bulk-assign.)

**Suggested working rules (write these down for each client):**

- New handoff lands → auto-assigned to an online agent
- Agent replies within X minutes during business hours
- `urgent` label → senior agent takes over immediately
- Conversation done → **Resolve** (this also triggers the customer
  satisfaction rating message from TheReplyte)
- After-hours handoffs (`after-hours` label) → first agent online next
  business day picks them up from the Open list

## A7. Canned responses (shared with TheReplyte)

Agents can type `/shortcut` in the reply box to insert templates
(`{{customer_name}}`, `{{business_name}}`, `{{agent_name}}` are filled
automatically). These are managed in TheReplyte dashboard → **Canned
Responses** per client — set them up for the client during onboarding
(greeting, business hours, payment details, address request, closing).

## A8. Notifications for agents

Each agent should enable notifications in **Profile Settings →
Notification Settings** (browser push + email if SMTP is configured), and
install Chatwoot mobile apps (iOS/Android) if they work from phones.

---

## PART B — CLIENT GUIDE (hand this to your clients)

# Your Team Inbox — Quick Guide

Your WhatsApp is now answered by an AI assistant. When the AI can't help,
or a customer asks for a person, the chat appears in your **team inbox**
(Chatwoot). This guide shows your team how to use it.

### 1. Logging in

- Go to `https://inbox.thereplyte.com`
- Use the email and password given to you by CloudIT
- (First time: set your own password via the link you received)

### 2. Adding your staff (owner/admin only)

1. Click **Settings** (bottom-left) → **Agents** → **Add Agent**
2. Enter their name, email, and role:
   - **Agent** = answers chats only (choose this for most staff)
   - **Administrator** = can change settings (owners/managers only)
3. They receive an email to set their password. If it doesn't arrive,
   contact CloudIT.

### 3. Starting and ending your workday

Click your profile picture (top-right) and set your status:

- **Online** = I'm working, send me chats
- **Offline** = I'm done for today

Chats are only auto-assigned to people who are **Online**.

### 4. How chats reach your team

When a chat needs a human, it appears in the inbox automatically:

- If **auto-assignment** is on (recommended — CloudIT can enable it), each
  new chat is given to an online team member in turn. You'll find your
  chats under **Mine**.
- Otherwise, chats wait in **Unassigned** — anyone can open one and assign
  it to themselves from the dropdown at the top of the chat.

### 5. Answering a chat

1. Open the conversation — you'll see the full history with the AI and a
   short summary of what happened so far. The handoff note includes a
   **ticket reference (TK-XXXXX)** — quote it when talking about the case
   with your team; the customer received the same reference on WhatsApp.
2. Type your reply and send — it goes straight to the customer's WhatsApp.
3. Quick replies: type `/` to pick a saved template (e.g. `/greeting`).
4. When the customer is sorted, click **Resolve**. The customer then gets
   a short 1–5 rating request — this measures your service quality.
   Resolving also files the ticket under **Support History** in TheReplyte
   dashboard (full transcript, resolution time, and the rating), so always
   resolve — never leave finished chats open.

### 6. Labels you'll see

- `ai-handoff` — the AI passed this chat to humans
- `urgent` — complaint/refund-type issue, handle first
- `after-hours` — came in while you were closed; answer these first thing
  next morning

### 7. Tips

- Keep your status **Online** only when you can actually reply.
- Check **Mine** first, then **Unassigned** if you have spare time.
- If a chat is too complex for you, reassign it to a teammate from the
  dropdown — no need to struggle alone.

---

## Quick reference — who does what

| Task | Where | Who |
|---|---|---|
| Create client account + inbox + admin | TheReplyte dashboard (automatic) | CloudIT staff |
| Add agents | Chatwoot → Settings → Agents | Client admin (or CloudIT) |
| Enable auto-assignment | Chatwoot → Settings → Inboxes → Auto Assignment | Client admin (or CloudIT) |
| Set availability (online/offline) | Chatwoot → profile menu | Each agent |
| Assign/reassign chats | Conversation → assignee dropdown | Any agent |
| Canned responses | TheReplyte dashboard → Canned Responses | CloudIT staff |
| Resolve chats (triggers CSAT) | Conversation → Resolve | Assigned agent |
