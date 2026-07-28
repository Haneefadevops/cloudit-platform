-- AlterTable (idempotent: the first deploy attempt may have partially applied)
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "ticketRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_ticketRef_key" ON "conversations"("ticketRef");

-- Remove orphan handoff logs (their conversation no longer exists) so the
-- foreign key can be created. These rows are unreachable in the app.
DELETE FROM "handoff_logs" hl
WHERE NOT EXISTS (
  SELECT 1 FROM "conversations" c WHERE c.id = hl."conversationId"
);

-- AddForeignKey (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'handoff_logs_conversationId_fkey'
  ) THEN
    ALTER TABLE "handoff_logs"
      ADD CONSTRAINT "handoff_logs_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
