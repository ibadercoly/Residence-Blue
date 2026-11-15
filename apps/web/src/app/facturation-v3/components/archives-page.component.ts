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
  BillingArchiveStatusFilter,
  BillingSortField,
  BillingSortOrder,
  BillingSummaryCard,
} from '@residence-blue/shared';
import { FacturationService } from '../services/facturation.service';
import {
  BILLING_SHARED_TABLE_STYLES,
  billingStatusBadge,
  formatFcfaPlain,
  nextSortState,
} from '../models/facturation.model';

@Component({
  selector: 'app-archives-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BILLING_SHARED_TABLE_STYLES],
  template: `
    <div class="rb-wrap" data-testid="facturation-archives">
      <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="mb-2">
            <a
              routerLink="/facturation"
              data-testid="back-to-comptoir"
              class="rb-btn-sm rb-btn-outline"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
              <span>Retour au Comptoir</span>
            </a>
          </div>
          <h1 class="rb-title text-3xl font-bold leading-tight">Archives de facturation</h1>
          <p class="mt-1 text-sm font-medium text-[#3d494a]">
            Toutes les factures émises, avoirs et historiques par période
          </p>
        </div>

        @if (service.canManageCreditsAndExport()) {
          <button
            type="button"
            data-testid="archives-export-btn"
            (click)="exportSelection()"
            class="rb-btn rb-btn-primary self-start sm:self-auto"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
            <span>Exporter la sélection</span>
          </button>
        }
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

      <!-- Filtres visibles -->
      <section aria-label="Filtres des archives" class="rb-card p-3 md:p-4 mb-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="min-w-0">
            <label for="archives-search" class="block text-xs font-bold text-[#3d494a] mb-1">
              Recherche
            </label>
            <input
              id="archives-search"
              data-testid="archives-search-input"
              type="text"
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              placeholder="N° facture, client, chambre..."
              class="min-h-[40px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 py-1.5 text-sm text-[#161d20] focus:border-[#00666f] focus:outline-none"
            />
          </div>

          <div class="min-w-0">
            <label for="archives-from" class="block text-xs font-bold text-[#3d494a] mb-1">
              Du
            </label>
            <input
              id="archives-from"
              data-testid="archives-from-date"
              type="date"
              [value]="fromDate()"
              (change)="onFromDateChange($event)"
              class="min-h-[40px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 py-1.5 text-sm text-[#161d20] focus:border-[#00666f] focus:outline-none"
            />
          </div>

          <div class="min-w-0">
            <label for="archives-to" class="block text-xs font-bold text-[#3d494a] mb-1">
              Au
            </label>
            <input
              id="archives-to"
              data-testid="archives-to-date"
              type="date"
              [value]="toDate()"
              (change)="onToDateChange($event)"
              class="min-h-[40px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 py-1.5 text-sm text-[#161d20] focus:border-[#00666f] focus:outline-none"
            />
          </div>

          <div class="min-w-0">
            <label for="archives-status" class="block text-xs font-bold text-[#3d494a] mb-1">
              Statut
            </label>
            <select
              id="archives-status"
              data-testid="archives-status-select"
              [value]="statusFilter()"
              (change)="onStatusChange($event)"
              class="min-h-[40px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 py-1.5 text-sm font-semibold text-[#161d20] focus:border-[#00666f] focus:outline-none"
            >
              <option value="ALL">Toutes (émises &amp; avoirs)</option>
              <option value="PAID">Émises (soldées)</option>
              <option value="OPEN">À régler</option>
              <option value="PARTIAL">Partielles</option>
              <option value="CREDIT_NOTE">Avoirs</option>
              <option value="CANCELLED">Annulées</option>
            </select>
          </div>

          <div class="min-w-0">
            <label for="archives-method" class="block text-xs font-bold text-[#3d494a] mb-1">
              Mode de paiement
            </label>
            <select
              id="archives-method"
              data-testid="archives-method-select"
              [value]="paymentMethodFilter()"
              (change)="onMethodChange($event)"
              class="min-h-[40px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 py-1.5 text-sm font-semibold text-[#161d20] focus:border-[#00666f] focus:outline-none"
            >
              <option value="ALL">Tous les modes</option>
              <option value="CASH">Espèces</option>
              <option value="ORANGE_MONEY">Orange Money</option>
              <option value="WAVE">Wave</option>
              <option value="CARD">Carte</option>
              <option value="BANK_TRANSFER">Virement</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Tableau interne à défilement vertical -->
      <section aria-label="Liste des archives" class="rb-card overflow-hidden">
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
          data-testid="archives-table-scroll"
          (scroll)="onTableScroll($event)"
        >
          <div
            class="rb-table-head rb-table-grid hidden md:grid"
            role="row"
            data-testid="archives-table-header"
          >
            <div class="rb-cell" role="columnheader" [attr.aria-sort]="ariaSort('guest')">
              <button
                type="button"
                data-testid="archives-sort-guest"
                (click)="toggleSort('guest')"
                class="rb-sort-btn"
              >
                <span>Client / N°</span>
                <span aria-hidden="true">{{ sortArrow('guest') }}</span>
              </button>
            </div>
            <div class="rb-cell text-xs font-extrabold uppercase tracking-wide text-[#161d20]" role="columnheader">
              Chambre
            </div>
            <div class="rb-cell" role="columnheader" [attr.aria-sort]="ariaSort('stay')">
              <button
                type="button"
                data-testid="archives-sort-stay"
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
                data-testid="archives-sort-balance"
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
            <div data-testid="archives-skeleton-rows">
              @for (item of [1, 2, 3, 4, 5, 6]; track item) {
                <div class="rb-table-row rb-table-grid">
                  <div class="rb-skeleton h-4 w-32"></div>
                  <div class="rb-skeleton h-4 w-12"></div>
                  <div class="rb-skeleton h-4 w-28"></div>
                  <div class="rb-skeleton h-4 w-20"></div>
                  <div class="rb-skeleton h-4 w-20"></div>
                  <div class="rb-skeleton h-6 w-24"></div>
                  <div class="rb-skeleton h-8 w-28 ml-auto"></div>
                </div>
              }
            </div>
          } @else if (items().length === 0) {
            <div
              class="p-8 text-center text-sm font-medium text-[#3d494a]"
              data-testid="archives-empty"
            >
              Aucune facture trouvée pour ces critères.
            </div>
          } @else {
            <div role="rowgroup" data-testid="archives-rows">
              @for (row of items(); track row.id) {
                <div
                  role="row"
                  tabindex="0"
                  (click)="openRow(row.id)"
                  (keydown.enter)="openRow(row.id)"
                  [attr.data-testid]="'archive-row-' + row.id"
                  class="hidden md:grid rb-table-row rb-table-grid"
                >
                  <div class="rb-cell leading-tight">
                    <div class="text-[13px] font-bold text-[#161d20]">{{ row.guestName }}</div>
                    <div class="text-[11px] font-semibold text-[#00666f]">{{ row.displayNumber }}</div>
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
                  >
                    {{ formatFcfa(row.balanceFcfa) }}
                  </div>
                  <div class="rb-cell">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold leading-tight"
                      [style.background-color]="statusBadge(row).bg"
                      [style.color]="statusBadge(row).text"
                      [style.border-color]="statusBadge(row).border"
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
                      class="rb-btn-sm rb-btn-outline"
                    >
                      Ouvrir
                    </a>
                    <button
                      type="button"
                      (click)="downloadPdf($event, row)"
                      class="rb-btn-sm rb-btn-primary"
                    >
                      PDF
                    </button>
                  </div>
                </div>

                <article
                  (click)="openRow(row.id)"
                  class="md:hidden border-b border-[#e3ecee] p-3 space-y-2 cursor-pointer hover:bg-[#f3fafe]"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-sm font-extrabold text-[#161d20]">{{ row.guestName }}</div>
                      <div class="text-xs font-semibold text-[#00666f]">{{ row.displayNumber }}</div>
                      <div class="text-xs text-[#3d494a]">Ch. {{ row.roomNumber }} • {{ row.stayLabel }}</div>
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
                    <span class="text-xs text-[#3d494a]">Total : {{ formatFcfa(row.totalFcfa) }}</span>
                    <span class="text-sm font-extrabold text-[#00666f]">
                      Reste : {{ formatFcfa(row.balanceFcfa) }}
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-2 pt-1" (click)="$event.stopPropagation()">
                    <a [routerLink]="['/facturation', row.id]" class="rb-btn-sm rb-btn-outline w-full">
                      Ouvrir
                    </a>
                    <button
                      type="button"
                      (click)="downloadPdf($event, row)"
                      class="rb-btn-sm rb-btn-primary w-full"
                    >
                      PDF
                    </button>
                  </div>
                </article>
              }
            </div>
          }

          @if (service.loadingMoreArchives()) {
            <div data-testid="archives-load-more-skeleton">
              @for (sk of [1, 2, 3]; track sk) {
                <div class="rb-table-row rb-table-grid">
                  <div class="rb-skeleton h-4 w-28"></div>
                  <div class="rb-skeleton h-4 w-10"></div>
                  <div class="rb-skeleton h-4 w-24"></div>
                  <div class="rb-skeleton h-4 w-20"></div>
                  <div class="rb-skeleton h-4 w-20"></div>
                  <div class="rb-skeleton h-5 w-20"></div>
                  <div class="rb-skeleton h-7 w-28 ml-auto"></div>
                </div>
              }
            </div>
          }
        </div>

        <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-[#d6e2e4] bg-[#f8fbfc] px-4 py-2.5 text-xs font-bold text-[#3d494a]">
          <span data-testid="archives-count">
            {{ items().length }} sur {{ totalCount() }} {{ totalCount() > 1 ? 'notes' : 'note' }}
          </span>
          @if (hasMore()) {
            <span>Faites défiler pour charger le lot suivant</span>
          }
        </footer>
      </section>
    </div>
  `,
})
export class ArchivesPageComponent implements OnInit, OnDestroy {
  readonly service = inject(FacturationService);
  private readonly router = inject(Router, { optional: true });

