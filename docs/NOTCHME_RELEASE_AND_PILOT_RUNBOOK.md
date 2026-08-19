# NotchMe Release and Malta Pilot Runbook

> Status: implementation-ready; production execution requires the named external inputs and approvals below.
> Scope: Europe-first product validation in Malta, followed by evidence-led European expansion and later Sri Lanka localization.

## 1. Release decision

Do not expose NotchMe to paying or invited pilot users until every release gate is signed off. A local build, passing tests, or a configured sandbox is not production approval.

### Required product gates

- Registration, verification, recovery, onboarding, publishing, reciprocal contact capture, booking management, People, Today, recap review, export, and deletion pass end-to-end testing against a representative PostgreSQL database.
- The migrations through `0024_auth_verification_recovery.sql` are applied to a disposable clone first, then to production with a verified backup and rollback procedure.
- Desktop, 768px tablet, and 375px mobile checks pass in light and dark themes. Keyboard order, focus visibility, skip links, reduced motion, touch targets, dialogs, errors, empty states, and horizontal overflow are reviewed in a real browser.
- A production dependency audit has no accepted critical exposure. Remaining high or moderate findings have an owner, applicability assessment, mitigation, and deadline.

### Required operational inputs

- Final application domain and API domain, with DNS and TLS.
- Official support, privacy, security, and transactional sender addresses.
- Legal entity/controller details, governing law, final Terms, Privacy, Cookies, cancellation/refund wording, processor list, and Malta/EU legal review.
- Stripe live Products/Prices, webhook secret, Customer Portal, tax registrations, invoice wording, and sandbox-to-live acceptance evidence.
- Resend domain authentication and delivery testing before `NOTCHME_REQUIRE_EMAIL_VERIFICATION=true`.
- Production database, Redis, secrets, backups, restore rehearsal, monitoring, alert ownership, and incident contact.
- OpenAI processing approval and a live redacted test only if AI recap is enabled. The core product must remain usable with AI disabled.

## 2. Security and dependency gate

The local review on 2026-08-19 upgraded NotchMe Web from Next 14.2.35 to 15.5.21 and PostCSS to the current direct line. The production build passed on that version.

The scoped production audits report five high and no critical findings for NotchMe Web, and six high, eight moderate, and no critical findings for NotchMe API. The repository-wide audit additionally reports critical findings attributable to other shared application paths. Nest 11 could not be safely isolated inside the npm workspace because Nest plugins are hoisted across other applications; a partial upgrade produced duplicate framework runtimes and was rejected. Resolve this as a coordinated monorepo upgrade, not with type casts or forced peer resolution. Re-run:

```powershell
npm.cmd audit --omit=dev --workspaces
npm.cmd audit --omit=dev --workspace @cloudit/notchme-web
npm.cmd audit --omit=dev --workspace @cloudit/notchme-api
```

Record each remaining advisory with affected runtime path, reachability, mitigation, owner, and target date. Do not describe the release as security-approved while a critical advisory is unresolved.

## 3. Pilot cohort

- Start with 10–20 Malta-based independent consultants and boutique professional-service firms.
- Run for four weeks after a one-week internal dogfood period.
- Include a mix of frequent networkers and appointment-led professionals; exclude regulated/highly sensitive use cases from the first cohort.
- Obtain explicit pilot terms and AI-processing consent where applicable. Do not upload third-party meeting audio without an appropriate lawful basis and participant notice.
- Give each participant a named onboarding slot and a documented support channel. The actual owner and address must be filled in before invitations are sent.

## 4. Pilot workflow

### Before invitation

1. Create the pilot roster with participant ID, segment, plan, inviter, consent status, start date, and support owner. Keep personal interview notes outside product analytics.
2. Confirm the participant can receive verification and recovery messages.
3. Confirm the account starts on the intended entitlement; never alter paid access through a client-side request.

### Activation session

1. Register and verify the account.
2. Complete and publish My Page.
3. Create one active meeting type.
4. Share the public page and capture one reciprocal introduction.
5. Create one next action and confirm it appears on Today.
6. Book, reschedule, and cancel a test appointment through the guest-management link.
7. Finalize one reviewed meeting recap; if AI is enabled, compare an AI-assisted draft with a manual draft and confirm nothing is sent automatically.

### Weekly operations

- Review failed verification delivery, booking errors, webhook failures, payment failures, and API health alerts daily.
- Review activation completion, active Today users, completed follow-ups, bookings, recaps, and support themes weekly.
- Interview active, inactive, converted, and churn-risk participants. Separate observed behavior from requested features.
- Do not add country-specific core logic during the pilot. Record locale, language, payment, and integration demand for later prioritization.

## 5. Measurement definitions

Use saved server data as the source of truth. Do not infer completion from a browser click when a persisted outcome exists.

| Measure | Definition |
| --- | --- |
| Verified account | `users.email_verified_at` is present |
| Published page | saved profile is published |
| Booking configured | at least one saved active meeting type |
| First person | first authorized customer/person record |
| First next action | first saved customer follow-up |
| Share readiness | published profile; `activation_share_opened` is supporting interaction data, not proof another person received it |
| Introduction captured | reciprocal public-page contact activity/customer created or matched in scope |
| Meeting completed | non-cancelled booking whose end time has passed |
| Recap completed | finalized meeting recap |
| Follow-up completed | saved follow-up with `completed_at` |
| Paid conversion | verified Stripe subscription state, never the return-page redirect |

Report Week 1 and Week 4 retention, weekly Today use, follow-ups completed, introductions-to-bookings, meetings with finalized recaps, trial-to-paid conversion, churn signals, AI generation cost, and AI draft acceptance. Small-cohort percentages must always include their numerator and denominator.

## 6. Decision framework

The pilot is successful enough to expand when participants repeatedly return to complete relationship work, not merely when they publish a page. Before the pilot begins, the product owner must set numeric hypotheses for activation, Week 4 retention, weekly follow-up completion, and willingness to pay. Do not choose thresholds after seeing the results.

At the end of four weeks choose one:

- **Expand:** repeat behavior and willingness to pay support a wider Malta/European cohort.
- **Iterate:** the core loop is used but a small number of evidenced obstacles block retention.
- **Narrow:** one segment shows value while others do not; focus the positioning and onboarding.
- **Stop:** page creation occurs but relationship follow-through does not repeat.

## 7. Expansion sequencing

1. Malta pilot in English and EUR.
2. Wider European rollout only after legal, tax, support, localization, and payment requirements are validated per target country.
3. Sri Lanka localization later using the same core product, with evidence-led LKR pricing, language options, payment methods, and WhatsApp-oriented workflows.

No country is “covered” merely because the website is reachable there. Coverage requires compliant contracting, privacy, tax, payments, support, and localized product behavior.
