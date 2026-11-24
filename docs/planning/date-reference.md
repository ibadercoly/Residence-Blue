# Date de référence du planning en heure de Dakar

## Ce qui a changé
- Ajout de l'utilitaire réutilisable [`dakar-date.util.ts`](../../apps/web/src/app/core/utils/dakar-date.util.ts) :
  - `aujourdhuiDakar()` et `aujourdhuiDakarIso()` calculent la date du jour dans le fuseau officiel du Sénégal (`Africa/Dakar`) via `Intl.DateTimeFormat`, indépendamment du fuseau horaire du navigateur.
  - `estAujourdhuiDakar()` et `trouverIndexColonneAujourdhui()` identifient la colonne « Aujourd'hui » par comparaison explicite de dates (`dateIso === todayIso`).
  - `addDaysToIso()`, `getDayOfWeekFromIso()` et `formatPlanningPeriodLabel()` calculent les 7 colonnes et le libellé de période sans date ni mois codés en dur.
- Mise à jour de [`planning-mock.service.ts`](../../apps/web/src/app/core/services/planning-mock.service.ts) :
  - Suppression de `baseDate = new Date(2026, 10, 10)`, de `offset === 0 && i === 0`, de `'2026-11-10'` dans `dailyMetrics` et de `'nov. 2026'` dans `periodLabel`.
  - Ajout du signal `todayIso` mis à jour automatiquement au changement de jour (vérification toutes les minutes + retour sur l'onglet via `visibilitychange` et `focus`), sans recharger la page et sans perdre la navigation (`weekOffset`) ni la réservation ouverte (`selectedReservationId`).
- Mise à jour de [`planning-page.component.ts`](../../apps/web/src/app/features/planning/planning-page.component.ts) :
  - Remplacement des valeurs de repli `'2026-11-10'` par `planningService.todayIso()` et calcul du lendemain via `addDaysToIso`.
  - Exposition des attributs `data-date-iso` et `data-is-today` sur chaque en-tête de colonne.

## Pourquoi
Avant ce correctif, le planning s'ouvrait toujours sur la semaine du 10 novembre 2026 et considérait la première colonne comme « Aujourd'hui ». En production, la réception risquait de consulter une semaine passée et d'attribuer une chambre déjà occupée, ou de voir la date décalée sur un poste mal réglé.

## Comment c'est vérifié
- **Tests unitaires** ([`dakar-date.util.spec.ts`](../../apps/web/src/app/core/utils/dakar-date.util.spec.ts) et [`planning-mock.service.spec.ts`](../../apps/web/src/app/core/services/planning-mock.service.spec.ts)) :
  - jour ordinaire, fin de mois, 28 et 29 février bissextile, 31 décembre 23 h 59, 1er janvier 00 h 01, fuseaux navigateur différents (Tokyo UTC+9, New York UTC-5) ;
  - détection de la colonne « Aujourd'hui » par comparaison de dates ;
  - changement de jour la nuit (timer 60 s et `visibilitychange`) en préservant `weekOffset` et `selectedReservationId`.
- **Tests E2E Playwright** ([`planning-date-reference.spec.ts`](../../apps/web/e2e/planning-date-reference.spec.ts)) sur la base de test `residence_blue_e2e` :
  - horloge simulée à deux dates différentes (`2026-07-15` et `2027-01-01`), colonne « Aujourd'hui » exacte, absence du `2026-11-10`, navigation Précédent / Suivant / Aujourd'hui, et affichage d'une réservation réelle sur les bonnes dates.
