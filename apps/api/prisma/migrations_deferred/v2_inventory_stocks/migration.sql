-- Migration V2 : Stocks & Économat (Fiches techniques restaurant, inventaire bar, alertes)
-- Ne pas exécuter en V1.

CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sku" VARCHAR(50) NOT NULL UNIQUE,
    "name" VARCHAR(150) NOT NULL,
    "category" VARCHAR(50) NOT NULL, -- BOISSON, INGREDIENT, FOURNITURE
    "unit" VARCHAR(20) NOT NULL, -- BOUTEILLE, KG, LITRE, UNITE
    "quantity_on_hand" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "reorder_threshold" DECIMAL(10, 2) NOT NULL DEFAULT 5,
    "unit_cost_fcfa" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "movement_type" VARCHAR(20) NOT NULL, -- RECEPTION, CONSUMPTION, LOSS, ADJUSTMENT
    "quantity" DECIMAL(10, 2) NOT NULL,
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_movements_item_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE,
    CONSTRAINT "stock_movements_user_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_inventory_sku" ON "inventory_items"("sku");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_item" ON "stock_movements"("item_id");
