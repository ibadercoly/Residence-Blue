# Journal de Refonte — Module Facturation (`feature/facturation-refonte`)

> **Date :** 12 novembre 2026  
> **Branche :** `feature/facturation-refonte` (depuis `master`)

## 1. Règle d'or — Suppression de l'ancien écran (`git rm`)

Les fichiers suivants de l'ancien écran Facturation, de son service mock et de ses anciens tests visuels/E2E ont été **supprimés via `git rm`** avant la création du nouveau dossier :

1. `apps/web/src/app/features/facturation/facturation-page.component.ts`
2. `apps/web/src/app/features/facturation/facturation-page.component.spec.ts`
3. `apps/web/src/app/core/services/facturation-mock.service.ts`
4. `apps/web/src/app/core/services/facturation-mock.service.spec.ts`
5. `apps/web/e2e/facturation-folio.spec.ts`
6. `apps/web/e2e/facturation-folio-security.spec.ts`
7. `docs/design/comparaisons/actual_facturation_folio.png`
8. `docs/design/comparaisons/diff_facturation_folio.png`
9. `docs/design/comparaisons/ref_facturation_folio.png`

## 2. Architecture de la nouvelle interface (`apps/web/src/app/facturation-v3/`)

- **Rupture totale :** aucun fichier dans `apps/web/src/app/facturation-v3/` n'importe de composant, service, style ou mock de l'ancien écran (`features/facturation` ou `FacturationMockService`).
- **Éléments partagés conservés uniquement :** palette (`tailwind.config.js`), polices (`Manrope`, `Newsreader`), et coque de navigation (`LayoutComponent`).
- **Composants dédiés (tous `ChangeDetectionStrategy.OnPush`, `track` sur chaque boucle `@for`, annulation `AbortController` des requêtes obsolètes) :**
  - `apps/web/src/app/facturation-v3/models/facturation.model.ts`
  - `apps/web/src/app/facturation-v3/services/facturation.service.ts`
  - `apps/web/src/app/facturation-v3/components/comptoir-page.component.ts` (`/facturation`)
  - `apps/web/src/app/facturation-v3/components/note-sejour-page.component.ts` (`/facturation/:id`)
