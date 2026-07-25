-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "aiPausedMessage" TEXT DEFAULT 'Thanks for your message! Our team will reply to you shortly.',
ADD COLUMN     "planAllowance" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "topUpCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usageResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "top_up_purchases" (
    "id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceLkr" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "top_up_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "top_up_purchases_clientId_idx" ON "top_up_purchases"("clientId");

-- AddForeignKey
ALTER TABLE "top_up_purchases" ADD CONSTRAINT "top_up_purchases_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

