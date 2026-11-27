-- Workflow d'intervention technique en chambre avec validation préalable de la Direction
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoomInterventionStatus') THEN
    CREATE TYPE "RoomInterventionStatus" AS ENUM (
      'PENDING_DIRECTOR',
      'APPROVED',
      'REJECTED',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "room_intervention_requests" (
  "id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "reported_by_id" UUID NOT NULL,
  "issue_description" TEXT NOT NULL,
  "status" "RoomInterventionStatus" NOT NULL DEFAULT 'PENDING_DIRECTOR',
  "approved_by_id" UUID,
  "approved_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "completed_by_id" UUID,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_intervention_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_intervention_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "room_intervention_requests_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "room_intervention_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "room_intervention_requests_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "room_intervention_requests_room_id_status_idx"
  ON "room_intervention_requests"("room_id", "status");
CREATE INDEX IF NOT EXISTS "room_intervention_requests_status_created_at_idx"
  ON "room_intervention_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "room_intervention_requests_reported_by_id_idx"
  ON "room_intervention_requests"("reported_by_id");

ALTER TABLE "notification_messages"
  ADD COLUMN IF NOT EXISTS "target_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  IF to_regprocedure('public.enforce_residence_blue_permissions()') IS NOT NULL THEN
    PERFORM public.enforce_residence_blue_permissions();
  END IF;
END
$$;
