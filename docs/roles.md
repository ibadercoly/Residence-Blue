# Matrice des Rôles et Droits d'Accès — Résidence Blue

Ce document définit la matrice de contrôle d'accès basée sur les rôles (**RBAC**) et la machine à états finis régissant le cycle de vie et les statuts des chambres de la **Résidence Blue** (Thiès - Grand Standing, Sénégal).

---

## 1. Rôles Applicatifs

| Rôle | Périmètre & Responsabilités |
| :--- | :--- |
| **`DIRECTION`** | Direction générale et gérance : accès complet, fixation des tarifs des chambres, configuration et supervision globale. |
| **`RECEPTION`** | Réceptionnistes et front-desk : accueil, enregistrement des check-in (`FREE` $\rightarrow$ `OCCUPIED`), départs/check-out (`OCCUPIED` $\rightarrow$ `CLEANING`), signalement technique. |
| **`HOUSEKEEPING`** | Gouvernance et équipe d'étage : nettoyage des chambres, inspection et validation de propreté (`CLEANING` $\rightarrow$ `FREE`), signalement technique. |
| **`MAINTENANCE`** | Équipe technique et maintenance : prise en charge des pannes (`*` $\rightarrow$ `MAINTENANCE`), fin d'intervention (`MAINTENANCE` $\rightarrow$ `CLEANING` ou `FREE`). |
| **`RESTAURANT`** | Salle et bar : commandes restaurant, point de vente, facturation sur chambre (aucun droit de modification sur l'état des chambres). |
| **`COMPTABLE`** | Comptabilité et finances : clôtures, bilans, exports comptables (aucun droit de modification sur l'état physique des chambres). |

---

## 2. Matrice d'Habilitation sur les Chambres

| Action / Endpoint | `DIRECTION` | `RECEPTION` | `HOUSEKEEPING` | `MAINTENANCE` | `RESTAURANT` | `COMPTABLE` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Lecture des chambres (`GET /rooms`, `GET /rooms/:id`)** | ✅ Autorisé | ✅ Autorisé | ✅ Autorisé | ✅ Autorisé | ✅ Autorisé | ✅ Autorisé |
| **Création / Modification des Tarifs (`POST /room-types`, `PATCH /room-types/:id`)** | ✅ **Exclusif** | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
| **Changement de statut (`PATCH /rooms/:id/status`)** | ✅ Autorisé | ✅ Autorisé* | ✅ Autorisé* | ✅ Autorisé* | ❌ Refusé (403) | ❌ Refusé (403) |

*\* Selon la matrice des transitions autorisées ci-dessous.*

---

## 3. Machine à États des Statuts de Chambres

Les statuts possibles d'une chambre sont :
- **`FREE`** : Chambre libre, propre, inspectée et prête à la location.
- **`OCCUPIED`** : Chambre actuellement occupée par un client ayant effectué son check-in.
- **`CLEANING`** : Chambre libérée ou salie, nécessitant ménage et désinfection par l'équipe d'étage.
- **`MAINTENANCE`** : Chambre indisponible pour cause de problème technique ou travaux.

### Matrice des Transitions d'États

| Statut Actuel | Statut Cible | Rôles Autorisés | Justification Métier |
| :--- | :--- | :--- | :--- |
| **`FREE`** | **`OCCUPIED`** | `DIRECTION`, `RECEPTION` | Check-in du client à la réception. |
| **`FREE`** | **`CLEANING`** | `DIRECTION`, `HOUSEKEEPING` | Rafraîchissement ou re-nettoyage d'une chambre restée vacante. |
| **`FREE`** | **`MAINTENANCE`** | `DIRECTION`, `RECEPTION`, `HOUSEKEEPING`, `MAINTENANCE` | Panne détectée avant occupation. |
| **`OCCUPIED`** | **`CLEANING`** | `DIRECTION`, `RECEPTION` | Check-out / Départ du client. |
| **`OCCUPIED`** | **`MAINTENANCE`** | `DIRECTION`, `RECEPTION`, `MAINTENANCE` | Incident technique urgent nécessitant intervention pendant le séjour. |
| **`OCCUPIED`** | **`FREE`** | ❌ **STRICTEMENT INTERDIT** | **Règle absolue :** Une chambre occupée ne peut JAMAIS redevenir libre sans passage préalable par le nettoyage (`CLEANING`). |
| **`CLEANING`** | **`FREE`** | `DIRECTION`, `HOUSEKEEPING`, `RECEPTION` | Ménage achevé et contrôlé : la chambre est remise en vente. |
| **`CLEANING`** | **`MAINTENANCE`** | `DIRECTION`, `HOUSEKEEPING`, `MAINTENANCE` | Problème technique découvert pendant le nettoyage. |
| **`CLEANING`** | **`OCCUPIED`** | ❌ **INTERDIT** | Interdiction d'enregistrer un client dans une chambre sale. |
| **`MAINTENANCE`** | **`CLEANING`** | `DIRECTION`, `MAINTENANCE`, `HOUSEKEEPING` | Travaux terminés nécessitant un nettoyage approfondi. |
| **`MAINTENANCE`** | **`FREE`** | `DIRECTION`, `MAINTENANCE` | Petite intervention sans salissure (ex: remplacement ampoule ou télécommande). |
| **`MAINTENANCE`** | **`OCCUPIED`** | ❌ **INTERDIT** | Interdiction d'attribuer une chambre en maintenance sans contrôle préalable. |

---

## 4. Traçabilité dans l'Audit Log

Toute transition de statut déclenche une insertion obligatoire et synchrone dans la table immuable `audit_log` :
```json
{
  "action": "ROOM_STATUS_CHANGE",
  "entity": "Room",
  "entityId": "uuid-de-la-chambre",
  "before": { "status": "OCCUPIED" },
  "after": { "status": "CLEANING", "reason": "Check-out client" },
  "userId": "uuid-utilisateur",
  "ip": "adresse-ip-client",
  "createdAt": "2026-11-08T15:00:00.000Z"
}
```
Si l'écriture dans `audit_log` échoue, la transaction entière est annulée.

---

## 5. Matrice d'Habilitation Restaurant & Gestion du Menu

| Action / Périmètre | `DIRECTION` | `RESTAURANT` | `RECEPTION` | `HOUSEKEEPING` | `MAINTENANCE` | `COMPTABLE` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Prise de commande / Encaissement / Table / Chambre** | ✅ Autorisé | ✅ Autorisé | ✅ Autorisé (Room service) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
| **Accès au bouton « Gérer le menu »** | ✅ Autorisé | ✅ Autorisé | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
| **Création / Modification d'un plat** | ✅ Autorisé | ✅ Autorisé | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
| **Duplication & Bascule Épuisé (1 clic)** | ✅ Autorisé | ✅ Autorisé | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
| **Archivage d'un plat (conservation historique)** | ✅ Autorisé | ✅ Autorisé | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
| **Téléversement & Traitement de photos (WebP, magic bytes)** | ✅ Autorisé | ✅ Autorisé | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
| **Gestion des catégories (Création, Renommage, Archivage)** | ✅ Autorisé | ✅ Autorisé | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
| **Export du menu (CSV, Excel avec protection formules)** | ✅ Autorisé | ✅ Autorisé | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ✅ Autorisé |
| **Import du menu (CSV avec contrôle strict < 2 Mo, 500 lignes)** | ✅ Autorisé | ✅ Autorisé | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) | ❌ Refusé (403) |
