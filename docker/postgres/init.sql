-- =============================================================================
-- Script d'initialisation PostgreSQL 16 : Résidence Blue (base sécurisée)
-- Crée les 3 rôles de moindre privilège avec authentification scram-sha-256 :
--   1. app_owner    : exécute les migrations (propriétaire du schéma public)
--   2. app_user     : utilisé par l'API NestJS (SELECT/INSERT/UPDATE/DELETE,
--                     AUCUN DDL, pas superuser, ajout seul sur audit_log)
--   3. app_readonly : utilisé pour les rapports (SELECT uniquement)
--
-- AUCUN mot de passe n'est écrit dans ce fichier. Ils sont fournis par psql :
--   psql -v ON_ERROR_STOP=1 \
--        -v owner_password="$APP_OWNER_PASSWORD" \
--        -v user_password="$APP_USER_PASSWORD" \
--        -v readonly_password="$APP_READONLY_PASSWORD" \
--        -f docker/postgres/init.sql
-- (voir docker/postgres/00-init-roles.sh, exécuté au premier démarrage du conteneur)
-- =============================================================================

\set ON_ERROR_STOP on

-- Forcer le hachage des mots de passe en scram-sha-256
SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- 1. Création des 3 rôles (sans mot de passe), puis attribution des mots de passe
SELECT 'CREATE ROLE app_owner NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') \gexec
SELECT 'CREATE ROLE app_user NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') \gexec
SELECT 'CREATE ROLE app_readonly NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') \gexec

-- Les mots de passe sont passés en variables psql et échappés par format(%L)
SELECT format(
  'ALTER ROLE app_owner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT PASSWORD %L',
  :'owner_password'
) \gexec
SELECT format(
  'ALTER ROLE app_user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD %L',
  :'user_password'
) \gexec
SELECT format(
  'ALTER ROLE app_readonly WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD %L',
  :'readonly_password'
) \gexec

-- 2. Durcissement du schéma public : retirer CREATE à PUBLIC (interdit tout DDL implicite)
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO app_owner;
GRANT USAGE ON SCHEMA public TO app_owner, app_user, app_readonly;
GRANT CREATE ON SCHEMA public TO app_owner;

-- 3. Privilèges par défaut pour les futures tables créées par app_owner (migrations)
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO app_readonly;

-- 4. Fonction utilitaire permettant d'appliquer et verrouiller les droits
--    après chaque migration ou restauration (notamment audit_log en ajout seul).
--    Elle appartient à app_owner pour pouvoir être sauvegardée/restaurée par lui.
CREATE OR REPLACE FUNCTION public.enforce_residence_blue_permissions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Aucun droit DDL (CREATE) sur le schéma public pour app_user et app_readonly
  REVOKE CREATE ON SCHEMA public FROM PUBLIC, app_user, app_readonly;
  GRANT USAGE ON SCHEMA public TO app_user, app_readonly;

  -- Droits DML standards pour app_user sur toutes les tables existantes
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM app_user;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

  -- Droits lecture seule stricts pour app_readonly
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_readonly;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;

  -- Table audit_log en ajout seul (SELECT + INSERT uniquement)
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

ALTER FUNCTION public.enforce_residence_blue_permissions() OWNER TO app_owner;
REVOKE ALL ON FUNCTION public.enforce_residence_blue_permissions() FROM PUBLIC;
