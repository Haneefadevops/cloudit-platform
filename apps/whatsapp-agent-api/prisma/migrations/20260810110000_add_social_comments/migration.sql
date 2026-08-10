-- AlterTable
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "facebookPageId" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "facebookPageAccessToken" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "instagramAccountId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_comments" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "postId" TEXT,
    "authorName" TEXT,
    "authorId" TEXT,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "aiDraft" TEXT,
    "replyText" TEXT,
    "repliedAt" TIMESTAMP(3),
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_comments_clientId_externalId_key" ON "social_comments"("clientId", "externalId");

-- AddForeignKey
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
