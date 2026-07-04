# Client Onboarding Build Plan

## Goal
Enable the CloudIT Platform team to fully onboard a client from the Platform admin panel:
- Create the organization and fill organization details.
- Create a product super admin user (no Platform access required).
- Send the super admin an email with a secure link to set their password.
- Enable product modules during onboarding.
- Let the super admin log directly into the product (TouchOrbit, OrbitOne, etc.) and manage their own admins / RBAC inside that product.

Pricing/contract management is intentionally **out of scope** for onboarding and will live in a separate Billing/Contracts module later.

---

## Team Split

- **Codex** — all backend work (Platform API + product APIs).
- **Kimi** — all frontend work (Platform web + product frontends).

This means:
- Codex designs the data models, internal provisioning endpoints, email payload contracts, and API responses.
- Kimi builds the UI pages that consume those endpoints.

---

## Architecture Decisions

1. **Platform is the orchestrator.** The Platform admin UI creates the organization and triggers provisioning in each product.
2. **Products remain separate.** Each product keeps its own users, sessions, and RBAC. There is no shared login across products.
3. **Products expose an internal provisioning endpoint** that Platform calls with an internal API token.
4. **Products generate their own invite/set-password token** and return the public link to Platform. Platform sends the email.
5. **Module enablement is controlled from Platform** via the existing `OrganizationProductModule` table. Product APIs already read this via `ModuleGuard`.
6. **Customization** (custom fields, feature flags, client-only modules) is configured from Platform and applied per organization inside each product.

---

## Internal Provisioning Contract

### Platform → Product

```http
POST /api/internal/provision-tenant
Authorization: Bearer <INTERNAL_API_TOKEN>
Content-Type: application/json

{
  "platformOrgId": "uuid",
  "name": "CloudIT Pvt Ltd",
  "slug": "cloudit-pvt-ltd",
  "superAdminEmail": "admin@client.com",
  "superAdminFirstName": "John",
  "superAdminLastName": "Doe"
}
```

### Product → Platform response

```http
200 OK
{
  "tenantId": "uuid",
  "userId": "uuid",
  "inviteToken": "secure-random-token",
  "setPasswordUrl": "https://touchorbit.cloudit.lk/set-password?token=secure-random-token"
}
```

Platform then stores the mapping and sends the email using its email service.

---

## Database Changes

### Platform API (Codex)

1. **`OrganizationProvisioning` table** — maps a Platform org to product tenants and tracks onboarding status.

```prisma
model OrganizationProvisioning {
  id            String   @id @default(uuid())
  orgId         String   @map("org_id")
  product       String
  tenantId      String   @map("tenant_id")
  status        String   @default("pending") // pending, provisioned, invite_sent, activated, failed
  invitedEmail  String   @map("invited_email")
  inviteToken   String?  @map("invite_token")
  invitedAt     DateTime? @map("invited_at")
  activatedAt   DateTime? @map("activated_at")
  failureReason String?  @map("failure_reason")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, product])
  @@map("organization_provisioning")
}
```

2. **`OrganizationCustomField` table** — defines custom fields per org/entity.

```prisma
model OrganizationCustomField {
  id          String  @id @default(uuid())
  orgId       String  @map("org_id")
  product     String
  module      String
  entity      String
  fieldKey    String  @map("field_key")
  fieldLabel  String  @map("field_label")
  fieldType   String  @map("field_type") // text, number, date, dropdown, checkbox
  options     Json?
  required    Boolean @default(false)
  order       Int     @default(0)
  isActive    Boolean @default(true)

  @@unique([orgId, product, entity, fieldKey])
  @@map("organization_custom_fields")
}
```

3. **`OrganizationFeatureFlag` table** — per-org behavior toggles.

```prisma
model OrganizationFeatureFlag {
  id          String @id @default(uuid())
  orgId       String @map("org_id")
  product     String
  featureKey  String @map("feature_key")
  enabled     Boolean @default(false)

  @@unique([orgId, product, featureKey])
  @@map("organization_feature_flags")
}
```

4. **Add `clientOnly` to module registry entries** (TypeScript only, no DB change).

### Product APIs (Codex)

Each product must create or reuse a table to store the invite/set-password token for the provisioned super admin.

- **TouchOrbit:** new `user_invite_tokens` or reuse password-reset token logic.
- **OrbitOne:** existing `organization_invites` table can be reused.

