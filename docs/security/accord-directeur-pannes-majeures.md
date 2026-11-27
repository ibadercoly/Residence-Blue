# Porte de sécurité — Accord préalable du directeur pour les pannes majeures

- **Date** : 26 novembre 2026
- **Branche** : `feature/pannes-technique`
- **Périmètre** :
  - `POST /api/rooms/:id/problems` (signalement d'une panne)
  - `PATCH /api/rooms/problems/:id/approve` (autorisation directeur depuis Chambres)
  - `PATCH /api/technique/problems/:id/approve` (autorisation directeur depuis Technique)
  - `PATCH /api/rooms/problems/:id/toggle-blocking` (bascule « chambre louable malgré ce problème »)
  - `PATCH /api/technique/problems/:id/take` (prise en charge technicien)
  - `PATCH /api/technique/problems/:id/resolve` (clôture / réparation technicien)
  - `PATCH /api/rooms/:id/status` (changement de statut direct de chambre)
  - `GET /api/technique/problems` (tableau de bord Technique)
  - Interface web : `/technique` (`TechniquePageComponent`) et `/chambres` (`RoomStatusCardComponent`)

---

## 1. Règle métier vérifiée

Même si le cuisinier, un assistant, le ménage ou la réception signale une panne technique majeure dans une chambre, l'équipe technique **ne peut pas venir ni réparer la chambre sans l'autorisation préalable expresse du directeur**.

- **Panne majeure** : définie par la nature du problème (`isMajorRoomProblem` dans `packages/shared/src/rooms.ts`), soit tout type autre que `AMPOULE` (`CLIMATISATION`, `FUITE_EAU`, `ELECTRICITE`, `AUTRE`).
- **Panne mineure (`AMPOULE`)** : ne nécessite pas l'accord préalable du directeur (`directorApproved = true` dès le signalement).
- **Signalement par le directeur (`Role.DIRECTION`)** : auto-approuvé (`directorApproved = true`, `approvedByDirectorId/Name/At` renseignés).

---

## 2. Attaques testées et résultats obtenus

| # | Scénario d'attaque / contournement | Résultat attendu | Couverture |
|---|------------------------------------|------------------|------------|
| 1 | Technicien (`MAINTENANCE`) appelle `PATCH /api/technique/problems/:id/approve` | `403 Forbidden` | `apps/api/test/technique.e2e-spec.ts` |
| 2 | Technicien (`MAINTENANCE`) appelle `PATCH /api/rooms/problems/:id/approve` | `403 Forbidden` | `apps/api/test/technique.e2e-spec.ts` |
| 3 | Réception, Ménage, Restaurant, Cuisinier appellent `approve` (routes `/technique` et `/rooms`) | `403 Forbidden` | `apps/api/test/technique.e2e-spec.ts` |
| 4 | Technicien appelle `PATCH /api/technique/problems/:id/take` avant accord du directeur | `409 Conflict` (message « accord préalable du directeur ») | `room-problems.service.spec.ts` & `technique.e2e-spec.ts` |
| 5 | Technicien appelle `PATCH /api/technique/problems/:id/resolve` avant accord du directeur | `409 Conflict` | `room-problems.service.spec.ts` & `technique.e2e-spec.ts` |
| 6 | Technicien appelle `PATCH /api/rooms/:id/status` directement (`MAINTENANCE -> CLEANING`) pour contourner le workflow Technique | `409 Conflict` tant qu'une panne majeure non autorisée est active | `rooms.service.spec.ts` & `technique.e2e-spec.ts` |
| 7 | Contournement via `toggleBlocking` (`blocksRental: false`, « chambre louable malgré ce problème ») suivi de `take` | `directorApproved` reste `false`, `take` renvoie toujours `409 Conflict` | `room-problems.service.spec.ts` & `technique.e2e-spec.ts` |
| 8 | Signalement d'une panne majeure par un non-directeur (ménage, réception, cuisine/restaurant) | `directorApproved = false` + notification `CRITICAL` `ACCORD_DIRECTEUR_REQUIS` | `room-problems.service.spec.ts` & `technique.e2e-spec.ts` |
| 9 | Signalement d'une panne mineure (`AMPOULE`) par un non-directeur | `directorApproved = true`, `blocksRental = false`, prise en charge immédiate sans blocage | `room-problems.service.spec.ts` & `technique.e2e-spec.ts` |
| 10 | Isolation des données sensibles pour `MAINTENANCE` (`GET /api/guests`, `GET /api/invoices`, `GET /api/accueil/jour`) | `403 Forbidden` ; tableau Technique garanti sans `pricePerNight`, `totalAmount`, `guestName`, `identityNumber` | `technique.e2e-spec.ts` & `accueil-jour.e2e-spec.ts` |
| 11 | Contournement côté UI (réactivation manuelle d'un bouton désactivé dans le navigateur) | Boutons « Je m'en occupe » et « C'est réparé » désactivés côté UI ET contrôles serveur `409`/`403` incontournables | `technique-page.component.spec.ts` & `technique.e2e-spec.ts` |
| 12 | Traçabilité / non-répudiation (`audit_log` chaîné SHA-256 append-only) | Entrées `ROOM_PROBLEM_REPORTED`, `ROOM_PROBLEM_DIRECTOR_APPROVED`, `ROOM_PROBLEM_ACKNOWLEDGED`, `ROOM_PROBLEM_RESOLVED` vérifiées en base | `technique.e2e-spec.ts` & `base-securisee.e2e-spec.ts` |

---

## 3. Défenses en place

1. **Contrôle d'accès par défaut (RBAC strict)** :
   - `@Roles(Role.DIRECTION)` sur `PATCH /api/rooms/problems/:id/approve` et `PATCH /api/technique/problems/:id/approve`.
   - `@Roles(Role.MAINTENANCE, Role.DIRECTION)` sur `TechniqueController` ; `RECEPTION`, `HOUSEKEEPING`, `RESTAURANT`, `CUISINIER` reçoivent `403`.
   - `@Acces({ anyScreens: [{ screen: 'chambres', level: 'LECTURE' }, { screen: 'technique', level: 'ECRITURE' }], specialPermission: 'changer_etat_chambre' })` sur `PATCH /api/rooms/:id/status`, combiné à la matrice des transitions de `RoomsService` et au verrou `directorApproved`.
2. **Application côté serveur (jamais uniquement UI)** :
   - `RoomProblemsService.acknowledgeProblem()`, `RoomProblemsService.resolveProblem()`, `RoomProblemsService.toggleBlocking()`, et `RoomsService.updateStatus()` appliquent systématiquement le verrou métier côté serveur.
3. **Validation stricte des entrées** :
   - `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` actif globalement ; tout champ supplémentaire injecté (ex. `directorApproved: true` dans le corps d'un `POST /rooms/:id/problems`) est rejeté (`400 Bad Request`).
4. **Accès base de données sécurisé** :
   - Requêtes Prisma paramétrées uniquement (aucune concaténation SQL brute).
   - Compte applicatif `app_user` sans droits DDL ni `UPDATE`/`DELETE` sur `audit_log` (protégé par droits PostgreSQL + trigger append-only).
5. **Secrets & données sensibles** :
   - Aucun secret dans le code source ni dans Git (variables d'environnement uniquement).
   - Chiffrement AES-256-GCM des pièces d'identité inchangé et préservé.

---

## 4. Validation et verdict

Commandes exécutées sur `feature/pannes-technique` le **26 novembre 2026** :
- `npm run lint` : **PASS**
- `npm run build` : **PASS**
- `npm run test:unit` : **PASS** (shared, api, web)
- `npm run test:integration` : **PASS** (toutes les suites, y compris `technique.e2e-spec.ts`, `rooms.e2e-spec.ts`, `base-securisee.e2e-spec.ts`, `modules-status.e2e-spec.ts`, `accueil-jour.e2e-spec.ts`)

**Verdict de la porte de sécurité : PASSÉ (GO).**
