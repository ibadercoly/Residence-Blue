# Porte de Sécurité : Module Chambres (`feature/chambres`)

## 1. Périmètre audité
Ce document consigne les tests offensifs, les vecteurs d'attaque et les contrôles de sécurité exécutés sur le module de gestion des 12 chambres de **Résidence Blue** (Grand Standing, Thiès) :
- **Modèles Prisma (`apps/api/prisma/schema.prisma`)** : `RoomType` (`id` UUID, `name` unique, `pricePerNight` entier FCFA), `Room` (`id` UUID, `number` unique, `typeId` UUID relation, `floor` entier, `status` enum `RoomStatus`, `amenities` string array).
- **Permissions PostgreSQL 16 & RBAC Déclaratif** : l'API tourne sous `app_user` (SELECT/INSERT/UPDATE/DELETE, aucun DDL, droits stricts sur `room_types` et `rooms`).
- **Endpoints audités** :
  - `GET /rooms` & `GET /rooms/:id` : Consultation de la grille et des détails d'une chambre.
  - `PATCH /rooms/:id/status` : Transition de statut de chambre protégée par RBAC et machine à états finis.
  - `POST /rooms/types` & `PATCH /rooms/types/:id` : Création et modification des tarifs, strictement réservées au rôle `DIRECTION`.
- **Journal d'audit immuable (`audit_log`)** : Enregistrement systématique de chaque changement de statut avec instantanés `before` et `after`. Table en ajout seul protégée par trigger SQL et révocation DML.
- **Frontend PWA Offline-First (`apps/web`)** : Stockage local IndexedDB, file d'attente sortante (outbox) avec clés d'idempotence UUID côté client et réconciliation au retour du réseau.

---

## 2. Attaques exécutées et résultats (Porte de Sécurité)

### Attaque 1 : Changement de statut avec une valeur invalide
- **Vecteur testé** : Envoi de valeurs de statut inexistantes ou hors-enum (`INVALID_STATUS`, `AVAILABLE`, `DIRTY`, payload vide, booléen) sur `PATCH /rooms/:id/status`.
- **Preuve automatisée** : Suite `apps/api/test/rooms.e2e-spec.ts` (section *Sécurité & Robustesse*).
- **Contrôle appliqué** : `ValidationPipe` NestJS avec décorateur `@IsEnum(RoomStatus, { message: ... })`.
- **Résultat** : **BLOQUÉ** (`400 Bad Request`). Le serveur rejette le payload avant tout traitement métier.

### Attaque 2 : Changement de statut avec un ID inexistant ou corrompu
- **Vecteur testé** :
  1. ID UUID syntaxiquement valide mais n'appartenant à aucune chambre (`00000000-0000-0000-0000-000000000999`).
  2. ID corrompu avec tentative d'injection de chemin ou SQL (`' OR 1=1 --`, `../secret`, `invalid-id`).
- **Preuve automatisée** : Suite `apps/api/test/rooms.e2e-spec.ts`.
- **Contrôle appliqué** : Validation UUID stricte (`UUID_REGEX`) et requête Prisma paramétrée.
- **Résultat** : **BLOQUÉ** (`404 Not Found` pour un UUID inexistant, `400 Bad Request` pour un ID invalide). Aucune erreur 500 n'est générée.

### Attaque 3 : Changement de statut avec un rôle non autorisé (RBAC Deny-by-default)
- **Vecteur testé** :
  1. Rôles transverses n'ayant aucun droit sur le statut des chambres (`RESTAURANT`, `COMPTABLE`).
  2. Requête anonyme (sans rôle authentifié).
- **Preuve automatisée** : Suite `apps/api/test/rooms.e2e-spec.ts` (section *RBAC et habilitations*).
- **Contrôle appliqué** : `@Roles(Role.DIRECTION, Role.RECEPTION, Role.HOUSEKEEPING, Role.MAINTENANCE)` combiné avec le `RolesGuard` NestJS.
- **Résultat** : **BLOQUÉ** (`403 Forbidden`). Accès refusé par défaut.

### Attaque 4 : Transition de statut interdite par la machine à états métier
- **Vecteur testé** :
  1. Transition directe `OCCUPIED -> FREE` tentée par `RECEPTION`, `HOUSEKEEPING` ou même `DIRECTION` (contournement du ménage obligatoire).
  2. Transition `CLEANING -> OCCUPIED` (installation d'un client dans une chambre sale).
  3. Transition `MAINTENANCE -> OCCUPIED` (installation d'un client dans une chambre en panne).
  4. Transition hors prérogatives pour la Gouvernance (`HOUSEKEEPING` tentant un Check-in `FREE -> OCCUPIED`).
- **Preuve automatisée** :
  - `packages/shared/src/__tests__/rooms.spec.ts` (19 tests unitaires).
  - `apps/api/src/rooms/rooms.service.spec.ts` (15 tests de service).
  - `apps/api/test/rooms.e2e-spec.ts` (tests d'intégration).
  - `apps/web/e2e/rooms.spec.ts` (test E2E navigateur).
- **Contrôle appliqué** : Fonction pure `isRoomStatusTransitionAllowed(from, to, role)` selon la matrice `docs/roles.md`.
- **Résultat** : **BLOQUÉ** (`400 Bad Request` avec explication métier claire en français).

### Attaque 5 : Création ou altération d'un tarif de chambre par un rôle non Direction
- **Vecteur testé** : Requêtes `POST /rooms/types` ou `PATCH /rooms/types/:id` émises avec les rôles `RECEPTION`, `HOUSEKEEPING`, `MAINTENANCE`, `RESTAURANT` ou `COMPTABLE`.
- **Preuve automatisée** : Suite `apps/api/test/rooms.e2e-spec.ts` (section *Tarifs & Privilèges DIRECTION*).
- **Contrôle appliqué** : Décorateur `@Roles(Role.DIRECTION)` exclusif sur les routes de tarification.
- **Résultat** : **BLOQUÉ** (`403 Forbidden`). Seule la DIRECTION est habilitée à définir les prix des nuitées.

### Attaque 6 : Injection de montant décimal dans les tarifs en FCFA
- **Vecteur testé** : Tentative de soumettre un prix décimal (`35000.50`, `49999.99`) ou négatif (`-5000`) sur `POST /rooms/types`.
- **Preuve automatisée** : Suite `apps/api/test/rooms.e2e-spec.ts`.
- **Contrôle appliqué** : Règle `AGENTS.md` (montants stockés en ENTIERS, jamais de décimaux). Décorateur `@IsInt({ message: 'Le prix par nuit doit être un entier en FCFA' })` et `@Min(0)`.
- **Résultat** : **BLOQUÉ** (`400 Bad Request`). L'intégrité monétaire en FCFA est garantie.

### Attaque 7 : Pollution de paramètres et injection d'attributs non déclarés
- **Vecteur testé** : Injection de champs frauduleux dans le corps de requête (`{ status: "OCCUPIED", isAdmin: true, role: "DIRECTION", discount: 50 }`).
- **Preuve automatisée** : Suite `apps/api/test/rooms.e2e-spec.ts`.
- **Contrôle appliqué** : `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
- **Résultat** : **BLOQUÉ** (`400 Bad Request : property isAdmin should not exist`).

