import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  BillingCounterFilter,
  BillingSortField,
  BillingSortOrder,
  BillingSummaryCard,
} from '@residence-blue/shared';
import { FacturationService } from '../services/facturation.service';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import {
  BILLING_SHARED_TABLE_STYLES,
  billingStatusBadge,
  formatFcfaPlain,
  nextSortState,
} from '../models/facturation.model';

interface FilterPillOption {
  key: BillingCounterFilter;
  label: string;
}

@Component({
  selector: 'app-comptoir-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    BILLING_SHARED_TABLE_STYLES,
    `
      .rb-grid-kpi {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      @media (min-width: 1024px) {
        .rb-grid-kpi {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
      }

      .rb-grid-cash {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      @media (min-width: 640px) {
        .rb-grid-cash {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (min-width: 1024px) {
        .rb-grid-cash {
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }
      }
    `,
  ],
  template: `
    <div class="rb-wrap" data-testid="facturation-comptoir">
      <!-- En-tête -->
      <header class="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="min-w-0">
          <h1 class="rb-title text-3xl font-bold leading-tight">Facturation</h1>
          <p class="mt-1 text-sm font-medium text-[#3d494a]">
            Le Comptoir — Notes ouvertes, encaissements et check-out rapide
          </p>
        </div>

        <a
          routerLink="/facturation/archives"
          data-testid="link-all-invoices"
          class="rb-btn rb-btn-outline self-start md:self-auto"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">inventory_2</span>
          <span>Voir toutes les factures</span>
        </a>
      </header>

      @if (service.errorMessage()) {
        <div
          role="alert"
          class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ba1a1a] bg-[#ffdad6] px-4 py-3 text-sm font-semibold text-[#410002]"
        >
          <span>{{ service.errorMessage() }}</span>
          <button
            type="button"
            (click)="service.clearMessages()"
            class="min-h-[36px] rounded-lg border border-[#ba1a1a] bg-white px-3 text-xs font-bold text-[#93000a]"
          >
            Fermer
          </button>
        </div>
      }

      @if (service.successMessage()) {
        <div
          role="status"
          data-testid="comptoir-success-banner"
          class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#00666f] bg-[#d8f0f2] px-4 py-3 text-sm font-semibold text-[#004f56]"
        >
          <span>{{ service.successMessage() }}</span>
          <button
            type="button"
            (click)="service.clearMessages()"
            class="min-h-[36px] rounded-lg border border-[#00666f] bg-white px-3 text-xs font-bold text-[#00666f]"
          >
            Fermer
          </button>
        </div>
      }

      <!-- 4 tuiles KPI -->
      <section aria-label="Indicateurs de facturation" class="mb-4">
        @if (showSkeleton()) {
          <div class="rb-grid-kpi" data-testid="comptoir-skeleton-kpi">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="rb-card p-4">
                <div class="rb-skeleton mb-3 h-4 w-28"></div>
                <div class="rb-skeleton h-8 w-36"></div>
              </div>
            }
          </div>
        } @else {
          <div class="rb-grid-kpi" data-testid="comptoir-kpis">
            <article class="rb-card p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">À encaisser</p>
              <p class="rb-title mt-2 text-2xl font-bold text-[#ba1a1a]" data-testid="kpi-to-collect">
                {{ formatFcfa(kpis().toCollectFcfa) }}
              </p>
            </article>

            <article class="rb-card p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">
                Encaissé aujourd'hui
              </p>
              <p class="rb-title mt-2 text-2xl font-bold text-[#00666f]" data-testid="kpi-collected-today">
                {{ formatFcfa(kpis().collectedTodayFcfa) }}
              </p>
            </article>

            <article class="rb-card p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">Notes impayées</p>
              <p class="rb-title mt-2 text-2xl font-bold text-[#161d20]" data-testid="kpi-unpaid">
                {{ kpis().unpaidCount }} {{ kpis().unpaidCount > 1 ? 'notes' : 'note' }}
              </p>
            </article>

            <article class="rb-card p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">
                Départs à régler aujourd'hui
              </p>
              <p class="rb-title mt-2 text-2xl font-bold text-[#161d20]" data-testid="kpi-departures">
                {{ kpis().departuresTodayToSettleCount }}
                {{ kpis().departuresTodayToSettleCount > 1 ? 'départs' : 'départ' }}
              </p>
            </article>
          </div>
        }
      </section>

      <!-- Bande Caisse du jour -->
      <section aria-label="Caisse du jour" class="rb-card mb-5 p-4">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-sm font-extrabold uppercase tracking-wider text-[#161d20]">
              Caisse du jour
            </h2>
            <p class="text-xs font-medium text-[#3d494a]">
              Totaux encaissés aujourd'hui par mode de règlement (hors annulations)
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            @if (service.canCloseCash()) {
              @if (!isCashClosedToday()) {
                <button
                  type="button"
                  data-testid="btn-open-cash-closure"
                  (click)="openCashClosureModal()"
                  class="rb-btn rb-btn-primary"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                    >point_of_sale</span
                  >
                  <span>Fermer la caisse</span>
                </button>
              } @else {
                <span
                  data-testid="cash-closed-today-badge"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
                >
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">task_alt</span>
                  <span>Caisse fermée aujourd'hui</span>
                </span>
                <button
                  type="button"
                  data-testid="btn-reopen-cash-closure"
                  (click)="requestReopenCashClosure()"
                  class="rb-btn rb-btn-outline"
                >
                  <span>Nouvelle clôture</span>
                </button>
              }
            }

            @if (service.canManageCreditsAndExport()) {
              <button
                type="button"
                data-testid="export-closure-pdf"
                (click)="service.downloadCashClosure('pdf')"
                class="rb-btn rb-btn-outline"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                  >picture_as_pdf</span
                >
                <span>Exporter la clôture de caisse (PDF)</span>
              </button>
              <button
                type="button"
                data-testid="export-closure-excel"
                (click)="service.downloadCashClosure('excel')"
                class="rb-btn rb-btn-outline"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                  >table_view</span
                >
                <span>Exporter la clôture (Excel)</span>
              </button>
            }
          </div>
        </div>

        <div class="rb-grid-cash" data-testid="daily-cash-cards">
          <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-3">
            <div class="text-xs font-bold text-[#3d494a]">Espèces</div>
            <div class="mt-1 text-base font-extrabold text-[#161d20]">
              {{ formatFcfa(dailyCash().byMethod.CASH) }}
            </div>
          </div>
          <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-3">
            <div class="text-xs font-bold text-[#3d494a]">Orange Money</div>
            <div class="mt-1 text-base font-extrabold text-[#161d20]">
              {{ formatFcfa(dailyCash().byMethod.ORANGE_MONEY) }}
            </div>
          </div>
          <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-3">
            <div class="text-xs font-bold text-[#3d494a]">Wave</div>
            <div class="mt-1 text-base font-extrabold text-[#161d20]">
              {{ formatFcfa(dailyCash().byMethod.WAVE) }}
            </div>
          </div>
          <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-3">
            <div class="text-xs font-bold text-[#3d494a]">Carte</div>
            <div class="mt-1 text-base font-extrabold text-[#161d20]">
              {{ formatFcfa(dailyCash().byMethod.CARD) }}
            </div>
          </div>
          <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-3">
            <div class="text-xs font-bold text-[#3d494a]">Virement</div>
            <div class="mt-1 text-base font-extrabold text-[#161d20]">
              {{ formatFcfa(dailyCash().byMethod.BANK_TRANSFER) }}
            </div>
          </div>
        </div>
      </section>

      <!-- Barre Recherche + Pastilles de filtre au-dessus du tableau -->
      <section aria-label="Filtres et recherche du comptoir" class="rb-card p-3 md:p-4 mb-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filtres rapides">
            @for (pill of filterPills; track pill.key) {
              <button
                type="button"
                [attr.data-testid]="'filter-pill-' + pill.key"
                (click)="setFilter(pill.key)"
                class="rb-pill"
                [class.rb-pill-active]="activeFilter() === pill.key"
                [attr.aria-pressed]="activeFilter() === pill.key"
              >
                {{ pill.label }}
              </button>
            }
          </div>

          <div class="w-full lg:max-w-md min-w-0">
            <label for="comptoir-search" class="sr-only">
              Rechercher par client, chambre ou numéro de note
            </label>
            <div class="relative flex items-center">
              <span
                class="material-symbols-outlined pointer-events-none absolute left-3 text-[#3d494a] text-[20px]"
                aria-hidden="true"
                >search</span
              >
              <input
                #searchInput
                id="comptoir-search"
                data-testid="comptoir-search-input"
                type="text"
                role="searchbox"
                autofocus
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
                placeholder="Rechercher : client, chambre, n° note..."
                class="min-h-[42px] w-full rounded-xl border border-[#7c8c8e] bg-white pl-10 pr-20 py-2 text-sm font-medium text-[#161d20] placeholder-[#4a5759] focus:border-[#00666f] focus:outline-none focus:ring-2 focus:ring-[#00666f]/25"
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  (click)="clearSearch()"
                  class="absolute right-8 rounded-md px-2 py-1 text-xs font-bold text-[#00666f] hover:bg-[#e6f3f4]"
                  aria-label="Effacer la recherche"
                >
                  Effacer
                </button>
              }
              <kbd
                class="pointer-events-none absolute right-2.5 hidden sm:inline-flex items-center rounded border border-[#bdc9ca] bg-[#f3fafe] px-1.5 py-0.5 text-[11px] font-bold text-[#3d494a]"
                title="Raccourci clavier : /"
                >/</kbd
              >
            </div>
          </div>
        </div>
      </section>

      <!-- Tableau unique à défilement vertical interne -->
      <section aria-label="Liste des notes du comptoir" class="rb-card overflow-hidden">
        <!-- Tri rapide mobile (< 768 px) -->
        <div class="flex md:hidden flex-wrap items-center justify-between gap-2 border-b border-[#d6e2e4] bg-[#eef6f8] px-3 py-2">
          <span class="text-xs font-bold text-[#3d494a]">Trier par :</span>
          <div class="flex flex-wrap gap-2">
            <button type="button" (click)="toggleSort('guest')" class="rb-sort-btn">
              Client {{ sortArrow('guest') }}
            </button>
            <button type="button" (click)="toggleSort('stay')" class="rb-sort-btn">
              Séjour {{ sortArrow('stay') }}
            </button>
            <button type="button" (click)="toggleSort('balance')" class="rb-sort-btn">
              Reste {{ sortArrow('balance') }}
            </button>
          </div>
        </div>

        <div
          #tableScroll
          class="rb-table-scroll"
          data-testid="comptoir-table-scroll"
          (scroll)="onTableScroll($event)"
        >
          <!-- En-tête collant desktop (>= 768 px) -->
          <div
            class="rb-table-head rb-table-grid hidden md:grid"
            role="row"
            data-testid="comptoir-table-header"
          >
            <div class="rb-cell" role="columnheader" [attr.aria-sort]="ariaSort('guest')">
              <button
                type="button"
                data-testid="sort-guest"
                (click)="toggleSort('guest')"
                class="rb-sort-btn"
              >
                <span>Client</span>
                <span aria-hidden="true">{{ sortArrow('guest') }}</span>
              </button>
            </div>
            <div class="rb-cell text-xs font-extrabold uppercase tracking-wide text-[#161d20]" role="columnheader">
              Chambre
            </div>
            <div class="rb-cell" role="columnheader" [attr.aria-sort]="ariaSort('stay')">
              <button
                type="button"
                data-testid="sort-stay"
                (click)="toggleSort('stay')"
                class="rb-sort-btn"
              >
                <span>Séjour</span>
                <span aria-hidden="true">{{ sortArrow('stay') }}</span>
              </button>
            </div>
            <div class="rb-cell text-xs font-extrabold uppercase tracking-wide text-[#161d20]" role="columnheader">
              Total
            </div>
            <div class="rb-cell" role="columnheader" [attr.aria-sort]="ariaSort('balance')">
              <button
                type="button"
                data-testid="sort-balance"
                (click)="toggleSort('balance')"
                class="rb-sort-btn"
              >
                <span>Reste à payer</span>
                <span aria-hidden="true">{{ sortArrow('balance') }}</span>
              </button>
            </div>
            <div class="rb-cell text-xs font-extrabold uppercase tracking-wide text-[#161d20]" role="columnheader">
              État
            </div>
            <div class="rb-cell text-right text-xs font-extrabold uppercase tracking-wide text-[#161d20]" role="columnheader">
              Actions
            </div>
          </div>

          @if (showSkeleton()) {
            <div data-testid="comptoir-skeleton-rows">
              @for (item of [1, 2, 3, 4, 5, 6]; track item) {
                <div class="rb-table-row rb-table-grid">
                  <div class="rb-skeleton h-4 w-32"></div>
                  <div class="rb-skeleton h-4 w-12"></div>
                  <div class="rb-skeleton h-4 w-28"></div>
                  <div class="rb-skeleton h-4 w-20"></div>
                  <div class="rb-skeleton h-4 w-20"></div>
                  <div class="rb-skeleton h-6 w-24"></div>
                  <div class="rb-skeleton h-8 w-36 ml-auto"></div>
                </div>
              }
            </div>
          } @else if (items().length === 0) {
            <div
              class="p-8 text-center text-sm font-medium text-[#3d494a]"
              data-testid="comptoir-empty"
            >
              Aucune note pour ce filtre.
            </div>
          } @else {
            <div role="rowgroup" data-testid="comptoir-rows">
              @for (row of items(); track row.id) {
                <!-- Ligne Desktop (>= 768 px) -->
                <div
                  role="row"
                  tabindex="0"
                  (click)="openRow(row.id)"
                  (keydown.enter)="openRow(row.id)"
                  [attr.data-testid]="'note-row-' + row.id"
                  class="hidden md:grid rb-table-row rb-table-grid"
                >
                  <div class="rb-cell font-bold text-[13px] text-[#161d20] leading-tight">
                    {{ row.guestName }}
                  </div>
                  <div class="rb-cell text-[13px] font-semibold text-[#161d20]">
                    Ch. {{ row.roomNumber }}
                  </div>
                  <div class="rb-cell text-xs font-medium text-[#3d494a] leading-tight">
                    {{ row.stayLabel }}
                  </div>
                  <div class="rb-cell text-[13px] font-semibold text-[#3d494a]">
                    {{ formatFcfa(row.totalFcfa) }}
                  </div>
                  <div
                    class="rb-cell text-[13px] font-extrabold"
                    [class.text-[#ba1a1a]]="row.balanceFcfa > 0"
                    [class.text-[#00666f]]="row.balanceFcfa <= 0"
                    [attr.data-testid]="'row-balance-' + row.id"
                  >
                    {{ formatFcfa(row.balanceFcfa) }}
                  </div>
                  <div class="rb-cell">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold leading-tight"
                      [style.background-color]="statusBadge(row).bg"
                      [style.color]="statusBadge(row).text"
                      [style.border-color]="statusBadge(row).border"
                      [attr.data-testid]="'row-status-' + row.id"
                    >
                      {{ statusBadge(row).label }}
                    </span>
                  </div>
                  <div
                    class="rb-cell flex items-center justify-end gap-1.5"
                    (click)="$event.stopPropagation()"
                  >
                    <a
                      [routerLink]="['/facturation', row.id]"
                      [attr.data-testid]="'open-note-' + row.id"
                      class="rb-btn-sm rb-btn-outline"
                    >
                      Ouvrir
                    </a>
                    @if (isReadyForCheckout(row)) {
                      <button
                        type="button"
                        [disabled]="busyRowId() === row.id"
                        (click)="checkoutRow($event, row)"
                        [attr.data-testid]="'checkout-note-' + row.id"
                        class="rb-btn-sm rb-btn-primary"
                      >
                        {{ busyRowId() === row.id ? 'Clôture...' : 'Clôturer' }}
                      </button>
                    } @else {
                      <a
                        [routerLink]="['/facturation', row.id]"
                        fragment="encaissement"
                        [attr.data-testid]="'pay-note-' + row.id"
                        class="rb-btn-sm rb-btn-primary"
                      >
                        Encaisser
                      </a>
                    }
                  </div>
                </div>

                <!-- Carte compacte Mobile (< 768 px) -->
                <article
                  (click)="openRow(row.id)"
                  [attr.data-testid]="'note-card-mobile-' + row.id"
                  class="md:hidden border-b border-[#e3ecee] p-3 space-y-2 cursor-pointer hover:bg-[#f3fafe]"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-sm font-extrabold text-[#161d20] break-words">
                        {{ row.guestName }}
                      </div>
                      <div class="text-xs font-medium text-[#3d494a]">
                        Ch. {{ row.roomNumber }} • {{ row.stayLabel }}
                      </div>
                    </div>
                    <span
                      class="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold"
                      [style.background-color]="statusBadge(row).bg"
                      [style.color]="statusBadge(row).text"
                      [style.border-color]="statusBadge(row).border"
                    >
                      {{ statusBadge(row).label }}
                    </span>
                  </div>

                  <div class="flex items-baseline justify-between gap-2">
                    <span class="text-xs font-medium text-[#3d494a]">
                      Total : {{ formatFcfa(row.totalFcfa) }}
                    </span>
                    <span
                      class="text-sm font-extrabold"
                      [class.text-[#ba1a1a]]="row.balanceFcfa > 0"
                      [class.text-[#00666f]]="row.balanceFcfa <= 0"
                    >
                      Reste : {{ formatFcfa(row.balanceFcfa) }}
                    </span>
                  </div>

                  <div
                    class="grid grid-cols-2 gap-2 pt-1"
                    (click)="$event.stopPropagation()"
                  >
                    <a
                      [routerLink]="['/facturation', row.id]"
                      class="rb-btn-sm rb-btn-outline w-full"
                    >
                      Ouvrir
                    </a>
                    @if (isReadyForCheckout(row)) {
                      <button
                        type="button"
                        [disabled]="busyRowId() === row.id"
                        (click)="checkoutRow($event, row)"
                        class="rb-btn-sm rb-btn-primary w-full"
                      >
                        {{ busyRowId() === row.id ? 'Clôture...' : 'Clôturer' }}
                      </button>
                    } @else {
                      <a
                        [routerLink]="['/facturation', row.id]"
                        fragment="encaissement"
                        class="rb-btn-sm rb-btn-primary w-full"
                      >
                        Encaisser
                      </a>
                    }
                  </div>
                </article>
              }
            </div>
          }

          @if (service.loadingMoreCounter()) {
            <div data-testid="comptoir-load-more-skeleton">
              @for (sk of [1, 2, 3]; track sk) {
                <div class="rb-table-row rb-table-grid">
                  <div class="rb-skeleton h-4 w-28"></div>
                  <div class="rb-skeleton h-4 w-10"></div>
                  <div class="rb-skeleton h-4 w-24"></div>
                  <div class="rb-skeleton h-4 w-20"></div>
                  <div class="rb-skeleton h-4 w-20"></div>
                  <div class="rb-skeleton h-5 w-20"></div>
                  <div class="rb-skeleton h-7 w-32 ml-auto"></div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Compteur visible sous le tableau -->
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-[#d6e2e4] bg-[#f8fbfc] px-4 py-2.5 text-xs font-bold text-[#3d494a]">
          <span data-testid="comptoir-count">
            {{ items().length }} sur {{ totalCount() }} {{ totalCount() > 1 ? 'notes' : 'note' }}
          </span>
          @if (hasMore()) {
            <span>Faites défiler pour charger le lot suivant</span>
          }
        </footer>
      </section>

      <!-- Modale Fermer la caisse -->
      <app-modal-shell
        [isOpen]="cashClosureModalOpen()"
        title="Fermer la caisse"
        subtitle="Vérifiez les encaissements du jour et saisissez le montant compté en espèces"
        icon="point_of_sale"
        maxWidth="640px"
        testId="cash-closure-modal"
        (closed)="closeCashClosureModal()"
      >
        <div modal-body class="space-y-4 min-w-0">
          @if (confirmingReopen()) {
            <div class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              La caisse a déjà été fermée aujourd'hui. Valider enregistrera une nouvelle clôture horodatée.
            </div>
          }

          <div>
            <h3 class="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#3d494a]">
              Totaux attendus du jour (lecture seule)
            </h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-2.5 min-w-0">
                <div class="text-[11px] font-bold text-[#3d494a] truncate">Espèces (attendu)</div>
                <div class="mt-0.5 text-sm font-extrabold text-[#161d20]" data-testid="closure-expected-cash">
                  {{ formatFcfa(theoreticalCashFcfa()) }}
                </div>
              </div>
              <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-2.5 min-w-0">
                <div class="text-[11px] font-bold text-[#3d494a] truncate">Orange Money</div>
                <div class="mt-0.5 text-sm font-extrabold text-[#161d20]">
                  {{ formatFcfa(dailyCash().byMethod.ORANGE_MONEY) }}
                </div>
              </div>
              <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-2.5 min-w-0">
                <div class="text-[11px] font-bold text-[#3d494a] truncate">Wave</div>
                <div class="mt-0.5 text-sm font-extrabold text-[#161d20]">
                  {{ formatFcfa(dailyCash().byMethod.WAVE) }}
                </div>
              </div>
              <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-2.5 min-w-0">
                <div class="text-[11px] font-bold text-[#3d494a] truncate">Carte</div>
                <div class="mt-0.5 text-sm font-extrabold text-[#161d20]">
                  {{ formatFcfa(dailyCash().byMethod.CARD) }}
                </div>
              </div>
              <div class="rounded-lg border border-[#d6e2e4] bg-[#f8fbfc] p-2.5 min-w-0">
                <div class="text-[11px] font-bold text-[#3d494a] truncate">Virement</div>
                <div class="mt-0.5 text-sm font-extrabold text-[#161d20]">
                  {{ formatFcfa(dailyCash().byMethod.BANK_TRANSFER) }}
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-1.5">
            <label for="input-counted-cash" class="block text-xs font-extrabold uppercase tracking-wider text-[#161d20]">
              Montant compté en espèces (FCFA)
            </label>
            <input
              id="input-counted-cash"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              data-testid="input-counted-cash"
              [value]="countedCashInput()"
              (input)="onCountedCashInput($event)"
              placeholder="Ex. 150000"
              class="w-full min-h-[44px] rounded-lg border border-[#b9cdd0] bg-white px-3 py-2 text-base font-bold text-[#161d20] focus:border-[#00666f] focus:outline-none"
            />
          </div>

          <!-- Écart automatique (vert si 0, rouge si positif ou négatif) -->
          <div
            data-testid="cash-closure-difference"
            class="rounded-xl border px-4 py-3 flex items-center justify-between gap-2"
            [class.border-emerald-300]="cashDifferenceFcfa() === 0"
            [class.bg-emerald-50]="cashDifferenceFcfa() === 0"
            [class.text-emerald-800]="cashDifferenceFcfa() === 0"
            [class.border-red-300]="cashDifferenceFcfa() !== 0"
            [class.bg-red-50]="cashDifferenceFcfa() !== 0"
            [class.text-red-800]="cashDifferenceFcfa() !== 0"
          >
            <span class="text-xs font-extrabold uppercase tracking-wider">Écart constaté</span>
            <span class="text-base font-extrabold" data-testid="cash-closure-difference-value">
              {{ formattedCashDifference() }}
            </span>
          </div>

          <div class="space-y-1.5">
            <label for="input-closure-notes" class="block text-xs font-bold uppercase tracking-wider text-[#3d494a]">
              Notes (optionnel)
            </label>
            <textarea
              id="input-closure-notes"
              rows="2"
              maxlength="1000"
              data-testid="input-closure-notes"
              [value]="closureNotesInput()"
              (input)="onClosureNotesInput($event)"
              placeholder="Explication éventuelle en cas d'écart..."
              class="w-full rounded-lg border border-[#b9cdd0] bg-white px-3 py-2 text-sm text-[#161d20] focus:border-[#00666f] focus:outline-none"
            ></textarea>
          </div>
        </div>

        <div modal-footer class="w-full flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            (click)="closeCashClosureModal()"
            class="rb-btn rb-btn-outline"
          >
            Annuler
          </button>
          <button
            type="button"
            data-testid="btn-confirm-cash-closure"
            [disabled]="service.submittingCashClosure() || !isCountedCashValid()"
            (click)="submitCashClosure()"
            class="rb-btn rb-btn-primary"
          >
            {{ service.submittingCashClosure() ? 'Enregistrement...' : 'Valider la clôture' }}
          </button>
        </div>
      </app-modal-shell>
    </div>
  `,
})
export class ComptoirPageComponent implements OnInit, OnDestroy {
  readonly service = inject(FacturationService);
  private readonly router = inject(Router, { optional: true });

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('tableScroll') tableScroll?: ElementRef<HTMLElement>;

