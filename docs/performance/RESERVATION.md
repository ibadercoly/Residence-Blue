# Audit de Performance & Refonte — Fenêtre « Nouvelle réservation »

> **Branche :** `feature/reservation-refonte`  
> **Date de mesure AVANT :** 12 novembre 2026  
> **Environnement :** Build de production Angular (`http://localhost:4200`), API NestJS (`http://localhost:3000`), Edge/Chromium 1366×768 via Playwright + Chrome DevTools Protocol (CDP `Performance.getMetrics` & `Tracing`).

---

## ÉTAPE 1 — Mesures AVANT correction (code historique)

| Métrique | Mesure AVANT | Budget cible (après) | Verdict AVANT |
| :--- | :---: | :---: | :---: |
| **Temps clic → fenêtre utilisable** | **429 ms** | < 150 ms (hors réseau) | ❌ 2,86× au-dessus du budget |
| **Latence d'une frappe (jusqu'à rAF)** | **208,97 ms** moy. / **421,4 ms** max | < 50 ms | ❌ Dépassement critique |
| **Événements `input` (CDP `Tracing`)** | 0,34–4,84 ms JS + 16 `Layout` / 42 `UpdateLayoutTree` / 24 `Paint` | Minimisés, `transform`/`opacity` seuls | ⚠️ Recalculs de layout fréquents |
| **Nœuds DOM dans la fenêtre** | **233 nœuds** (426 total page) | ≤ 300 nœuds | ⚠️ Chargée de décorations + image |
| **Requêtes API à l'ouverture** | **0 requête API** (100% mocks statiques) | ≤ 2 requêtes, < 20 Ko total | ❌ Aucune donnée réelle |
| **Cycles de détection de changements / frappe** | Arbre complet `Default` (Layout + Sidebar + Header + ModalShell + Modal) + méthodes appelées au template (`isFormDirty()`, `roomsCatalog` getter) | `OnPush` isolé + signaux fins | ❌ `ChangeDetectionStrategy.Default` partout |
| **Mémoire JS Heap (10 ouvertures/fermetures)** | `5,52 Mo` → `5,65 Mo` (`Nodes: 782 → 783`, `JSEventListeners: 82`) | Stable sur 20 ouvertures | ✅ Pas de fuite majeure sur 10 cycles mais instance montée en permanence |
| **Poids du code de la fenêtre** | **Dans `main-OXR6LEPG.js` (248 605 octets)** — Source : **62 836 octets** (`1 213` lignes) + service `10 188` octets | Chargement différé (`@defer`) — **0 octet** dans `main.js` | ❌ Chargé au démarrage de toute l'app |
| **Barre de défilement verticale** | `overflow-y: auto`, `offsetWidth = 960`, `clientWidth = 960` (largeur barre = 0 px visible) | Toujours visible (`10–12 px`), `scrollbar-gutter: stable` | ❌ Invisible / non réservée |

### Causes réelles identifiées dans le code existant

1. **Absence totale de lazy loading (`LayoutComponent`) :** `NewReservationModalComponent` (62,8 Ko de TS) était importé directement dans `LayoutComponent` et monté dans le DOM dès le chargement initial de l'application.
2. **Absence de `ChangeDetectionStrategy.OnPush` :** `LayoutComponent`, `ModalShellComponent` et `NewReservationModalComponent` utilisaient `ChangeDetectionStrategy.Default`. Chaque frappe ou clic déclenchait une passe de détection sur toute l'arborescence et réévaluait des accesseurs (`roomsCatalog`, `formatMoney()`, `isFormDirty()`).
3. **Effets visuels coûteux :** `ModalShellComponent` appliquait `backdrop-blur-md` (`backdrop-filter: blur(12px)`) sur tout le fond d'écran et une ombre portée lourde (`0 24px 48px -12px`), forçant des repaints coûteux (~209 ms jusqu'au frame suivant lors de la frappe) et un `setTimeout(..., 50)` sur le focus à l'ouverture (contribuant aux 429 ms d'ouverture).
4. **Chargement d'image de chambre inutile :** Une balise `<img>` (`/assets/images/chambres/...-800w.webp`, avec fallback `.jpg` jusqu'à 225 Ko) était rendue dans le récapitulatif.
5. **Données 100 % fictives et figées :** `regularGuests`, `categoryOptions`, `defaultRoomsCatalog` et dates `2024-05-30` → `2024-06-02` étaient codées en dur dans le frontend sans interroger PostgreSQL (`GET /api/rooms/available`, `GET /api/guests?search=...&limit=5`), ni enregistrer en base via une transaction atomique.
6. **Barre de défilement invisible :** Le conteneur `<main>` utilisait `overflow-y: auto` sans `scrollbar-gutter: stable` ni style explicite (`::-webkit-scrollbar` / `scrollbar-width: auto`).

---

## Plan d'architecture (Refonte)

- **Backend NestJS / PostgreSQL :**
  - `GET /api/rooms/available?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&category=&adults=&children=` : renvoie uniquement les chambres actives, hors `MAINTENANCE`, sans réservation chevauchante (`status NOT IN ('CANCELLED', 'NO_SHOW')`), avec tarif nuitée, capacité et catégorie.
  - `GET /api/guests/search?q=...&limit=5` (ou `GET /api/guests?search=...&limit=5`) : recherche légère limitée à 5 résultats (`id, fullName, phone`).
  - `GET /api/hotel-settings` (ou tarifs inclus / endpoint existant) mis en cache court côté client.
  - `POST /api/reservations` : transaction Prisma atomique (`IsolationLevel.Serializable` + contrainte d'exclusion PostgreSQL `btree_gist` sur `(room_id, daterange(check_in_date, check_out_date, '[)')) WHERE status NOT IN ('CANCELLED', 'NO_SHOW')`) créant éventuellement le client rapide (téléphone sénégalais validé), la réservation (avec prix & taxe recalculés côté serveur, validation capacité et dates), le paiement d'acompte éventuel (facture/acompte + mode de paiement + référence sans numéro de carte), et les écritures `AuditLog`. Conflit → `409 Conflict` avec message exact : `« Cette chambre vient d'être réservée, choisissez-en une autre »`.
- **Frontend Angular (Standalone + `OnPush` + `@defer`) :**
  - Suppression de l'ancienne fenêtre `new-reservation-modal` et de ses styles.
  - Nouveaux composants dédiés dans `apps/web/src/app/features/reservation-modal/` chargés paresseusement via `@defer (when modalService.isOpen())` dans `LayoutComponent` avec squelette immédiat (`< 150 ms`).
  - Constante `SCROLLBAR_SIDE: 'right' | 'left' = 'right'` dans `apps/web/src/app/core/config/reservation-modal.config.ts`.
  - Trois zones fixes (En-tête fixe, Corps défilant 2 colonnes / 1 colonne mobile + barre récapitulatif mobile fixée au-dessus du pied, Pied fixe) avec `overflow-y: scroll; scrollbar-gutter: stable;` et largeur `11px` contrastée.
  - Sections numérotées `1. Séjour`, `2. Client`, `3. Paiement et notes`, plus colonne droite récapitulatif fixe.
  - Mises à jour immédiates de `PlanningMockService`, `RoomsService`, `ClientsService` et `DashboardMockService` / KPI après `POST /api/reservations`.

---

## ÉTAPE 5 — Mesures APRÈS refonte

*(Section complétée après implémentation, tests et mesures de vérification.)*
