-- CreateTable
CREATE TABLE "integration_settings" (
    "id" TEXT NOT NULL,
    "n8n_webhook_url" TEXT,
    "n8n_webhook_secret" TEXT,
    "ai_provider" TEXT NOT NULL DEFAULT 'none',
    "ai_api_key" TEXT,
    "whatsapp_api_key" TEXT,
    "whatsapp_phone_number_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);
