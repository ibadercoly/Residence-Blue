# Définitions et règles de calcul — Écran Rapports (`/rapports`)

Ce document précise les règles retenues côté serveur (`GET /api/rapports`) pour produire les indicateurs, graphiques et tableaux à partir des données réelles de PostgreSQL.

## 1. Fuseau horaire et périodes

- Toutes les bornes et regroupements de dates utilisent exclusivement le fuseau horaire **Africa/Dakar** (UTC+0 permanent).
- Un jour $J$ couvre l'intervalle semi-ouvert `[J 00:00:00.000Z, J+1 00:00:00.000Z)`.
- En SQL PostgreSQL sur colonnes `TIMESTAMP(3)` stockées en UTC, la date calendaire Dakar est obtenue par :
  `("colonne" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Dakar')::date`.
- Périodes disponibles (`periode`) :
  - `30j` : 30 derniers jours en cours jusqu'à aujourd'hui inclus ; période précédente = les 30 jours immédiatement antérieurs.
  - `3m` : 90 derniers jours jusqu'à aujourd'hui inclus ; période précédente = les 90 jours immédiatement antérieurs.
  - `12m` : 12 mois calendaires complets jusqu'à aujourd'hui inclus (du 1er du mois M-11 à aujourd'hui) ; période précédente = les 12 mois immédiatement antérieurs.
  - `mois` : du 1er jour du mois calendaire Dakar en cours jusqu'à aujourd'hui inclus ; période précédente = le mois calendaire complet précédent.

## 2. Montants et unités

- Tous les montants financiers sont exprimés **hors taxes** et stockés / arrondis en **FCFA entiers** (`Math.round`, jamais de décimales).
- Les pourcentages sont arrondis à l'entier le plus proche (`Math.round`).

## 3. Règles d'inclusion et d'exclusion

- **Annulations exclues** :
  - Les factures/notes avec `status = 'CANCELLED'` sont exclues des ventes, encaissements, restes à encaisser et tableaux.
  - Les réservations avec `status IN ('CANCELLED', 'NO_SHOW', 'PENDING')` ne comptent pas dans l'occupation des chambres ni dans les sources de réservation actives (`CANCELLED` et `NO_SHOW` exclues).
  - Les commandes restaurant avec `status = 'CANCELLED'` sont exclues du classement des plats.
- **Avoirs déduits** :
  - Les documents de type `CREDIT_NOTE` (`status <> 'CANCELLED'`) ont un montant `subtotal_ht_fcfa` négatif et viennent en déduction directe du chiffre d'affaires sur la période de leur date comptable (`issued_at`).
  - Sur la ventilation par catégorie (Hébergement / Restaurant et bar / Autres), un avoir rattaché à une facture parente est imputé au prorata des catégories de la facture parente (ou en Autres si la facture parente est absente).
- **Date de consommation / service** :
  - Factures et avoirs : date de prestation / émission (`issued_at`) en heure de Dakar.
  - Encaissements : date d'encaissement (`payments.paid_at`) en heure de Dakar, en déduisant les écritures inverses (`is_reversal = true`, montant négatif) et en excluant les paiements liés à une facture annulée.
  - Occupation chambres : chaque nuit passée $N$ telle que `check_in_date <= N` et `check_out_date > N` sur les séjours confirmés, en cours ou terminés (`CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`), rapportée au nombre de chambres actives (`rooms.is_active = true`).
  - Plats restaurant : date de la commande (`orders.created_at`) en heure de Dakar, montants hors taxes proportionnels à `subtotal_ht_fcfa / total_ttc_fcfa` (ou taux de TVA de la commande).

## 4. Condition d'affichage sans données fictives

- Si aucune donnée réelle n'existe sur la période, `hasData = false` et toutes les sections optionnelles sont omises de la réponse JSON.
- Aucune tuile n'est retournée si sa valeur est nulle sans activité.
- Comparaisons avec la période précédente : omises si la période précédente ne contient pas de données (`previousPeriodHasData = false` ou base de référence nulle).
- Diagrammes :
  - Courbe d'évolution du chiffre d'affaires : au moins 2 points non nuls.
  - Barres (ventes par semaine, occupation par jour, encaissements par mode, ventes par catégorie, jours de la semaine) : au moins 1 valeur non nulle.
  - Provenance des réservations : au moins 1 réservation active dotée d'une source non vide.
  - Top 10 plats : au moins 1 vente restaurant non annulée (classement par quantité décroissante, puis chiffre d'affaires hors taxes décroissant en cas d'égalité).
