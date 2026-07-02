CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'date', 'single_select', 'multi_select', 'url', 'email')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT custom_field_definitions_owner_check CHECK (
    (organization_id IS NOT NULL AND owner_user_id IS NULL) OR
    (organization_id IS NULL AND owner_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS custom_field_definitions_org_key_idx
  ON custom_field_definitions (organization_id, key)
  WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS custom_field_definitions_user_key_idx
  ON custom_field_definitions (owner_user_id, key)
  WHERE owner_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  custom_field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, custom_field_definition_id)
);

CREATE INDEX IF NOT EXISTS custom_field_values_customer_idx ON custom_field_values(customer_id);

CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pipelines_owner_check CHECK (
    (organization_id IS NOT NULL AND owner_user_id IS NULL) OR
    (organization_id IS NULL AND owner_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pipelines_org_default_idx
  ON pipelines (organization_id)
  WHERE is_default = TRUE AND organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pipelines_user_default_idx
  ON pipelines (owner_user_id)
  WHERE is_default = TRUE AND owner_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  color TEXT,
  probability INTEGER CHECK (probability BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipeline_stages_pipeline_idx ON pipeline_stages(pipeline_id);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id),
  ADD COLUMN IF NOT EXISTS pipeline_stage_id UUID REFERENCES pipeline_stages(id);

CREATE TABLE IF NOT EXISTS customer_pipeline_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  from_stage_name TEXT,
  to_stage_name TEXT NOT NULL,
  note TEXT,
  changed_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_pipeline_stage_history_customer_idx
  ON customer_pipeline_stage_history(customer_id);

-- Seed a default pipeline for every existing organization.
DO $$
DECLARE
  org_record RECORD;
  new_pipeline_id UUID;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    INSERT INTO pipelines (organization_id, name, is_default, "order")
    VALUES (org_record.id, 'Default pipeline', TRUE, 0)
    RETURNING id INTO new_pipeline_id;

    INSERT INTO pipeline_stages (pipeline_id, name, "order", color, probability)
    VALUES
      (new_pipeline_id, 'New', 0, NULL, NULL),
      (new_pipeline_id, 'Contacted', 1, NULL, NULL),
      (new_pipeline_id, 'Qualified', 2, NULL, NULL),
      (new_pipeline_id, 'Meeting', 3, NULL, NULL),
      (new_pipeline_id, 'Proposal', 4, NULL, NULL),
      (new_pipeline_id, 'Customer', 5, NULL, NULL),
      (new_pipeline_id, 'Lost', 6, NULL, NULL),
      (new_pipeline_id, 'Archived', 7, NULL, NULL);

    UPDATE customers c
    SET pipeline_id = new_pipeline_id,
        pipeline_stage_id = s.id
    FROM pipeline_stages s
    WHERE c.organization_id = org_record.id
      AND s.pipeline_id = new_pipeline_id
      AND lower(s.name) = c.lifecycle_stage;
  END LOOP;
END $$;
