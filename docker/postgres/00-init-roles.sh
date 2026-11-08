#!/bin/sh
# =============================================================================
# Exécuté UNE SEULE FOIS par l'image postgres au premier démarrage (volume vide).
# Crée les rôles app_owner / app_user / app_readonly avec les mots de passe
# fournis par l'environnement (.env), sans jamais les écrire dans Git.
# =============================================================================
set -eu

for var in APP_OWNER_PASSWORD APP_USER_PASSWORD APP_READONLY_PASSWORD; do
  eval "value=\${$var:-}"
  if [ -z "$value" ]; then
    echo "[INIT][ERREUR] La variable $var est obligatoire." >&2
    exit 1
  fi
done

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v owner_password="$APP_OWNER_PASSWORD" \
  -v user_password="$APP_USER_PASSWORD" \
  -v readonly_password="$APP_READONLY_PASSWORD" \
  -f /opt/residence-blue/init.sql

echo "[INIT] Rôles app_owner, app_user et app_readonly créés (scram-sha-256)."
