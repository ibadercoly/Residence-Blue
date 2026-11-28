-- Migration sans perte : catégories réelles, grille tarifaire location, prestations (autres ventes),
-- prix figé sur réservation + surcharge direction, suppression des anciens défauts 35000 / 25m2 / jardin (DAT-003).

-- 1. Catégories de tarification réelles (Standard, Confort, Appartement)
CREATE TABLE IF NOT EXISTS "tariff_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tariff_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tariff_categories_code_key" ON "tariff_categories"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "tariff_categories_name_key" ON "tariff_categories"("name");

-- 2. Grille de tarifs par catégorie, nombre de personnes et chambres utilisées (appartement)
CREATE TABLE IF NOT EXISTS "room_tariffs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "category_id" UUID NOT NULL,
  "guests_count" INTEGER NOT NULL,
  "rooms_used" INTEGER,
  "label" TEXT NOT NULL,
  "price_per_night_fcfa" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_tariffs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_tariffs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tariff_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "room_tariffs_category_id_guests_count_rooms_used_idx"
  ON "room_tariffs"("category_id", "guests_count", "rooms_used");

CREATE UNIQUE INDEX IF NOT EXISTS "room_tariffs_unique_with_rooms_idx"
  ON "room_tariffs"("category_id", "guests_count", "rooms_used")
  WHERE "rooms_used" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "room_tariffs_unique_without_rooms_idx"
  ON "room_tariffs"("category_id", "guests_count")
  WHERE "rooms_used" IS NULL;

-- 3. Catalogue des autres ventes / prestations (salle de séminaire, pauses)
CREATE TABLE IF NOT EXISTS "extra_service_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'PERSON',
  "unit_label" TEXT NOT NULL DEFAULT 'personne',
  "price_fcfa" INTEGER NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'AUTRES',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extra_service_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "extra_service_items_code_key" ON "extra_service_items"("code");
CREATE INDEX IF NOT EXISTS "extra_service_items_is_active_display_order_idx" ON "extra_service_items"("is_active", "display_order");

-- 4. RoomType & Room : retrait des valeurs par défaut fictives (DAT-003, 35000 FCFA) sans perte de données
ALTER TABLE "room_types" ALTER COLUMN "price_per_night" DROP NOT NULL;

ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "tariff_category_id" UUID;
ALTER TABLE "rooms" ALTER COLUMN "category" SET DEFAULT 'À classer';
ALTER TABLE "rooms" ALTER COLUMN "price_per_night" DROP NOT NULL;
ALTER TABLE "rooms" ALTER COLUMN "price_per_night" DROP DEFAULT;
ALTER TABLE "rooms" ALTER COLUMN "surface_m2" DROP NOT NULL;
ALTER TABLE "rooms" ALTER COLUMN "surface_m2" DROP DEFAULT;
ALTER TABLE "rooms" ALTER COLUMN "view" DROP NOT NULL;
ALTER TABLE "rooms" ALTER COLUMN "view" DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rooms_tariff_category_id_fkey'
  ) THEN
    ALTER TABLE "rooms"
      ADD CONSTRAINT "rooms_tariff_category_id_fkey"
      FOREIGN KEY ("tariff_category_id") REFERENCES "tariff_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "rooms_tariff_category_id_idx" ON "rooms"("tariff_category_id");

-- 5. Réservations : chambres utilisées (appartement), tarif figé à la création, surcharge direction + motif
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "rooms_used" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "rate_per_night_fcfa" INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "tariff_label" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "price_overridden_by_director" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "price_override_reason" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "price_overridden_by_id" UUID;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "price_overridden_by_name" TEXT;

-- Figer le tarif historique des réservations déjà existantes sans altérer leurs totaux
UPDATE "reservations"
SET "rate_per_night_fcfa" = GREATEST(
  0,
  ROUND(("total_fcfa" - COALESCE("tourism_tax_fcfa", 0) + COALESCE("discount_fcfa", 0))::numeric / GREATEST(1, "nights"))::integer
)
WHERE "rate_per_night_fcfa" IS NULL;

-- 6. Paramètres hôtel : champs complémentaires d'identité (code postal, site web, téléphones secondaires)
ALTER TABLE "hotel_settings" ADD COLUMN IF NOT EXISTS "postal_code" TEXT;
ALTER TABLE "hotel_settings" ADD COLUMN IF NOT EXISTS "secondary_phones" TEXT;
ALTER TABLE "hotel_settings" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "hotel_settings" ALTER COLUMN "full_address" SET DEFAULT '';
ALTER TABLE "hotel_settings" ALTER COLUMN "ninea" SET DEFAULT '';
ALTER TABLE "hotel_settings" ALTER COLUMN "rccm" SET DEFAULT '';
ALTER TABLE "hotel_settings" ALTER COLUMN "support_phone" SET DEFAULT '';
ALTER TABLE "hotel_settings" ALTER COLUMN "support_email" SET DEFAULT '';

