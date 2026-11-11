-- AlterTable: ajout des champs Clients v2 fluide (idempotent si colonnes déjà présentes)
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "birth_date" TEXT;
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "id_document_type" TEXT;
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "internal_note" TEXT;
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
