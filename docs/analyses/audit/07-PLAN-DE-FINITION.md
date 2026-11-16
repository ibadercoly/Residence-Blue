# 07 — Plan de finition

Ordre imposé : sécurité et données, puis logique métier, puis interfaces, puis confort.
Chaque lot se donne **seul** à un agent de code, sur sa propre branche, avec tous les tests verts avant fusion.

---

## Lot 1 — Sécurité de base (P0/P1) — modèle conseillé : medium
- **Objectif** : fermer les portes inutiles et refuser de démarrer sans secrets.
- **Supprimer** : chargement de `SecurityTestController` hors test (`apps/api/src/app.module.ts:22`, `:45`) ; routes `/users` (`apps/api/src/auth/auth.controller.ts:164-205`) après vérification que l'écran ne les appelle plus ; import inutilisé `hasScreenAccess` (`restaurant.controller.ts:28`).
- **Corriger** : clé de secours (`apps/api/src/common/security/crypto.service.ts:29-31`) → erreur au démarrage si `NODE_ENV !== 'test'` et clé absente.
- **Constats** : SEC-001, SEC-002, SEC-004.
- **Migration** : aucune.
- **Tests** : `security-test/*` → 404 en production ; démarrage refusé sans clé ; `/users` → 404 ; tests de sécurité existants toujours verts (ils doivent tourner avec `NODE_ENV=test`).
- **Effort** : petit.

## Lot 2 — HTTPS, santé et sauvegarde hors site (P0/P1) — modèle : high
- **Objectif** : pouvoir exploiter sans perdre de données ni exposer de mots de passe.
- **Ajouter** : proxy HTTPS unique dans `docker-compose.prod.yml` ; retirer la publication du port 3000 ; `healthcheck` de l'API sur `/api/health` ; copie hors site de `scripts/backup.sh` ; page `docs/exploitation.md` (installer, mettre à jour, revenir en arrière) ; variables manquantes dans `.env.example` (`COOKIE_SECURE`, `MEDIA_DIR`, `BACKUP_AGE_RECIPIENT`, `BACKUP_DIR`) ; alerte simple si l'API ou la sauvegarde échoue.
- **Constats** : EXP-001 à EXP-006.
- **Migration** : aucune.
- **Tests** : restauration complète d'une sauvegarde sur une base vide (base de test), puis `npm run verify:integrity` ; migrations rejouées sur base vide (DAT-005).
- **Effort** : moyen.

## Lot 3 — Données de démonstration hors production (P0/P1) — modèle : medium
- **Objectif** : aucun écran ne doit parler de « démonstration ».
- **Supprimer** : bandeau et bouton « Mode Démonstration » (`dashboard-page.component.ts:20-44`, `:374-383`), `resetDemoData` et `isDemoDataActive` (`module-config.service.ts:392`, `:511`), `dashboard-mock.service.ts` et son test, tableau `initialReservations` (`planning-mock.service.ts:48-211`).
- **Renommer** : `PlanningMockService` → `PlanningService` (sans changer son comportement).
- **Constats** : INT-001, INT-007, DAT-006.
- **Migration** : aucune.
- **Tests** : E2E « l'accueil ne contient pas le mot démonstration » ; recherche dans le paquet construit qu'aucun faux nom (ex. « mamadou.diop ») n'y figure.
- **Effort** : petit.

