-- =============================================================================
-- Migration : Persistance Complète (chore/audit-persistance)
-- Étend users et rooms sans perte de données, crée guests, reservations
-- (avec contrainte anti-chevauchement btree_gist), invoices, invoice_lines,
-- payments, restaurant_categories, restaurant_products, orders, order_lines
-- et hotel_settings.
-- =============================================================================

-- 0. Protection anti-chevauchement par trigger PostgreSQL (sans extension superuser)

-- 1. Ajout des rôles SERVEUR et CUISINE à l'enum Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SERVEUR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUISINE';

-- 2. Nouveaux enums métier
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationStatus') THEN
    CREATE TYPE "ReservationStatus" AS ENUM (
      'PENDING',
      'CONFIRMED',
      'CHECKED_IN',
      'CHECKED_OUT',
      'CANCELLED',
      'NO_SHOW'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
    CREATE TYPE "InvoiceStatus" AS ENUM (
      'OPEN',
      'PARTIAL',
      'PAID',
      'CANCELLED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM (
      'CASH',
      'WAVE',
      'ORANGE_MONEY',
      'CARD',
      'BANK_TRANSFER'
    );
  END IF;
END
$$;

-- 3. Extension de la table users (sans perte de données)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "full_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "job_title" TEXT;

-- 4. Extension de la table rooms (sans perte de données)
ALTER TABLE "rooms"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Standard',
  ADD COLUMN IF NOT EXISTS "adults_capacity" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "children_capacity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bed_type" TEXT NOT NULL DEFAULT 'queen',
  ADD COLUMN IF NOT EXISTS "beds_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "surface_m2" INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS "view" TEXT NOT NULL DEFAULT 'jardin',
  ADD COLUMN IF NOT EXISTS "smoking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "connecting_room" TEXT,
  ADD COLUMN IF NOT EXISTS "price_per_night" INTEGER NOT NULL DEFAULT 35000,
  ADD COLUMN IF NOT EXISTS "high_season_price_per_night" INTEGER,
  ADD COLUMN IF NOT EXISTS "corporate_price_per_night" INTEGER,
  ADD COLUMN IF NOT EXISTS "breakfast_included" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "internal_note" TEXT;

-- Synchroniser la catégorie et le tarif des chambres existantes depuis room_types
UPDATE "rooms" r
SET
  "category" = rt."name",
  "price_per_night" = rt."price_per_night"
FROM "room_types" rt
WHERE r."type_id" = rt."id";

-- 5. Table guests (Clients)
CREATE TABLE IF NOT EXISTS "guests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "civility" TEXT NOT NULL DEFAULT 'M.',
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "nationality" TEXT DEFAULT 'Sénégalaise',
  "residence_city" TEXT,
  "company_name" TEXT,
  "company_role" TEXT,
  "vip_tier" TEXT,
  "avatar_url" TEXT,
  "id_document_encrypted" TEXT,
  "id_document_expiry" TEXT,
  "dietary_preferences" JSONB,
  "preferences" JSONB,
  "permanent_instructions" JSONB,
  "notes" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "guests_phone_idx" ON "guests"("phone");
CREATE INDEX IF NOT EXISTS "guests_email_idx" ON "guests"("email");
CREATE INDEX IF NOT EXISTS "guests_full_name_idx" ON "guests"("full_name");

-- 6. Table reservations (Réservations et séjours, avec anti-chevauchement GiST)
CREATE TABLE IF NOT EXISTS "reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "guest_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "check_in_date" DATE NOT NULL,
  "check_out_date" DATE NOT NULL,
  "adults_count" INTEGER NOT NULL DEFAULT 1,
  "children_count" INTEGER NOT NULL DEFAULT 0,
  "nights" INTEGER NOT NULL DEFAULT 1,
  "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
  "deposit_fcfa" INTEGER NOT NULL DEFAULT 0,
  "total_fcfa" INTEGER NOT NULL,
  "checked_in_at" TIMESTAMP(3),
  "checked_out_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservations_dates_valid_chk" CHECK ("check_out_date" > "check_in_date"),
  CONSTRAINT "reservations_guest_id_fkey"
    FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservations_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservations_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "reservations_reference_key" ON "reservations"("reference");
CREATE INDEX IF NOT EXISTS "reservations_room_id_check_in_date_check_out_date_idx"
  ON "reservations"("room_id", "check_in_date", "check_out_date");
CREATE INDEX IF NOT EXISTS "reservations_guest_id_idx" ON "reservations"("guest_id");
CREATE INDEX IF NOT EXISTS "reservations_status_idx" ON "reservations"("status");
CREATE INDEX IF NOT EXISTS "reservations_check_in_date_check_out_date_idx"
  ON "reservations"("check_in_date", "check_out_date");

-- Trigger PostgreSQL empêchant tout chevauchement de réservation active sur une même chambre
CREATE OR REPLACE FUNCTION prevent_reservation_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" NOT IN ('CANCELLED', 'NO_SHOW') THEN
    IF EXISTS (
      SELECT 1
      FROM "reservations" r
      WHERE r."room_id" = NEW."room_id"
        AND r."id" <> NEW."id"
        AND r."status" NOT IN ('CANCELLED', 'NO_SHOW')
        AND NEW."check_in_date" < r."check_out_date"
        AND NEW."check_out_date" > r."check_in_date"
    ) THEN
      RAISE EXCEPTION 'Chevauchement interdit : la chambre est déjà réservée sur cette période.'
        USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reservation_overlap ON "reservations";

CREATE TRIGGER trg_prevent_reservation_overlap
BEFORE INSERT OR UPDATE ON "reservations"
FOR EACH ROW
EXECUTE FUNCTION prevent_reservation_overlap();

-- 7. Table invoices (Factures / Folios)
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_number" TEXT NOT NULL,
  "reservation_id" UUID,
  "guest_id" UUID,
  "room_id" UUID,
  "subtotal_ht_fcfa" INTEGER NOT NULL DEFAULT 0,
  "vat_rate_percent" INTEGER NOT NULL DEFAULT 10,
  "vat_amount_fcfa" INTEGER NOT NULL DEFAULT 0,
  "tourism_tax_fcfa" INTEGER NOT NULL DEFAULT 0,
  "total_fcfa" INTEGER NOT NULL DEFAULT 0,
  "deposit_fcfa" INTEGER NOT NULL DEFAULT 0,
  "paid_amount_fcfa" INTEGER NOT NULL DEFAULT 0,
  "balance_fcfa" INTEGER NOT NULL DEFAULT 0,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "billing_company_name" TEXT,
  "billing_ninea" TEXT,
  "billing_address" TEXT,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_reservation_id_fkey"
    FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoices_guest_id_fkey"
    FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoices_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX IF NOT EXISTS "invoices_reservation_id_idx" ON "invoices"("reservation_id");
CREATE INDEX IF NOT EXISTS "invoices_guest_id_idx" ON "invoices"("guest_id");
CREATE INDEX IF NOT EXISTS "invoices_room_id_idx" ON "invoices"("room_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");

-- 8. Table invoice_lines (Lignes de facture)
CREATE TABLE IF NOT EXISTS "invoice_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "date_label" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL,
  "sub_description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'ROOM',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "quantity_label" TEXT,
  "unit_price_fcfa" INTEGER NOT NULL,
  "total_price_fcfa" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_lines_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- 9. Table payments (Paiements)
CREATE TABLE IF NOT EXISTS "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "amount_fcfa" INTEGER NOT NULL,
  "transaction_ref" TEXT,
  "received_by_id" UUID,
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payments_received_by_id_fkey"
    FOREIGN KEY ("received_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "payments_invoice_id_idx" ON "payments"("invoice_id");
CREATE INDEX IF NOT EXISTS "payments_method_idx" ON "payments"("method");
CREATE INDEX IF NOT EXISTS "payments_paid_at_idx" ON "payments"("paid_at");

-- 10. Table restaurant_categories (Catégories du restaurant)
CREATE TABLE IF NOT EXISTS "restaurant_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT 'dinner_dining',
  "display_order" INTEGER NOT NULL DEFAULT 1,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "restaurant_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_categories_name_key" ON "restaurant_categories"("name");

-- 11. Table restaurant_products (Plats et boissons du restaurant)
CREATE TABLE IF NOT EXISTS "restaurant_products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "category_id" UUID NOT NULL,
  "price_fcfa" INTEGER NOT NULL,
  "half_portion_price_fcfa" INTEGER,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "prep_time_minutes" INTEGER NOT NULL DEFAULT 15,
  "prep_station" TEXT NOT NULL DEFAULT 'CUISINE',
  "availability" JSONB,
  "options" JSONB,
  "vat_rate_percent" INTEGER NOT NULL DEFAULT 10,
  "display_order" INTEGER NOT NULL DEFAULT 1,
  "photo_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "restaurant_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restaurant_products_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "restaurant_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_products_name_key" ON "restaurant_products"("name");
CREATE INDEX IF NOT EXISTS "restaurant_products_category_id_idx" ON "restaurant_products"("category_id");
CREATE INDEX IF NOT EXISTS "restaurant_products_status_idx" ON "restaurant_products"("status");

-- 12. Table orders (Commandes du restaurant)
CREATE TABLE IF NOT EXISTS "orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ticket_number" TEXT NOT NULL,
  "destination_type" TEXT NOT NULL DEFAULT 'TABLE',
  "table_label" TEXT,
  "room_id" UUID,
  "reservation_id" UUID,
  "invoice_id" UUID,
  "server_name" TEXT NOT NULL DEFAULT 'Service',
  "status" TEXT NOT NULL DEFAULT 'SENT_TO_KITCHEN',
  "subtotal_ht_fcfa" INTEGER NOT NULL DEFAULT 0,
  "vat_amount_fcfa" INTEGER NOT NULL DEFAULT 0,
  "total_ttc_fcfa" INTEGER NOT NULL DEFAULT 0,
  "payment_method" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orders_reservation_id_fkey"
    FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_ticket_number_key" ON "orders"("ticket_number");
CREATE INDEX IF NOT EXISTS "orders_room_id_idx" ON "orders"("room_id");
CREATE INDEX IF NOT EXISTS "orders_reservation_id_idx" ON "orders"("reservation_id");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at");

-- 13. Table order_lines (Lignes de commande)
CREATE TABLE IF NOT EXISTS "order_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "product_id" UUID,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price_fcfa" INTEGER NOT NULL,
  "total_price_fcfa" INTEGER NOT NULL,
  "selected_options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "prep_station" TEXT NOT NULL DEFAULT 'CUISINE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_lines_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "restaurant_products"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "order_lines_order_id_idx" ON "order_lines"("order_id");

-- 14. Table hotel_settings (Paramètres de l'hôtel)
CREATE TABLE IF NOT EXISTS "hotel_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "hotel_name" TEXT NOT NULL DEFAULT 'Résidence Blue',
  "legal_name" TEXT NOT NULL DEFAULT 'Résidence Blue S.A.R.L.',
  "tagline" TEXT NOT NULL DEFAULT 'Hôtel Boutique • Grand Standing, Thiès',
  "city" TEXT NOT NULL DEFAULT 'Thiès',
  "neighborhood" TEXT NOT NULL DEFAULT 'Grand Standing',
  "country" TEXT NOT NULL DEFAULT 'Sénégal',
  "full_address" TEXT NOT NULL DEFAULT 'Quartier Grand Standing • Thiès, Sénégal',
  "ninea" TEXT NOT NULL DEFAULT '004819230',
  "rccm" TEXT NOT NULL DEFAULT 'SN-THS-2021-B-114',
  "support_phone" TEXT NOT NULL DEFAULT '+221 33 957 00 00',
  "support_email" TEXT NOT NULL DEFAULT 'support@residenceblue.sn',
  "room_count" INTEGER NOT NULL DEFAULT 12,
  "restaurant_name" TEXT NOT NULL DEFAULT 'La Teranga',
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "vat_rate_percent" INTEGER NOT NULL DEFAULT 10,
  "tourism_tax_per_night_per_person" INTEGER NOT NULL DEFAULT 1000,
  "exchange_rate_eur_to_fcfa" DOUBLE PRECISION NOT NULL DEFAULT 655.957,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hotel_settings_pkey" PRIMARY KEY ("id")
);

-- 15. Application des privilèges par rôle PostgreSQL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
    GRANT ALL PRIVILEGES ON TABLE
      "guests", "reservations", "invoices", "invoice_lines", "payments",
      "restaurant_categories", "restaurant_products", "orders", "order_lines",
      "hotel_settings"
    TO app_owner;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      "guests", "reservations", "invoices", "invoice_lines", "payments",
      "restaurant_categories", "restaurant_products", "orders", "order_lines",
      "hotel_settings"
    TO app_user;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    GRANT SELECT ON TABLE
      "guests", "reservations", "invoices", "invoice_lines", "payments",
      "restaurant_categories", "restaurant_products", "orders", "order_lines",
      "hotel_settings"
    TO app_readonly;
  END IF;
END
$$;