Each product must also expose a set-password/accept-invite public page (consumed by Kimi).

---

## Phase-by-Phase Build Plan

### Phase 0 — Backend Foundation (Codex)

| # | Task | Files / Areas | Acceptance Criteria |
|---|------|---------------|---------------------|
| 0.1 | Add `OrganizationProvisioning`, `OrganizationCustomField`, and `OrganizationFeatureFlag` Prisma models and generate migration. | `apps/platform-api/prisma/schema.prisma`, migration files | Tables exist in DB. |
| 0.2 | Add internal provisioning endpoint to TouchOrbit API. | `apps/touchorbit-api/src/internal/internal.controller.ts` or `provisioning.controller.ts` | `POST /api/internal/provision-tenant` creates org + owner user + invite token and returns `tenantId`, `userId`, `inviteToken`, `setPasswordUrl`. |
| 0.3 | Add internal provisioning endpoint to OrbitOne API (reuse existing org + invite flow). | `apps/orbitone-api/src/organizations/organizations.controller.ts` or new `provisioning.controller.ts` | `POST /api/internal/provision-tenant` creates org + admin invite and returns token + URL. |
| 0.4 | Confirm internal auth tokens and `ModuleGuard` already work between Platform and products. | `apps/platform-api/src/common/guards/internal-auth.guard.ts`, product `ModuleGuard` | Platform can call product internal endpoints and products can read enabled modules from Platform. |

**Frontend dependency:** Kimi cannot build product set-password pages until these endpoints exist.

---

### Phase 1 — Platform Onboarding Backend (Codex)

| # | Task | Files / Areas | Acceptance Criteria |
|---|------|---------------|---------------------|
| 1.1 | Build email service abstraction (SMTP/Resend/n8n) with invite template. | `apps/platform-api/src/email/email.service.ts`, `email.module.ts`, templates | Can send "Set your password" email with dynamic link. |
| 1.2 | Create onboarding service: create org, call product provisioning, store provisioning mapping, send email. | `apps/platform-api/src/onboarding/onboarding.service.ts` | Platform admin can onboard a client and the super admin receives the email. |
| 1.3 | Create onboarding controller and DTOs. | `apps/platform-api/src/onboarding/onboarding.controller.ts`, `dto/*.ts` | `POST /api/onboarding` accepts org details, product, super admin email/name, modules. |
| 1.4 | Add `GET /api/onboarding` and `GET /api/onboarding/:orgId` endpoints for invite status. | Onboarding controller/service | Platform admin can see provisioning status per product. |
| 1.5 | Add resend / revoke invite endpoints. | Onboarding controller/service | Admin can resend the email or cancel a pending invite. |
| 1.6 | Add audit logging for onboarding events. | `apps/platform-api/src/events/event-publisher.service.ts` | `organization.created`, `invite.sent`, `invite.accepted` events are logged. |

---

### Phase 2 — Product Set-Password Backend (Codex)

| # | Task | Files / Areas | Acceptance Criteria |
|---|------|---------------|---------------------|
| 2.1 | Build TouchOrbit set-password API endpoint. | `apps/touchorbit-api/src/auth/auth.controller.ts`, token storage | `POST /api/auth/set-password` validates token, sets password, activates user, returns session/cookie. |
| 2.2 | Ensure OrbitOne `/v2/auth/accept-invite` works with Platform-provisioned invites. | `apps/orbitone-api/src/auth/auth.controller.ts`, `organizations.service.ts` | Provisioned super admin can accept invite and set password. |
| 2.3 | Ensure provisioned super admin has full RBAC in each product. | Product role assignment during provisioning | Super admin can create admins, managers, staff inside the product. |
| 2.4 | Add product-side activation callback or event so Platform knows invite was accepted. | Product auth service calls Platform internal event endpoint | `OrganizationProvisioning.status` updates to `activated`. |

---

### Phase 3 — Platform Admin Onboarding UI (Kimi)

| # | Task | Files / Areas | Acceptance Criteria |
|---|------|---------------|---------------------|
| 3.1 | Build step-by-step onboarding wizard page. | `apps/platform-web/app/dashboard/onboarding/page.tsx` | Steps: product selection → org details → super admin → modules → review. |
| 3.2 | Build onboarding list/status page. | `apps/platform-web/app/dashboard/onboarding/list/page.tsx` | Shows all onboarded clients, status, resend/revoke actions. |
| 3.3 | Add sidebar navigation links for onboarding. | `apps/platform-web/components/layout/sidebar.tsx`, `mobile-nav.tsx` | Onboarding links appear for Platform admins. |
| 3.4 | Wire onboarding API to UI. | `apps/platform-web/lib/onboarding.ts` or extend `api-client.ts` | Form submits successfully and shows status. |

