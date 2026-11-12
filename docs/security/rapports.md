# Porte de sécurité — Écran Rapports (`/rapports`)

- **Branche** : `feature/rapports-simple`
- **Périmètre** : `GET /api/rapports`, `GET /api/rapports/export/pdf`, `GET /api/rapports/export/excel`, page `/rapports`.

## Contrôles vérifiés

1. **Contrôle d'accès par rôle (RBAC)** :
   - `@Roles(Role.DIRECTION, Role.COMPTABLE)` et `@RequireModule('rapports')` appliqués sur `RapportsController`.
   - Les rôles `RECEPTION`, `RESTAURANT`, `SERVEUR`, `CUISINE`, `HOUSEKEEPING` et `MAINTENANCE` reçoivent `403 Forbidden` (vérifié en test d'intégration et E2E).
   - L'entrée de menu latéral **Rapports** est masquée pour tout rôle autre que `DIRECTION` et `COMPTABLE`.
2. **Validation stricte des entrées** :
   - `RapportsQueryDto` valide `periode` (`30j | 3m | 12m | mois`) et `comparer` (`true | false | 1 | 0`) sous `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`). Tout paramètre non autorisé retourne `400`.
3. **Requêtes SQL paramétrées uniquement** :
   - Toutes les agrégations `RapportsService` utilisent exclusivement `prisma.$queryRaw` avec gabarit étiqueté paramétré (aucune concaténation SQL).
4. **Absence de cache financier hors ligne** :
   - `RapportsService` côté front utilise `fetch(..., { cache: 'no-store' })` et ne stocke aucune donnée financière dans IndexedDB, `localStorage`, `sessionStorage` ni `ngsw-config.json`. Hors ligne, la page affiche un message d'indisponibilité clair.
5. **Protection des exports (PDF & Excel)** :
   - Refus explicite (`400 Bad Request`) côté serveur si la période ne contient aucune donnée réelle.
   - Cellules texte Excel nettoyées par `sanitizeSpreadsheetCell` contre l'injection de formules CSV/Excel (`=`, `+`, `-`, `@`).
   - En-têtes binaires complets (`Content-Type`, `Content-Disposition`, `Content-Length`, `Cache-Control: no-store`).
   - Chaque export PDF et Excel enregistre une entrée chaînée SHA-256 dans `audit_log` (`RAPPORT_EXPORT_PDF`, `RAPPORT_EXPORT_EXCEL`).
