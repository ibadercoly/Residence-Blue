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


---

## 3. Gestion Dynamique du Parc de Chambres

Ces endpoints permettent au profil `DIRECTION` d'administrer dynamiquement le parc de chambres sans aucune limitation fixe à 12 chambres.

### `POST /api/rooms`
- **Rôles autorisés** : `DIRECTION` uniquement (rejet `403 Forbidden` pour `RECEPTION`, `HOUSEKEEPING`, `MAINTENANCE`).
- **En-tête** : `Idempotency-Key` (UUID côté client).
- **Corps de la requête (DTO validé par ValidationPipe whitelist + forbidNonWhitelisted)** :
  ```json
  {
    "number": "401",
    "floor": 4,
    "category": "Suite",
    "status": "FREE",
    "pricePerNight": 110000,
    "highSeasonPricePerNight": 135000,
    "corporatePricePerNight": 100000,
    "breakfastIncluded": true,
    "adultsCapacity": 2,
    "childrenCapacity": 1,
    "bedType": "king",
    "bedsCount": 1,
    "surfaceM2": 45,
    "view": "piscine",
    "smoking": false,
    "connectingRoom": "",
    "amenities": ["Climatisation", "Wi-Fi Fibre", "Balcon", "Baignoire"],
    "imageUrl": "assets/images/chambres/suite-401.webp",
    "description": "Suite panoramique avec balcon privatif donnant sur le patio et la piscine.",
    "internalNote": "Réglage climatisation centralisé Daikin."
  }
  ```
- **Règles backend & contraintes de sécurité** :
  - Unicité stricte du champ `number` : index unique PostgreSQL (`room_number_unique`). Si collision, renvoie `409 Conflict` avec message : `"La chambre \"401\" existe déjà. Veuillez renseigner un numéro unique."`.
  - Montants en FCFA entiers stricts (jamais de décimaux).
  - Validation de format de l'image (WebP sécurisé, pas de scripts ni SVG).

### `PUT /api/rooms/:id`
- **Rôles autorisés** : `DIRECTION` uniquement.
- **Paramètre URL** : `:id` (UUID de la chambre).
- **Corps de la requête** : `UpdateRoomDto` (champs modifiables : `number`, `floor`, `category`, `pricePerNight`, `highSeasonPricePerNight`, `corporatePricePerNight`, `breakfastIncluded`, `amenities`, `imageUrl`, `description`, `internalNote`).
- **Règles backend** :
  - Vérifie que le numéro n'est pas déjà pris par une autre chambre (`WHERE number = $1 AND id != $2`).
  - Met à jour le catalogue sans impacter l'historique des réservations passées.

### `PATCH /api/rooms/:id/deactivate`
- **Rôles autorisés** : `DIRECTION` uniquement.
- **Paramètre URL** : `:id` (UUID de la chambre).
- **Contrôle d'intégrité transactionnel strict** :
  - Requête : `SELECT id, guest_name, check_in_date, check_out_date, status FROM reservations WHERE room_id = $1 AND status IN ('CONFIRME', 'ARRIVEE_AUJ', 'EN_SEJOUR', 'DEPART_AUJ') AND check_out_date >= CURRENT_DATE`.
  - Si des réservations sont trouvées : renvoie immédiatement `409 Conflict` avec le détail précis des réservations bloquantes :
    ```json
    {
      "statusCode": 409,
      "error": "Conflict",
      "message": "Impossible de désactiver la chambre 301 : 1 réservation(s) en cours ou à venir détectée(s) : • Dossier #res-301-diop : M. Mamadou Diop (2026-11-10 au 2026-11-14)"
    }
    ```
  - Si aucune réservation active : bascule le booléen `is_active` à `false` (`UPDATE rooms SET is_active = false, updated_at = NOW() WHERE id = $1`). La chambre est retirée des sélecteurs de réservation et du planning, mais conservée pour les archives et le filtre "Inactives".

### `PATCH /api/rooms/:id/reactivate`
- **Rôles autorisés** : `DIRECTION` uniquement.
- **Paramètre URL** : `:id` (UUID de la chambre).
- **Règles backend** :
  - Repasse `is_active` à `true`.
  - La chambre redevient immédiatement disponible à la vente et visible dans la grille principale.
