-- Migration V3 : Channel Manager (Passerelle Booking.com, Airbnb, Expedia)
-- Ne pas exécuter en V1.

CREATE TABLE IF NOT EXISTS "channel_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel_name" VARCHAR(50) NOT NULL UNIQUE, -- BOOKING, AIRBNB, EXPEDIA
    "api_endpoint" VARCHAR(255) NOT NULL,
    "hotel_external_id" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "channel_room_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel_id" UUID NOT NULL,
    "local_room_type_id" UUID NOT NULL,
    "channel_room_type_code" VARCHAR(100) NOT NULL,
    "channel_rate_plan_code" VARCHAR(100) NOT NULL,

    CONSTRAINT "channel_room_mappings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "channel_room_mappings_channel_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_credentials"("id") ON DELETE CASCADE,
    CONSTRAINT "channel_room_mappings_room_type_fkey" FOREIGN KEY ("local_room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE
);
