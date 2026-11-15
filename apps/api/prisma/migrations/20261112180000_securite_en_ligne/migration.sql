-- =============================================================================
-- Migration : Durcissement Sécurité En Ligne (chore/securite-en-ligne)
-- Ajouts : TOTP 2FA + codes de secours, rotation/sessions RefreshToken,
--          chaîne de hachage AuditLog, Idempotency-Key sur RestaurantOrder.
-- =============================================================================

-- 1. Colonnes 2FA TOTP & dernière connexion sur users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totp_secret_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "totp_pending_secret_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "totp_backup_codes_json" JSONB,
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);

-- 2. Colonnes de suivi de session, rotation et détection de réutilisation sur refresh_tokens
ALTER TABLE "refresh_tokens"
  ADD COLUMN IF NOT EXISTS "device_label" TEXT,
  ADD COLUMN IF NOT EXISTS "user_agent" TEXT,
  ADD COLUMN IF NOT EXISTS "ip_address" TEXT,
  ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "used_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replaced_by_token_id" UUID,
  ADD COLUMN IF NOT EXISTS "revoked_reason" TEXT;

-- 3. Clé d'idempotence sur orders (commandes restaurant)
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- 4. Chaîne de hachage infalsifiable sur audit_log
ALTER TABLE "audit_log"
  ADD COLUMN IF NOT EXISTS "seq" SERIAL NOT NULL,
  ADD COLUMN IF NOT EXISTS "prev_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "entry_hash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "audit_log_seq_key" ON "audit_log"("seq");
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log"("created_at");

-- 5. Initialiser la chaîne de hachage des entrées audit_log existantes (si présentes)
DO $$
DECLARE
  rec RECORD;
  v_prev TEXT := 'GENESIS';
  v_payload TEXT;
  v_hash TEXT;
BEGIN
  ALTER TABLE "audit_log" DISABLE TRIGGER trg_audit_log_append_only;

  FOR rec IN
    SELECT id, seq, user_id, action, entity, entity_id, before, after, ip, created_at
    FROM "audit_log"
    ORDER BY seq ASC
  LOOP
    v_payload := COALESCE(v_prev, 'GENESIS') || '|' ||
      rec.seq::TEXT || '|' ||
      to_char(rec.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
      COALESCE(rec.user_id::TEXT, '') || '|' ||
      rec.action || '|' ||
      rec.entity || '|' ||
      COALESCE(rec.entity_id, '') || '|' ||
      COALESCE(rec.before::TEXT, 'null') || '|' ||
      COALESCE(rec.after::TEXT, 'null') || '|' ||
      COALESCE(rec.ip, '');
    v_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

    UPDATE "audit_log"
    SET "prev_hash" = v_prev, "entry_hash" = v_hash
    WHERE id = rec.id;

    v_prev := v_hash;
  END LOOP;

  ALTER TABLE "audit_log" ENABLE TRIGGER trg_audit_log_append_only;
END
$$;

-- 6. Droits PostgreSQL sur la séquence audit_log_seq_seq pour app_user et app_readonly
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
    GRANT ALL PRIVILEGES ON SEQUENCE "audit_log_seq_seq" TO app_owner;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT USAGE, SELECT ON SEQUENCE "audit_log_seq_seq" TO app_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    GRANT SELECT ON SEQUENCE "audit_log_seq_seq" TO app_readonly;
  END IF;
END
$$;
