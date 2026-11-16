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

---

## 7. Restriction stricte de l’écran `Rapports` (`fix/rapports-acces-restreint`)

### Règle absolue
Seuls le compte **Directeur (administrateur principal)** et les comptes de profil **Comptable** ont accès à l’écran **Rapports**, à `GET /api/rapports`, aux exports PDF/Excel et aux agrégats associés. Le droit particulier `voir_montants` ne donne jamais accès à `Rapports`.

### Diagnostic des causes corrigées
1. **Attribution non verrouillée dans la gestion des comptes** : `AdministrationService` et la matrice UI « 3. Accès par écran » ne bloquaient que `cuisine` pour `ASSISTANT_RESTAURANT`, laissant la possibilité d’attribuer `rapports: 'LECTURE' | 'ECRITURE'` à un profil `ASSISTANT_RECEPTION` (ou tout autre profil) via l’interface ou un appel direct API.
2. **Contrôle serveur fondé uniquement sur le JSON `screenAccess.rapports`** : `GET /api/rapports` ne vérifiait que `@Acces('rapports', 'LECTURE')` (sans exiger `voir_montants` ni que le compte soit Directeur ou Comptable) et `hasScreenAccess` ne rejetait pas `rapports` pour les autres profils ayant reçu ou conservé une valeur non nulle en base.
3. **Inférence de rôle ambiguë** : `inferRoleFromScreenAccess` associait `rapports !== 'AUCUN'` combiné à `planning !== 'AUCUN'` au rôle `RECEPTION` lorsque le profil de départ n’était pas précisé.
4. **Exports financiers dépréciés et données agrégées ailleurs** : dans l’ancien module `/api/exports/download`, `EXPORT_DEFINITIONS` (`DAILY_SALES_CLOSURE_PDF`, `DAILY_SALES_CLOSURE_EXCEL`, `RESTAURANT_POOL_SALES_EXCEL`) mentionnait encore `Role.RECEPTION` ; sur l’écran Accueil (`GET /api/accueil/jour`) et Le Comptoir (`GET /api/invoices/counter`, `GET /api/invoices/archives`), les montants d’ensemble sont filtrés côté serveur par `voir_montants`, droit qui est activé par défaut pour `ASSISTANT_RECEPTION` (et sur les ventes restaurant pour `ASSISTANT_RESTAURANT`).

### Correctif appliqué
- Verrou côté serveur (`403 Forbidden`, message `« Seul le comptable peut voir les rapports »`) à la création/modification d’un compte non-Comptable avec `rapports !== 'AUCUN'` et dans `RapportsController` + `hasScreenAccess`.
- Option `Rapports` grisée et désactivée dans la fiche compte avec la mention `« Seul le comptable peut voir les rapports »` pour tout profil autre que `COMPTABLE`.
- Migration Prisma sans perte retirant l’accès `rapports` à tout compte ni Directeur ni Comptable sans modifier ses autres permissions, avec écriture dans `audit_log`.
