-- Migration : Flux Cuisine & Restaurant, rôle CUISINIER et traçabilité des transitions (sans perte)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUISINIER';

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "statut" TEXT NOT NULL DEFAULT 'ENVOYEE',
  ADD COLUMN IF NOT EXISTS "envoyee_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "envoyee_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "prise_en_charge_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "prise_en_charge_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "prise_en_charge_by_name" TEXT,
  ADD COLUMN IF NOT EXISTS "temps_preparation_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "heure_fin_prevue" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "prete_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "prete_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "servi_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "servi_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "annule_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "annule_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "motif_annulation" TEXT;

-- Synchronisation initiale sans perte depuis les colonnes existantes
UPDATE "orders"
SET
  "statut" = CASE
    WHEN "status" IN ('IN_PREPARATION', 'EN_PREPARATION') THEN 'EN_PREPARATION'
    WHEN "status" IN ('READY', 'PRETE') THEN 'PRETE'
    WHEN "status" IN ('SERVED', 'SERVIE') THEN 'SERVIE'
    WHEN "status" IN ('CANCELLED', 'ANNULEE') THEN 'ANNULEE'
    ELSE 'ENVOYEE'
  END,
  "envoyee_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "prise_en_charge_at" = COALESCE("prise_en_charge_at", "preparing_at"),
  "prete_at" = COALESCE("prete_at", "ready_at"),
  "servi_at" = COALESCE("servi_at", "served_at"),
  "annule_at" = COALESCE("annule_at", "cancelled_at"),
  "annule_by_id" = COALESCE("annule_by_id", "cancelled_by_id"),
  "motif_annulation" = COALESCE("motif_annulation", "cancellation_reason");

CREATE INDEX IF NOT EXISTS "orders_statut_envoyee_at_idx" ON "orders"("statut", "envoyee_at");
