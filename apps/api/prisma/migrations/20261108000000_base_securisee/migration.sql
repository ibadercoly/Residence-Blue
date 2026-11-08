-- =============================================================================
-- Migration initiale : Socle de sécurité PostgreSQL (feature/base-securisee)
-- Sans tables métier (uniquement User, RefreshToken, AuditLog, SyncOperation)
-- =============================================================================

-- 1. Enum des rôles applicatifs
CREATE TYPE "Role" AS ENUM (
  'DIRECTION',
  'RECEPTION',
  'RESTAURANT',
  'HOUSEKEEPING',
  'MAINTENANCE',
  'COMPTABLE'
);

-- 2. Table users
CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "failed_logins" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- 3. Table refresh_tokens
CREATE TABLE "refresh_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "family_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- 4. Table audit_log (en ajout seul : append-only)
CREATE TABLE "audit_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ip" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_log_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- 5. Table sync_operations (idempotence hors-ligne / outbox)
CREATE TABLE "sync_operations" (
  "idempotency_key" TEXT NOT NULL,
  "user_id" UUID,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("idempotency_key"),
  CONSTRAINT "sync_operations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sync_operations_idempotency_key_key" ON "sync_operations"("idempotency_key");
CREATE INDEX "sync_operations_user_id_idx" ON "sync_operations"("user_id");

-- 6. Protection append-only stricte sur audit_log :
--    Trigger levant une exception sur toute tentative de UPDATE ou DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Opération % interdite : la table audit_log est en ajout seul (append-only).', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_append_only ON "audit_log";

CREATE TRIGGER trg_audit_log_append_only
BEFORE UPDATE OR DELETE ON "audit_log"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

-- 7. Application des privilèges par rôle si les rôles PostgreSQL existent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
    GRANT ALL PRIVILEGES ON TABLE "users", "refresh_tokens", "audit_log", "sync_operations" TO app_owner;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "users", "refresh_tokens", "sync_operations" TO app_user;
    GRANT SELECT, INSERT ON TABLE "audit_log" TO app_user;
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_log" FROM app_user;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    GRANT SELECT ON TABLE "users", "refresh_tokens", "audit_log", "sync_operations" TO app_readonly;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM app_readonly;
  END IF;
END
$$;
