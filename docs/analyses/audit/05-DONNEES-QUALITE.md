# 05 — Données et qualité

Audit en lecture seule, 17/11/2026. Aucune commande n'a écrit en base.

## 1. Résultats réels exécutés pendant l'audit
| Commande | Résultat | Base utilisée |
|---|---|---|
| `npm run lint` | **0 erreur, 1 avertissement** : `hasScreenAccess` importé mais inutilisé (`apps/api/src/restaurant/restaurant.controller.ts:28`) | aucune |
| `npm run test --workspace=@residence-blue/api` (unitaires) | **8 suites, 35 tests, tous verts** | aucune (tests simulés) |
| `npm audit --json` | 8 alertes modérées, 0 haute, 0 critique (voir SEC-007) | aucune |
| Tests d'intégration, E2E, sécurité, build web | **non relancés pendant cet audit** (longs, besoin de la base de test `residence_blue_e2e`) | — |

> Les tests unitaires de l'API sont peu nombreux (35) au regard de deux services de plus de 1 900 lignes. La sécurité des parcours repose surtout sur les tests d'intégration et E2E, non relancés ici.

## 2. Base de données (`apps/api/prisma/schema.prisma`, 579 lignes, 21 migrations)
**Points solides**
- Montants en `Int` partout (FCFA entiers).
- Suppressions protégées : `onDelete: Restrict` sur réservations, factures, paiements, commandes (`:205-207`, `:247-255`, `:328`, `:398-400`) ; seules les lignes de facture et les jetons de session partent en cascade (`:306`, `:96`), ce qui est normal.
- Comptes supprimés « en douceur » (`deletedAt`, `deletedDisplayName`, `:71-72`) et liens `SetNull` sur l'auteur d'une réservation ou d'un paiement, avec nom recopié (`:224-225`, `:333-334`) : l'historique survit à la suppression d'un compte.
- Index présents sur les recherches fréquentes (dates de réservation, statut, téléphone client, dates de facture).
- Anti-chevauchement en base (`btree_gist`, migration `20261112000000_reservation_refonte`).

### DAT-001 — P2 — Champs en double dans les commandes restaurant
- `status`/`statut`, `preparingAt`/`priseEnChargeAt`, `readyAt`/`preteAt`, `servedAt`/`serviAt` (`schema.prisma:404-426`). Voir LOG-008.

### DAT-002 — P2 — Valeurs de rôles obsolètes
- `CUISINE`, `SERVEUR` dans `enum Role` (`:15-17`), convertis à la lecture (`packages/shared/src/access.ts:330-333`). À retirer après vérification qu'aucun compte ne les porte.

### DAT-003 — P2 — Valeurs par défaut « de démonstration » dans le schéma
- `Room.pricePerNight @default(35000)`, `surfaceM2 @default(25)`, `view @default("jardin")` (`:136-143`), `Guest.nationality @default("Sénégalaise")` (`:171`).
- **Risque** : une chambre créée sans prix part à 35 000 FCFA sans que personne l'ait décidé. **Correction** : rendre le prix obligatoire à la création. **Effort** : petit.

### DAT-004 — P2 — Dates de naissance et d'expiration stockées en texte
- `Guest.birthDate`, `idDocumentExpiry` en `String` (`:179-180`). Aucun contrôle de format en base. **Peut attendre.**

### DAT-005 — Non vérifié — Migrations rejouables
- Les 21 migrations sont appliquées sur la base de développement (constat de session). Le rejeu sur une base vide n'a pas été lancé pendant cet audit (il écrirait dans une base). À faire dans le lot 1 sur la base de test.

### DAT-006 — P1 — Données de test dans le code livré
- Faux clients dans `planning-mock.service.ts:48-211` ; service de tableau de bord fictif `dashboard-mock.service.ts` (seulement utilisé par son test). Voir INT-007.
- `prisma/seed.ts` et `npm run seed` (`package.json:16`) : contenu non relu dans cet audit ; **ne jamais lancer en production** sans relecture.

## 3. Qualité du code
- **TODO / FIXME** : 7 occurrences dans `apps/api/src` et `apps/web/src`, dont 2 fausses (le planning parle déjà à l'API : `planning-mock.service.ts:29` ; `dashboard-mock.service.ts:11`).
- **Fichiers énormes (> 1 000 lignes)** : `restaurant.service.ts` (2 124), `billing.service.ts` (1 949) et 9 composants web (liste dans 02-INTERFACES, INT-008).
- **Code mort** : 6 routes de modules reportés qui ouvrent le tableau de bord (`app.routes.ts:164-226`) ; contrôleur de test (SEC-001) ; routes `/users` (SEC-004).

## 4. Performance, accessibilité, responsive
- Budgets de taille et exclusion des modules reportés : script `scripts/test-bundle-budgets-and-exclusion.mjs` présent, non relancé.
- N+1 : non recherché en détail. Le planning charge **toutes** les réservations d'un coup (`GET /api/reservations`, `planning-mock.service.ts:246`) ; avec 12 chambres c'est acceptable pendant plusieurs années. **Peut attendre.**
- Contrastes, clavier, lecteurs d'écran : **non vérifiés**.
- Défilement horizontal 360/768/1024/1440 px : couvert par des tests E2E récents (Cuisine, cloche) ; non relancé ici.
