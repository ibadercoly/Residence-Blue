# Modèle d’accès, profils et correspondance des rôles

**Module :** Administration des comptes (`/administration`)
**Branche :** `feature/administration-comptes`

---

## 1. Signalement sur le compte administrateur principal

Lors de la migration `20261115224500_administration_comptes` sur la base de développement (`residence_blue_db`), **3 comptes** portaient déjà le rôle `DIRECTION` :
1. `restore-test-1794740910403@residence-blue.sn` (créé le `2026-11-15T11:08:30.405Z`) — **le plus ancien : marqué automatiquement `is_primary_admin = true`**.
2. `aissatou.ba@residenceblue.sn` (`Aïssatou Ba`, `2026-11-15T11:08:50.953Z`).
3. `test.direction@residenceblue.sn` (`Test DIRECTION`, `2026-11-15T11:09:01.760Z`).

L’index unique partiel PostgreSQL `users_single_primary_admin_idx` garantit désormais qu’il ne peut exister qu’**un seul** `is_primary_admin = true`. Les endpoints API `POST /api/administration/comptes` et `POST /api/users` refusent toute création d’un second compte `DIRECTION` ou administrateur principal (`403 Forbidden`).

---

## 2. Regroupement des rôles en double (migration sans perte)

La migration SQL met à jour sans perte les comptes existants :

| Ancien rôle | Nouveau rôle unifié | Profil de départ appliqué | Remarque |
| :--- | :--- | :--- | :--- |
| `CUISINE` | `CUISINIER` | Cuisinier | Écran `Cuisine` en modification uniquement ; aucun prix ni nom de client. |
| `CUISINIER` | `CUISINIER` | Cuisinier | Conservé à l’identique. |
| `SERVEUR` | `RESTAURANT` | Assistant(e) du restaurant | Écran `Restaurant` en modification ; jamais l’écran `Cuisine`. |
| `RESTAURANT` | `RESTAURANT` | Assistant(e) du restaurant | Conservé à l’identique. |

---

## 3. Matrice des 8 écrans attribuables et des 3 niveaux

Écrans attribuables :
1. `accueil` (`Accueil`, `/tableau-de-bord`)
2. `planning` (`Planning`, `/planning`)
3. `chambres` (`Chambres`, `/chambres`)
4. `clients` (`Clients`, `/clients`)
5. `facturation` (`Facturation`, `/facturation`)
6. `restaurant` (`Restaurant`, `/restaurant`)
7. `cuisine` (`Cuisine`, `/cuisine`)
8. `rapports` (`Rapports`, `/rapports`)

Niveaux par écran :
- `AUCUN` — Aucun accès (entrée absente de la barre latérale, `403` sur API, redirection côté navigateur vers le premier écran autorisé).
- `LECTURE` — Lecture seule.
- `ECRITURE` — Lecture et modification.

---

## 4. Droits particuliers (interrupteurs)

1. `voir_montants` — Voir les prix, totaux, soldes et chiffres d’affaires (masqués dans l’API, le SSE et l’interface si désactivé).
2. `encaisser_paiement` — Encaisser un paiement client (chambre ou restaurant).
3. `changer_etat_chambre` — Passer une chambre en nettoyage, prête ou maintenance.
4. `annuler_commande_ou_reservation` — Annuler une commande restaurant ou une réservation autorisée.

---

## 5. Actions réservées au directeur (non attribuables)

Ces actions restent strictement bloquées (`403`) pour tout autre compte :
- Menu `Administration` (`/administration` et `/api/administration/*`)
- Gestion de `La Carte` restaurant (création/modification/suppression de plats et prix)
- Apparence et paramètres généraux (`PATCH /api/hotel-settings`)
- Suppressions définitives (`DELETE` chambres, clients, factures, réservations, comptes)
- Émission d’avoirs (`POST /api/invoices/:id/credit-notes`) et annulation de paiement (`reverse`)
- Check-out forcé (`force: true` avec reste à payer)
- Réinitialisation des données et gestion des comptes

---

## 6. Correspondance des 6 profils de départ

| Profil de départ | Rôle technique sous-jacent | Accès par écran préremplis | Droits particuliers |
| :--- | :--- | :--- | :--- |
| **Assistant(e) de réception** | `RECEPTION` | `accueil`, `planning`, `chambres`, `clients`, `facturation`, `restaurant` en `ECRITURE` ; `cuisine` et `rapports` en `AUCUN` | Tous activés |
| **Assistant(e) du restaurant** | `RESTAURANT` | `restaurant` en `ECRITURE` ; tous les autres en `AUCUN` (`cuisine` verrouillé `AUCUN`) | `voir_montants`, `encaisser_paiement`, `annuler_commande_ou_reservation` |
| **Cuisinier** | `CUISINIER` | `cuisine` en `ECRITURE` ; tous les autres en `AUCUN` | Aucun (ni prix, ni nom client) |
| **Ménage** | `HOUSEKEEPING` | `chambres` en `LECTURE` ; tous les autres en `AUCUN` | `changer_etat_chambre` |
| **Technique** | `MAINTENANCE` | `chambres` en `LECTURE` ; tous les autres en `AUCUN` | Aucun |
| **Comptable** | `COMPTABLE` | `facturation` et `rapports` en `LECTURE` ; tous les autres en `AUCUN` | `voir_montants` |
