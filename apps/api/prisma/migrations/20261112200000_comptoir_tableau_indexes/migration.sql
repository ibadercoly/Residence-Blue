-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_is_issued_document_type_status_updated_at_idx"
  ON "invoices"("is_issued", "document_type", "status", "updated_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_issued_at_idx" ON "invoices"("issued_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_balance_fcfa_idx" ON "invoices"("balance_fcfa");
