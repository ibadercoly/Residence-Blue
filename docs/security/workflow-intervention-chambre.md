# Porte de sécurité — Workflow d'intervention technique en chambre

- **Date** : 27 novembre 2026
- **Branche** : `feature/workflow-intervention-chambre`
- **Périmètre** :
  - `POST /api/rooms/:id/intervention` (constat Ménage / Réception -> `PENDING_DIRECTOR`)
  - `GET /api/rooms/interventions` et `GET /api/rooms/interventions/notifications`
  - `POST /api/rooms/interventions/:id/approve` (Direction uniquement -> `APPROVED` + notif `MAINTENANCE`)
  - `POST /api/rooms/interventions/:id/reject` (Direction uniquement -> `REJECTED` + notif `RECEPTION` & `HOUSEKEEPING`)
  - `POST /api/rooms/interventions/:id/complete` (`MAINTENANCE` uniquement -> `COMPLETED` + chambre `CLEANING`)
  - `PATCH /api/rooms/:id/status` (verrouillage strict du passage à `MAINTENANCE`)

## Contrôles et attaques vérifiés

1. **RBAC strict sur la validation Direction** :
   - `RECEPTION`, `HOUSEKEEPING`, `MAINTENANCE`, `RESTAURANT` et `CUISINIER` reçoivent `403 Forbidden` sur `POST /api/rooms/interventions/:id/approve` et `/reject`.
2. **Verrouillage serveur du statut `MAINTENANCE`** :
   - `PATCH /api/rooms/:id/status` avec `{ status: 'MAINTENANCE' }` vérifie en base la présence d'une `RoomInterventionRequest` au statut `APPROVED`.
   - Sans autorisation préalable de la Direction, `MAINTENANCE`, `RECEPTION`, `HOUSEKEEPING` et `DIRECTION` reçoivent `403 Forbidden`.
3. **Isolation des informations côté Technique** :
   - `GET /api/rooms/interventions` pour `MAINTENANCE` filtre strictement aux statuts `APPROVED` et `COMPLETED` : une demande en attente ou refusée n'est jamais transmise à l'équipe Technique.
4. **Validation stricte des entrées** :
   - `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` rejette tout champ non autorisé (ex. tentative d'injection de `status: 'APPROVED'` lors de la création -> `400 Bad Request`).
5. **Prisma paramétré et journalisation chaînée** :
   - Aucune requête SQL brute concaténée ; toutes les transitions (`ROOM_INTERVENTION_REQUESTED`, `ROOM_INTERVENTION_APPROVED`, `ROOM_INTERVENTION_REJECTED`, `ROOM_INTERVENTION_COMPLETED`) sont tracées dans `audit_log` chaîné SHA-256.
6. **Sécurité secrets et base** :
   - Aucun secret dans le code ni Git ; migration appliquée avec `public.enforce_residence_blue_permissions()` (privilèges moindres pour `app_user`).

**Verdict : PASSÉ (GO).**
