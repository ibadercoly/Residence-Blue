#!/usr/bin/env sh
# =============================================================================
# Script de sauvegarde chiffrée PostgreSQL 16 — Résidence Blue
# Exécute pg_dump et chiffre immédiatement le flux avec age ou gpg (AES-256) :
# aucune donnée en clair n'est écrite sur disque.
# Nom du fichier daté : backup_residence_blue_YYYYMMDD_HHMMSS.sql.<gpg|age>
# Les droits (GRANT/REVOKE, dont audit_log en ajout seul) sont conservés.
# =============================================================================
set -eu

PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-app_owner}"
PGDATABASE="${PGDATABASE:-residence_blue_db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

run_pg_dump() {
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump --clean --if-exists --no-owner \
      -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE"
  else
    # Poste de développement sans client PostgreSQL : on passe par le conteneur
    PG_CONTAINER="${PG_CONTAINER:-residence_blue_db}"
    docker exec -e PGPASSWORD="${PGPASSWORD:-}" "$PG_CONTAINER" \
      pg_dump --clean --if-exists --no-owner \
      -h localhost -U "$PGUSER" -d "$PGDATABASE"
  fi
}

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ] && command -v age >/dev/null 2>&1; then
  OUTPUT_FILE="${BACKUP_DIR}/backup_residence_blue_${TIMESTAMP}.sql.age"
  run_pg_dump | age -r "$BACKUP_AGE_RECIPIENT" -o "$OUTPUT_FILE"
  echo "[BACKUP] Sauvegarde chiffrée (age) créée : ${OUTPUT_FILE}"
elif command -v gpg >/dev/null 2>&1; then
  if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "[BACKUP][ERREUR] Variable BACKUP_ENCRYPTION_KEY manquante pour le chiffrement GPG." >&2
    exit 1
  fi
  OUTPUT_FILE="${BACKUP_DIR}/backup_residence_blue_${TIMESTAMP}.sql.gpg"
  run_pg_dump | gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 \
      --passphrase "$BACKUP_ENCRYPTION_KEY" \
      -o "$OUTPUT_FILE"
  echo "[BACKUP] Sauvegarde chiffrée (GPG AES-256) créée : ${OUTPUT_FILE}"
else
  echo "[BACKUP][ERREUR] Aucun outil de chiffrement (age ou gpg) disponible." >&2
  exit 1
fi

printf "%s" "$OUTPUT_FILE" > "${BACKUP_DIR}/latest_backup.txt"