---

### Phase 4 — Product Set-Password Frontend (Kimi)

| # | Task | Files / Areas | Acceptance Criteria |
|---|------|---------------|---------------------|
| 4.1 | Build TouchOrbit set-password page. | `apps/touchorbit-admin-web/src/app/set-password/page.tsx` | User can visit link, set password, and be logged in as super admin. |
| 4.2 | Ensure OrbitOne `/accept-invite` page works with Platform-provisioned invites. | `apps/orbitone-web/src/app/accept-invite/page.tsx` | Provisioned super admin can accept invite and set password. |
| 4.3 | Add error states for expired/invalid invite tokens on both pages. | Product set-password/accept-invite pages | Clear UI for invalid/expired links. |

---

### Phase 5 — Customization Engine Backend (Codex)

| # | Task | Files / Areas | Acceptance Criteria |
|---|------|---------------|---------------------|
| 5.1 | Build Platform API endpoints to manage custom fields per org/entity. | `apps/platform-api/src/custom-fields/custom-fields.controller.ts`, `service.ts` | CRUD custom field definitions. |
| 5.2 | Build Platform API endpoints to manage feature flags per org. | `apps/platform-api/src/feature-flags/feature-flags.controller.ts`, `service.ts` | Toggle flags per product per org. |
| 5.3 | Build public/internal endpoints for products to fetch custom fields and feature flags for an org. | Platform API internal or public endpoints | Products can read per-org config securely. |
| 5.4 | Support client-only modules in module registry and enable per org. | `modules.registry.ts`, Platform module toggle API | A module built for one client can be enabled only for that client. |

---

### Phase 6 — Customization Engine Frontend (Kimi)

| # | Task | Files / Areas | Acceptance Criteria |
|---|------|---------------|---------------------|
| 6.1 | Build Platform UI to configure custom fields during onboarding. | Onboarding wizard + custom fields builder | Admin can add/edit custom fields per entity. |
| 6.2 | Build Platform UI to configure feature flags during onboarding. | Onboarding wizard + feature flags panel | Admin can toggle flags per product. |
| 6.3 | Product frontends dynamically render custom fields on forms. | Product form components, e.g. employee form, card form | Custom fields appear based on org config and save correctly. |
| 6.4 | Product frontends check feature flags before showing UI. | Product hooks/components | Flag-controlled UI works. |
| 6.5 | Add organization settings / white-label editor. | Platform settings page | Logo, color, date format, currency can be set per org. |
| 6.6 | Products apply white-label settings. | Product layout/theme provider | Product shows client logo/color if configured. |

---

### Phase 7 — Polish & Operations (Mixed)

| # | Task | Owner | Files / Areas | Acceptance Criteria |
|---|------|-------|---------------|---------------------|
| 7.1 | Add welcome email after activation. | Codex | Email service + template | Super admin receives welcome email after setting password. |
| 7.2 | Add retry and failure handling for provisioning calls. | Codex | Onboarding service | Failed provisioning is recorded and can be retried. |
| 7.3 | Add end-to-end onboarding tests. | Codex + Kimi | API tests + basic UI smoke tests | Happy path onboarding works for TouchOrbit and OrbitOne. |

---

## Out of Scope for This Plan

- Billing, invoices, and contract pricing (to be built separately).
- Shared login / SSO across products (products keep separate auth).
- Changing product RBAC models (we use what each product already has).

---

## Suggested Start Order

1. **Phase 0** — Codex: Platform DB migrations + TouchOrbit/OrbitOne internal provisioning endpoints.
2. **Phase 1** — Codex: Platform onboarding service + email service.
3. **Phase 2** — Codex: Product set-password / accept-invite backend.
4. **Phase 3** — Kimi: Platform onboarding wizard UI.
5. **Phase 4** — Kimi: Product set-password / accept-invite frontend.
6. **Phase 5** — Codex: Custom fields + feature flags backend.
7. **Phase 6** — Kimi: Customization frontend.
8. **Phase 7** — Mixed: Polish and tests.

This order lets us verify end-to-end onboarding before investing heavily in customization.
