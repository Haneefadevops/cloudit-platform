-- AlterTable: operating-hours auto-response + CSAT settings on clients
ALTER TABLE "clients"
ADD COLUMN     "outsideHoursMessage" TEXT DEFAULT 'Thank you for contacting us! We are currently outside our business hours. Please leave your message and our team will get back to you as soon as we open.',
ADD COLUMN     "csatEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "csatMessage" TEXT DEFAULT 'Thank you for chatting with us! How would you rate your experience? Please reply with a number from 1 (poor) to 5 (excellent).';

-- AlterTable: CSAT state on conversations
ALTER TABLE "conversations"
ADD COLUMN     "csatPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "csatRating" INTEGER,
ADD COLUMN     "csatFeedback" TEXT;
