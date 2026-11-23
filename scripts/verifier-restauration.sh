#!/usr/bin/env sh
# =============================================================================
# Script de vérification de restauration — Résidence Blue
# Prend la dernière sauvegarde chiffrée, vérifie sa lisibilité (--dry-run) ou
# la restaure sur une base de TEST vide (*_e2e uniquement, jamais prod ni dev)
# puis lance `npm run verify:integrity` (--apply).
#
# Usage :
#   ./scripts/verifier-restauration.sh            # mode --dry-run (défaut)
#   ./scripts/verifier-restauration.sh --dry-run  # lecture seule, ne touche à rien
#   ./scripts/verifier-restauration.sh --apply    # restaure sur residence_blue_e2e vide
# =============================================================================
set -eu

MODE="dry-run"
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      MODE="dry-run"
      ;;
    --apply)
      MODE="apply"
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run|--apply]"
      exit 0
      ;;
    *)
      echo "[VERIF-RESTAURATION][ERREUR] Option inconnue : $arg (attendu --dry-run ou --apply)" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"

# Charger les variables manquantes depuis .env sans jamais afficher de secret
CR="$(printf '\r')"
if [ -f "${REPO_ROOT}/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%"$CR"}"
    case "$line" in
      ''|'#'*) continue ;;
      *=*)
        key="${line%%=*}"
        val="${line#*=}"
        val="${val%\"}"
        val="${val#\"}"
        val="${val%\'}"
        val="${val#\'}"
        # Ne jamais écraser une variable déjà fournie par l'appelant
        eval "existing=\${$key-__UNSET__}"
        if [ "$existing" = "__UNSET__" ]; then
          export "$key=$val"
        fi
        ;;
    esac
  done < "${REPO_ROOT}/.env"
fi

if [ "$MODE" = "dry-run" ]; then
  echo "[VERIF-RESTAURATION] Mode choisi : --dry-run (lecture seule, aucune modification en base)"
else
  echo "[VERIF-RESTAURATION] Mode choisi : --apply (restauration réelle sur base de test vide)"
fi

TARGET_DB="${TEST_DB_NAME:-residence_blue_e2e}"
# Garde-fou absolu : uniquement une base *_e2e (JAMAIS residence_blue_db ni production)
case "$TARGET_DB" in
  *_e2e)
    ;;
  *)
    echo "[VERIF-RESTAURATION][REFUS] Base cible interdite : '${TARGET_DB}'. Seule une base *_e2e (ex. residence_blue_e2e) est autorisée." >&2
    exit 1
    ;;
esac

BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
BACKUP_FILE=""

if [ -n "${BACKUP_FILE_OVERRIDE:-}" ]; then
  BACKUP_FILE="$BACKUP_FILE_OVERRIDE"
elif [ -f "${BACKUP_DIR}/latest_backup.txt" ]; then
  BACKUP_FILE="$(cat "${BACKUP_DIR}/latest_backup.txt" | tr -d '\r\n')"
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  # Cherche le fichier de sauvegarde le plus récent dans BACKUP_DIR
  if [ -d "$BACKUP_DIR" ]; then
    BACKUP_FILE="$(ls -1t "${BACKUP_DIR}"/backup_residence_blue_*.sql.* 2>/dev/null | head -n 1 || true)"
  fi
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "[VERIF-RESTAURATION][ECHEC] Aucune sauvegarde trouvée dans : ${BACKUP_DIR}" >&2
  exit 1
fi

FILE_SIZE="$(wc -c < "$BACKUP_FILE" | tr -d '[:space:]')"
if [ "$FILE_SIZE" -lt 1024 ]; then
  echo "[VERIF-RESTAURATION][ECHEC] Sauvegarde trop petite ou vide (${FILE_SIZE} octets) : ${BACKUP_FILE}" >&2
  exit 1
fi

echo "[VERIF-RESTAURATION] Sauvegarde sélectionnée : ${BACKUP_FILE} (${FILE_SIZE} octets)"

# Vérification de lisibilité / déchiffrement (sans écriture sur disque)
decrypt_stream() {
  case "$BACKUP_FILE" in
    *.age)
      if [ -z "${BACKUP_AGE_KEY_FILE:-}" ]; then
        echo "[VERIF-RESTAURATION][ECHEC] BACKUP_AGE_KEY_FILE requis pour déchiffrer .age" >&2
        return 1
      fi
      age --decrypt -i "$BACKUP_AGE_KEY_FILE" "$BACKUP_FILE"
      ;;
    *.gpg)
      if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        echo "[VERIF-RESTAURATION][ECHEC] BACKUP_ENCRYPTION_KEY requis pour déchiffrer .gpg" >&2
        return 1
      fi
      gpg --batch --yes --pinentry-mode loopback --decrypt \
        --passphrase "$BACKUP_ENCRYPTION_KEY" "$BACKUP_FILE" 2>/dev/null
      ;;
    *)
      echo "[VERIF-RESTAURATION][ECHEC] Extension non supportée : ${BACKUP_FILE}" >&2
      return 1
      ;;
  esac
}

