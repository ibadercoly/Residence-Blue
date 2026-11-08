-- =============================================================================
-- Migration : Module des Chambres (feature/chambres)
-- Crée les tables room_types, rooms et l'enum RoomStatus
-- =============================================================================

-- 1. Enum RoomStatus
CREATE TYPE "RoomStatus" AS ENUM ('FREE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE');

-- 2. Table room_types
CREATE TABLE "room_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "price_per_night" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_types_name_key" ON "room_types"("name");

-- 3. Table rooms
CREATE TABLE "rooms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "number" TEXT NOT NULL,
  "type_id" UUID NOT NULL,
  "floor" INTEGER NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'FREE',
  "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rooms_type_id_fkey"
    FOREIGN KEY ("type_id") REFERENCES "room_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "rooms_number_key" ON "rooms"("number");
CREATE INDEX "rooms_type_id_idx" ON "rooms"("type_id");
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- 4. Application des privilèges de moindre privilège
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
    GRANT ALL PRIVILEGES ON TABLE "room_types", "rooms" TO app_owner;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "room_types", "rooms" TO app_user;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    GRANT SELECT ON TABLE "room_types", "rooms" TO app_readonly;
  END IF;
END
$$;
