-- Facturation V3 : numérotation séquentielle sans trou, avoirs, écritures inverses, taux Paramètres

DO $$ BEGIN
  CREATE TYPE "InvoiceDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "invoices"
  ALTER COLUMN "invoice_number" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "document_type" "InvoiceDocumentType" NOT NULL DEFAULT 'INVOICE',
  ADD COLUMN IF NOT EXISTS "is_issued" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parent_invoice_id" UUID,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "discount_fcfa" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "service_rate_percent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "service_amount_fcfa" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "forced_checkout" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "forced_checkout_reason" TEXT;

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_parent_invoice_id_fkey"
    FOREIGN KEY ("parent_invoice_id") REFERENCES "invoices"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "invoices_parent_invoice_id_idx" ON "invoices"("parent_invoice_id");
CREATE INDEX IF NOT EXISTS "invoices_is_issued_idx" ON "invoices"("is_issued");

CREATE TABLE IF NOT EXISTS "invoice_sequences" (
  "id" TEXT NOT NULL,
  "doc_type" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "last_seq" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "invoice_lines"
  ALTER COLUMN "category" SET DEFAULT 'HEBERGEMENT',
  ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "source_order_id" UUID;

CREATE INDEX IF NOT EXISTS "invoice_lines_source_order_id_idx" ON "invoice_lines"("source_order_id");

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "received_by_name" TEXT,
  ADD COLUMN IF NOT EXISTS "is_reversal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reversed_payment_id" UUID,
  ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE INDEX IF NOT EXISTS "payments_reversed_payment_id_idx" ON "payments"("reversed_payment_id");

ALTER TABLE "hotel_settings"
  ADD COLUMN IF NOT EXISTS "service_rate_percent" INTEGER,
  ADD COLUMN IF NOT EXISTS "discount_threshold_percent" INTEGER,
  ADD COLUMN IF NOT EXISTS "invoice_logo_path" TEXT;

-- Réappliquer les privilèges app_owner / app_user si la fonction sécurisée existe
DO $$ BEGIN
  PERFORM public.enforce_residence_blue_permissions();
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;
