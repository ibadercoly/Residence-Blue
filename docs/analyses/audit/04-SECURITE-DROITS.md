# 04 — Sécurité et droits

Audit en lecture seule, 17/11/2026. Matrice établie **en lisant le code** (décorateurs `@Acces`, `@Roles`, `@Public` et profils de départ `packages/shared/src/access.ts:200-328`). Elle n'a **pas** été rejouée par appels HTTP pendant cet audit (les tests de sécurité existants le font ; non relancés ici).

## 1. Profils de départ (source : `packages/shared/src/access.ts`)
| Profil | Rôle | Écrans | Droits spéciaux |
|---|---|---|---|
| Directeur | DIRECTION | tous sauf Cuisine | tous |
| Assistant(e) de réception | RECEPTION | Accueil, Planning, Chambres, Clients, Facturation, Restaurant (modification) | montants, encaisser, état chambre, annuler (`:202-221`) |
| Assistant(e) du restaurant | RESTAURANT | Restaurant (modification) | montants, encaisser, annuler (`:224-243`) |
| Cuisinier | CUISINIER | Cuisine (modification) | aucun (`:246-261`) |
| Ménage | HOUSEKEEPING | Chambres (lecture) | état chambre (`:263-283`) |
| Technique | MAINTENANCE | Chambres (lecture) | état chambre (`:285-305`) |
| Comptable | COMPTABLE | Facturation, Rapports (lecture) | montants (`:307-327`) |

Les anciens rôles `CUISINE` et `SERVEUR` sont convertis en `CUISINIER` et `RESTAURANT` (`access.ts:330-333`).

## 2. Matrice rôle par route (lecture : 200 = autorisé, 403 = refusé, P = public)
Dir = Directeur, Réc = Réception, Rest = Restaurant, Cuis = Cuisinier, Mén = Ménage, Tech = Technique, Compt = Comptable.