-- 7. Chargement idempotent des données RÉELLES « TARIF PUBLIC » (jamais d'écrasement si déjà présent)
INSERT INTO "tariff_categories" ("code", "name", "display_order", "is_active")
VALUES
  ('STANDARD', 'Standard', 1, true),
  ('CONFORT', 'Confort', 2, true),
  ('APPARTEMENT', 'Appartement', 3, true)
ON CONFLICT ("code") DO NOTHING;

-- Grille Standard (1 pers = 30 000, 2 pers = 35 000)
INSERT INTO "room_tariffs" ("category_id", "guests_count", "rooms_used", "label", "price_per_night_fcfa", "display_order", "is_active")
SELECT tc."id", v."guests_count", v."rooms_used", v."label", v."price", v."display_order", true
FROM "tariff_categories" tc
JOIN (
  VALUES
    ('STANDARD', 1, NULL::integer, '1 personne', 30000, 1),
    ('STANDARD', 2, NULL::integer, '2 personnes', 35000, 2),
    ('CONFORT', 1, NULL::integer, '1 personne', 35000, 1),
    ('CONFORT', 2, NULL::integer, '2 personnes', 40000, 2),
    ('APPARTEMENT', 1, 1, '1 personne (1 chambre)', 50000, 1),
    ('APPARTEMENT', 2, 1, '2 personnes (couple, 1 chambre)', 55000, 2),
    ('APPARTEMENT', 2, 2, '2 personnes (2 chambres)', 65000, 3),
    ('APPARTEMENT', 3, 2, '3 personnes, 2 chambres', 75000, 4),
    ('APPARTEMENT', 3, 3, '3 personnes, 3 chambres', NULL::integer, 5),
    ('APPARTEMENT', 4, 2, '4 personnes, 2 chambres', 85000, 6),
    ('APPARTEMENT', 4, 3, '4 personnes, 3 chambres', NULL::integer, 7),
    ('APPARTEMENT', 5, NULL::integer, '5 personnes', 95000, 8),
    ('APPARTEMENT', 6, NULL::integer, '6 personnes', 105000, 9)
) AS v("code", "guests_count", "rooms_used", "label", "price", "display_order")
  ON tc."code" = v."code"
WHERE NOT EXISTS (
  SELECT 1 FROM "room_tariffs" rt
  WHERE rt."category_id" = tc."id"
    AND rt."guests_count" = v."guests_count"
    AND ((rt."rooms_used" IS NULL AND v."rooms_used" IS NULL) OR rt."rooms_used" = v."rooms_used")
);

-- Prestations réelles dans le catalogue des autres ventes (sans écraser si déjà modifiées)
INSERT INTO "extra_service_items" ("code", "name", "unit", "unit_label", "price_fcfa", "category", "display_order", "is_active")
VALUES
  ('SALLE_SEMINAIRE', 'Salle de séminaire', 'DAY', 'journée', 100000, 'AUTRES', 1, true),
  ('PAUSE_CAFE', 'Pause-café', 'PERSON', 'personne', 3000, 'AUTRES', 2, true),
  ('PAUSE_DEJEUNER_MENU_1_PLAT', 'Pause déjeuner (1 plat au menu)', 'PERSON', 'personne', 7000, 'AUTRES', 3, true),
  ('PAUSE_DEJEUNER_BUFFET_2_PLATS', 'Pause déjeuner (2 plats en buffet)', 'PERSON', 'personne', 10000, 'AUTRES', 4, true)
ON CONFLICT ("code") DO NOTHING;

-- Rattachement SANS deviner : seules les chambres déjà explicitement en Standard / Confort / Appartement
-- reçoivent leur tariff_category_id ; les chambres sans catégorie réelle passent en « À classer ».
UPDATE "rooms" r
SET "tariff_category_id" = tc."id",
    "category" = tc."name"
FROM "tariff_categories" tc
WHERE r."tariff_category_id" IS NULL
  AND LOWER(TRIM(COALESCE(r."category", ''))) = LOWER(tc."name");

UPDATE "rooms"
SET "category" = 'À classer'
WHERE "tariff_category_id" IS NULL
  AND (
    "category" IS NULL
    OR TRIM("category") = ''
    OR LOWER(TRIM("category")) NOT IN ('standard', 'confort', 'appartement')
  );

-- Identité de l'hôtel : remplir UNIQUEMENT les champs vides, sans jamais écraser une saisie existante
UPDATE "hotel_settings"
SET
  "postal_code" = CASE WHEN NULLIF(TRIM(COALESCE("postal_code", '')), '') IS NULL THEN '21000' ELSE "postal_code" END,
  "secondary_phones" = CASE WHEN NULLIF(TRIM(COALESCE("secondary_phones", '')), '') IS NULL THEN '+221 78 426 64 56 / +221 77 541 69 11' ELSE "secondary_phones" END,
  "website" = CASE WHEN NULLIF(TRIM(COALESCE("website", '')), '') IS NULL THEN 'www.residencesblue.com' ELSE "website" END,
  "full_address" = CASE WHEN NULLIF(TRIM(COALESCE("full_address", '')), '') IS NULL THEN 'Rue 47 Grand Standing, derrière station EDK, Thiès, 21000, Sénégal' ELSE "full_address" END,
  "ninea" = CASE WHEN NULLIF(TRIM(COALESCE("ninea", '')), '') IS NULL THEN '006927349 2F2' ELSE "ninea" END,
  "support_phone" = CASE WHEN NULLIF(TRIM(COALESCE("support_phone", '')), '') IS NULL THEN '+221 33 954 18 68' ELSE "support_phone" END,
  "support_email" = CASE WHEN NULLIF(TRIM(COALESCE("support_email", '')), '') IS NULL THEN 'info@residencesblue.com' ELSE "support_email" END
WHERE "id" = 'default';

-- 8. Droits DML pour le rôle applicatif restreint app_user sur les nouvelles tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tariff_categories", "room_tariffs", "extra_service_items" TO app_user;
  END IF;
END $$;
