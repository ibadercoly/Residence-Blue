#!/usr/bin/env sh
# =============================================================================
# Script de restauration chiffrée PostgreSQL 16 — Résidence Blue
# Déchiffre une sauvegarde (.sql.age ou .sql.gpg) et la restaure via psql
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
    psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE"
  else
    PG_CONTAINER="${PG_CONTAINER:-residence_blue_postgres}"
    docker exec -i -e PGPASSWORD="${PGPASSWORD:-}" "$PG_CONTAINER" \
      psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE"
  fi
}

case "$BACKUP_FILE" in
  *.age)
    if [ -z "${BACKUP_AGE_KEY_FILE:-}" ]; then
      echo "[RESTORE][ERREUR] BACKUP_AGE_KEY_FILE requis pour déchiffrer un fichier .age" >&2
      exit 1
    fi
    age --decrypt -i "$BACKUP_AGE_KEY_FILE" "$BACKUP_FILE" | run_psql
    ;;
  *.gpg)
    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
      echo "[RESTORE][ERREUR] BACKUP_ENCRYPTION_KEY requis pour déchiffrer un fichier .gpg" >&2
      exit 1
    fi
    gpg --batch --yes --pinentry-mode loopback --decrypt \
      --passphrase "$BACKUP_ENCRYPTION_KEY" "$BACKUP_FILE" | run_psql
    ;;
  *)
    echo "[RESTORE][ERREUR] Format de sauvegarde non supporté (attendu .age ou .gpg) : $BACKUP_FILE" >&2
    exit 1
    ;;
esac

echo "[RESTORE] Restauration complète terminée depuis : ${BACKUP_FILE}"
