# Porte de sécurité — Parcours Ménage, verrouillage d’accès et alertes temps réel

**Branche :** `feature/menage-parcours`
**Périmètre :** Profil `MENAGE` (`Role.HOUSEKEEPING`), écran `/chambres`, transitions `/api/rooms/:id/status`, masquage des montants, et flux temps réel `/api/rooms/stream`.

---

## 1. Surface d’attaque et contrôles vérifiés

| Menace testée | Défense implémentée | Vérification |
| :--- | :--- | :--- |
| **Compte Ménage historique sans `screenAccess` (`null`) voyant Accueil ou Restaurant** | Migration SQL sans perte `20261116063000_menage_verrouillage_acces` normalisant `screenAccess` (`chambres: LECTURE`, tous les autres écrans `AUCUN`) et `specialPermissions` (`changer_etat_chambre: true`, `voir_montants: false`, `encaisser_paiement: false`, `annuler_commande_ou_reservation: false`). Repli strict côté serveur & partagé (`packages/shared/src/access.ts`). | Tests unitaires `access.spec.ts` + E2E Playwright `menage-verrouillage.spec.ts` (compte historique nul + compte récent). |
| **Escalade de privilèges depuis l’écran Administration** | `STARTER_PROFILES` (`packages/shared/src/access.ts`) verrouille le profil `MENAGE` (`lockedScreens: true`) côté interface (`AdministrationCompteFormPageComponent`) et côté serveur (`AdministrationService` force les écrans et permissions du profil `MENAGE`). | Tests API `administration-comptes.e2e-spec.ts` + E2E Playwright `menage-verrouillage.spec.ts`. |
| **Accès Restaurant, Accueil ou Administration par un compte Ménage** | Garde serveur `@Acces(...)` / `@Roles(...)` (`RolesGuard`) bloquant les routes Restaurant (`/api/restaurant/**`), Accueil (`/api/accueil/jour`) et Administration (`/api/administration/**`) en `403`. Navigation SPA nettoyée (aucun lien Restaurant, aucune tuile Accueil, garde route). | Tests d’intégration API `menage` / `rooms.e2e-spec.ts` + E2E Playwright `menage-verrouillage.spec.ts`. |
| **Fuite de prix (FCFA) ou données clients vers le Ménage** | `RoomsController` (`findAll`, `findAvailable`, `findOne`, `updateStatus`) masque les montants via `maskAmountsInPayload` si `!hasSpecialPermission(user, 'voir_montants')` ; `RoomsService` côté front annule tout tarif sans `voir_montants` ; `MenageChambresComponent` n’affiche ni prix ni nom client. | Tests unitaires `rooms.service.spec.ts` (`Masquage strict des tarifs`) + assertions HTTP `rooms.e2e-spec.ts` + Playwright `menage-parcours.spec.ts`. |
| **Remise en service non autorisée d’une chambre hors service (`MAINTENANCE -> FREE`)** | `isRoomStatusTransitionAllowed` (`packages/shared/src/rooms.ts`) interdit la sortie de `MAINTENANCE` à `HOUSEKEEPING` et `RECEPTION` (`403 Forbidden`, message en français simple). Seuls `DIRECTION` et `MAINTENANCE` (profil Technique) peuvent remettre en service ; motif enregistré dans `maintenance_reason` (migration `20261116080500_room_maintenance_reason`). | Tests unitaires `packages/shared/src/__tests__/rooms.spec.ts` + intégration `rooms.e2e-spec.ts` (24 tests) + Playwright `menage-parcours.spec.ts`. |
| **Accès non autorisé au flux SSE `/api/rooms/stream` ou fuite de données sensibles** | Route `@Get('stream') @Sse()` décorée uniquement avec `@Roles(Role.DIRECTION, Role.RECEPTION, Role.MAINTENANCE)` (sans `@Acces` qui contournerait `@Roles`). Le flux émet exclusivement `{ eventId, type, roomId, roomNumber, status, previousStatus, reason, timestamp }` sans tarif ni identité client. | Intégration `rooms-stream.e2e-spec.ts` (`401` anonyme, `403` pour `HOUSEKEEPING`, `RESTAURANT`, `CUISINIER`, `COMPTABLE` ; `200` et contenu vérifié pour `RECEPTION`, `DIRECTION`, `MAINTENANCE`) + Playwright `menage-alerts-realtime.spec.ts` (`401` / `403`). |
| **Persistance d’un flux SSE après révocation de session utilisateur** | `RoomsController.streamRoomStatus` coupe le flux par `takeUntil(this.sessionRevocation.onUserRevoked(user.id))` et `RoomsService` (front) stoppe la reconnexion sur HTTP `401` / `403`. | Intégration `rooms-stream.e2e-spec.ts` (`ferme immédiatement le flux SSE si la session utilisateur est révoquée`). |

---

## 2. Vérifications exécutées sur la base de test (`residence_blue_e2e`)

- **Lint :** `npm run lint` (`@residence-blue/shared`, `@residence-blue/api`, `@residence-blue/web`) — succès (0 erreur).
- **Build :** `npm run build:shared`, `npm run build:api`, `npm run build:web` — succès (bundle initial `50.40 Ko` gzip, sous le budget `250 Ko`).
- **Tests unitaires (`npm run test:unit`) :**
  - `@residence-blue/shared` : 3/3 suites, 30/30 tests réussis.
  - `@residence-blue/api` : 7/7 suites, 31/31 tests réussis.
  - `@residence-blue/web` : 24/24 suites, 136/136 tests réussis.
- **Tests d’intégration (`npm run test:integration`) :** 18/18 suites, 123/123 tests réussis (dont `rooms-stream.e2e-spec.ts` et `rooms.e2e-spec.ts`).
- **Porte de sécurité (`npm run test:security`) :** 17/17 suites API, 121/121 tests réussis + `test-securite-photos.mjs` + `test-bundle-budgets-and-exclusion.mjs` réussis.
- **Tests E2E Playwright :** 8 fichiers exécutés (`menage-alerts-realtime.spec.ts`, `menage-parcours.spec.ts`, `menage-verrouillage.spec.ts`, `chambres-etat-dans-menu.spec.ts`, `accueil-stats-du-jour.spec.ts`, `menu-lateral.spec.ts`, `deferred-modules.spec.ts`, `administration-comptes.spec.ts`) — 16 tests réussis, 1 ignoré (aucun échec).