### Attaque 8 : Tentative d'effacement ou de modification des traces d'audit de statut
- **Vecteur testé** :
  1. Vérification que chaque changement de statut insère une ligne dans `audit_log` avec `action: ROOM_STATUS_CHANGE`, l'ID de la chambre et l'instantané JSON `before` / `after`.
  2. Tentative de `UPDATE` ou `DELETE` sur cette ligne d'audit avec la connexion applicative `app_user`.
- **Preuve automatisée** : Suites `apps/api/test/rooms.e2e-spec.ts` et `apps/api/test/base-securisee.e2e-spec.ts`.
- **Contrôle appliqué** : Privilèges SQL restreints (`REVOKE UPDATE, DELETE`) + Trigger PostgreSQL `trg_audit_log_append_only`.
- **Résultat** : **BLOQUÉ** (`42501: must be owner of table` / exception trigger). Les traces d'audit des statuts de chambre sont immuables.

---

## 3. Synthèse de conformité

| Exigence | Statut | Preuve |
| :--- | :---: | :--- |
| Modèles Prisma `RoomType` (prix entier FCFA) et `Room` (statuts enum) | Vert | `apps/api/prisma/schema.prisma` |
| Migration SQL avec droits PostgreSQL appliqués pour `app_user` et `app_readonly` | Vert | `apps/api/prisma/migrations/20261108150000_chambres/migration.sql` |
| Seed des 12 chambres (Standard 35k, Deluxe 55k, Suite 95k) | Vert | `apps/api/prisma/seed.ts` vérifié en base PostgreSQL |
| Endpoints `GET /rooms`, `GET /rooms/:id`, `PATCH /rooms/:id/status` | Vert | `apps/api/src/rooms/rooms.controller.ts` |
| Tarifs réservés à `DIRECTION`, statuts selon la matrice `docs/roles.md` | Vert | `@Roles()` guard sur toutes les routes |
| Interdiction stricte de transition `OCCUPIED -> FREE` sans nettoyage | Vert | Rejet 400 documenté et testé |
| Journalisation systématique dans `audit_log` (avant/après immuable) | Vert | Transaction Prisma + Trigger append-only |
| Écran frontend avec cartes, statuts, filtres, mode hors-ligne IndexedDB et outbox | Vert | `RoomsComponent` et `RoomsService` |
| Tests unitaires (19 shared + 15 service + 16 web) | Vert | 50 tests unitaires verts |
| Tests d'intégration API (38 tests) | Vert | `npm run test:integration --workspace=@residence-blue/api` |
| Tests de sécurité API (36 tests) | Vert | `npm run test:security --workspace=@residence-blue/api` |
| Tests E2E Playwright navigateur (8 tests dont 4 chambres offline-first) | Vert | `npx playwright test` |
