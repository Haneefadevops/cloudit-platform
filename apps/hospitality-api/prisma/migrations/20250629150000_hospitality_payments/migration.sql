-- Add payment ledger for cash, bank transfer, PayHere, Stripe, and partial payments.
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'bank_transfer', 'payhere', 'stripe');
CREATE TYPE "PaymentProviderStatus" AS ENUM ('pending', 'succeeded', 'failed', 'cancelled');

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "providerStatus" "PaymentProviderStatus" NOT NULL DEFAULT 'succeeded',
  "providerRef" TEXT,
  "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");
CREATE INDEX "payments_reservationId_idx" ON "payments"("reservationId");
CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");
CREATE INDEX "payments_method_idx" ON "payments"("method");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
