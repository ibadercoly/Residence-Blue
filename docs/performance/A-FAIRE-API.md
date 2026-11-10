# A-FAIRE-API.md : Spécifications des Endpoints Manquants (Planning & Réservations)

Ce document répertorie les spécifications API pour le backend NestJS / PostgreSQL (Prisma) correspondant aux fonctionnalités opérées actuellement avec les données de démonstration (`PlanningMockService` et `ReservationModalService`).

---

## 1. Module Planning (Vue Semaine 7 Jours)

### `GET /api/planning`
- **Rôles autorisés** : `DIRECTION`, `RECEPTION`, `SERVEUR`, `CUISINE`.
- **Paramètres de requête (Query params)** :
  - `startDate` (obligatoire, format ISO YYYY-MM-DD, ex: `2026-11-10`)
  - `endDate` (obligatoire, format ISO YYYY-MM-DD, ex: `2026-11-16`)
  - `statusFilter` (optionnel : `ALL`, `FREE`, `OCCUPIED`)
  - `search` (optionnel : chaîne de recherche chambre / nom client)
- **Contrat de réponse (Payload < 100 Ko, temps < 200 ms)** :
  ```json
  {
    "period": {
      "startDate": "2026-11-10",
      "endDate": "2026-11-16",
      "label": "10 – 16 nov. 2026"
    },
    "dailyMetrics": {
      "arrivalsToday": 3,
      "departuresToday": 2,
      "freeRoomsToday": 3
    },
    "rooms": [
      {
        "number": "101",
        "category": "Standard",
        "typeLabel": "Standard Patio",
        "reservations": [
          {
            "id": "res-101-diallo",
            "guestName": "M. Diallo",
            "roomNumber": "101",
            "checkInDate": "2026-11-07",
            "checkOutDate": "2026-11-10",
            "status": "DEPART_AUJ",
            "nights": 3,
            "totalFcfa": 255000,
            "remainingFcfa": 0
          }
        ]
      }
    ]
  }
  ```
- **Règles backend** :
  - Sélection stricte des colonnes utiles (`select: { id: true, guestName: true, roomNumber: true, checkInDate: true, checkOutDate: true, status: true, totalFcfa: true, remainingFcfa: true }`).
  - Aucun N+1 queries : jointure indexée sur `roomNumber` et index composite `(check_in_date, check_out_date)`.

---

## 2. Opérations sur les Réservations

### `POST /api/reservations`
- **Rôles autorisés** : `DIRECTION`, `RECEPTION`.
- **En-tête** : `Idempotency-Key` (UUID côté client).
- **Corps de la requête (DTO validé par ValidationPipe)** :
  ```json
  {
    "guestName": "M. Mamadou Diop",
    "roomNumber": "301",
    "checkInDate": "2026-11-10",
    "checkOutDate": "2026-11-14",
    "adultsCount": 2,
    "childrenCount": 0,
    "depositAmountFcfa": 200000
  }
  ```
- **Contrôle de conflit transactionnel (PostgreSQL SERIALIZABLE ou verrou FOR UPDATE)** :
  - Vérification : `WHERE room_number = $1 AND check_in_date < $3 AND check_out_date > $2`.
  - Si un chevauchement existe : renvoyer immédiatement `409 Conflict` avec message d'erreur clair :
    `{ "statusCode": 409, "message": "La chambre 301 est déjà réservée sur cette période (du 2026-11-10 au 2026-11-14)." }`.

### `PATCH /api/reservations/:id/checkin`
- **Rôles autorisés** : `DIRECTION`, `RECEPTION`.
- Passe le statut de `CONFIRME` à `EN_SEJOUR`.
- Horodatage et traçabilité de l'opérateur.

### `PATCH /api/reservations/:id/checkout`
- **Rôles autorisés** : `DIRECTION`, `RECEPTION`.
- Vérifie que le solde restant est à 0 FCFA ou émet un avertissement.
- Passe le statut à `CHECKOUT` et libère la chambre.

### `PATCH /api/reservations/:id/extend`
- **Rôles autorisés** : `DIRECTION`, `RECEPTION`.
- Paramètre : `{ "additionalNights": 1 }`.
- Vérifie l'absence de chevauchement sur la nouvelle période étendue ; renvoie `409 Conflict` si la chambre est occupée.

### `DELETE /api/reservations/:id`
- **Rôles autorisés** : `DIRECTION`, `RECEPTION`.
- Marque la réservation comme `ANNULEE` (soft delete pour conserver l'audit log) et libère la plage de dates.
