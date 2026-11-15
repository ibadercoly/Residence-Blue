-- Index de performance pour l'écran Rapports (/api/rapports)
CREATE INDEX IF NOT EXISTS "invoices_document_type_status_issued_at_idx" ON "invoices"("document_type", "status", "issued_at");
CREATE INDEX IF NOT EXISTS "invoice_lines_category_idx" ON "invoice_lines"("category");
CREATE INDEX IF NOT EXISTS "reservations_source_idx" ON "reservations"("source");
