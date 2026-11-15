# Refonte Restaurant & Bar — Liste des suppressions et nouvelle architecture (`restaurant-v3/`)

## Objectif
Remplacer intégralement l'ancienne interface Restaurant / Cuisine / Gestion du menu (modales, tiroirs, mocks locaux, onglets) par une nouvelle implémentation isolée sous `apps/web/src/app/restaurant-v3/`, 100 % connectée à l'API NestJS / PostgreSQL (Prisma) et compatible hors ligne (`OutboxService` + `IdbService`).

## Anciens fichiers supprimés (`git rm`)
- `apps/web/src/app/features/restaurant/restaurant-page.component.ts`
- `apps/web/src/app/features/restaurant/restaurant-page.component.spec.ts`
- `apps/web/src/app/features/restaurant/kitchen-screen/kitchen-screen.component.ts`
- `apps/web/src/app/features/restaurant/menu-management-modal/menu-management-modal.component.ts`
- `apps/web/src/app/features/restaurant/menu-management-modal/menu-management-modal.component.html`
- `apps/web/src/app/core/services/menu-management.service.ts`
- `apps/web/src/app/core/services/menu-management.service.spec.ts`
- `apps/web/src/app/core/services/restaurant-mock.service.ts`
- `apps/web/src/app/core/services/restaurant-mock.service.spec.ts`
- `apps/web/e2e/restaurant.spec.ts`
- `apps/web/e2e/menu-management.spec.ts`
- `apps/web/e2e/menu-management-security.spec.ts`

## Nouvelle structure (`restaurant-v3/`)
Aucun import depuis `features/restaurant/`, `restaurant-mock.service`, `menu-management.service`, ni aucun composant visuel partagé (`app-stat-card`, `app-action-button`, `app-status-badge`, `app-modal-shell`, etc.). Seuls restent communs : la palette, les polices (`Manrope`, `Newsreader`), les icônes locales (`material-symbols`), le shell de navigation (`app-layout`), `AuthService` et les services offline (`IdbService`, `NetworkService`, `OutboxService`).

### Fichiers à créer / modifier
1. **Documentation & Design :**
   - `docs/restaurant/REFONTE.md`
   - `docs/restaurant/DESIGN.md`
   - `docs/securite/ROLES.md`
2. **Base de données & Types partagés :**
   - `apps/api/prisma/schema.prisma` + nouvelle migration (`cancellationReason`, `cancelledAt`, `cancelledByName`, `guestName`, `preparingAt`, `readyAt`, `servedAt`, index de pagination)
   - `packages/shared/src/restaurant.ts` (types V3 stricts en entiers FCFA, statuts normalisés, pagination par lots de 50, destinations `ROOM | TABLE | TAKEAWAY`)
3. **Backend API (`apps/api/src/restaurant/`) :**
   - `apps/api/src/restaurant/restaurant-image.util.ts` (validation JPEG/PNG/WebP ≤ 2 Mo par magic bytes, nom UUID unique, miniature 200 px via `sharp`, suppression de l'ancienne image au remplacement)
   - `apps/api/src/restaurant/dto/restaurant.dto.ts` (validation stricte DTO produits, commandes, annulation avec motif, pagination lots de 50)
   - `apps/api/src/restaurant/restaurant.service.ts` (prix snapshot serveur, séjour `CHECKED_IN` obligatoire pour charge chambre, transaction atomique commande + lignes `RESTAURANT` sur note de séjour, transaction atomique table/emporter commande + paiement + note `Client de passage`, idempotence `Idempotency-Key`, 409 suppression produit avec historique, flux SSE temps réel cuisine, journalisation `appendChainedAuditLog`, RBAC)
   - `apps/api/src/restaurant/restaurant.controller.ts` (routes `/categories`, `/products`, `/products/:id/image`, `/rooms-in-stay`, `/orders`, `/orders/stream`, `/orders/:id/status`, `/orders/:id/cancel`, `/orders/:id/pay` avec `@Roles` stricts)
   - `apps/api/src/billing/billing.service.ts` (cohérence `syncOpenStayNotesAndRoomOrders` uniquement sur séjours `CHECKED_IN` non annulés)
4. **Frontend (`apps/web/src/app/restaurant-v3/` + routes) :**
   - `apps/web/src/app/restaurant-v3/models/restaurant-v3.model.ts`
   - `apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts`
   - `apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts` (`/restaurant`)
   - `apps/web/src/app/restaurant-v3/components/kitchen-board-page.component.ts` (`/cuisine`)
   - `apps/web/src/app/restaurant-v3/components/carte-admin-page.component.ts` (`/restaurant/carte`)
   - `apps/web/src/app/app.routes.ts`
5. **Tests (base E2E séparée `residence_blue_e2e` uniquement) :**
   - `apps/api/test/restaurant-v3.e2e-spec.ts` (intégration & sécurité API)
   - `apps/web/src/app/restaurant-v3/services/restaurant-v3.service.spec.ts`
   - `apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.spec.ts`
   - `apps/web/e2e/restaurant-v3.spec.ts` (Playwright complet sur base isolée)
   - `apps/web/e2e/visual-comparison.spec.ts` (mise à jour contrôle structure/palette/0 overflow `/restaurant`)
