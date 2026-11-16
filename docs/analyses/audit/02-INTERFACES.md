# 02 — Interfaces manquantes ou incomplètes

Audit en lecture seule, 17/11/2026. Chaque constat : gravité, preuve, risque, correction, effort.
Rappel de la règle : on ne propose rien qui ajoute un bouton sans en retirer un autre.

## INT-001 — P0 — Bandeau « Mode Démonstration Actif » visible en production
- **Ce qui est cassé** : l'accueil affiche toujours un bandeau « Mode Démonstration Actif » et, pour la directrice ou la réception, un bouton « Réinitialiser les données de démonstration ».
- **Preuve** : `apps/web/src/app/features/dashboard/pages/dashboard-page/dashboard-page.component.ts:20-44` (bandeau sans condition, bouton `btn-reset-demo` sous `@if (isDirector() || canAccessPlanning())` ligne 39), `:374-383` (`confirmResetDemo` → `moduleConfig.resetDemoData()`), `apps/web/src/app/core/services/module-config.service.ts:392` (`isDemoDataActive = signal(true)`), `:511-513`.
- **Risque** : la directrice croit que ses vraies données sont fictives ; un clic sur « Réinitialiser » vide des données locales du navigateur (`localStorage`).
- **Correction** : supprimer le bandeau, le bouton et `resetDemoData`. Rien n'est ajouté. **Effort** : petit. **Classement** : indispensable.

## INT-002 — P0 — Planning ouvert sur une semaine figée
- Voir MET-001 (`planning-mock.service.ts:289-308`). La colonne « aujourd'hui » est toujours le 10/11/2026.

## INT-003 — P1 — Pas d'écran pour les paramètres de l'hôtel
- **Ce qui est absent** : l'API sait modifier les paramètres (nom légal, TVA, taxe de séjour), mais l'adresse `/parametres` ouvre le tableau de bord.
- **Preuve** : `apps/api/src/settings/settings.controller.ts:18` (`PATCH`), `apps/web/src/app/app.routes.ts:192-198` (`parametres` → `DashboardPageComponent`).
- **Risque** : impossible de corriger le taux de taxe de séjour ou l'en-tête des factures sans développeur.
- **Correction** : une petite carte « Hôtel » dans Administration (qui existe déjà), pas de nouvelle entrée de menu. **Effort** : moyen. **Classement** : indispensable (les factures portent ces informations).

## INT-004 — P1 — Adresses inconnues renvoyées vers le tableau de bord sans message
- **Preuve** : `app.routes.ts:227-230` (`'**'` → `tableau-de-bord`). Les modules reportés (`housekeeping`, `maintenance`, `stocks`, `marketing`, `channel-manager`, `comptabilite`) chargent aussi le tableau de bord (`:164-226`).
- **Risque** : faible ; mais un lien cassé ne se voit jamais. Pas de page « 403 / accès refusé » ni « serveur indisponible » dédiée (non trouvée dans `app.routes.ts`).
- **Correction** : supprimer les 6 routes des modules reportés (code mort) ; garder la redirection, avec un message court « Page introuvable ». **Effort** : petit. **Classement** : peut attendre (P1 pour le nettoyage).

## INT-005 — P2 — Clôture de caisse : un export, pas un écran
- Voir MET-002. Remplacer le bouton d'export par « Fermer la caisse ».

## INT-006 — P2 — Mot de passe oublié
- **Constat** : il existe `/changer-mot-de-passe` (`app.routes.ts:17`) et un indicateur `mustChangePassword` (`schema.prisma:67`) pour la première connexion. Aucun parcours « mot de passe oublié » trouvé.
- **Avis** : **à ne pas faire** (pas de courriel fiable à l'hôtel) ; la directrice réinitialise le mot de passe dans Administration. Vérifier que ce bouton existe (non vérifié).

## INT-007 — P2 — Code mort livré au navigateur
- `apps/web/src/app/core/services/dashboard-mock.service.ts` : utilisé seulement par son test (`dashboard-mock.service.spec.ts`). Il contient des textes interdits par ADAPTATION-THIES (`marineWeather`, `waterTemp`, `poolTemp`, lignes 73-82).
- `planning-mock.service.ts:48-211` : tableau `initialReservations` de faux clients (ex. « mamadou.diop@orange-sonatel.sn », ligne 208) jamais lu (`allReservations` démarre vide, ligne 214).
- Le service s'appelle encore « Mock » alors qu'il parle à l'API ; le commentaire `TODO(API)` ligne 29 est faux.
- **Correction** : supprimer le service fictif, le tableau, renommer en `PlanningService`. **Effort** : petit.

## INT-008 — P2 — Fichiers d'écran énormes (difficiles à corriger sans casser)
| Fichier | Lignes |
|---|---|
| `features/clients/clients-page.component.ts` | 1 615 |
| `features/rapports/rapports-charts.component.ts` | 1 489 |
| `features/rooms/rooms.component.ts` | 1 444 |
| `restaurant-v3/components/restaurant-pos-page.component.ts` | 1 383 |
| `core/services/rooms.service.ts` | 1 327 |
| `facturation-v3/components/note-sejour-page.component.ts` | 1 224 |
| `features/reservation-modal/reservation-modal.component.ts` | 1 199 |
| `restaurant-v3/components/cuisine-ecran-page.component.ts` | 1 038 |
| `restaurant-v3/services/restaurant-v3.service.ts` | 1 019 |
- **Correction** : ne pas réécrire ; découper seulement quand on touche le fichier. **Classement** : peut attendre.

## Non vérifié dans cet audit
États vides, messages d'erreur et états de chargement écran par écran ; aide à l'écran ; contrastes ; navigation au clavier. Les tests E2E existants couvrent le défilement horizontal (360 à 1440 px) pour les écrans récents, mais n'ont pas été relancés ici.
