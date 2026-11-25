# Pannes, Nettoyage et État des Chambres — Résidence Blue

Ce document détaille l'architecture des états des chambres, la gestion des pannes et l'indépendance propreté / occupation / pannes conformément aux décisions de la direction (Lot « pannes-technique »).

---

## 1. Principe : Trois dimensions indépendantes par chambre

Chaque chambre physique de la Résidence Blue (12 chambres) est caractérisée par trois états distincts et orthogonaux :

1. **Occupation (Réception)** :
   - `LIBRE` ou `OCCUPÉE` (client actuellement logé, issu d'une réservation au statut `CHECKED_IN`).
   - Géré par les actions de check-in et check-out de la réception.

2. **Propreté (Ménage)** :
   - `PROPRE` (`isClean = true`) ou `À NETTOYER` (`isClean = false`).
   - Géré par le ménage à tout moment via les actions « J'ai nettoyé » et « À nettoyer », que la chambre soit occupée ou non.
   - Le check-out d'un client positionne automatiquement la chambre à `isClean = false`.

3. **Problèmes techniques (Ménage, Réception, Direction, Technique)** :
   - Liste des problèmes ouverts ou résolus, stockés dans la table `room_problems`.
   - Chaque problème possède son propre type (`CLIMATISATION`, `FUITE_EAU`, `ELECTRICITE`, `AMPOULE`, `AUTRE`), son état (`REPORTED`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`) et son indicateur de blocage de location (`blocksRental`).

---

## 2. Dérivation de l'état « Hors service » (MAINTENANCE) et compatibilité

Afin de préserver la stabilité de l'existant (API, Planning, Facturation, Modules déconnectés) sans régression :
- La valeur `RoomStatus.MAINTENANCE` est conservée dans l'énumération `RoomStatus` comme **état dérivé** pour les chambres inoccupées ayant au moins un problème bloquant ouvert.
- Une chambre occupée avec un problème technique **ne passe jamais hors service** : elle reste `RoomStatus.OCCUPIED` car le client reste logé.
- Lorsqu'une chambre est libre (pas de client logé) :
  - Si un problème bloquant non résolu existe (`blocksRental = true` et statut `REPORTED` ou `IN_PROGRESS`), son statut dérivé est `MAINTENANCE` (Hors service / non louable).
  - Si aucun problème bloquant n'existe :
    - `CLEANING` si `isClean = false` (À nettoyer).
    - `FREE` si `isClean = true` (Prête à la location).
- Dès que le dernier problème bloquant est résolu ou annulé, la chambre redevient immédiatement louable (`FREE` si propre, `CLEANING` si à nettoyer).

---

## 3. Migration Prisma sans perte

La migration Prisma :
1. Crée la table `room_problems` avec clés étrangères vers `rooms` et `users`, horodatages et index de performance.
2. Ajoute la colonne `is_clean BOOLEAN NOT NULL DEFAULT true` sur la table `rooms`.
3. Initialise `is_clean = false` pour toutes les chambres actuellement au statut `CLEANING`.
4. Pour toute chambre actuellement au statut `MAINTENANCE` :
   - Crée un enregistrement dans `room_problems` avec type `AUTRE`, statut `REPORTED`, `blocks_rental = true`, description reprenant `maintenance_reason` (ou `Autre : maintenance en cours`).
   - Aucune donnée historique n'est perdue.

---

## 4. Règles de réservation et check-in

- **Nouvelle réservation** : le serveur refuse toute réservation sur une chambre dont le statut est `MAINTENANCE` ou ayant un problème bloquant ouvert (`400 Bad Request` avec explication claire en français).
- **Check-in** : le serveur refuse le check-in si la chambre a un problème bloquant non résolu.
- **Départ client (check-out)** :
  - La chambre passe à `isClean = false`.
  - Si un problème bloquant est en cours, elle passe immédiatement à `MAINTENANCE` après nettoyage (ou dès le départ), la réception reçoit une notification cloche (« Chambre X : le client est parti, problème non réparé (type), chambre non louable ») et le technicien voit « Chambre vide, vous pouvez entrer ».
