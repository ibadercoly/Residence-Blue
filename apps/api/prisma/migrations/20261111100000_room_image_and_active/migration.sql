-- =============================================================================
-- Migration : Ajout de image_url et is_active sur rooms
-- =============================================================================

ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
