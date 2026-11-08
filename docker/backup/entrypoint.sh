#!/bin/sh
# =============================================================================
# Planifie scripts/backup.sh chaque jour à 02h00 (UTC) via crond.
# crond ne transmet pas l'environnement du conteneur aux tâches : on enregistre
# donc les variables nécessaires dans un fichier lisible par root uniquement.
# =============================================================================
set -eu

umask 077
export -p | grep -E "^export (PG|BACKUP_)" > /etc/backup.env

echo "0 2 * * * . /etc/backup.env && /bin/sh /scripts/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

echo "[BACKUP] Sauvegarde quotidienne planifiée à 02h00 UTC."
exec crond -f -l 8
