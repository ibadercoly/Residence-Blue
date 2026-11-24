-- Lot 6 (LOG-002) : rendre l'inclusion des enfants dans la taxe de séjour configurable
ALTER TABLE "hotel_settings"
ADD COLUMN IF NOT EXISTS "tourism_tax_includes_children" BOOLEAN NOT NULL DEFAULT false;