  readonly searchQuery = signal<string>('');
  readonly activeFilter = signal<BillingCounterFilter>('TO_PROCESS');
  readonly sortBy = signal<BillingSortField>('updatedAt');
  readonly sortOrder = signal<BillingSortOrder>('desc');
  readonly busyRowId = signal<string | null>(null);
  readonly cashClosureModalOpen = signal<boolean>(false);
  readonly confirmingReopen = signal<boolean>(false);
  readonly countedCashInput = signal<string>('0');
  readonly closureNotesInput = signal<string>('');

  readonly filterPills: readonly FilterPillOption[] = [
    { key: 'TO_PROCESS', label: 'À traiter' },
    { key: 'DEPARTURES_TODAY', label: "Départs aujourd'hui" },
    { key: 'OVERDUE_24H', label: 'Plus de 24 h' },
    { key: 'PAID_TODAY', label: 'Soldées du jour' },
  ];

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private keyListener = (ev: KeyboardEvent) => this.handleGlobalKey(ev);

  readonly showSkeleton = computed(
    () => this.service.loadingCounter() && !this.service.counter(),
  );

  readonly kpis = computed(
    () =>
      this.service.counter()?.kpis ?? {
        toCollectFcfa: 0,
        collectedTodayFcfa: 0,
        unpaidCount: 0,
        departuresTodayToSettleCount: 0,
      },
  );

