-- CreateTable
CREATE TABLE "top_up_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "conversations" INTEGER NOT NULL,
    "priceLkr" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "slipData" BYTEA,
    "slipMimeType" TEXT,
    "staffNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "top_up_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "top_up_requests_reference_key" ON "top_up_requests"("reference");

-- CreateIndex
CREATE INDEX "top_up_requests_clientId_status_idx" ON "top_up_requests"("clientId", "status");

-- AddForeignKey
ALTER TABLE "top_up_requests" ADD CONSTRAINT "top_up_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

