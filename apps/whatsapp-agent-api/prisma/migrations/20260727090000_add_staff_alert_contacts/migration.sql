-- CreateTable
CREATE TABLE "staff_alert_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'scheduled',
    "daysOfWeek" JSONB NOT NULL DEFAULT '[]',
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_alert_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_alert_rotation" (
    "id" TEXT NOT NULL,
    "lastContactId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_alert_rotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_alert_contacts_phone_key" ON "staff_alert_contacts"("phone");
