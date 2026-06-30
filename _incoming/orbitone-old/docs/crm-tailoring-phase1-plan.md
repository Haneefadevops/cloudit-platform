# Phase 1 — Custom Fields + Configurable Pipeline

## Goal

Make the OrbitOne CRM feel tailored to each business by letting them:

1. Add custom fields to customer records.
2. Define their own sales/recruiting pipeline and stages.
3. Move customers through stages in a simple Kanban or list view.

This is the smallest set of changes that delivers a “tailored CRM” feeling without over-engineering.

## Out of scope for Phase 1

- Multiple pipelines per organization
- Custom activity types
- Templates
- Automation rules
- Bulk actions
- Webhooks
- Duplicate detection

These move to Phase 2 and Phase 3.

## User stories

### Custom fields

- As a business user, I can add extra fields to my customer records so the CRM matches my workflow.
- As a business user, I can choose field types: text, number, date, single-select, multi-select, URL, email.
- As a business user, I can reorder, edit, or delete custom fields.
- As a business user, I can see custom fields on the customer detail page and in the customer list.

### Configurable pipeline

- As a business user, I can rename and reorder the stages of my default pipeline.
- As a business user, I can add or remove stages.
- As a business user, I can move a customer to a different stage from the detail page or the Kanban board.
- As a business user, I can see all customers grouped by stage in a Kanban view.

## Data model

### New tables

```sql
-- Custom field definitions per organization
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'date', 'single_select', 'multi_select', 'url', 'email')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb, -- for select types
  "order" INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

-- Stored custom field values per customer
CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  custom_field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, custom_field_definition_id)
);

-- Pipelines (one per organization in Phase 1)
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stages inside a pipeline
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  color TEXT,
  probability INTEGER CHECK (probability BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Changes to existing tables

```sql
ALTER TABLE customers
  ADD COLUMN pipeline_id UUID REFERENCES pipelines(id),
  ADD COLUMN pipeline_stage_id UUID REFERENCES pipeline_stages(id);
```

For individual (non-organization) users, we create a hidden default pipeline tied to the user, or keep using `lifecycle_stage` until they upgrade. In Phase 1, **configurable pipelines are a Pro Business feature**; individuals continue using the existing lifecycle enum.

## API endpoints

### Custom fields

```
GET    /api/v2/custom-fields
POST   /api/v2/custom-fields
PUT    /api/v2/custom-fields/:id
DELETE /api/v2/custom-fields/:id
```

### Pipeline & stages

```
GET    /api/v2/pipelines
GET    /api/v2/pipelines/default
PUT    /api/v2/pipelines/:id
POST   /api/v2/pipelines/:id/stages
PUT    /api/v2/pipeline-stages/:id
DELETE /api/v2/pipeline-stages/:id
```

### Customer CRUD updates

```
GET    /api/v2/customers/:id          # includes customFieldValues + pipelineStage
PUT    /api/v2/customers/:id          # accepts customFieldValues + pipelineStageId
```

### Move customer to stage

```
PUT    /api/v2/customers/:id/stage    # body: { pipelineStageId }
```

## Contracts / shared types

Add to `contracts/orbitone.v2.ts`:

```ts
export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "single_select"
  | "multi_select"
  | "url"
  | "email";

export type CustomFieldDefinition = {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  type: CustomFieldType;
  options: string[];
  order: number;
  isRequired: boolean;
};

export type CustomFieldInput = Omit<CustomFieldDefinition, "id" | "organizationId">;

export type CustomFieldValue = {
  definitionId: string;
  value: unknown;
};

export type Pipeline = {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
};

export type PipelineStage = {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  color: string | null;
  probability: number | null;
};
```

Update `Customer` type to include:

```ts
pipelineId: string | null;
pipelineStageId: string | null;
customFieldValues: CustomFieldValue[];
```

## UI / UX

### Settings page

New section under **Dashboard → Settings → CRM**:

- **Custom fields** tab
  - List of fields with type, required status, order.
  - Add/edit drawer with field type selector.
  - Reorder via drag handles.
- **Pipeline** tab
  - List of stages with name, color, probability.
  - Add/edit/delete stages.
  - Reorder stages.

### Customer detail page

- Show custom fields in a dedicated section.
- Add a “Stage” selector dropdown.
- Display current stage badge.

### Customers list

- Add columns for key custom fields and stage.
- Allow filtering by stage.

### New Kanban board

- New route: `/dashboard/crm/pipeline`
- Columns = pipeline stages.
- Cards = customers (name, company, value, priority).
- Click card opens customer detail.
- Stage change from detail page (Phase 1), drag-and-drop in Phase 2.

## Defaults and presets

When an organization is created, seed a default pipeline:

```
New → Contacted → Qualified → Meeting → Proposal → Customer → Lost
```

Map existing `lifecycle_stage` values to this default pipeline during migration.

## Freemium enforcement

| Limit | Free | Pro Individual | Pro Business |
|---|---|---|---|
| Custom fields | 3 | 10 | Unlimited |
| Configurable pipeline | ❌ | ✅ 1 pipeline | ✅ 1 pipeline (multiple in Phase 2) |
| Kanban view | ❌ | ✅ | ✅ |

Enforce at API level using existing plan middleware.

## Migration strategy

1. Create new tables.
2. Create default pipeline for every existing organization.
3. Map each customer’s `lifecycle_stage` to the matching stage in the default pipeline.
4. Backfill `customers.pipeline_id` and `customers.pipeline_stage_id`.
5. Keep `lifecycle_stage` column for backward compatibility during transition.

## Implementation order

1. Backend migrations + shared contracts
2. Backend routes/service for custom field definitions
3. Backend routes/service for pipelines and stages
4. Update customer service to read/write custom field values and pipeline stage
5. Frontend settings page for custom fields
6. Frontend settings page for pipeline
7. Update customer detail page
8. Update customer list with stage filter and custom field columns
9. Build Kanban board
10. E2E tests

## Edge cases

- Deleting a custom field definition deletes all stored values for that field.
- Deleting a pipeline stage requires choosing a fallback stage for customers currently in that stage.
- Renaming a stage does not affect customer history.
- Changing a field type from `single_select` to `text` preserves raw values as text.

## Verification

- Backend typecheck and build pass.
- All existing CRM e2e tests still pass.
- New e2e tests:
  - Admin creates a custom field and sees it on a customer.
  - Admin renames a pipeline stage.
  - User moves a customer to a new stage from detail page.
  - User views the Kanban board.

## Time estimate

- Backend: 5–7 days
- Frontend: 6–8 days
- Testing & polish: 2–3 days

**Total: ~3–4 weeks** with one backend and one frontend developer.