  @ViewChild('tableScroll') tableScroll?: ElementRef<HTMLElement>;

  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<BillingArchiveStatusFilter>('ALL');
  readonly paymentMethodFilter = signal<string>('ALL');
  readonly fromDate = signal<string>('');
  readonly toDate = signal<string>('');
  readonly sortBy = signal<BillingSortField>('updatedAt');
  readonly sortOrder = signal<BillingSortOrder>('desc');

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly showSkeleton = computed(
    () => this.service.loadingArchives() && !this.service.archivesPage(),
  );
  readonly items = computed<BillingSummaryCard[]>(() => this.service.archivesPage()?.items ?? []);
  readonly totalCount = computed<number>(() => this.service.archivesPage()?.total ?? 0);
  readonly hasMore = computed<boolean>(() => this.service.archivesPage()?.hasMore ?? false);

  ngOnInit(): void {
    this.reloadArchives();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  private currentParams() {
    return {
      search: this.searchQuery(),
      status: this.statusFilter(),
      paymentMethod: this.paymentMethodFilter(),
      fromDate: this.fromDate(),
      toDate: this.toDate(),
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder(),
      limit: 50,
    };
  }

  private reloadArchives(): void {
    if (this.tableScroll?.nativeElement) {
      this.tableScroll.nativeElement.scrollTop = 0;
    }
    void this.service.loadArchives(this.currentParams());
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement)?.value ?? '';
    this.searchQuery.set(val);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reloadArchives(), 200);
  }

  onFromDateChange(event: Event): void {
    this.fromDate.set((event.target as HTMLInputElement)?.value ?? '');
    this.reloadArchives();
  }

  onToDateChange(event: Event): void {
    this.toDate.set((event.target as HTMLInputElement)?.value ?? '');
    this.reloadArchives();
  }

  onStatusChange(event: Event): void {
    const val = ((event.target as HTMLSelectElement)?.value || 'ALL') as BillingArchiveStatusFilter;
    this.statusFilter.set(val);
    this.reloadArchives();
  }

  onMethodChange(event: Event): void {
    this.paymentMethodFilter.set((event.target as HTMLSelectElement)?.value || 'ALL');
    this.reloadArchives();
  }

  toggleSort(field: BillingSortField): void {
    const next = nextSortState(this.sortBy(), this.sortOrder(), field);
    this.sortBy.set(next.sortBy);
    this.sortOrder.set(next.sortOrder);
    this.reloadArchives();
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
    if (!el || !this.hasMore() || this.service.loadingMoreArchives()) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 180) {
      void this.service.loadMoreArchives(this.currentParams());
    }
  }

  statusBadge(row: BillingSummaryCard) {
    return billingStatusBadge(row);
  }

  openRow(id: string): void {
    void this.router?.navigate(['/facturation', id]);
  }

  downloadPdf(event: Event, row: BillingSummaryCard): void {
    event.stopPropagation();
    void this.service.downloadInvoicePdf(row.id, row.displayNumber);
  }

  exportSelection(): void {
    void this.service.downloadArchivesExport(this.currentParams());
  }

  formatFcfa(amount: number): string {
    return formatFcfaPlain(amount);
  }
}
