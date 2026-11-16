# Porte de sécurité — Administration, comptes et contrôle d’accès

**Branche :** `feature/administration-comptes`
**Périmètre :** `/administration/*`, `/api/administration/*`, `/api/auth/change-initial-password`, `@Acces(...)`, flux SSE et masquage des montants.

---

## 1. Surface d’attaque et contrôles vérifiés

| Menace testée | Défense implémentée | Vérification |
| :--- | :--- | :--- |
| **Escalade de privilèges / création d’un 2e admin** | DTO whitelisté (`forbidNonWhitelisted`), refus `403` si `starterProfile === 'DIRECTEUR'` ou `role === 'DIRECTION'`, index unique DB `users_single_primary_admin_idx`. | Test d’intégration (`POST /api/administration/comptes`, `POST /api/users` -> `403`). |
| **Altération ou suppression du compte directeur principal** | Vérification systématique `isPrimaryAdmin \|\| role === 'DIRECTION'` dans `AdministrationService` et `AuthService` -> `403` sur `DELETE`, désactivation, changement de profil ou réduction d’accès. | Tests directs `DELETE`, `POST /desactiver`, `PATCH` sur l’ID directeur -> `403`. |
| **Usurpation via en-tête client / payload** | `RolesGuard` lit exclusivement `request.user` hydraté depuis PostgreSQL par `JwtAuthGuard` à chaque requête. Aucun en-tête ou champ client pris en compte. | Tests API avec en-têtes falsifiés ignorés (`403`). |
| **Accès non autorisé aux routes métier / `/api/cuisine`** | Décorateur `@Acces(...)` appliqué à chaque contrôleur (`planning`, `cuisine`, `restaurant`, `billing`, `rapports`, `guests`, `rooms`, `accueil`, `exports`, `administration`). | Assistant restaurant -> `403` sur `/api/cuisine/orders` ; utilisateur sans `Planning` -> `403` sur `/api/reservations` + redirection UI. |
| **Effet immédiat lors de la modification ou désactivation** | `JwtAuthGuard` recharge `isActive`, `deletedAt`, `screenAccess`, `specialPermissions` en base à chaque requête ; `deactivateAccount` révoque tous les `RefreshToken` et émet `SessionRevocationService.notifyUserRevoked` qui ferme les flux SSE (`takeUntil`). | Test d’intégration + SSE réel : jeton déjà émis refusé (`401`) à la requête suivante, flux SSE fermé immédiatement, réactivation rétablit l’accès. |
| **Fuite de montants / données clients vers le cuisinier ou sans `voir_montants`** | `RestaurantService`, `AccueilService`, `BillingController`, `RoomsController`, `ReservationsController`, `RapportsController` masquent montants (`Fcfa`, `pricePerNight`, `totalTtcFcfa`) et données clients (`guestName`, `roomsInStay`, SSE). | Assertions HTTP + SSE `expect(payload)` sans prix ni nom de client pour Cuisinier. |
| **Changement d’e-mail ou mot de passe du directeur** | Vérifie `currentPassword` (argon2id) + `totpCode` si 2FA active, politique de force (`>= 10` car.), unicité d’e-mail, et révoque toutes les autres sessions actives. Limitation à 5 échecs (`429`). | Test sans `currentPassword` ou mauvais mot de passe -> `403`, avec bon mot de passe -> `200` + autres sessions révoquées. |
| **Exposition du mot de passe provisoire** | Généré par `crypto.randomInt`, haché `argon2id`, jamais stocké ni écrit dans `audit_log` ni renvoyé par `GET`. `mustChangePassword = true` bloque tout accès métier avant `/changer-mot-de-passe`. | Inspection base PostgreSQL, réponse `GET`, et `AuditLog` après création. |
| **Intégrité après suppression d’un compte** | Soft-delete conservant les relations historiques tout en libérant l’e-mail (`deleted.<id>@supprime...`) et en marquant `<Nom> (compte supprimé)` sur les réservations, paiements, commandes, événements et fiche utilisateur (table `audit_log` append-only jamais altérée). Exige nom exact + mot de passe du directeur. | Test E2E/API vérifiant conservation historique avec `(compte supprimé)` et réutilisation possible de l’e-mail libéré. |

---

## 2. Journal d’actions (AuditLog chaîné)

Toutes les opérations sensibles d’administration sont chaînées et enregistrées dans `audit_log` sans aucun secret :
- `ADMIN_COMPTE_CREE`
- `ADMIN_COMPTE_ACCES_MODIFIES`
- `ADMIN_MOT_DE_PASSE_REINITIALISE`
- `ADMIN_COMPTE_DESACTIVE`
- `ADMIN_COMPTE_REACTIVE`
- `ADMIN_COMPTE_SUPPRIME`
- `ADMIN_DIRECTEUR_IDENTIFIANTS_MODIFIES`
- `USER_INITIAL_PASSWORD_CHANGED`