| Route (préfixe `/api`) | Règle dans le code | Dir | Réc | Rest | Cuis | Mén | Tech | Compt |
|---|---|---|---|---|---|---|---|---|
| `POST auth/login`, `auth/refresh`, `auth/logout` | `@Public` (`auth.controller.ts:74-102`) | P | P | P | P | P | P | P |
| `GET health` | `@Public` (`health.controller.ts:9-10`) | P | P | P | P | P | P | P |
| `GET hotel-settings` | `@Public` (`settings.controller.ts:11-12`) | P | P | P | P | P | P | P |
| `PATCH hotel-settings` | directeur seul (`:18`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET auth/me`, `auth/my-sessions` | tous (`auth.controller.ts:115-146`) | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET auth/sessions`, `/users*` | `Role.DIRECTION` (`:138-197`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `administration/*` | directeur seul (`administration.controller.ts:26`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET accueil/jour` | accueil lecture (`accueil.controller.ts:14`) | 200 | 200 | 403 | 403 | 403 | 403 | 403 |
| `GET reservations*` | planning lecture (`reservations.controller.ts:26-34`) | 200 | 200 | 403 | 403 | 403 | 403 | 403 |
| `POST/PATCH reservations*`, check-in/out | planning écriture (`:42-73`) | 200 | 200 | 403 | 403 | 403 | 403 | 403 |
| `POST reservations/:id/cancel` | planning écriture + annuler (`:80`) | 200 | 200 | 403 | 403 | 403 | 403 | 403 |
| `DELETE reservations/:id` | directeur seul (`:87`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET guests*` | clients lecture (`guests.controller.ts:31-55`) | 200 | 200 | 403 | 403 | 403 | 403 | 403 |
| `POST guests/:id/reveal-document` | clients écriture (`:78`) | 200 | 200 | 403 | 403 | 403 | 403 | 403 |
| `DELETE guests/:id` | directeur seul (`:86`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET rooms`, `rooms/:id` | règle composée (`rooms.controller.ts:49`, `:156`) | 200 | 200 | non vérifié | 403 | 200 | 200 | non vérifié |
| `GET rooms/stream` (temps réel) | `DIRECTION, RECEPTION, MAINTENANCE` (`:122`) | 200 | 200 | 403 | 403 | **403** | 200 | 403 |
| `PATCH rooms/:id/status` | chambres lecture + état chambre (`:251`) | 200 | 200 | 403 | 403 | 200 | 200 | 403 |
| `POST/DELETE rooms`, `room-types` | directeur seul (`:172`, `:226`, `:285`, `:298`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET invoices*` | facturation lecture (`billing.controller.ts:69-139`) | 200 | 200 | 403 | 403 | 403 | 403 | 200 |
| `GET invoices/:id/pdf` | + voir montants (`:128`) | 200 | 200 | 403 | 403 | 403 | 403 | 200 |
| `POST invoices/:id/payments` | + encaisser (`:187`) | 200 | 200 | 403 | 403 | 403 | 403 | 403 |
| `POST …/payments/:id/reverse`, `DELETE invoices/:id` | directeur seul (`:199`, `:263`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `POST invoices/:id/credit-notes` | lecture + contrôle interne directeur ou comptable (`:236`, `:243`) | 200 | 403 | 403 | 403 | 403 | 403 | 200 |
| `POST invoices/room/:n/restaurant-charge` | facturation **ou** restaurant écriture (`:154`) | 200 | 200 | 200 | 403 | 403 | 403 | 403 |
| `GET rapports*` | rapports lecture + montants (`rapports.controller.ts:32-80`) | 200 | 403 | 403 | 403 | 403 | 403 | 200 |
| `GET exports/audit` | directeur seul (`exports.controller.ts:13`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET exports/download` | rapports **ou** planning lecture (`:19`) | 200 | 200 | 403 | 403 | 403 | 403 | 200 |
| `GET audit/logs`, `audit/verify` | `DIRECTION, COMPTABLE` (`audit.controller.ts:10-18`) | 200 | 403 | 403 | 403 | 403 | 403 | 200 |
| `restaurant/products` (écriture) | directeur seul (`restaurant.controller.ts:121-160`) | 200 | 403 | 403 | 403 | 403 | 403 | 403 |
| `restaurant/orders*`, `orders/stream` | restaurant (`:168-284`) | 200 | 200 | 200 | 403 | 403 | 403 | 403 |
| `PATCH restaurant/orders/:id/status` | cuisine **ou** restaurant écriture (`:294`, `:304`) | 200 | 200 | 200 | 200 | 403 | 403 | 403 |
| `GET restaurant/kitchen/orders`, `cuisine/*`, `cuisine/stream` | cuisine (`:231-241`, `:323-371`) + contrôle cuisinier (fix précédent) | 403 | 403 | 403 | 200 | 403 | 403 | 403 |
| `notifications*` (cloche) | restaurant lecture (`notifications.controller.ts:27-73`) | 200 | 200 | 200 | **403** | **403** | **403** | **403** |
| `GET restaurant/products/images/:f`, `rooms/images/:f` | `@Public` (`restaurant.controller.ts:96-97`, `rooms.controller.ts:84-85`) | P | P | P | P | P | P | P |
| `security-test/*` | **contrôleur de test chargé en production** (`app.module.ts:22`, `:45`) | voir SEC-001 |

## 3. Constats

### SEC-001 — P0 — Contrôleur de test chargé dans l'application réelle
- **Preuve** : `apps/api/src/app.module.ts:22` (import) et `:45` (`controllers: [SecurityTestController]`). Routes publiques `GET security-test/public-ping` et `POST security-test/strict-validation` (`security-test.controller.ts:33-60`).
- **Précision** : la route publique chiffre puis déchiffre ce qu'on lui envoie et renvoie le texte chiffré ; elle ne lit **aucune** donnée de la base. Ce n'est donc pas une fuite de pièces d'identité, mais une porte ouverte inutile (n'importe qui peut faire travailler le chiffrement du serveur et observer les sorties).
- **Correction** : ne charger ce contrôleur qu'en environnement de test (`NODE_ENV === 'test'`). **Effort** : petit.

### SEC-002 — P1 — Clé de chiffrement de secours écrite dans le code
- **Preuve** : `apps/api/src/common/security/crypto.service.ts:29-31` : si `ENCRYPTION_MASTER_KEY` manque, la clé `0123456789abcdef…` est utilisée.
- **Atténuation trouvée** : `docker-compose.prod.yml` exige la variable (`ENCRYPTION_MASTER_KEY: ${ENCRYPTION_MASTER_KEY:?…}`) ; le risque n'existe que si l'API est lancée hors de ce fichier (ex. `node dist/main.js`).
- **Risque** : un oubli dans le fichier d'environnement de production chiffre les pièces d'identité avec une clé publique (présente dans Git). Personne ne s'en rend compte.
- **Correction** : refuser de démarrer sans clé hors test. **Effort** : petit.

### SEC-003 — P2 — Cloche fermée à quatre profils
- **Preuve** : toutes les routes `notifications` exigent l'écran Restaurant (`notifications.controller.ts:27`, `:34`, `:66`, `:73`).
- **Risque** : Comptable, Ménage, Technique et Cuisinier reçoivent un refus si l'écran appelle la cloche (comportement de l'écran non vérifié).
- **Correction** : masquer la cloche pour ces profils (ne rien ajouter) ou accepter tout compte connecté pour leurs propres messages. **Effort** : petit.

### SEC-004 — P1 — Deux portes pour gérer les comptes
- **Preuve** : `/users` dans `auth.controller.ts:164-205` et `/administration/comptes` dans `administration.controller.ts:43-143`.
- **Risque** : une règle ajoutée à l'une (ex. « un seul administrateur protégé », refus de donner Cuisine à un non-cuisinier) peut manquer à l'autre.
- **Correction** : vérifier que l'écran n'appelle plus `/users`, puis supprimer ces 5 routes. **Effort** : petit.

### SEC-005 — P2 — Ménage sans flux temps réel des chambres
- **Preuve** : `rooms.controller.ts:122` (`HOUSEKEEPING` absent).
- **Risque** : l'écran Chambres du ménage ne se met pas à jour seul. **Correction** : ajouter `HOUSEKEEPING`. **Effort** : petit.

### SEC-006 — P2 — Limitation des tentatives en mémoire
- Voir LOG-006 (`auth.service.ts:94-95`). Le verrou en base (`schema.prisma:74-75`) protège le compte.

### SEC-007 — P2 — Dépendances : 8 alertes modérées, 0 haute, 0 critique
- **Preuve** : `npm audit --json` (lecture) : `exceljs` → `uuid` (GHSA-w5hq-g745-h8pq), `@typescript-eslint/*` → `minimatch` (GHSA-g3hv-75wg-m249, outil de développement seulement).
- **Risque** : faible ; la faille `uuid` touche des fonctions (v3/v5/v6 avec tampon) non utilisées a priori par l'export (non vérifié).
- **Correction** : mettre à jour `@typescript-eslint` ; surveiller `exceljs`. **Effort** : petit.

## 4. Ce qui est en place (vérifié dans le code)
Jeton d'accès de 15 min (`auth/jwt.util.ts:27`), secret JWT en variable d'environnement (`:46`), cookies `Secure` sauf si `COOKIE_SECURE=false` (`auth.controller.ts:44`, `:55`), double authentification TOTP et codes de secours (`schema.prisma:76-79`), verrou après échecs (`:74-75`), sessions révocables (`auth.controller.ts:152`), refus par défaut des routes sans décorateur (testé par `security-test/undecorated-route`), pièces d'identité chiffrées AES-256-GCM et affichées seulement via `reveal-document` journalisé (`guests.controller.ts:77-78`). Requêtes SQL brutes vues : paramétrées par gabarit Prisma (`billing.service.ts:245-251`, `rapports.service.ts:800`, `:831`).

## Non vérifié
Contenu des journaux (absence de données sensibles), téléversement de photos (un script `scripts/test-securite-photos.mjs` existe, non relancé), en-têtes HTTP en production derrière le proxy.