## Lot 4 — Planning sur la vraie date (P0) — modèle : medium
- **Objectif** : le planning s'ouvre sur la semaine du jour, en heure de Dakar.
- **Corriger** : `baseDate` et `isToday` (`planning-mock.service.ts:289-308`).
- **Constats** : MET-001 / LOG-001 / INT-002.
- **Tests** : unitaire avec une horloge simulée (fin de mois, fin d'année) ; E2E « la colonne Aujourd'hui = date du jour ».
- **Effort** : petit.

## Lot 5 — Import Excel (P0) — modèle : high
- **Objectif** : charger une seule fois les clients et les réservations à venir depuis les fichiers Excel de l'hôtel.
- **Ajouter** : un script en ligne de commande `scripts/importer-excel.ts` (pas d'écran) : mode « essai » qui n'écrit rien et liste les lignes refusées, puis mode « import » en une transaction ; pièces d'identité chiffrées ; doublons de téléphone signalés ; journal d'actions.
- **Constats** : MET-003 / EXP-007.
- **Dépendance** : `exceljs` déjà présente (aucune nouvelle).
- **Migration** : aucune.
- **Tests** : fichier d'exemple avec erreurs ; rejouer l'import ne crée pas de doublon ; refus des chevauchements (la contrainte en base s'applique).
- **Effort** : moyen.

## Lot 6 — Justesse des montants (P1) — modèle : high
- **Objectif** : factures exactes au franc près.
- **Corriger** : TVA = TTC − HT quand le prix est TTC (`billing.service.ts:140-148`, `:177-185`) ; année du numéro en heure de Dakar (`:243`) ; règle de taxe de séjour validée par la comptable (`:350`).
- **Constats** : LOG-002, LOG-003, LOG-004.
- **Migration** : aucune (les factures déjà émises ne changent pas).
- **Tests** : tableau de cas (5 000, 35 000, 47 500 FCFA ; avec/sans remise ; avec/sans service) ; facture créée le 31/12 à 23 h 59.
- **Effort** : petit.

## Lot 7 — Clôture de caisse (P1) — modèle : high
- **Objectif** : fermer la caisse en fin de journée avec le montant compté et l'écart.
- **Remplacer** (pas ajouter) : le bouton d'export de clôture par « Fermer la caisse » dans Facturation ; réutiliser `GET /api/invoices/cash-closure/export` (`billing.controller.ts:101-116`).
- **Constats** : MET-002 / INT-005.
- **Migration** : une table de clôtures (ajout seul, sans perte).
- **Tests** : intégration (totaux par moyen de paiement, remboursements déduits) ; droits (comptable lecture, réception écriture, autres 403) ; E2E à 360 px.
- **Effort** : moyen.

## Lot 8 — Paramètres de l'hôtel (P1) — modèle : medium
- **Objectif** : la directrice modifie nom légal, NINEA, TVA, taxe de séjour sans développeur.
- **Ajouter** : une carte « Hôtel » dans Administration (écran existant) branchée sur `PATCH /api/hotel-settings` (`settings.controller.ts:18`).
- **Supprimer** : les 6 routes de modules reportés qui ouvrent le tableau de bord (`app.routes.ts:164-226`), y compris `/parametres`.
- **Constats** : INT-003, INT-004.
- **Tests** : directeur seul (403 pour les autres) ; une facture émise après changement porte la nouvelle valeur, les anciennes non.
- **Effort** : moyen.

## Lot 9 — Hors ligne du planning (P1) — modèle : high
- **Objectif** : message clair sans connexion ; actions mises en file d'attente avec `Idempotency-Key`.
- **Corriger** : `planning-mock.service.ts:242-256`, `:590-621`.
- **Constat** : LOG-005.
- **Tests** : E2E hors ligne (check-in puis retour réseau = un seul check-in).
- **Effort** : moyen.

## Lot 10 — Confort et nettoyage (P2) — modèle : medium
- Cloche : la masquer pour les profils sans Restaurant ou ouvrir leurs messages (SEC-003).
- Flux temps réel des chambres pour le Ménage (SEC-005).
- Rôles obsolètes `CUISINE`/`SERVEUR` (LOG-007, migration après comptage en lecture).
- Champs d'état en double des commandes (LOG-008, migration sans perte).
- Prix de chambre obligatoire à la création (DAT-003).
- Mise à jour `@typescript-eslint` (SEC-007).
- **Effort** : moyen au total ; à faire après le lancement.

## À ne pas faire (pour garder le logiciel simple)
- Parcours « mot de passe oublié » par courriel (INT-006) : la directrice réinitialise dans Administration.
- Écrans Ménage et Maintenance séparés : l'état de la chambre dans Chambres suffit.
- Réécriture des gros fichiers : les découper seulement quand on les modifie (INT-008).
