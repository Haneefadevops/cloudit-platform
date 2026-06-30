-- Add Sri Lanka-specific property and guest fields for Hospitality OS.
ALTER TABLE "properties"
  ADD COLUMN "registrationNumber" TEXT,
  ADD COLUMN "sltdaNumber" TEXT,
  ALTER COLUMN "settings" SET DEFAULT '{"currency":"LKR","currencySymbol":"Rs.","locale":"en-LK","dateFormat":"yyyy-MM-dd"}';

ALTER TABLE "guests"
  ADD COLUMN "localPhone" TEXT,
  ADD COLUMN "nicNumber" TEXT,
  ADD COLUMN "passportNumber" TEXT,
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT,
  ADD COLUMN "isForeignGuest" BOOLEAN NOT NULL DEFAULT false;
