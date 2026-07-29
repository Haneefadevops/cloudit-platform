-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_failover_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fromModel" TEXT NOT NULL,
    "toModel" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_failover_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_failover_events_createdAt_idx" ON "ai_failover_events"("createdAt");
