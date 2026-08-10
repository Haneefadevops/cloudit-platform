-- AlterTable
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "leadSource" TEXT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "referral" JSONB;
