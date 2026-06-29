-- CreateTable
CREATE TABLE "organization_product_modules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_product_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_product_modules_orgId_product_moduleKey_key" ON "organization_product_modules"("org_id", "product", "module_key");

-- CreateIndex
CREATE INDEX "organization_product_modules_org_id_idx" ON "organization_product_modules"("org_id");

-- CreateIndex
CREATE INDEX "organization_product_modules_product_idx" ON "organization_product_modules"("product");

-- AddForeignKey
ALTER TABLE "organization_product_modules" ADD CONSTRAINT "organization_product_modules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
