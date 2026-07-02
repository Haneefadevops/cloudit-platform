# OrbitOne CRM Tailoring Plan

## 1. Purpose

Present a client-ready plan for making the OrbitOne CRM **adaptable by business type**, without rebuilding it as a full enterprise CRM.

The goal: one lightweight CRM core that a freelancer, agency, recruiter, consultant, or B2B sales team can each shape to their own workflow.

## 2. Vision statement

> “A relationship CRM that fits your business model — not the other way around.”

OrbitOne already captures introductions (profiles, bookings, connections). The CRM should let users turn those introductions into structured, trackable relationships using a small set of powerful configuration options.

## 3. What stays in scope

- Configurable customer fields
- Configurable sales/recruiting pipelines and stages
- Configurable activity types
- Simple workflow automation rules
- Message/activity templates
- Role-based CRM views
- Import/export and data quality tools

## 4. What stays out of scope (for v2)

- AI-driven recommendations
- Real payments, invoicing, or subscriptions
- Native email/SMS sending infrastructure
- Code-level customization or plugins
- Complex multi-currency accounting
- Forecasting algorithms beyond simple weighted pipeline

## 5. Core architecture

### 5.1 Shared foundation (always present)

Every customer record includes:

- `id`, `fullName`, `email`, `phone`, `company`
- `assignedToUserId`
- `lifecycleStage`
- `priority`, `nextStep`
- `valueAmount`, `valueCurrency`, `expectedCloseDate`
- `source`, `outcome`
- `createdAt`, `updatedAt`
- `organizationId` for team accounts

### 5.2 Customization layers

| Layer | What the business configures | Example |
|---|---|---|
| **Custom fields** | Extra fields per customer | `industry`, `linkedinUrl`, `preferredContactTime` |
| **Pipelines** | Named workflow boards | `Sales`, `Recruiting`, `Partnerships` |
| **Stages** | Steps inside a pipeline | `New → Meeting → Proposal → Won` |
| **Activity types** | Kinds of touchpoints | `Call`, `Email`, `Interview`, `Site visit` |
| **Templates** | Reusable messages and agendas | Follow-up email, meeting prep note |
| **Automation rules** | Simple if-this-then-that | “Move to `Meeting` → create follow-up in 2 days” |

### 5.3 Data model changes

New tables:

```
custom_field_definitions
  - id, organization_id, name, key, type, options, order, is_required

custom_field_values
  - customer_id, custom_field_definition_id, value

pipelines
  - id, organization_id, name, is_default, order

pipeline_stages
  - id, pipeline_id, name, order, color, probability

activity_type_definitions
  - id, organization_id, name, icon, order

crm_templates
  - id, organization_id, name, type, subject, body

crm_automation_rules
  - id, organization_id, name, trigger_event, conditions, actions, is_active
```

Existing tables to extend:

```
customers.pipeline_id
customers.pipeline_stage_id
customer_activities.activity_type_definition_id
```

## 6. Proposed feature roadmap

### Phase 1 — Foundation (4–6 weeks)

1. Custom fields per organization
2. Custom pipelines and stages
3. Customer detail view redesigned to show configured fields
4. Basic CRM settings page

### Phase 2 — Workflow (3–4 weeks)

1. Custom activity types
2. Activity templates
3. Pipeline board view (Kanban)
4. Drag-and-drop stage movement

### Phase 3 — Automation (3–4 weeks)

1. Automation rule builder (trigger → condition → action)
2. Starter rules: follow-up creation, stale alerts, assignment notifications
3. Webhook events for CRM actions

### Phase 4 — Scale (2–3 weeks)

1. Bulk actions (assign, tag, stage change, export)
2. Duplicate detection and merging
3. CSV import improvements with field mapping

## 7. Freemium tier mapping

| Feature | Free | Pro Individual | Pro Business |
|---|---|---|---|
| Core CRM (contacts, notes, follow-ups) | ✅ | ✅ | ✅ |
| Custom fields | 3 fields | 10 fields | Unlimited |
| Pipelines | 1 default | 1 custom | Multiple |
| Custom stages | ✅ | ✅ | ✅ |
| Custom activity types | ❌ | ✅ | ✅ |
| Templates | ❌ | 5 templates | Unlimited |
| Automation rules | ❌ | 3 rules | Unlimited |
| Bulk actions | ❌ | ❌ | ✅ |
| Team assignment / roles | ❌ | ❌ | ✅ |
| Webhooks | ❌ | ❌ | ✅ |

## 8. Client conversation guide

### Key questions to ask the client

1. What type of businesses will use this most? (sales teams, agencies, recruiters, consultants)
2. Do they need multiple pipelines, or is one configurable pipeline enough?
3. Is automation a must-have for launch, or can it come in Phase 3?
4. Should custom fields be per organization or per user?
5. Do they want to offer templates out of the box, or let users build their own?

### Value proposition to pitch

- Not another bloated CRM.
- Adapts to the customer’s existing workflow.
- Grows from solo professional to team without switching tools.
- Built on top of OrbitOne’s introductions and bookings, so data is already connected.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope creep into full CRM | Strict phased roadmap; clear out-of-scope list |
| Over-engineering customization | Cap limits per plan; no code/plugins |
| Migration complexity for existing customers | Baseline existing records to a default pipeline |
| Performance with many custom fields | Index custom field values by definition + text value |
| UI becomes cluttered | Group custom fields into collapsible sections |

## 10. Success metrics

- Pro Business trial-to-paid conversion improves.
- Average number of CRM records per active account increases.
- Support tickets about “CRM doesn’t fit our process” decrease.
- Time from first customer creation to first closed deal decreases.

## 11. Recommended first step

Start with **custom fields + one configurable pipeline** in Phase 1. This alone makes the CRM feel tailored to most businesses without heavy engineering, and it sets the foundation for stages, templates, and automation later.

## 12. Open decisions

- Should pipeline/stage configuration be admin-only in Pro Business?
- Should we provide industry-specific presets (e.g., “Recruiting pipeline,” “Agency pipeline”) at signup?
- Should automation rules be available in Pro Individual with a lower limit?
