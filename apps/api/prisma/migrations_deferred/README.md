# Migrations de base de données reportées (V2 et V3)

Ce répertoire contient les scripts de migration SQL et les définitions Prisma pour les modules reportés de **Résidence Blue** :
- **Housekeeping détaillé** (V2)
- **Maintenance complète** (V2)
- **Gestion des stocks & Économat** (V2)
- **Passerelle Channel Manager (OTAs)** (V3)
- **Comptabilité générale SYSCOHADA** (V3)

## Règle d'Architecture
Pour garantir une base de données PostgreSQL légère, rapide et sans surcharge inutile lors de la V1 (12 chambres), **ces migrations sont isolées du dossier standard `apps/api/prisma/migrations/`**.
Ainsi, la commande `npx prisma migrate deploy` en production ne crée AUCUNE table pour les modules reportés.

## Procédure d'application lors de la réactivation d'un module
Lorsqu'un module est promu en version active (ex: passage à la V2) :
1. Intégrer les modèles correspondants depuis `prisma/schema.deferred.prisma` vers `prisma/schema.prisma`.
2. Déplacer le dossier de migration depuis `migrations_deferred/<nom_module>/` vers `apps/api/prisma/migrations/<timestamp>_<nom_module>/`.
3. Exécuter `npx prisma migrate dev` ou `npx prisma migrate deploy`.
4. Mettre à jour l'interrupteur dans `config/modules.json` (`"enabled": true`).
