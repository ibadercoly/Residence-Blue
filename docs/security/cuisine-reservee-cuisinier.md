# Porte de sécurité — Cuisine strictement réservée au Cuisinier

**Branche :** `fix/cuisine-reservee-cuisinier`
**Périmètre :** Écran `/cuisine`, routes API `/api/cuisine/*`, `/api/restaurant/kitchen/orders`, `/api/restaurant/orders/stream`, `/api/cuisine/stream`, actions cuisine (`PATCH /api/restaurant/orders/:id/status`), administration des comptes (`/administration`), et migration Prisma `20261116164500_cuisine_reservee_cuisinier`.

---

## 1. Surface d’attaque et contrôles vérifiés

| Menace testée | Défense implémentée | Vérification |
| :--- | :--- | :--- |
| **Accès à l’écran `/cuisine` par un compte non-cuisinier (y compris `DIRECTION`)** | `hasScreenAccess(..., 'cuisine', ...)` et `getAuthorizedScreens()` (`packages/shared/src/access.ts`) n’autorisent `cuisine` que pour `isKitchenAccount(user)` (`Role.CUISINIER` / legacy `CUISINE`), même si `isPrimaryAdmin` ou `role === DIRECTION` est vrai. `AuthGuard` redirige vers le premier écran autorisé. | Tests unitaires `access.spec.ts` + E2E Playwright `cuisine-reservee-cuisinier.spec.ts` (6 profils : `DIRECTION`, `RECEPTION`, `RESTAURANT`, `COMPTABLE`, `HOUSEKEEPING`, `MAINTENANCE`) + `menu-lateral.spec.ts`. |
| **Appels API directs sur `/api/cuisine/*` ou `/api/restaurant/kitchen/orders` avec un jeton valide non-cuisinier** | `RolesGuard` retourne `403` avec le message exact « Cet écran est réservé au cuisinier » sur `@Acces('cuisine', ...)` ; double contrôle `isKitchenAccount(user)` dans `CuisineController` et `RestaurantController`. | Intégration `restaurant-v3.e2e-spec.ts` et `administration-comptes.e2e-spec.ts` (`403` vérifié pour `DIRECTION`, `RECEPTION`, `RESTAURANT`, `COMPTABLE`, `HOUSEKEEPING`, `MAINTENANCE`) + Playwright `cuisine-reservee-cuisinier.spec.ts`. |
| **Exécution d’actions de cuisine (`IN_PREPARATION`, temps de préparation, `+5 min`, plat indisponible, `READY`) par `DIRECTION` ou `RESTAURANT`** | `RestaurantService.updateOrder` rejette en `403` « Cet écran est réservé au cuisinier » toute action cuisine si `!isKitchen`, tout en conservant `AUTHORIZED`, `SERVED`, `CANCELLED` et l’encaissement pour `RESTAURANT`, `RECEPTION` et `DIRECTION`. | Intégration `restaurant-v3.e2e-spec.ts` + Playwright `cuisine-reservee-cuisinier.spec.ts` (flux complet assistant -> cuisinier -> assistant). |
| **Écoute du flux SSE Cuisine par un non-cuisinier, ou accès Restaurant (API / SSE) par le Cuisinier** | `GET /api/cuisine/stream` (`CuisineController`) est réservé strictement au Cuisinier (`explicitHideAmounts = true`, coupure sur `sessionRevocation`). `GET /api/restaurant/orders/stream` et `GET /api/restaurant/orders/page` excluent `cuisine` (`403` pour `CUISINIER`). | Intégration `restaurant-v3.e2e-spec.ts` + Playwright `cuisine-reservee-cuisinier.spec.ts` (`403` sur `/api/restaurant/orders/page` et `/api/restaurant/orders/stream` pour `CUISINIER`, zéro prix/client dans `/api/cuisine/*`). |
| **Attribution du droit `cuisine` à un autre profil ou élargissement du profil `CUISINIER`** | `AdministrationService.enforceProfileAccessRules` refuse (`403` « Seul le cuisinier voit la cuisine ») toute attribution `cuisine != 'AUCUN'` aux profils non-cuisiniers, et force le profil `CUISINIER` à `cuisine: 'ECRITURE'` uniquement sans droits particuliers (`403` si élargissement). UI `AdministrationCompteFormPageComponent` grise `Cuisine` et verrouille les autres écrans du Cuisinier. | Intégration `administration-comptes.e2e-spec.ts` + Playwright `cuisine-reservee-cuisinier.spec.ts`. |
| **Navigation du Cuisinier hors `/cuisine` ou fuite de données sensibles** | `AuthGuard` redirige toute URL hors `/cuisine` vers `/cuisine` pour `isKitchenAccount(user)` (y compris `/administration`, `/restaurant`, `/accueil`). Barre latérale réduite (logo, Cuisine, nom, déconnexion), aucune barre du bas à `360 px`, aucun lien « Prise de commande ». | Playwright `cuisine-reservee-cuisinier.spec.ts` (9 URL testées + 360/768/1024/1440 px) + `cuisine-nouveau-design.spec.ts`. |
| **Migration SQL sans perte & traçabilité** | Migration `20261116164500_cuisine_reservee_cuisinier` retire `cuisine` à tous les comptes non-cuisiniers (y compris `DIRECTION`), normalise les comptes `CUISINIER`, et écrit les entrées chaînées `MIGRATION_CUISINE_RESERVEE_CUISINIER` dans `audit_log`. | Migration exécutée sur `residence_blue_e2e` avec vérification des enregistrements `audit_log`. |

---

## 2. Vérifications exécutées sur la base de test (`residence_blue_e2e`)

- **Lint (`npm run lint`) :** succès (0 erreur sur `@residence-blue/shared`, `@residence-blue/api`, `@residence-blue/web` ; 1 avertissement `hasScreenAccess` inutilisé dans `restaurant.controller.ts`).
- **Build (`npm run build`) :** `build:shared`, `build:api`, `build:web` réussis (`50.57 Ko` gzip pour le bundle initial).
- **Tests unitaires (`npm run test:unit`) :**
  - `@residence-blue/shared` : 3/3 suites, 31/31 tests réussis.
  - `@residence-blue/api` : 7/7 suites, 31/31 tests réussis.
  - `@residence-blue/web` : 24/24 suites, 137/137 tests réussis.
- **Tests d’intégration (`npm run test:integration`) :** 18/18 suites, 123/123 tests réussis.
- **Porte de sécurité (`npm run test:security`) :** 17/17 suites API, 121/121 tests réussis + `scripts/test-securite-photos.mjs` + `scripts/test-bundle-budgets-and-exclusion.mjs` réussis.
- **Tests E2E Playwright :** 5 fichiers exécutés (`cuisine-reservee-cuisinier.spec.ts`, `menu-lateral.spec.ts`, `cuisine-nouveau-design.spec.ts`, `administration-comptes.spec.ts`, `menage-verrouillage.spec.ts`) — 8/8 tests réussis, 0 échec, 0 ignoré.
