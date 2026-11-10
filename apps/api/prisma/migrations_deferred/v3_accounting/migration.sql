-- Migration V3 : Comptabilité SYSCOHADA (Grand livre, comptes généraux, écritures)
-- Ne pas exécuter en V1.

CREATE TABLE IF NOT EXISTS "syscohada_accounts" (
    "account_number" VARCHAR(20) NOT NULL PRIMARY KEY,
    "label" VARCHAR(200) NOT NULL,
    "account_class" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "general_ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_date" DATE NOT NULL,
    "journal_code" VARCHAR(10) NOT NULL, -- VT (Ventes), CA (Caisse), BQ (Banque), OD (Opérations Diverses)
    "piece_reference" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "debit_fcfa" INTEGER NOT NULL DEFAULT 0,
    "credit_fcfa" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "general_ledger_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "general_ledger_entries_account_fkey" FOREIGN KEY ("account_number") REFERENCES "syscohada_accounts"("account_number")
);

CREATE INDEX IF NOT EXISTS "idx_ledger_date" ON "general_ledger_entries"("entry_date");
CREATE INDEX IF NOT EXISTS "idx_ledger_account" ON "general_ledger_entries"("account_number");
