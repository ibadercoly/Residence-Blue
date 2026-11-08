# Conteneur de sauvegarde quotidienne : client PostgreSQL 16 + outils de chiffrement.
# Les paquets sont installés à la construction, car le conteneur tourne ensuite
# uniquement sur le réseau interne (sans accès Internet).
FROM postgres:16-alpine

RUN apk add --no-cache gnupg age

COPY docker/backup/entrypoint.sh /usr/local/bin/backup-entrypoint.sh
RUN chmod 755 /usr/local/bin/backup-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/backup-entrypoint.sh"]
