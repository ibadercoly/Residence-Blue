-- AlterTable
ALTER TABLE "restaurant_products"
  ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT;

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "guest_name" TEXT,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelled_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "cancelled_by_name" TEXT,
  ADD COLUMN IF NOT EXISTS "preparing_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ready_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "served_at" TIMESTAMP(3);

ALTER TABLE "orders"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "restaurant_products_status_display_order_idx"
  ON "restaurant_products"("status", "display_order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_status_created_at_idx"
  ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_destination_type_created_at_idx"
  ON "orders"("destination_type", "created_at");
