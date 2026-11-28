# Tarifs publics — Côté Location (Résidence Blue, Thiès)

> Source : document papier **« TARIF PUBLIC »** de Résidence Blue (lu sur photo).
> Tous les montants sont stockés en **entiers FCFA** (jamais de décimaux).
> Les éléments marqués **« à vérifier »** doivent être confirmés par la directrice (voir [A-VALIDER.md](file:///c:/Projets/Residence-Blue/docs/location/A-VALIDER.md)).

## 1. Grille tarifaire hébergement (B&B = nuit avec petit-déjeuner)

- **Unité appliquée par défaut** : **PAR NUIT** *(à vérifier avec la directrice)*.
- **Petit-déjeuner** : **inclus** par défaut (B&B) *(à vérifier)*.
- **Traitement TVA / Taxe de séjour (logique existante conservée sans modification)** :
  - Dans [billing.service.ts](file:///c:/Projets/Residence-Blue/apps/api/src/billing/billing.service.ts) (`computeInvoiceTotals`), le code existant traite les tarifs d'hébergement comme des montants **TTC** (`subtotalHt = Math.round((net * 100) / (100 + vatRate))`, `vat = totalTtc - baseWithService`).
  - La **taxe de séjour** (1 000 FCFA / nuit / adulte par défaut) est calculée **en sus, hors TVA**, exactement comme avant.

| Situation | Chambre Standard | Chambre Confort | Appartement | Statut de vérification |
|---|---|---|---|---|
| 1 personne | 30 000 FCFA | 35 000 FCFA | 50 000 FCFA | Lu sur photo (unité par nuit **à vérifier**) |
| 2 personnes (1 chambre / couple) | 35 000 FCFA | 40 000 FCFA | 55 000 FCFA | Lu sur photo |
| 2 personnes (2 chambres) | Non proposé | Non proposé | 65 000 FCFA | Lu sur photo |
| 3 personnes, 2 chambres | Non proposé | Non proposé | 75 000 FCFA | Lu sur photo |
| 3 personnes, 3 chambres | Non proposé | Non proposé | **À définir** (`null`) | **À vérifier** — jamais inventé |
| 4 personnes, 2 chambres | Non proposé | Non proposé | 85 000 FCFA | Lu sur photo |
| 4 personnes, 3 chambres | Non proposé | Non proposé | **À définir** (`null`) | **À vérifier** — jamais inventé |
| 5 personnes | Non proposé | Non proposé | 95 000 FCFA | Lu sur photo |
| 6 personnes | Non proposé | Non proposé | 105 000 FCFA | Lu sur photo |

### Règles d'intégrité appliquées
- **Case « Non proposé »** : aucune ligne en base de données (`room_tariffs`). Toute tentative de réservation retourne une erreur claire en français : *« Pas de tarif pour X personnes en chambre Y. Choisissez un appartement ou demandez à la direction. »*
- **Case « À définir »** : ligne existante en base avec `pricePerNightFcfa = null`. Le serveur refuse la réservation tant que la directrice n'a pas saisi un montant dans **Administration → Tarifs**.
- **Prix figé à la réservation** : `Reservation.ratePerNightFcfa` et `Reservation.tariffLabel` sont figés à la création. Une mise à jour ultérieure de la grille ne modifie **ni** les réservations existantes, **ni** les notes/factures déjà émises.
- **Négociation manuelle** : réservée strictement au profil **DIRECTION**, avec motif obligatoire et écriture dans le journal d'actions (`RESERVATION_PRICE_OVERRIDE`). La réception voit « Prix fixé par la direction ».

## 2. Catalogue des prestations (Autres ventes)

Ces prestations sont stockées dans `extra_service_items` et intégrées au flux existant **Facturation → Autres ventes** (ajoutables sur une note de séjour ouverte ou sur une facture dédiée entreprise / client de passage).

| Code | Libellé | Prix unitaire (FCFA) | Unité | Statut de vérification |
|---|---|---|---|---|
| `SALLE_SEMINAIRE` | Salle de séminaire | 100 000 FCFA | journée | Lu sur photo |
| `PAUSE_CAFE` | Pause-café | 3 000 FCFA | personne | Lu sur photo |
| `PAUSE_DEJEUNER_MENU_1_PLAT` | Pause déjeuner (1 plat au menu) | 7 000 FCFA | personne | Lu sur photo |
| `PAUSE_DEJEUNER_BUFFET_2_PLATS` | Pause déjeuner (2 plats en buffet) | 10 000 FCFA | personne | Lu sur photo |

> Aucun calendrier de réservation de la salle de séminaire n'est inclus dans cette version.

## 3. Identité de l'hôtel (pied de page du tarif public)

La migration et le script idempotent [real-tariffs-loader.util.ts](file:///c:/Projets/Residence-Blue/apps/api/src/tariffs/real-tariffs-loader.util.ts) remplissent **uniquement les champs vides** dans `hotel_settings` (aucun écrasement des valeurs déjà saisies par la directrice).

| Champ (`hotel_settings`) | Valeur de référence (pied de page) | Statut de vérification |
|---|---|---|
| `name` | `Résidence Blue` | Confirmé |
| `address` | `Rue 47 Grand Standing, derrière station EDK, Thiès` | Lu sur photo (**à vérifier**) |
| `postalCode` | `21000` | Lu sur photo (**à vérifier**) |
| `country` | `Sénégal` | Confirmé |
| `ninea` | `006927349 2F2` | **À VÉRIFIER sur le document officiel** (lu sur photo) |
| `phone` | `+221 33 954 18 68` | Lu sur photo (**à vérifier**) |
| `secondaryPhones` | `+221 78 426 64 56, +221 77 541 69 11` | Lu sur photo (**à vérifier**) |
| `email` | `info@residencesblue.com` | Lu sur photo (**à vérifier**) |
| `website` | `www.residencesblue.com` | Lu sur photo (**à vérifier**) |

## 4. Champs masqués (conservés en base, non utilisés dans l'interface)

Conformément à la règle « ne pas supprimer, masquer et lister » :
- `Room.highSeasonPricePerNight` (`rooms.high_season_price_per_night`) — masqué dans le tiroir d'édition des chambres (`rooms.component.ts`).
- `Room.corporatePricePerNight` (`rooms.corporate_price_per_night`) — masqué dans le tiroir d'édition des chambres (`rooms.component.ts`).

Les chambres existantes sans catégorie reconnue sont automatiquement marquées **« À classer »** jusqu'à ce que la directrice choisisse leur catégorie (`Standard`, `Confort` ou `Appartement`) dans l'écran **Chambres**.
