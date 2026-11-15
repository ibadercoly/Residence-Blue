# Matrice des rôles et habilitations côté serveur (`@Roles`)

Tous les points de terminaison sont protégés par les guards globaux :
1. `ModuleStatusGuard` — renvoie `404 Not Found` si le module est désactivé dans `config/modules.json`.
2. `JwtAuthGuard` — vérifie la signature HMAC-SHA256, l'expiration (15 min), l'état actif du compte (`isActive`), la session active (`sid`) et l'inactivité (≤ 30 min). Renvoie `401 Unauthorized` si absent, falsifié, expiré ou révoqué. L'en-tête `x-user-role` est strictement ignoré.
3. `RolesGuard` — politique **Accès refusé par défaut (`403 Forbidden`)** : toute route sans `@Public()` ni `@Roles(...)` est rejetée. Vérifie que le rôle du jeton signé appartient à `@Roles(...)` et est activé côté serveur.

| Domaine | Méthode & Route | Décorateur / Rôles autorisés | Rôles refusés (`403`) |
| :--- | :--- | :--- | :--- |
| **Santé** | `GET /health`, `GET /api/health` | `@Public()` | — |
| **Authentification** | `POST /api/auth/login` | `@Public()` (limité par compte & IP, argon2id) | — |
| **Authentification** | `POST /api/auth/refresh` | `@Public()` (cookie `httpOnly`, `Secure`, `SameSite=Strict`, rotation + détection de réutilisation) | — |
| **Authentification** | `POST /api/auth/logout` | `@Public()` (révoque la famille de jetons et supprime le cookie) | — |
| **Authentification** | `GET /api/auth/me` | `@Roles(Tous rôles actifs)` | Sans jeton (`401`) |
| **Sessions / Appareils** | `GET /api/auth/sessions` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Sessions / Appareils** | `GET /api/auth/my-sessions` | `@Roles(Tous rôles actifs)` | Sans jeton (`401`) |
| **Sessions / Appareils** | `DELETE /api/auth/sessions/:familyId` | `@Roles(Tous rôles actifs)` (autre utilisateur réservé à `DIRECTION`) | Autre utilisateur si non `DIRECTION` |
| **Utilisateurs** | `GET /api/users`, `GET /api/users/:id`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Audit immuable** | `GET /api/audit/logs`, `GET /api/audit/verify` | `@Roles(DIRECTION, COMPTABLE)` | `RECEPTION`, `RESTAURANT`, `SERVEUR`, `CUISINE`, etc. |
| **Paramètres hôtel** | `GET /api/hotel-settings` | `@Public()` (nom/téléphone sur écran connexion) | — |
| **Paramètres hôtel** | `PATCH /api/hotel-settings` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Chambres** | `GET /api/rooms`, `GET /api/rooms/:id` | `@Roles(DIRECTION, RECEPTION, HOUSEKEEPING, MAINTENANCE, RESTAURANT, COMPTABLE)` | `SERVEUR`, `CUISINE` |
| **Chambres** | `GET /api/rooms/available` | `@Roles(DIRECTION, RECEPTION)` | `RESTAURANT`, `SERVEUR`, `CUISINE`, `COMPTABLE`, etc. |
| **Chambres** | `GET /api/rooms/images/:filename` | `@Public()` (validation stricte UUID + extension) | — |
| **Chambres** | `POST /api/rooms`, `PATCH/PUT /api/rooms/:id`, `DELETE /api/rooms/:id`, `DELETE /api/rooms/:id/image` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Chambres** | `PATCH /api/rooms/:id/status` | `@Roles(DIRECTION, RECEPTION, HOUSEKEEPING, MAINTENANCE)` | `RESTAURANT`, `SERVEUR`, `CUISINE`, `COMPTABLE` |
| **Catégories chambres** | `POST /api/room-types`, `PATCH /api/room-types/:id` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Clients** | `GET /api/guests`, `search`, `check-duplicate`, `:id`, `:id/stays` | `@Roles(DIRECTION, RECEPTION)` (pièces d'identité masquées `****XXXX`) | `RESTAURANT`, `SERVEUR`, `CUISINE`, `COMPTABLE`, etc. |
| **Clients** | `POST /api/guests`, `PATCH /api/guests/:id` | `@Roles(DIRECTION, RECEPTION)` | `RESTAURANT`, `SERVEUR`, `CUISINE`, `COMPTABLE`, etc. |
| **Clients (pièce d'ID)** | `POST /api/guests/:id/reveal-document` | `@Roles(DIRECTION, RECEPTION)` (déchiffrement AES-256-GCM journalisé) | `RESTAURANT`, `SERVEUR`, `CUISINE`, `COMPTABLE`, etc. |
| **Clients** | `DELETE /api/guests/:id` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Réservations** | `GET /api/reservations`, `:id`, `POST /api/reservations` (`Idempotency-Key`), `PATCH`, `check-in`, `check-out`, `cancel` | `@Roles(DIRECTION, RECEPTION)` | `RESTAURANT`, `SERVEUR`, `CUISINE`, `COMPTABLE`, etc. |
| **Réservations** | `DELETE /api/reservations/:id` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Restaurant** | `GET /api/restaurant/catalog`, `categories`, `products`, `orders`, `orders/page`, `orders/stream` | `@Roles(DIRECTION, RECEPTION, RESTAURANT, SERVEUR, CUISINE, COMPTABLE)` (`stream` sans `COMPTABLE`) | `HOUSEKEEPING`, `MAINTENANCE` (`403`) |
| **Restaurant** | `GET /api/restaurant/rooms-in-stay` | `@Roles(DIRECTION, RECEPTION, RESTAURANT, SERVEUR, COMPTABLE)` | `CUISINE`, `HOUSEKEEPING`, `MAINTENANCE` |
| **Restaurant** | `POST/PATCH/DELETE /api/restaurant/products*` (+ `/image`) | `@Roles(DIRECTION)` | `RESTAURANT`, `RECEPTION`, `SERVEUR`, `CUISINE`, `COMPTABLE`, `HOUSEKEEPING`, `MAINTENANCE` |
| **Restaurant** | `GET /api/restaurant/products/images/:filename` | `@Public()` (validation stricte UUID `.webp`) | — |
| **Restaurant** | `POST /api/restaurant/orders`, `POST /api/restaurant/orders/:id/pay` (`Idempotency-Key`) | `@Roles(DIRECTION, RECEPTION, RESTAURANT, SERVEUR)` | `CUISINE`, `COMPTABLE`, `HOUSEKEEPING`, `MAINTENANCE` |
| **Restaurant** | `POST /api/restaurant/orders/:id/cancel` | `@Roles(DIRECTION, RECEPTION)` (motif obligatoire) | `RESTAURANT`, `SERVEUR`, `CUISINE`, `COMPTABLE`, `HOUSEKEEPING`, `MAINTENANCE` |
| **Restaurant** | `PATCH /api/restaurant/orders/:id`, `PATCH /api/restaurant/orders/:id/status` | `@Roles(DIRECTION, RECEPTION, RESTAURANT, SERVEUR, CUISINE)` (`CANCELLED` restreint à `DIRECTION`, `RECEPTION`) | `COMPTABLE`, `HOUSEKEEPING`, `MAINTENANCE` |
| **Facturation** | `GET /api/invoices/counter`, `GET /api/invoices/archives`, `GET /api/invoices`, `GET /api/invoices/:id`, `GET /api/invoices/:id/pdf` | `@Roles(DIRECTION, RECEPTION, COMPTABLE)` | `RESTAURANT`, `SERVEUR`, `CUISINE` |
| **Facturation** | `GET /api/invoices/cash-closure/export`, `GET /api/invoices/archives/export`, `POST /api/invoices/:id/credit-notes` | `@Roles(DIRECTION, COMPTABLE)` | `RECEPTION`, `RESTAURANT`, `SERVEUR`, `CUISINE` |
| **Facturation** | `POST /api/invoices`, `PATCH /api/invoices/:id/discount`, `POST /api/invoices/:id/payments` (`Idempotency-Key`), `POST checkout`, `POST issue`, `DELETE lines/:lineId` | `@Roles(DIRECTION, RECEPTION)` | `COMPTABLE`, `RESTAURANT`, `SERVEUR`, `CUISINE` |
| **Facturation** | `POST /api/invoices/room/:roomNumber/restaurant-charge`, `POST /api/invoices/:id/lines` | `@Roles(DIRECTION, RECEPTION, RESTAURANT)` | `COMPTABLE`, `SERVEUR`, `CUISINE` |
| **Facturation** | `POST /api/invoices/:id/payments/:paymentId/reverse`, `DELETE /api/invoices/:id` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Exports** | `GET /api/exports/audit` | `@Roles(DIRECTION)` | Tous les autres rôles |
| **Exports** | `GET /api/exports/download` | `@Roles(DIRECTION, RECEPTION)` + contrôle par type de document | `RESTAURANT`, `SERVEUR`, `CUISINE`, etc. |
| **Sécurité (test)** | `GET /api/security-test/undecorated-route` | Aucun décorateur -> `403 Forbidden` (avec jeton valide) | Tous les rôles |
