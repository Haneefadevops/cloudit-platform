-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "phoneNumber" DROP NOT NULL;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "channelSourceId" TEXT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'whatsapp';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_clientId_channel_channelSourceId_idx" ON "customers"("clientId", "channel", "channelSourceId");
