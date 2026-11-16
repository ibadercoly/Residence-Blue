-- Migration sans perte : Administration, comptes, profils d'accès et administrateur principal protégé

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_primary_admin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "starter_profile" TEXT,
  ADD COLUMN IF NOT EXISTS "screen_access" JSONB,
  ADD COLUMN IF NOT EXISTS "special_permissions" JSONB,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_display_name" TEXT;

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "created_by_name" TEXT;

UPDATE "reservations" r
SET "created_by_name" = u."full_name"
FROM "users" u
WHERE r."created_by_id" = u."id"
  AND r."created_by_name" IS NULL;

-- Regroupement des rôles en double sans perte de comptes
UPDATE "users" SET "role" = 'CUISINIER' WHERE "role" = 'CUISINE';
UPDATE "users" SET "role" = 'RESTAURANT' WHERE "role" = 'SERVEUR';

-- Attribution de l'administrateur principal au compte DIRECTION le plus ancien (unicité garantie)
UPDATE "users"
SET "is_primary_admin" = true
WHERE "id" = (
  SELECT "id"
  FROM "users"
  WHERE "role" = 'DIRECTION' AND "deleted_at" IS NULL
  ORDER BY "created_at" ASC, "id" ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM "users" WHERE "is_primary_admin" = true
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_single_primary_admin_idx"
  ON "users"("is_primary_admin")
  WHERE "is_primary_admin" = true;

-- Préremplissage des accès équivalents pour les utilisateurs existants
UPDATE "users"
SET
  "starter_profile" = CASE "role"::text
    WHEN 'DIRECTION' THEN 'DIRECTEUR'
    WHEN 'RECEPTION' THEN 'ASSISTANT_RECEPTION'
    WHEN 'RESTAURANT' THEN 'ASSISTANT_RESTAURANT'
    WHEN 'CUISINIER' THEN 'CUISINIER'
    WHEN 'HOUSEKEEPING' THEN 'MENAGE'
    WHEN 'MAINTENANCE' THEN 'TECHNIQUE'
    WHEN 'COMPTABLE' THEN 'COMPTABLE'
    ELSE 'ASSISTANT_RECEPTION'
  END,
  "screen_access" = CASE "role"::text
    WHEN 'DIRECTION' THEN '{"accueil":"ECRITURE","planning":"ECRITURE","chambres":"ECRITURE","clients":"ECRITURE","facturation":"ECRITURE","restaurant":"ECRITURE","cuisine":"ECRITURE","rapports":"ECRITURE"}'::jsonb
    WHEN 'RECEPTION' THEN '{"accueil":"ECRITURE","planning":"ECRITURE","chambres":"ECRITURE","clients":"ECRITURE","facturation":"ECRITURE","restaurant":"ECRITURE","cuisine":"AUCUN","rapports":"AUCUN"}'::jsonb
    WHEN 'RESTAURANT' THEN '{"accueil":"AUCUN","planning":"AUCUN","chambres":"AUCUN","clients":"AUCUN","facturation":"AUCUN","restaurant":"ECRITURE","cuisine":"AUCUN","rapports":"AUCUN"}'::jsonb
    WHEN 'CUISINIER' THEN '{"accueil":"AUCUN","planning":"AUCUN","chambres":"AUCUN","clients":"AUCUN","facturation":"AUCUN","restaurant":"AUCUN","cuisine":"ECRITURE","rapports":"AUCUN"}'::jsonb
    WHEN 'HOUSEKEEPING' THEN '{"accueil":"AUCUN","planning":"AUCUN","chambres":"LECTURE","clients":"AUCUN","facturation":"AUCUN","restaurant":"AUCUN","cuisine":"AUCUN","rapports":"AUCUN"}'::jsonb
    WHEN 'MAINTENANCE' THEN '{"accueil":"AUCUN","planning":"AUCUN","chambres":"LECTURE","clients":"AUCUN","facturation":"AUCUN","restaurant":"AUCUN","cuisine":"AUCUN","rapports":"AUCUN"}'::jsonb
    WHEN 'COMPTABLE' THEN '{"accueil":"AUCUN","planning":"AUCUN","chambres":"AUCUN","clients":"AUCUN","facturation":"LECTURE","restaurant":"AUCUN","cuisine":"AUCUN","rapports":"LECTURE"}'::jsonb
    ELSE '{"accueil":"AUCUN","planning":"AUCUN","chambres":"AUCUN","clients":"AUCUN","facturation":"AUCUN","restaurant":"AUCUN","cuisine":"AUCUN","rapports":"AUCUN"}'::jsonb
  END,
  "special_permissions" = CASE "role"::text
    WHEN 'DIRECTION' THEN '{"voir_montants":true,"encaisser_paiement":true,"changer_etat_chambre":true,"annuler_commande_ou_reservation":true}'::jsonb
    WHEN 'RECEPTION' THEN '{"voir_montants":true,"encaisser_paiement":true,"changer_etat_chambre":true,"annuler_commande_ou_reservation":true}'::jsonb
    WHEN 'RESTAURANT' THEN '{"voir_montants":true,"encaisser_paiement":true,"changer_etat_chambre":false,"annuler_commande_ou_reservation":true}'::jsonb
    WHEN 'CUISINIER' THEN '{"voir_montants":false,"encaisser_paiement":false,"changer_etat_chambre":false,"annuler_commande_ou_reservation":false}'::jsonb
    WHEN 'HOUSEKEEPING' THEN '{"voir_montants":false,"encaisser_paiement":false,"changer_etat_chambre":true,"annuler_commande_ou_reservation":false}'::jsonb
    WHEN 'MAINTENANCE' THEN '{"voir_montants":false,"encaisser_paiement":false,"changer_etat_chambre":false,"annuler_commande_ou_reservation":false}'::jsonb
    WHEN 'COMPTABLE' THEN '{"voir_montants":true,"encaisser_paiement":false,"changer_etat_chambre":false,"annuler_commande_ou_reservation":false}'::jsonb
    ELSE '{"voir_montants":false,"encaisser_paiement":false,"changer_etat_chambre":false,"annuler_commande_ou_reservation":false}'::jsonb
  END
WHERE "screen_access" IS NULL;
