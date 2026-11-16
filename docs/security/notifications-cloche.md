# Porte de sécurité — Notifications dans la cloche (`fix/notifications-cloche`)

**Branche :** `fix/notifications-cloche`
**Périmètre :**
- Modèles Prisma `NotificationMessage` & `NotificationRead` et migrations sans perte `20261116200000_notifications_cloche`, `20261116212000_notification_order_cascade`
- Module API `NotificationsModule` (`GET /api/notifications`, `GET /api/notifications/stream`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`) et génération serveur des messages dans `RestaurantService`
- Service front `NotificationsService`, panneau `Messages` dans `HeaderComponent`, alerte importante unique 8 s + interrupteur son, suppression complète des bandeaux empilés dans `RestaurantPosPageComponent` et mise en évidence de la commande ciblée (`?highlightOrder=`).

---

## 1. Surface d’attaque et contrôles vérifiés

| Menace testée | Défense implémentée | Vérification |
| :--- | :--- | :--- |
| **Accès anonyme aux notifications ou au flux SSE (`401`)** | `JwtAuthGuard` + `RolesGuard` globaux (aucun `@Public()` sur `NotificationsController`). | Intégration & sécurité `notifications-cloche.e2e-spec.ts` (`401` sans jeton sur `GET /api/notifications`, `POST /api/notifications/read-all`). |
| **Accès au flux ou messages par le Cuisinier (`CUISINIER`) ou rôles sans droit Restaurant (`HOUSEKEEPING`, `MAINTENANCE`, `COMPTABLE`) (`403`)** | `@Acces('restaurant', 'LECTURE')` + contrôle serveur explicite `NotificationsService.canReceiveOrderNotifications(user)` rejetant tout compte `isKitchenAccount(user)` et tout rôle hors `DIRECTION` / `RECEPTION` / `RESTAURANT`. | Intégration `notifications-cloche.e2e-spec.ts` (`403` pour `CUISINIER`, `HOUSEKEEPING`, `MAINTENANCE`, `COMPTABLE` sur endpoints REST et `getUserStream`), unitaires `notifications.service.spec.ts`, E2E Playwright `notifications-cloche.spec.ts`. |
| **Fuite de prix, totaux FCFA ou nom de client de passage dans les messages ou flux SSE** | Textes générés exclusivement côté serveur sans aucun montant (`FCFA`, prix unitaire, total). Pour `TABLE` et `TAKEAWAY`, `guestName` n’est ni stocké ni transmis (`Table 4`, `À emporter N° ...`). | Unitaires `notifications.service.spec.ts`, intégration `notifications-cloche.e2e-spec.ts` (inspection JSON), E2E Playwright `notifications-cloche.spec.ts`. |
| **Fuite du nom client d’une chambre à un compte sans droit** | `NotificationsService.canSeeRoomGuestName(user)` conditionne l’ajout du nom client à `Chambre <num>` sur la permission effective de l’utilisateur (les rôles sans accès `voir_montants`/`clients` ne reçoivent que `Chambre <num>`). | Unitaires `notifications.service.spec.ts` (`Chambre 301, M. Diop` vs `Chambre 301` selon permissions). |
| **Injection / paramètres invalides sur `:id/read`** | `ParseUUIDPipe` sur `@Param('id')` (`400 Bad Request` si non-UUID), `ValidationPipe` global `whitelist + forbidNonWhitelisted`, requêtes Prisma paramétrées uniquement. | Intégration `notifications-cloche.e2e-spec.ts` (`400` sur `/api/notifications/not-a-uuid/read`). |
| **Duplication d’alerte `RETARD` ou désynchronisation lu/non lu multi-appareils** | Index partiel unique PostgreSQL `notification_messages_unique_retard_order_idx` sur `(order_id) WHERE type = 'RETARD'`, table `notification_reads` par `(notification_id, user_id)` avec émission SSE `NOTIFICATION_READ` / `NOTIFICATIONS_READ_ALL` ciblée sur `user.id`. | Unitaires `notifications.service.spec.ts`, intégration `notifications-cloche.e2e-spec.ts` (concurrence retard + sync deux jetons), Playwright `notifications-cloche.spec.ts` (2 navigateurs assistant synchronisés). |
| **Révocation de session en cours d’écoute SSE** | Flux `GET /api/notifications/stream` coupé immédiatement via `takeUntil(this.sessionRevocation.onUserRevoked(user.id))`. | `notifications.controller.ts` aligné sur `RoomsController` et `RestaurantController`. |
| **Écrasement audio automatique ou saturation d’alertes** | Son désactivé par défaut et bloqué avant toute interaction utilisateur (`userInteracted`), 1 seul encadré d’alerte importante affiché pendant 8 s (seuls `PRETE` et `PLAT_MANQUANT`). | Unitaires web `notifications.service.spec.ts` + E2E Playwright `notifications-cloche.spec.ts`. |

---

## 2. Vérifications exécutées sur la base de test (`residence_blue_e2e`)

- **Lint (`npm run lint`) :** succès (`0` erreur sur `@residence-blue/shared`, `@residence-blue/api`, `@residence-blue/web` ; 1 avertissement préexistant `hasScreenAccess` inutilisé dans `restaurant.controller.ts`).
- **Build (`npm run build`) :** `build:shared`, `build:api`, `build:web` réussis (`48,95 Ko` gzip pour le bundle JS initial).
- **Tests unitaires (`npm run test:unit`) :**
  - `@residence-blue/shared` : 3/3 suites, 31/31 tests réussis.
  - `@residence-blue/api` : 8/8 suites, 35/35 tests réussis.
  - `@residence-blue/web` : 25/25 suites, 141/141 tests réussis.
- **Tests d’intégration (`npm run test:integration`) :** 19/19 suites, 125/125 tests réussis (incluant `test/notifications-cloche.e2e-spec.ts`).
- **Porte de sécurité (`npm run test:security`) :** 18/18 suites API, 123/123 tests réussis + `scripts/test-securite-photos.mjs` + `scripts/test-bundle-budgets-and-exclusion.mjs` réussis.
- **Tests E2E Playwright :** 7 fichiers exécutés (`administration-comptes.spec.ts`, `cuisine-nouveau-design.spec.ts`, `cuisine-reservee-cuisinier.spec.ts`, `menage-alerts-realtime.spec.ts`, `menage-verrouillage.spec.ts`, `menu-lateral.spec.ts`, `notifications-cloche.spec.ts`) — 10/10 tests réussis (`0` échec, `0` ignoré).
