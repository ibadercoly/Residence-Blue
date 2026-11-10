-- Migration V2 : Housekeeping Détaillé (Chambres blanches, rotation du linge, plannings d'étage)
-- Ne pas exécuter en V1.

CREATE TABLE IF NOT EXISTS "housekeeping_sheets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "assigned_to" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "linen_status" VARCHAR(50) NOT NULL DEFAULT 'CLEAN',
    "inspection_passed" BOOLEAN NOT NULL DEFAULT false,
    "inspected_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "housekeeping_sheets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "housekeeping_sheets_room_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT,
    CONSTRAINT "housekeeping_sheets_user_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_housekeeping_room" ON "housekeeping_sheets"("room_id");
CREATE INDEX IF NOT EXISTS "idx_housekeeping_status" ON "housekeeping_sheets"("status");
