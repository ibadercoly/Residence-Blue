-- Migration sans perte : événements de commande, autorisation de service et plats indisponibles
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "autorise_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autorise_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "autorise_by_name" TEXT;

ALTER TABLE "order_lines"
  ADD COLUMN IF NOT EXISTS "is_unavailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "unavailable_reason" TEXT;

CREATE TABLE IF NOT EXISTS "order_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "user_id" UUID,
  "user_name" TEXT,
  "added_minutes" INTEGER,
  "unavailable_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "order_events" TO app_user;
GRANT SELECT ON TABLE "order_events" TO app_readonly;
