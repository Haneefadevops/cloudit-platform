-- Add growth integration connections, sync logs, and guest self-check-in sessions.
CREATE TYPE "IntegrationProvider" AS ENUM ('channel_manager', 'pos');
CREATE TYPE "IntegrationStatus" AS ENUM ('active', 'inactive', 'error');
CREATE TYPE "IntegrationSyncStatus" AS ENUM ('pending', 'success', 'failed');

CREATE TABLE "integration_connections" (
  "id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "name" TEXT NOT NULL,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'active',
  "endpointUrl" TEXT,
  "config" JSONB NOT NULL DEFAULT '{}',
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "propertyId" TEXT,
  "organizationId" TEXT NOT NULL,

  CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_sync_logs" (
  "id" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "status" "IntegrationSyncStatus" NOT NULL DEFAULT 'pending',
  "recordsPulled" INTEGER NOT NULL DEFAULT 0,
  "recordsPushed" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT,
  "errorMessage" TEXT,
  "payload" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "connectionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,

  CONSTRAINT "integration_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guest_check_in_sessions" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "payload" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reservationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,

  CONSTRAINT "guest_check_in_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guest_check_in_sessions_token_key" ON "guest_check_in_sessions"("token");
CREATE INDEX "integration_connections_propertyId_idx" ON "integration_connections"("propertyId");
CREATE INDEX "integration_connections_organizationId_idx" ON "integration_connections"("organizationId");
CREATE INDEX "integration_connections_provider_idx" ON "integration_connections"("provider");
CREATE INDEX "integration_sync_logs_connectionId_idx" ON "integration_sync_logs"("connectionId");
CREATE INDEX "integration_sync_logs_organizationId_idx" ON "integration_sync_logs"("organizationId");
CREATE INDEX "integration_sync_logs_status_idx" ON "integration_sync_logs"("status");
CREATE INDEX "integration_sync_logs_createdAt_idx" ON "integration_sync_logs"("createdAt");
CREATE INDEX "guest_check_in_sessions_reservationId_idx" ON "guest_check_in_sessions"("reservationId");
CREATE INDEX "guest_check_in_sessions_organizationId_idx" ON "guest_check_in_sessions"("organizationId");
CREATE INDEX "guest_check_in_sessions_expiresAt_idx" ON "guest_check_in_sessions"("expiresAt");

ALTER TABLE "integration_connections"
  ADD CONSTRAINT "integration_connections_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_sync_logs"
  ADD CONSTRAINT "integration_sync_logs_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "integration_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_check_in_sessions"
  ADD CONSTRAINT "guest_check_in_sessions_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