  readonly dailyCash = computed(
    () =>
      this.service.counter()?.dailyCash ?? {
        dateIso: '',
        totalTodayFcfa: 0,
        byMethod: {
          CASH: 0,
          ORANGE_MONEY: 0,
          WAVE: 0,
          CARD: 0,
          BANK_TRANSFER: 0,
        },
      },
  );

  readonly items = computed<BillingSummaryCard[]>(() => this.service.counter()?.page?.items ?? []);
  readonly totalCount = computed<number>(() => this.service.counter()?.page?.total ?? 0);
  readonly hasMore = computed<boolean>(() => this.service.counter()?.page?.hasMore ?? false);
  readonly isCashClosedToday = computed<boolean>(
    () => this.service.todayCashClosure()?.isClosedToday ?? false,
  );
  readonly theoreticalCashFcfa = computed<number>(
    () =>
      this.service.todayCashClosure()?.totalTheoreticalCash ??
      this.dailyCash().byMethod.CASH,
  );
  readonly parsedCountedCash = computed<number | null>(() => {
    const raw = this.countedCashInput().trim();
    if (raw === '' || !/^\d+$/.test(raw)) return null;
    return Number(raw);
  });
  readonly isCountedCashValid = computed<boolean>(() => this.parsedCountedCash() !== null);
  readonly cashDifferenceFcfa = computed<number>(() => {
    const counted = this.parsedCountedCash();
    if (counted === null) return -this.theoreticalCashFcfa();
    return counted - this.theoreticalCashFcfa();
  });
  readonly formattedCashDifference = computed<string>(() => {
    const diff = this.cashDifferenceFcfa();
    const prefix = diff > 0 ? '+' : '';
    return `${prefix}${formatFcfaPlain(diff)}`;
  });

