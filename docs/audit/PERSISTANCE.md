# Audit de Persistance des Données — Résidence Blue (Thiès)

Ce document recense l'état de la persistance de chaque donnée métier de l'application **Résidence Blue** avant et après l'audit et le branchement complet sur PostgreSQL 16 via NestJS et Prisma.

---

## 1. Inventaire Initial (AVANT corrections)

| Module | Donnée concernée | Modèle Prisma correspondant (avant) | Route API CRUD (avant) | L'interface utilise-t-elle cette API ? (avant) | Stockage réel constaté (avant) | Verdict initial |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Utilisateurs et rôles** | Comptes utilisateurs, rôles, mots de passe hachés, statut actif | `User` (`users`), `RefreshToken` (`refresh_tokens`) | **Absente** (aucun `AuthController` ni `UsersController`) | **Non** | Tableau en dur `mockUsers` dans `AuthMockService` (mots de passe en clair dans le code) + `localStorage` (`residence_blue_auth_session`) | **À CORRIGER** |
| **Chambres et photos** | Numéro, catégorie, étage, statut, équipements, photo (`imageUrl`), actif (`isActive`) | `Room` (`rooms`), `RoomType` (`room_types`) | `GET/POST/PATCH/PUT/DELETE /api/rooms`, `GET /api/rooms/images/:filename` | **Partiellement** | Base PostgreSQL + fichiers sur disque (`uploads/rooms/`), mais repli automatique sur `SEED_ROOMS` en dur si la base est vide ; champs détaillés (capacité, lit, surface, vue, tarifs haute saison/corporate, petit-déjeuner, description, note interne) absents du modèle Prisma `Room` | **À CORRIGER** |
| **Clients** | Identité, téléphone, e-mail, nationalité, pièce d'identité chiffrée, préférences, notes | **Absent** | **Absente** | **Non** | Objet fictif en mémoire `defaultProfile` (Mamadou Diop) dans `GuestProfileService` et tableau `regularGuests` en dur dans `ReservationModalService` | **MANQUANT** |
| **Réservations et séjours** | Réservations, dates arrivée/départ, personnes, statut, acompte, total, check-in / check-out | **Absent** | **Absente** | **Non** | Tableau fictif `initialReservations` en mémoire dans `PlanningMockService` (modifications perdues au rechargement) | **MANQUANT** |
| **Planning** | Grille 7 jours des chambres et réservations, métriques du jour, détection de conflits | **Absent** (dépend de `Room` et `Reservation`) | **Absente** | **Non** | Calculé en mémoire dans `PlanningMockService` à partir de `initialReservations` et d'un catalogue statique de 12 chambres | **À CORRIGER** |
| **Restaurant : produits** | Catégories et plats/boissons du restaurant « La Teranga », prix FCFA, disponibilité, photos | **Absent** | **Absente** | **Non** | Signaux en mémoire `_categories` et `_dishes` dans `RestaurantMockService` + photos en base64 dans IndexedDB (`PhotoStorageService`) | **MANQUANT** |
| **Restaurant : commandes** | Tickets de commande et lignes de commande (liés à une table ou une chambre) | **Absent** | **Absente** | **Non** | Signal en mémoire `_ticketItems` dans `RestaurantMockService` | **MANQUANT** |
| **Facturation : factures** | Factures (folios), lignes de facture, sous-total HT, TVA, taxe de séjour, total TTC, solde | **Absent** | **Absente** | **Non** | Signaux en mémoire `_lineItems` et `_closedFolios` dans `FacturationMockService` | **MANQUANT** |
| **Facturation : paiements** | Règlements (Espèces, Wave, Orange Money, Carte, Virement), référence de transaction, date | **Absent** | **Absente** | **Non** | Signaux en mémoire dans `FacturationMockService` (`inputWave`, `inputCash`, `inputOM`, `inputCard`) | **MANQUANT** |
| **Exports** | Génération PDF / Excel et historique des exports | `AuditLog` (`audit_log`) existant mais non utilisé par `ExportsService` | `GET /api/exports/download`, `GET /api/exports/audit` | **Partiellement** | Données d'export codées en dur dans `ExportsService` (`sampleRooms`, `sampleClients`, `sampleSales`) et journal en mémoire `this.auditLogs = []` | **À CORRIGER** |
| **Paramètres** | Informations de l'hôtel, NINEA, RCCM, tarifs, TVA (10 %), taxe de séjour (1 000 FCFA) | **Absent** | **Absente** | **Non** | Signal en mémoire `_settings` dans `HotelSettingsService` | **MANQUANT** |
| **Journal d'actions** | Traçabilité append-only des actions sensibles (création, modification, suppression) | `AuditLog` (`audit_log`) avec trigger PostgreSQL append-only | `GET /api/exports/audit` | **Partiellement** | Utilisé pour la suppression de chambre (`ROOM_DELETE`), mais absent des autres opérations et non branché dans `ExportsService` | **À CORRIGER** |

