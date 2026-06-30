-- Add public booking slug for guest-facing property pages.
ALTER TABLE "properties" ADD COLUMN "publicSlug" TEXT;

CREATE UNIQUE INDEX "properties_publicSlug_key" ON "properties"("publicSlug");
CREATE INDEX "properties_publicSlug_idx" ON "properties"("publicSlug");
