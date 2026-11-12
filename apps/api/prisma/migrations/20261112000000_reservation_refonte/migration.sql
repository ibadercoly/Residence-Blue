-- AlterTable
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'RECEPTION',
  ADD COLUMN IF NOT EXISTS "breakfast_included" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "discount_fcfa" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tourism_tax_fcfa" INTEGER NOT NULL DEFAULT 0;

-- Ensure btree_gist extension exists (if already installed by superuser, app_owner skips CREATE EXTENSION)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    CREATE EXTENSION btree_gist;
  END IF;
END $$;

ALTER TABLE "reservations"
  DROP CONSTRAINT IF EXISTS "reservations_no_overlap_active";

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap_active"
  EXCLUDE USING gist (
    "room_id" WITH =,
    daterange("check_in_date", "check_out_date", '[)') WITH &&
  )
  WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW'));