HEADER_CHECK="$(decrypt_stream | head -n 40 || true)"
if ! printf "%s" "$HEADER_CHECK" | grep -qE "PostgreSQL database dump|SET statement_timeout|CREATE TABLE"; then
  echo "[VERIF-RESTAURATION][ECHEC] Impossible de déchiffrer la sauvegarde ou contenu SQL invalide." >&2
  exit 1
fi

if [ "$MODE" = "dry-run" ]; then
  echo "[VERIF-RESTAURATION] OK — Sauvegarde lisible et déchiffrable (base cible vérifiée : ${TARGET_DB}, aucune modification effectuée)."
  exit 0
fi

# Mode --apply : vider la base de test *_e2e, restaurer, puis lancer npm run verify:integrity
PG_CONTAINER="${PG_CONTAINER:-residence_blue_db}"
PG_ADMIN_USER="${POSTGRES_USER:-postgres}"
PG_ADMIN_PASSWORD="${POSTGRES_PASSWORD:-}"
PG_OWNER_USER="app_owner"
PG_OWNER_PASSWORD="${APP_OWNER_PASSWORD:-}"
PG_APP_USER="app_user"
PG_APP_PASSWORD="${APP_USER_PASSWORD:-}"
PG_HOST_LOCAL="${TEST_DB_HOST:-127.0.0.1}"
PG_PORT_LOCAL="${TEST_DB_PORT:-5432}"

run_admin_sql() {
  db="$1"
  sql="$2"
  if command -v psql >/dev/null 2>&1 && [ -n "${PGHOST:-}" ] && [ "$PGHOST" != "db" ]; then
    PGPASSWORD="$PG_ADMIN_PASSWORD" psql -q -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PG_PORT_LOCAL" -U "$PG_ADMIN_USER" -d "$db" -c "$sql"
  else
    docker exec -e PGPASSWORD="$PG_ADMIN_PASSWORD" "$PG_CONTAINER" \
      psql -q -v ON_ERROR_STOP=1 -h localhost -U "$PG_ADMIN_USER" -d "$db" -c "$sql"
  fi
}

echo "[VERIF-RESTAURATION] Préparation d'une base de test VIDE : ${TARGET_DB}..."

# Créer la base *_e2e si elle n'existe pas encore
DB_EXISTS="$(docker exec -e PGPASSWORD="$PG_ADMIN_PASSWORD" "$PG_CONTAINER" \
  psql -tAc "SELECT 1 FROM pg_database WHERE datname='${TARGET_DB}'" -h localhost -U "$PG_ADMIN_USER" -d postgres 2>/dev/null | tr -d '[:space:]' || true)"

if [ "$DB_EXISTS" != "1" ]; then
  run_admin_sql postgres "CREATE DATABASE \"${TARGET_DB}\" OWNER app_owner;"
fi

# Réinitialiser complètement le schéma public (base strictement vide) et installer btree_gist
run_admin_sql "$TARGET_DB" "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION app_owner; GRANT USAGE ON SCHEMA public TO app_user, app_readonly; CREATE EXTENSION IF NOT EXISTS btree_gist;"

echo "[VERIF-RESTAURATION] Restauration de la sauvegarde dans ${TARGET_DB}..."
PGDATABASE="$TARGET_DB" \
PGUSER="$PG_OWNER_USER" \
PGPASSWORD="$PG_OWNER_PASSWORD" \
PG_CONTAINER="$PG_CONTAINER" \
  sh "${SCRIPT_DIR}/restore.sh" "$BACKUP_FILE"

echo "[VERIF-RESTAURATION] Lancement de npm run verify:integrity sur ${TARGET_DB}..."
TARGET_DATABASE_URL="postgresql://${PG_APP_USER}:${PG_APP_PASSWORD}@${PG_HOST_LOCAL}:${PG_PORT_LOCAL}/${TARGET_DB}?schema=public"

(
  cd "$REPO_ROOT"
  DATABASE_URL="$TARGET_DATABASE_URL" \
    node ./node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.json scripts/verifier-integrite.ts
)

echo "[VERIF-RESTAURATION] OK — Restauration complète sur ${TARGET_DB} et intégrité vérifiées avec succès."