---

## 2. Inventaire Final (APRÈS corrections)

| Module | Donnée concernée | Modèle Prisma correspondant (après) | Route API CRUD (après) | L'interface utilise-t-elle cette API ? (après) | Stockage réel constaté (après) | Verdict final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Utilisateurs et rôles** | Comptes utilisateurs, rôles (`DIRECTION`, `RECEPTION`, `RESTAURANT`, `SERVEUR`, `CUISINE`, `HOUSEKEEPING`, `MAINTENANCE`, `COMPTABLE`), mots de passe hachés (`scrypt`), statut actif | `User` (`users`), `RefreshToken` (`refresh_tokens`) | `POST /api/auth/login`, `GET/POST/PATCH/DELETE /api/users` | **Oui** (`AuthMockService` branché sur `/api/auth/login` et `/api/users`) | Base PostgreSQL (`users`) + jeton de session locale | **OK** |
| **Chambres et photos** | Numéro unique, étage, catégorie, statut, capacités, lit, surface, vue, équipements, tarifs, petit-déjeuner inclus, chemin photo (`imageUrl`), description, note interne, actif (`isActive`) | `Room` (`rooms`), `RoomType` (`room_types`) | `GET/POST/PATCH/PUT/DELETE /api/rooms`, `PATCH /api/rooms/:id/status`, `GET /api/rooms/images/:filename` | **Oui** (`RoomsService` branché sur `/api/rooms` + cache hors-ligne IndexedDB) | Base PostgreSQL (`rooms`, `room_types`) + fichiers uniques UUID sur disque (`uploads/rooms/`) | **OK** |
| **Clients** | Identité, téléphone, e-mail, nationalité, pièce d'identité chiffrée en AES-256-GCM (`idDocumentEncrypted`), préférences, notes | `Guest` (`guests`) | `GET/POST/PATCH/DELETE /api/guests` | **Oui** (`GuestProfileService` branché sur `/api/guests`) | Base PostgreSQL (`guests`) avec chiffrement AES-256-GCM des pièces d'identité | **OK** |
| **Réservations et séjours** | Client, chambre, dates arrivée/départ, personnes, statut, acompte, total FCFA, créateur, check-in / check-out, trigger PostgreSQL anti-chevauchement (`trg_prevent_reservation_overlap`) | `Reservation` (`reservations`) | `GET/POST/PATCH/DELETE /api/reservations`, `POST /api/reservations/:id/check-in`, `POST /api/reservations/:id/check-out` | **Oui** (`PlanningMockService` branché sur `/api/reservations`) | Base PostgreSQL (`reservations`) avec protection transactionnelle et trigger SQL anti-chevauchement | **OK** |
| **Planning** | Grille 7 jours des chambres et réservations, métriques temps réel, détection de conflits | `Room` (`rooms`) + `Reservation` (`reservations`) | `GET /api/rooms`, `GET /api/reservations` | **Oui** (`PlanningMockService` synchronisé sur `/api/reservations` et `/api/rooms`) | Base PostgreSQL (`rooms`, `reservations`) | **OK** |
| **Restaurant : produits** | Catégories (`RestaurantCategory`) et plats/boissons (`RestaurantProduct`), prix FCFA entiers, station, allergènes, chemin photo (`imageUrl`) sur disque (`uploads/restaurant/`) | `RestaurantCategory` (`restaurant_categories`), `RestaurantProduct` (`restaurant_products`) | `GET/POST /api/restaurant/categories`, `GET/POST/PATCH/DELETE /api/restaurant/products`, `GET /api/restaurant/images/:filename` | **Oui** (`RestaurantMockService` branché sur `/api/restaurant/*`) | Base PostgreSQL (`restaurant_categories`, `restaurant_products`) + fichiers photo sur disque | **OK** |
| **Restaurant : commandes** | Tickets de commande (`RestaurantOrder`) et lignes (`RestaurantOrderLine`) liés à une table ou une chambre | `RestaurantOrder` (`orders`), `RestaurantOrderLine` (`order_lines`) | `GET/POST /api/restaurant/orders`, `PATCH /api/restaurant/orders/:id/status` | **Oui** (`RestaurantMockService` branché sur `/api/restaurant/orders`) | Base PostgreSQL (`orders`, `order_lines`) | **OK** |
| **Facturation : factures** | Factures (`Invoice`) et lignes de facture (`InvoiceLine`), calcul strict HT / TVA 10 % / Taxe de séjour / Total TTC / Solde | `Invoice` (`invoices`), `InvoiceLine` (`invoice_lines`) | `GET/POST /api/invoices`, `POST /api/invoices/:id/lines`, `DELETE /api/invoices/lines/:lineId` | **Oui** (`FacturationMockService` branché sur `/api/invoices`) | Base PostgreSQL (`invoices`, `invoice_lines`) | **OK** |
| **Facturation : paiements** | Règlements (`Payment` : `CASH`, `WAVE`, `ORANGE_MONEY`, `CARD`, `BANK_TRANSFER`), référence de transaction, date, mise à jour atomique du solde de facture | `Payment` (`payments`) | `POST /api/invoices/:id/payments` | **Oui** (`FacturationMockService` branché sur `/api/invoices/:id/payments`) | Base PostgreSQL (`payments`, `invoices`) | **OK** |
| **Exports** | Génération PDF / Excel et historique des exports | `AuditLog` (`audit_log`) | `GET /api/exports/download`, `GET /api/exports/audit` | **Oui** | Base PostgreSQL (`audit_log` alimenté à chaque génération d'export via `PrismaService`) | **OK** |
| **Paramètres** | Informations de l'hôtel, NINEA, RCCM, tarifs, TVA (10 %), taxe de séjour (1 000 FCFA) | `HotelSetting` (`hotel_settings`) | `GET/PATCH /api/hotel-settings` | **Oui** (`HotelSettingsService` branché sur `/api/hotel-settings`) | Base PostgreSQL (`hotel_settings`) | **OK** |
| **Journal d'actions** | Traçabilité append-only des actions sensibles (utilisateurs, chambres, clients, réservations, restaurant, facturation, exports, paramètres) | `AuditLog` (`audit_log`) avec trigger PostgreSQL append-only (`trg_audit_log_append_only`) | `GET /api/exports/audit` | **Oui** | Base PostgreSQL (`audit_log` en ajout seul) | **OK** |

---

## 3. Résultat du script `scripts/verifier-integrite.ts`

```text
================================================================
🔍 VÉRIFICATION D’INTÉGRITÉ — RÉSIDENCE BLUE (THIÈS)
================================================================

1. Contrôle des photos de chambres (12 chambres inspectées) :
   - Fichiers téléversés référencés : 0
   - Fichiers orphelins dans uploads/rooms : 0
2. Contrôle des réservations (3 réservations) :
   - Réservations actives contrôlées : 3
3. Contrôle des factures et paiements (2 factures) :
   - Cohérence lignes / acomptes / paiements vérifiée.
4. Contrôle des comptes utilisateurs (8 comptes) :
   - Rôles et hachages cryptographiques vérifiés.

5. Nombre de lignes par table PostgreSQL :
┌─────────┬─────────────────────────┬────────┐
│ (index) │ Table                   │ Lignes │
├─────────┼─────────────────────────┼────────┤
│ 0       │ 'users'                 │ 8      │
│ 1       │ 'refresh_tokens'        │ 0      │
│ 2       │ 'room_types'            │ 3      │
│ 3       │ 'rooms'                 │ 12     │
│ 4       │ 'guests'                │ 3      │
│ 5       │ 'reservations'          │ 3      │
│ 6       │ 'invoices'              │ 2      │
│ 7       │ 'invoice_lines'         │ 8      │
│ 8       │ 'payments'              │ 1      │
│ 9       │ 'restaurant_categories' │ 5      │
│ 10      │ 'restaurant_products'   │ 8      │
│ 11      │ 'orders'                │ 1      │
│ 12      │ 'order_lines'           │ 2      │
│ 13      │ 'hotel_settings'        │ 1      │
│ 14      │ 'audit_log'             │ 228    │
│ 15      │ 'sync_operations'       │ 0      │
└─────────┴─────────────────────────┴────────┘

✅ AUCUNE ANOMALIE DÉTECTÉE : Intégrité images & base de données 100 % conforme.
```

---

## 4. Comparatif du nombre de lignes par table (AVANT vs APRÈS)

| Table PostgreSQL | Nombre de lignes (AVANT) | Nombre de lignes (APRÈS seed) |
| :--- | ---: | ---: |
| `users` | 2 | **8** |
| `refresh_tokens` | 0 | **0** |
| `room_types` | 3 | **3** |
| `rooms` | 12 | **12** |
| `guests` | *(table absente)* | **3** |
| `reservations` | *(table absente)* | **3** |
| `invoices` | *(table absente)* | **2** |
| `invoice_lines` | *(table absente)* | **8** |
| `payments` | *(table absente)* | **1** |
| `restaurant_categories` | *(table absente)* | **5** |
| `restaurant_products` | *(table absente)* | **8** |
| `orders` | *(table absente)* | **1** |
| `order_lines` | *(table absente)* | **2** |
| `hotel_settings` | *(table absente)* | **1** |
| `audit_log` | 104 | **228** |
| `sync_operations` | 0 | **0** |
