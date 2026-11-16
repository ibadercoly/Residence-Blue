# 03 — Logique métier manquante ou fausse

Audit en lecture seule, 17/11/2026. On distingue **cassé** (le code fait une erreur) et **absent** (le code ne fait rien).

## Ce qui est solide (vérifié dans le code)
- **Chevauchement de réservations** : double protection, transaction `Serializable` (`apps/api/src/reservations/reservations.service.ts:222`, `:272-285`, `:498`) et contrainte en base `reservations_no_overlap_active` (`btree_gist`, migration `20261112000000_reservation_refonte`).
- **Numéros de facture** : compteur atomique dans la transaction (`apps/api/src/billing/billing.service.ts:239-254`).
- **Montants en entiers FCFA** : tous les champs monétaires sont `Int` (`apps/api/prisma/schema.prisma:216-219`, `:256-266`, `:330`, `:368`, `:405-407`) ; arrondi au plus proche documenté (`billing.service.ts:124-190`).
- **Paiements rejoués** : `Payment.idempotencyKey` unique (`schema.prisma:338`) ; commandes restaurant idem (`:394`).
- **Fuseau Africa/Dakar** dans les rapports et l'accueil (`apps/api/src/rapports/rapports.service.ts:800`, `:831` ; `apps/api/src/accueil/accueil.service.ts:36-40`).
- **Annulations restaurant tracées** : qui, quand, motif (`schema.prisma:409-412`, `:428-433`).

## Constats

### LOG-001 — P0 — Cassé : planning calculé depuis une date fixe
- **Preuve** : `apps/web/src/app/core/services/planning-mock.service.ts:289-296` ; « aujourd'hui » = premier jour quand décalage = 0 (`:308`).
- **Risque** : la réception lit une semaine passée et prend une décision sur de mauvaises disponibilités.
- **Correction** : `baseDate` = date du jour en heure de Dakar ; « aujourd'hui » = comparaison de dates. **Effort** : petit.

### LOG-002 — P1 — À confirmer : taxe de séjour calculée sur les adultes seulement
- **Preuve** : `billing.service.ts:350` (`tourismTaxRate * res.adultsCount * res.nights`).
- **Risque** : montant légal faux si la règle locale inclut les enfants (ou exclut certains séjours).
- **Correction** : faire valider la règle par la comptable, puis l'écrire dans un test. **Effort** : petit.

### LOG-003 — P1 — Possible écart d'arrondi entre TVA « incluse » et TVA « ajoutée »
- **Preuve** : deux chemins dans le même calcul : HT retrouvé depuis un TTC (`billing.service.ts:140`, `:177`) puis TVA recalculée sur ce HT (`:148`, `:185`). Avec des arrondis successifs, HT + service + TVA peut différer de 1 FCFA du prix affiché.
- **Risque** : une facture de 1 FCFA différente du ticket ; perte de confiance.
- **Correction** : calculer la TVA comme `TTC − HT` quand le prix est TTC. Ajouter un test sur des prix « ronds » (5 000, 35 000). **Effort** : petit. **Statut** : non reproduit, à tester.

### LOG-004 — P1 — Année du numéro de facture prise sur l'horloge du serveur
- **Preuve** : `billing.service.ts:243` (`new Date().getFullYear()`).
- **Risque** : faible car Dakar = UTC+0 toute l'année ; il devient réel si le serveur est réglé sur un autre fuseau (ex. Europe/Paris) : une facture du 31/12 à 23h30 serait numérotée sur l'année suivante.
- **Correction** : calculer l'année en Africa/Dakar comme dans `rapports-date.util.ts:58-62`. **Effort** : petit.

### LOG-005 — P1 — Absent : le planning ne fonctionne pas hors ligne
- **Preuve** : `planning-mock.service.ts:242-256` : lecture directe `fetch('/api/reservations')`, erreur avalée (`catch {}`), aucune lecture IndexedDB ; les actions check-in / annulation (`:590-592`, `:620-621`) partent en `fetch` direct, sans file d'attente ni `Idempotency-Key`.
- **Risque** : coupure Internet = planning vide sans message ; une action faite hors ligne est perdue sans le dire. Contraire à la règle « hors ligne » du projet.
- **Correction** : afficher un message « Pas de connexion » et réutiliser la file d'attente existante pour ces actions. **Effort** : moyen.

### LOG-006 — P2 — Limitation des tentatives de connexion gardée en mémoire
- **Preuve** : `apps/api/src/auth/auth.service.ts:94-95` (`new Map`). Le verrou de compte en base existe aussi (`failedLogins`, `lockedUntil`, `schema.prisma:74-75`).
- **Risque** : redémarrer l'API remet les compteurs par adresse IP à zéro. Acceptable pour un seul serveur.
- **Correction** : aucune avant lancement ; le verrou en base suffit. **Classement** : peut attendre.

### LOG-007 — P2 — Rôles en double dans la base
- **Preuve** : `enum Role` contient `CUISINE` et `CUISINIER`, `RESTAURANT` et `SERVEUR`, `HOUSEKEEPING` et `MAINTENANCE` (`schema.prisma:11-21`).
- **Risque** : un compte créé avec l'ancien rôle peut avoir des droits inattendus (règle « Cuisine réservée au cuisinier »).
- **Correction** : vérifier qu'aucun compte n'utilise `CUISINE`/`SERVEUR` (requête en lecture), puis retirer ces valeurs par migration. **Effort** : petit à moyen.

### LOG-008 — P2 — Commandes restaurant : deux jeux de champs d'état
- **Preuve** : `schema.prisma:404` (`status`, anglais) et `:416` (`statut`, français), ainsi que `preparingAt/readyAt/servedAt` (`:413-415`) en double de `priseEnChargeAt/preteAt/serviAt` (`:419-426`).
- **Risque** : un rapport qui lit l'ancien champ donne des chiffres faux.
- **Correction** : choisir un seul jeu, migrer, supprimer l'autre. **Effort** : moyen.

## Non vérifié
Courses entre deux assistants qui encaissent la même note au même moment (les transactions de paiement sont en `ReadCommitted`, `billing.service.ts:1244`, `:1325`, `:1427`, `:1547` ; un verrou de ligne n'a pas été recherché) ; données orphelines en base réelle ; exactitude des rapports recalculée à la main.
