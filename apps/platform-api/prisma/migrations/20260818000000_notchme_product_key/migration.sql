-- NotchMe rebrand: migrate persisted platform product identifiers transactionally.
-- For duplicate business keys, retain the existing NotchMe row, merge OrbitOne
-- values into it, delete the duplicate OrbitOne row, then update remaining rows
-- in place. This preserves IDs whenever an OrbitOne row is the only row.
BEGIN;

-- organization_product_modules
UPDATE "organization_product_modules" AS notchme
SET "enabled" = notchme."enabled" OR orbitone."enabled",
    "updated_at" = GREATEST(notchme."updated_at", orbitone."updated_at")
FROM "organization_product_modules" AS orbitone
WHERE notchme."product" = 'notchme'
  AND orbitone."product" = 'orbitone'
  AND notchme."org_id" = orbitone."org_id"
  AND notchme."module_key" = orbitone."module_key";
DELETE FROM "organization_product_modules" AS orbitone
USING "organization_product_modules" AS notchme
WHERE orbitone."product" = 'orbitone'
  AND notchme."product" = 'notchme'
  AND notchme."org_id" = orbitone."org_id"
  AND notchme."module_key" = orbitone."module_key";
UPDATE "organization_product_modules"
SET "product" = 'notchme'
WHERE "product" = 'orbitone';

-- organization_provisioning
UPDATE "organization_provisioning" AS notchme
SET "tenant_id" = COALESCE(notchme."tenant_id", orbitone."tenant_id"),
    "user_id" = COALESCE(notchme."user_id", orbitone."user_id"),
    "status" = CASE
      WHEN notchme."status" = 'pending' AND orbitone."status" <> 'pending' THEN orbitone."status"
      ELSE notchme."status"
    END,
    "invite_token" = COALESCE(notchme."invite_token", orbitone."invite_token"),
    "set_password_url" = COALESCE(notchme."set_password_url", orbitone."set_password_url"),
    "invited_at" = COALESCE(notchme."invited_at", orbitone."invited_at"),
    "activated_at" = COALESCE(notchme."activated_at", orbitone."activated_at"),
    "revoked_at" = COALESCE(notchme."revoked_at", orbitone."revoked_at"),
    "failure_reason" = COALESCE(notchme."failure_reason", orbitone."failure_reason"),
    "retry_count" = GREATEST(notchme."retry_count", orbitone."retry_count"),
    "created_at" = LEAST(notchme."created_at", orbitone."created_at"),
    "updated_at" = GREATEST(notchme."updated_at", orbitone."updated_at")
FROM "organization_provisioning" AS orbitone
WHERE notchme."product" = 'notchme'
  AND orbitone."product" = 'orbitone'
  AND notchme."org_id" = orbitone."org_id";
DELETE FROM "organization_provisioning" AS orbitone
USING "organization_provisioning" AS notchme
WHERE orbitone."product" = 'orbitone'
  AND notchme."product" = 'notchme'
  AND notchme."org_id" = orbitone."org_id";
UPDATE "organization_provisioning"
SET "product" = 'notchme'
WHERE "product" = 'orbitone';

-- organization_custom_fields
UPDATE "organization_custom_fields" AS notchme
SET "options" = COALESCE(notchme."options", orbitone."options"),
    "required" = notchme."required" OR orbitone."required",
    "is_active" = notchme."is_active" OR orbitone."is_active",
    "created_at" = LEAST(notchme."created_at", orbitone."created_at"),
    "updated_at" = GREATEST(notchme."updated_at", orbitone."updated_at")
FROM "organization_custom_fields" AS orbitone
WHERE notchme."product" = 'notchme'
  AND orbitone."product" = 'orbitone'
  AND notchme."org_id" = orbitone."org_id"
  AND notchme."entity" = orbitone."entity"
  AND notchme."field_key" = orbitone."field_key";
DELETE FROM "organization_custom_fields" AS orbitone
USING "organization_custom_fields" AS notchme
WHERE orbitone."product" = 'orbitone'
  AND notchme."product" = 'notchme'
  AND notchme."org_id" = orbitone."org_id"
  AND notchme."entity" = orbitone."entity"
  AND notchme."field_key" = orbitone."field_key";
UPDATE "organization_custom_fields"
SET "product" = 'notchme'
WHERE "product" = 'orbitone';

-- organization_feature_flags
UPDATE "organization_feature_flags" AS notchme
SET "enabled" = notchme."enabled" OR orbitone."enabled",
    "created_at" = LEAST(notchme."created_at", orbitone."created_at"),
    "updated_at" = GREATEST(notchme."updated_at", orbitone."updated_at")
FROM "organization_feature_flags" AS orbitone
WHERE notchme."product" = 'notchme'
  AND orbitone."product" = 'orbitone'
  AND notchme."org_id" = orbitone."org_id"
  AND notchme."feature_key" = orbitone."feature_key";
DELETE FROM "organization_feature_flags" AS orbitone
USING "organization_feature_flags" AS notchme
WHERE orbitone."product" = 'orbitone'
  AND notchme."product" = 'notchme'
  AND notchme."org_id" = orbitone."org_id"
  AND notchme."feature_key" = orbitone."feature_key";
UPDATE "organization_feature_flags"
SET "product" = 'notchme'
WHERE "product" = 'orbitone';

COMMIT;
