-- Migration V2 : Maintenance Complète (Suivi des pannes, équipements et ordres de travail)
-- Ne pas exécuter en V1.

CREATE TABLE IF NOT EXISTS "maintenance_work_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID,
    "equipment_tag" VARCHAR(100),
    "category" VARCHAR(50) NOT NULL, -- CLIM, PLOMBERIE, ELECTRICITE, PISCINE, AUTRE
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- URGENT, HIGH, NORMAL, LOW
    "status" VARCHAR(50) NOT NULL DEFAULT 'REPORTED', -- REPORTED, IN_PROGRESS, RESOLVED, CLOSED
    "description" TEXT NOT NULL,
    "reported_by" UUID,
    "assigned_to" UUID,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_work_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "maintenance_work_orders_room_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL,
    CONSTRAINT "maintenance_work_orders_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "maintenance_work_orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_maintenance_status" ON "maintenance_work_orders"("status");
CREATE INDEX IF NOT EXISTS "idx_maintenance_room" ON "maintenance_work_orders"("room_id");
