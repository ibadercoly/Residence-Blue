-- Lot 7 (MET-002 / INT-005) : Table de clôture de caisse quotidienne avec écart compté
CREATE TABLE IF NOT EXISTS "cash_closures" (
  "id" UUID NOT NULL,
  "business_date" TEXT NOT NULL,
  "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_by_id" UUID NOT NULL,
  "closed_by_name" TEXT NOT NULL,
  "total_theoretical_cash" INTEGER NOT NULL,
  "total_counted_cash" INTEGER NOT NULL,
  "difference" INTEGER NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_closures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_closures_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "cash_closures_business_date_idx" ON "cash_closures"("business_date");
CREATE INDEX IF NOT EXISTS "cash_closures_closed_at_idx" ON "cash_closures"("closed_at");
CREATE INDEX IF NOT EXISTS "cash_closures_closed_by_id_idx" ON "cash_closures"("closed_by_id");

DO $$
BEGIN
  IF to_regprocedure('public.enforce_residence_blue_permissions()') IS NOT NULL THEN
    PERFORM public.enforce_residence_blue_permissions();
  END IF;
END
$$;
