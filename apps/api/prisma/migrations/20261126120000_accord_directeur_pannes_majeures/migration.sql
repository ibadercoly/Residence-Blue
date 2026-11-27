-- AlterTable
ALTER TABLE "room_problems" ADD COLUMN "director_approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "room_problems" ADD COLUMN "approved_by_director_id" UUID;
ALTER TABLE "room_problems" ADD COLUMN "approved_by_director_name" TEXT;
ALTER TABLE "room_problems" ADD COLUMN "approved_by_director_at" TIMESTAMP(3);

-- Déjà clos, signalés par la direction ou mineurs (ampoule) : aucun accord supplémentaire nécessaire.
-- Une panne majeure rendue « louable malgré ce problème » (blocks_rental = false) reste soumise
-- à l'accord préalable du directeur : elle n'est donc PAS approuvée automatiquement ici.
UPDATE "room_problems" SET "director_approved" = true WHERE "status" IN ('RESOLVED', 'CANCELLED') OR "type" = 'AMPOULE' OR "reported_by_role" = 'DIRECTION';

-- CreateIndex
CREATE INDEX "room_problems_director_approved_idx" ON "room_problems"("director_approved");

-- AddForeignKey
ALTER TABLE "room_problems" ADD CONSTRAINT "room_problems_approved_by_director_id_fkey" FOREIGN KEY ("approved_by_director_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
