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

## 2. Nombre de lignes par table en base (AVANT corrections)

| Table PostgreSQL | Nombre de lignes (AVANT) |
| :--- | ---: |
| `users` | 2 |
| `refresh_tokens` | 0 |
| `room_types` | 3 |
| `rooms` | 12 |
| `audit_log` | 104 |
| `sync_operations` | 0 |
| `guests` | *(table absente)* |
| `reservations` | *(table absente)* |
| `invoices` | *(table absente)* |
| `invoice_lines` | *(table absente)* |
| `payments` | *(table absente)* |
| `restaurant_categories` | *(table absente)* |
| `restaurant_products` | *(table absente)* |
| `orders` | *(table absente)* |
| `order_lines` | *(table absente)* |
| `hotel_settings` | *(table absente)* |
