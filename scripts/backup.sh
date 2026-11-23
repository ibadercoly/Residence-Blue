#!/usr/bin/env sh
# =============================================================================
# Script de sauvegarde chiffrée PostgreSQL 16 — Résidence Blue
# Exécute pg_dump et chiffre immédiatement le flux avec age ou gpg (AES-256) :
# aucune donnée en clair n'est écrite sur disque.
# Conserve une copie locale (BACKUP_DIR) ET écrit une seconde copie chiffrée
# hors site (BACKUP_OFFSITE_DIR : disque USB monté ou cible rsync).
# Nom du fichier daté : backup_residence_blue_YYYYMMDD_HHMMSS.sql.<gpg|age>
# Les droits (GRANT/REVOKE, dont audit_log en ajout seul) sont conservés.
# =============================================================================
set -eu

PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-app_owner}"
PGDATABASE="${PGDATABASE:-residence_blue_db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_OFFSITE_DIR="${BACKUP_OFFSITE_DIR:-}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"

if [ -z "$BACKUP_OFFSITE_DIR" ]; then
  echo "[BACKUP][ERREUR] Variable BACKUP_OFFSITE_DIR manquante : la copie hors site est obligatoire." >&2
  exit 1
fi

is_remote_offsite=0
case "$BACKUP_OFFSITE_DIR" in
  [A-Za-z]:/*|[A-Za-z]:\\*)
    is_remote_offsite=0
    ;;
  *:*)
    is_remote_offsite=1
    ;;
  *)
    is_remote_offsite=0
    ;;
esac

if [ "$is_remote_offsite" -eq 0 ] && [ ! -d "$BACKUP_OFFSITE_DIR" ]; then
  echo "[BACKUP][ERREUR] Dossier hors site BACKUP_OFFSITE_DIR introuvable ou non monté : ${BACKUP_OFFSITE_DIR}" >&2
  exit 1
fi

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

if [ ! -s "$OUTPUT_FILE" ]; then
  echo "[BACKUP][ERREUR] La sauvegarde locale est absente ou vide : ${OUTPUT_FILE}" >&2
  exit 1
fi

printf "%s" "$OUTPUT_FILE" > "${BACKUP_DIR}/latest_backup.txt"

# Seconde copie chiffrée hors site (disque USB monté ou cible rsync)
BASENAME="$(basename "$OUTPUT_FILE")"

if [ "$is_remote_offsite" -eq 1 ]; then
  if ! command -v rsync >/dev/null 2>&1; then
    echo "[BACKUP][ERREUR] rsync est requis pour copier vers la cible distante : ${BACKUP_OFFSITE_DIR}" >&2
    exit 1
  fi
  REMOTE_TARGET="${BACKUP_OFFSITE_DIR%/}/${BASENAME}"
  if ! rsync -az "$OUTPUT_FILE" "$REMOTE_TARGET"; then
    echo "[BACKUP][ERREUR] Échec de la copie hors site rsync vers : ${REMOTE_TARGET}" >&2
    exit 1
  fi
  echo "[BACKUP] Copie hors site (rsync) terminée : ${REMOTE_TARGET}"
else
  OFFSITE_FILE="${BACKUP_OFFSITE_DIR%/}/${BASENAME}"
  if command -v rsync >/dev/null 2>&1; then
    if ! rsync -a "$OUTPUT_FILE" "$OFFSITE_FILE"; then
      echo "[BACKUP][ERREUR] Échec de la copie hors site (rsync) vers : ${OFFSITE_FILE}" >&2
      exit 1
    fi
  else
    if ! cp -f "$OUTPUT_FILE" "$OFFSITE_FILE"; then
      echo "[BACKUP][ERREUR] Échec de la copie hors site (cp) vers : ${OFFSITE_FILE}" >&2
      exit 1
    fi
  fi

  if [ ! -s "$OFFSITE_FILE" ]; then
    echo "[BACKUP][ERREUR] La copie hors site est absente ou vide : ${OFFSITE_FILE}" >&2
    exit 1
  fi

  LOCAL_SIZE="$(wc -c < "$OUTPUT_FILE" | tr -d '[:space:]')"
  OFFSITE_SIZE="$(wc -c < "$OFFSITE_FILE" | tr -d '[:space:]')"
  if [ "$LOCAL_SIZE" != "$OFFSITE_SIZE" ]; then
    echo "[BACKUP][ERREUR] Taille incohérente entre copie locale (${LOCAL_SIZE} o) et hors site (${OFFSITE_SIZE} o)." >&2
    exit 1
  fi

  printf "%s" "$OFFSITE_FILE" > "${BACKUP_OFFSITE_DIR%/}/latest_backup.txt"
  echo "[BACKUP] Copie hors site vérifiée (${OFFSITE_SIZE} octets) : ${OFFSITE_FILE}"
fi
