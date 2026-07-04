CREATE TABLE "organization_provisioning" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "tenant_id" TEXT,
  "user_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "invited_email" TEXT NOT NULL,
  "invite_token" TEXT,
  "set_password_url" TEXT,
  "invited_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_provisioning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_custom_fields" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "field_key" TEXT NOT NULL,
  "field_label" TEXT NOT NULL,
  "field_type" TEXT NOT NULL,
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_custom_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_feature_flags" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "feature_key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_provisioning_org_id_product_key"
  ON "organization_provisioning"("org_id", "product");
CREATE INDEX "organization_provisioning_product_idx"
  ON "organization_provisioning"("product");
CREATE INDEX "organization_provisioning_status_idx"
  ON "organization_provisioning"("status");

CREATE UNIQUE INDEX "organization_custom_fields_org_id_product_entity_field_key_key"
  ON "organization_custom_fields"("org_id", "product", "entity", "field_key");
CREATE INDEX "organization_custom_fields_org_id_idx"
  ON "organization_custom_fields"("org_id");
CREATE INDEX "organization_custom_fields_product_idx"
  ON "organization_custom_fields"("product");
CREATE INDEX "organization_custom_fields_entity_idx"
  ON "organization_custom_fields"("entity");

CREATE UNIQUE INDEX "organization_feature_flags_org_id_product_feature_key_key"
  ON "organization_feature_flags"("org_id", "product", "feature_key");
CREATE INDEX "organization_feature_flags_org_id_idx"
  ON "organization_feature_flags"("org_id");
CREATE INDEX "organization_feature_flags_product_idx"
  ON "organization_feature_flags"("product");

ALTER TABLE "organization_provisioning"
  ADD CONSTRAINT "organization_provisioning_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_custom_fields"
  ADD CONSTRAINT "organization_custom_fields_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_feature_flags"
  ADD CONSTRAINT "organization_feature_flags_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
