-- Add operational housekeeping and seasonal pricing support.
CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE "HousekeepingTaskType" AS ENUM ('checkout_clean', 'stayover_clean', 'deep_clean', 'maintenance_followup');

CREATE TABLE "housekeeping_tasks" (
  "id" TEXT NOT NULL,
  "type" "HousekeepingTaskType" NOT NULL DEFAULT 'checkout_clean',
  "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'pending',
  "priority" INTEGER NOT NULL DEFAULT 3,
  "assignedTo" TEXT,
  "dueDate" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "propertyId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,

  CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seasonal_rates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "minimumStay" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,

  CONSTRAINT "seasonal_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "housekeeping_tasks_propertyId_idx" ON "housekeeping_tasks"("propertyId");
CREATE INDEX "housekeeping_tasks_roomId_idx" ON "housekeeping_tasks"("roomId");
CREATE INDEX "housekeeping_tasks_organizationId_idx" ON "housekeeping_tasks"("organizationId");
CREATE INDEX "housekeeping_tasks_status_idx" ON "housekeeping_tasks"("status");
CREATE INDEX "housekeeping_tasks_dueDate_idx" ON "housekeeping_tasks"("dueDate");
CREATE INDEX "seasonal_rates_roomTypeId_idx" ON "seasonal_rates"("roomTypeId");
CREATE INDEX "seasonal_rates_organizationId_idx" ON "seasonal_rates"("organizationId");
CREATE INDEX "seasonal_rates_startDate_endDate_idx" ON "seasonal_rates"("startDate", "endDate");

ALTER TABLE "housekeeping_tasks"
  ADD CONSTRAINT "housekeeping_tasks_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "housekeeping_tasks"
  ADD CONSTRAINT "housekeeping_tasks_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seasonal_rates"
  ADD CONSTRAINT "seasonal_rates_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
