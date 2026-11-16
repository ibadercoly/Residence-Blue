-- Migration sans perte : notifications dans la cloche (état lu par utilisateur et par message)

CREATE TABLE "notification_messages" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'RESTAURANT',
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "order_id" UUID,
    "destination_type" TEXT,
    "room_number" TEXT,
    "destination_label" TEXT NOT NULL,
    "guest_name" TEXT,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "important_alert" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_reads" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id","user_id")
);

CREATE INDEX "notification_messages_created_at_idx" ON "notification_messages"("created_at");
CREATE INDEX "notification_messages_order_id_type_idx" ON "notification_messages"("order_id", "type");
CREATE INDEX "notification_messages_category_created_at_idx" ON "notification_messages"("category", "created_at");
CREATE UNIQUE INDEX "notification_messages_unique_retard_order_idx" ON "notification_messages"("order_id") WHERE ("type" = 'RETARD' AND "order_id" IS NOT NULL);
CREATE INDEX "notification_reads_user_id_read_at_idx" ON "notification_reads"("user_id", "read_at");

ALTER TABLE "notification_reads"
    ADD CONSTRAINT "notification_reads_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "notification_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_reads"
    ADD CONSTRAINT "notification_reads_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
