-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "ticketRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_ticketRef_key" ON "conversations"("ticketRef");

-- AddForeignKey
ALTER TABLE "handoff_logs" ADD CONSTRAINT "handoff_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
