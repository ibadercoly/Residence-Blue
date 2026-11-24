#!/usr/bin/env sh
# =============================================================================
# Script de restauration chiffrée PostgreSQL 16 — Résidence Blue
# Déchiffre une sauvegarde (.sql.age ou .sql.gpg) et la restaure via psql,
# puis réapplique les droits de sécurité (audit_log en ajout seul, etc.).
# Usage : ./scripts/restore.sh <chemin_fichier_chiffré>
# =============================================================================
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <fichier_backup.sql.gpg|fichier_backup.sql.age>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "[RESTORE][ERREUR] Fichier introuvable : $BACKUP_FILE" >&2
  exit 1
fi

PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-app_owner}"
PGDATABASE="${PGDATABASE:-residence_blue_db}"

run_psql() {
  if command -v psql >/dev/null 2>&1; then
    psql -q -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE"
  else
    # Poste de développement sans client PostgreSQL : on passe par le conteneur
    PG_CONTAINER="${PG_CONTAINER:-residence_blue_db}"
    docker exec -i -e PGPASSWORD="${PGPASSWORD:-}" "$PG_CONTAINER" \
      psql -q -v ON_ERROR_STOP=1 -h localhost -U "$PGUSER" -d "$PGDATABASE"
  fi
}

filter_extension_ddl() {
  # L'extension btree_gist appartient au superutilisateur PostgreSQL :
  # app_owner ne peut ni la supprimer ni la recréer pendant une restauration.
  sed -E '/^(DROP|CREATE|COMMENT ON) EXTENSION /d'
}

case "$BACKUP_FILE" in
  *.age)
    if [ -z "${BACKUP_AGE_KEY_FILE:-}" ]; then
      echo "[RESTORE][ERREUR] BACKUP_AGE_KEY_FILE requis pour déchiffrer un fichier .age" >&2
      exit 1
    fi
    age --decrypt -i "$BACKUP_AGE_KEY_FILE" "$BACKUP_FILE" | filter_extension_ddl | run_psql
    ;;
  *.gpg)
    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
      echo "[RESTORE][ERREUR] BACKUP_ENCRYPTION_KEY requis pour déchiffrer un fichier .gpg" >&2
      exit 1
    fi
    gpg --batch --yes --pinentry-mode loopback --decrypt \
      --passphrase "$BACKUP_ENCRYPTION_KEY" "$BACKUP_FILE" | filter_extension_ddl | run_psql
    ;;
  *)
    echo "[RESTORE][ERREUR] Format de sauvegarde non supporté (attendu .age ou .gpg) : $BACKUP_FILE" >&2
    exit 1
    ;;
esac

# Réapplication des droits de sécurité après restauration (crée la fonction si la base était vierge)
run_psql >/dev/null <<'SQL'
DO $$
BEGIN
  IF to_regprocedure('public.enforce_residence_blue_permissions()') IS NULL THEN
    CREATE FUNCTION public.enforce_residence_blue_permissions()
    RETURNS void
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      REVOKE CREATE ON SCHEMA public FROM PUBLIC, app_user, app_readonly;
      GRANT USAGE ON SCHEMA public TO app_user, app_readonly;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
      REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM app_user;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_readonly;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'audit_log'
      ) THEN
        REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_log FROM app_user, app_readonly, PUBLIC;
        GRANT SELECT, INSERT ON TABLE public.audit_log TO app_user;
        GRANT SELECT ON TABLE public.audit_log TO app_readonly;
      END IF;
    END;
    $fn$;
    REVOKE ALL ON FUNCTION public.enforce_residence_blue_permissions() FROM PUBLIC;
  END IF;
END
$$;
SELECT public.enforce_residence_blue_permissions();
SQL

echo "[RESTORE] Restauration complète terminée depuis : ${BACKUP_FILE}"
