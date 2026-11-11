# Fonctionnalités et Routes API Reportées (V2 / V3) — Résidence Blue

Conformément à `config/modules.json` et `docs/MODULES.md`, les modules ci-dessous sont désactivés en Version 1 Minimale et leurs tables SQL sont isolées dans `apps/api/prisma/migrations_deferred/` :

1. **Météo temps réel de Thiès (`meteo` — V2)** :
   - Le widget météo sur le tableau de bord est désactivé en V1. Aucune clé d'API météo externe n'est appelée.
2. **Housekeeping détaillé (`housekeeping` — V2)** :
   - Table `housekeeping_sheets` isolée dans `migrations_deferred/v2_housekeeping/`.
3. **Maintenance technique complète (`maintenance` — V2)** :
   - Table `maintenance_work_orders` isolée dans `migrations_deferred/v2_maintenance/`.
4. **Stocks et Économat (`inventory` — V2)** :
   - Table `inventory_items` isolée dans `migrations_deferred/v2_inventory_stocks/`.
5. **Comptabilité SYSCOHADA (`accounting` — V3)** :
   - Table `general_ledger_entries` isolée dans `migrations_deferred/v3_accounting/`.
6. **Passerelle OTAs / Channel Manager (`channel_manager` — V3)** :
   - Isolée dans `migrations_deferred/v3_channel_manager/`.
