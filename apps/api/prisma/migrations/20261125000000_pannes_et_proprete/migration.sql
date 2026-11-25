-- CreateEnum
CREATE TYPE "RoomProblemType" AS ENUM ('CLIMATISATION', 'FUITE_EAU', 'ELECTRICITE', 'AMPOULE', 'AUTRE');

-- CreateEnum
CREATE TYPE "RoomProblemStatus" AS ENUM ('REPORTED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "is_clean" BOOLEAN NOT NULL DEFAULT true;

-- Initialisation de is_clean = false pour les chambres actuellement en cours de nettoyage
UPDATE "rooms" SET "is_clean" = false WHERE "status" = 'CLEANING';

-- CreateTable
CREATE TABLE "room_problems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "type" "RoomProblemType" NOT NULL,
    "description" TEXT,
    "reported_by_user_id" UUID,
    "reported_by_role" TEXT NOT NULL,
    "reported_by_name" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "was_occupied" BOOLEAN NOT NULL DEFAULT false,
    "blocks_rental" BOOLEAN NOT NULL DEFAULT true,
    "status" "RoomProblemStatus" NOT NULL DEFAULT 'REPORTED',
    "assigned_to_user_id" UUID,
    "assigned_to_name" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_by_user_id" UUID,
    "resolved_by_name" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "cancelled_by_user_id" UUID,
    "cancelled_by_name" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_problems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_problems_room_id_idx" ON "room_problems"("room_id");

-- CreateIndex
CREATE INDEX "room_problems_status_idx" ON "room_problems"("status");

-- CreateIndex
CREATE INDEX "room_problems_blocks_rental_idx" ON "room_problems"("blocks_rental");

-- CreateIndex
CREATE INDEX "room_problems_created_at_idx" ON "room_problems"("created_at");

-- AddForeignKey
ALTER TABLE "room_problems" ADD CONSTRAINT "room_problems_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_problems" ADD CONSTRAINT "room_problems_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_problems" ADD CONSTRAINT "room_problems_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_problems" ADD CONSTRAINT "room_problems_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_problems" ADD CONSTRAINT "room_problems_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migration de données sans perte : toute chambre actuellement en maintenance reçoit un problème 'AUTRE' bloquant
INSERT INTO "room_problems" (
    "id",
    "room_id",
    "type",
    "description",
    "reported_by_role",
    "reported_by_name",
    "reported_at",
    "was_occupied",
    "blocks_rental",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "id",
    'AUTRE'::"RoomProblemType",
    COALESCE(NULLIF(TRIM("maintenance_reason"), ''), 'Autre : maintenance en cours'),
    'MAINTENANCE',
    'Système',
    CURRENT_TIMESTAMP,
    false,
    true,
    'REPORTED'::"RoomProblemStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "rooms"
WHERE "status" = 'MAINTENANCE';