  ngOnInit(): void {
    this.reloadCounter();
    void this.service.loadTodayCashClosure();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keyListener);
    }
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 50);
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyListener);
    }
  }

  private handleGlobalKey(ev: KeyboardEvent): void {
    if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const target = ev.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
      return;
    }
    ev.preventDefault();
    this.searchInput?.nativeElement?.focus();
  }

  private currentQueryParams() {
    return {
      search: this.searchQuery(),
      filter: this.activeFilter(),
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder(),
      limit: 50,
    };
  }

  private reloadCounter(): void {
    if (this.tableScroll?.nativeElement) {
      this.tableScroll.nativeElement.scrollTop = 0;
    }
    void this.service.loadCounter(this.currentQueryParams());
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement)?.value ?? '';
    this.searchQuery.set(val);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.reloadCounter();
    }, 200);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.reloadCounter();
    this.searchInput?.nativeElement?.focus();
  }

  setFilter(filter: BillingCounterFilter): void {
    this.activeFilter.set(filter);
    this.reloadCounter();
  }

  toggleSort(field: BillingSortField): void {
    const next = nextSortState(this.sortBy(), this.sortOrder(), field);
    this.sortBy.set(next.sortBy);
    this.sortOrder.set(next.sortOrder);
    this.reloadCounter();
  }

  sortArrow(field: BillingSortField): string {
    if (this.sortBy() !== field) return '↕';
    return this.sortOrder() === 'asc' ? '↑' : '↓';
  }

  ariaSort(field: BillingSortField): string {
    if (this.sortBy() !== field) return 'none';
    return this.sortOrder() === 'asc' ? 'ascending' : 'descending';
  }

  onTableScroll(event: Event): void {
    const el = event.target as HTMLElement | null;
    if (!el || !this.hasMore() || this.service.loadingMoreCounter()) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 180) {
      void this.service.loadMoreCounter(this.currentQueryParams());
    }
  }

  statusBadge(row: BillingSummaryCard) {
    return billingStatusBadge(row);
  }

  isReadyForCheckout(row: BillingSummaryCard): boolean {
    return !row.isIssued && row.documentType === 'INVOICE' && row.balanceFcfa <= 0;
  }

  openRow(id: string): void {
    void this.router?.navigate(['/facturation', id]);
  }

  async checkoutRow(event: Event, row: BillingSummaryCard): Promise<void> {
    event.stopPropagation();
    if (this.busyRowId()) return;
    this.busyRowId.set(row.id);
    try {
      const ok = await this.service.checkout(row.id);
      if (ok) {
        await this.service.loadCounter(this.currentQueryParams());
      }
    } finally {
      this.busyRowId.set(null);
    }
  }

  openCashClosureModal(): void {
    this.confirmingReopen.set(false);
    this.countedCashInput.set(String(this.theoreticalCashFcfa()));
    this.closureNotesInput.set('');
    this.cashClosureModalOpen.set(true);
  }

  requestReopenCashClosure(): void {
    this.confirmingReopen.set(true);
    this.countedCashInput.set(String(this.theoreticalCashFcfa()));
    this.closureNotesInput.set('');
    this.cashClosureModalOpen.set(true);
  }

  closeCashClosureModal(): void {
    this.cashClosureModalOpen.set(false);
    this.confirmingReopen.set(false);
  }

  onCountedCashInput(event: Event): void {
    const val = (event.target as HTMLInputElement)?.value ?? '';
    this.countedCashInput.set(val);
  }

  onClosureNotesInput(event: Event): void {
    const val = (event.target as HTMLTextAreaElement)?.value ?? '';
    this.closureNotesInput.set(val);
  }

  async submitCashClosure(): Promise<void> {
    const counted = this.parsedCountedCash();
    if (counted === null) return;
    const saved = await this.service.submitCashClosure(counted, this.closureNotesInput());
    if (saved) {
      this.closeCashClosureModal();
      this.reloadCounter();
    }
  }

  formatFcfa(amount: number): string {
    return formatFcfaPlain(amount);
  }
}
