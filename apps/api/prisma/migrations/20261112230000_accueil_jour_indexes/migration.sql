-- Index non destructifs pour accélérer GET /api/accueil/jour (< 300 ms)
CREATE INDEX IF NOT EXISTS "guests_created_at_idx" ON "guests"("created_at");
CREATE INDEX IF NOT EXISTS "reservations_checked_in_at_idx" ON "reservations"("checked_in_at");
CREATE INDEX IF NOT EXISTS "reservations_checked_out_at_idx" ON "reservations"("checked_out_at");
