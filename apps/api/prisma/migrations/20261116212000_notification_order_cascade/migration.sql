-- Migration sans perte : suppression en cascade des notifications liées à une commande supprimée
DELETE FROM "notification_messages"
WHERE "order_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "orders" o WHERE o."id" = "notification_messages"."order_id"
  );

ALTER TABLE "notification_messages"
  ADD CONSTRAINT "notification_messages_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
