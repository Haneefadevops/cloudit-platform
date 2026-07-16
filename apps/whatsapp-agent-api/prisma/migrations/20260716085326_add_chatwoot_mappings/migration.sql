-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "chatwootAccountId" INTEGER,
ADD COLUMN     "chatwootApiKey" TEXT,
ADD COLUMN     "chatwootInboxId" INTEGER;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "chatwootContactId" INTEGER,
ADD COLUMN     "chatwootConversationId" INTEGER,
ADD COLUMN     "chatwootInboxId" INTEGER;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "chatwootContactId" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "chatwootUserId" INTEGER;
