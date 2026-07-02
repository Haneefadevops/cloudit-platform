-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "EventStatus" AS ENUM ('pending', 'success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_logs" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "EventStatus" NOT NULL DEFAULT 'pending',
    "webhook_url" TEXT,
    "response_status" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_logs_event_type_idx" ON "event_logs"("event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_logs_status_idx" ON "event_logs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_logs_created_at_idx" ON "event_logs"("created_at");
