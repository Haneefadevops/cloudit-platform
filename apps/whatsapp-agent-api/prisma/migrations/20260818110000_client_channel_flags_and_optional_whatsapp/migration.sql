-- DropWhatsAppNotNullConstraints
ALTER TABLE "clients" ALTER COLUMN "whatsappNumber" DROP NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "whatsappPhoneNumberId" DROP NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "metaAccessToken" DROP NOT NULL;

-- AddChannelEnablementFlags
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "messengerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "instagramEnabled" BOOLEAN NOT NULL DEFAULT false;
