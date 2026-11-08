-- =============================================================================
-- Script d'initialisation PostgreSQL 16 : Résidence Blue (feature/base-securisee)
-- Crée les 3 rôles de moindre privilège avec authentification scram-sha-256 :
--   1. app_owner    : exécute les migrations (DDL autorisé sur public)
--   2. app_user     : utilisé par l'API NestJS (SELECT/INSERT/UPDATE/DELETE,
--                     AUCUN DDL, pas superuser, et ajout seul sur audit_log)
--   3. app_readonly : utilisé pour les rapports (SELECT uniquement)
-- =============================================================================

-- Forcer le hachage des mots de passe en scram-sha-256
SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- Extension pour la génération d'UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Création des 3 rôles s'ils n'existent pas
DO $$
DECLARE
  v_owner_pwd    TEXT := COALESCE(current_setting('app.owner_password', true), 'app_owner_scram_secret');
  v_user_pwd     TEXT := COALESCE(current_setting('app.user_password', true), 'app_user_scram_secret');
  v_readonly_pwd TEXT := COALESCE(current_setting('app.readonly_password', true), 'app_readonly_scram_secret');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
    EXECUTE format(
      'CREATE ROLE app_owner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT PASSWORD %L',
      v_owner_pwd
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    EXECUTE format(
      'CREATE ROLE app_user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
      v_user_pwd
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    EXECUTE format(
      'CREATE ROLE app_readonly WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
      v_readonly_pwd
    );
  END IF;
END
$$;

-- 2. Durcissement du schéma public : retirer CREATE à PUBLIC (interdit tout DDL implicite)
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_owner, app_user, app_readonly;
GRANT CREATE ON SCHEMA public TO app_owner;
ALTER SCHEMA public OWNER TO app_owner;

-- 3. Privilèges par défaut pour les futures tables créées par app_owner (ou postgres)
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO app_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO app_readonly;

-- 4. Fonction utilitaire permettant d'appliquer et verrouiller les droits
--    après chaque migration (notamment audit_log en ajout seul)
CREATE OR REPLACE FUNCTION enforce_residence_blue_permissions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Aucun droit DDL (CREATE) sur le schéma public pour app_user et app_readonly
  REVOKE CREATE ON SCHEMA public FROM PUBLIC, app_user, app_readonly;
  GRANT USAGE ON SCHEMA public TO app_owner, app_user, app_readonly;

  -- Droits complets pour app_owner (propriétaire du schéma et des migrations)
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_owner;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_owner;

  -- Droits DML standards pour app_user sur toutes les tables existantes
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM app_user;

  -- Droits lecture seule stricts pour app_readonly
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_readonly;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;

  -- Règle spécifique #3 : Table audit_log en ajout seul (SELECT + INSERT uniquement)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_log FROM app_user, app_readonly, PUBLIC;
    GRANT SELECT, INSERT ON TABLE public.audit_log TO app_user;
    GRANT SELECT ON TABLE public.audit_log TO app_readonly;
  END IF;
END;
$$;
