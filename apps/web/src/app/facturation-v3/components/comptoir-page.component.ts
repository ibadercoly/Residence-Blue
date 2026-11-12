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
import { RouterLink } from '@angular/router';
import { BillingSummaryCard } from '@residence-blue/shared';
import { FacturationService } from '../services/facturation.service';
import { formatFcfaPlain } from '../models/facturation.model';

type ColumnKey = 'toPay' | 'partial' | 'paid';

@Component({
  selector: 'app-comptoir-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        background-color: #f3fafe;
        color: #161d20;
        font-family: 'Manrope', sans-serif;
      }

      .rb-wrap {
        width: 100%;
        max-width: 1380px;
        margin: 0 auto;
        padding: 16px;
        box-sizing: border-box;
      }

      @media (min-width: 768px) {
        .rb-wrap {
          padding: 24px 28px;
        }
      }

      .rb-title {
        font-family: 'Newsreader', serif;
        color: #161d20;
        letter-spacing: -0.01em;
      }

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

      .rb-grid-cols {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      @media (min-width: 900px) {
        .rb-grid-cols {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
      }

      .rb-card {
        background-color: #ffffff;
        border: 1px solid #bdc9ca;
        border-radius: 12px;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .rb-btn {
        min-height: 42px;
        padding: 8px 14px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        line-height: 1.2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        text-decoration: none;
        box-sizing: border-box;
        transition: background-color 150ms ease, border-color 150ms ease;
      }

      .rb-btn-primary {
        background-color: #00666f;
        color: #ffffff;
        border: 1px solid #00666f;
      }

      .rb-btn-primary:hover {
        background-color: #005158;
      }

      .rb-btn-outline {
        background-color: #ffffff;
        color: #00666f;
        border: 1px solid #00666f;
      }

      .rb-btn-outline:hover {
        background-color: #e6f3f4;
      }

      .rb-skeleton {
        background-color: #e2ecef;
        border-radius: 8px;
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
          animation: none !important;
        }
      }
    `,
  ],
  template: `
    <div class="rb-wrap" data-testid="facturation-comptoir">
      <!-- Bandeau : Titre + Recherche serveur (200 ms, autofocus, raccourci /) -->
      <header class="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="min-w-0">
          <h1 class="rb-title text-3xl font-bold leading-tight">Facturation</h1>
          <p class="mt-1 text-sm font-medium text-[#3d494a]">
            Le Comptoir — Notes ouvertes, encaissements et factures émises
          </p>
        </div>

        <div class="w-full md:max-w-lg min-w-0">
          <label for="comptoir-search" class="sr-only">
            Rechercher par numéro de facture, nom du client ou numéro de chambre
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
              type="search"
              autofocus
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              placeholder="Rechercher : n° facture, nom du client, chambre..."
              class="min-h-[46px] w-full rounded-xl border border-[#7c8c8e] bg-white pl-10 pr-20 py-2.5 text-sm font-medium text-[#161d20] placeholder-[#4a5759] focus:border-[#00666f] focus:outline-none focus:ring-2 focus:ring-[#00666f]/25"
            />
            @if (searchQuery()) {
              <button
                type="button"
                (click)="clearSearch()"
                class="absolute right-10 rounded-md px-2 py-1 text-xs font-bold text-[#00666f] hover:bg-[#e6f3f4]"
                aria-label="Effacer la recherche"
              >
                Effacer
              </button>
            }
            <kbd
              class="pointer-events-none absolute right-3 hidden sm:inline-flex items-center rounded border border-[#bdc9ca] bg-[#f3fafe] px-1.5 py-0.5 text-[11px] font-bold text-[#3d494a]"
              title="Raccourci clavier : /"
              >/</kbd
            >
          </div>
        </div>
      </header>

      @if (service.errorMessage()) {
        <div
          role="alert"
          class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ba1a1a] bg-[#ffdad6] px-4 py-3 text-sm font-semibold text-[#410002]"
        >
          <span>{{ service.errorMessage() }}</span>
          <button
            type="button"
            (click)="service.clearMessages()"
            class="min-h-[40px] rounded-lg border border-[#ba1a1a] bg-white px-3 text-xs font-bold text-[#93000a]"
          >
            Fermer
          </button>
        </div>
      }

      <!-- 4 grandes tuiles KPI -->
      <section aria-label="Indicateurs de facturation" class="mb-5">
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
              <p
                class="rb-title mt-2 text-2xl font-bold text-[#ba1a1a]"
                data-testid="kpi-to-collect"
              >
                {{ formatFcfa(kpis().toCollectFcfa) }}
              </p>
            </article>

            <article class="rb-card p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">
                Encaissé aujourd'hui
              </p>
              <p
                class="rb-title mt-2 text-2xl font-bold text-[#00666f]"
                data-testid="kpi-collected-today"
              >
                {{ formatFcfa(kpis().collectedTodayFcfa) }}
              </p>
            </article>

            <article class="rb-card p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">
                Notes impayées
              </p>
              <p class="rb-title mt-2 text-2xl font-bold text-[#161d20]" data-testid="kpi-unpaid">
                {{ kpis().unpaidCount }} {{ kpis().unpaidCount > 1 ? 'notes' : 'note' }}
              </p>
            </article>

            <article class="rb-card p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">
                Départs à régler aujourd'hui
              </p>
              <p
                class="rb-title mt-2 text-2xl font-bold text-[#161d20]"
                data-testid="kpi-departures"
              >
                {{ kpis().departuresTodayToSettleCount }}
                {{ kpis().departuresTodayToSettleCount > 1 ? 'départs' : 'départ' }}
              </p>
            </article>
          </div>
        }
      </section>

      <!-- Bande Caisse du jour -->
      <section aria-label="Caisse du jour" class="rb-card mb-6 p-4">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-sm font-extrabold uppercase tracking-wider text-[#161d20]">
              Caisse du jour
            </h2>
            <p class="text-xs font-medium text-[#3d494a]">
              Totaux encaissés aujourd'hui par mode de règlement (hors annulations)
            </p>
          </div>

          @if (service.canManageCreditsAndExport()) {
            <div class="flex flex-wrap gap-2">
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
                class="rb-btn rb-btn-primary"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                  >table_view</span
                >
                <span>Exporter la clôture (Excel)</span>
              </button>
            </div>
          }
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

      <!-- Trois colonnes égales : À régler | Partiellement payées | Soldées -->
      @if (showSkeleton()) {
        <section class="rb-grid-cols" data-testid="comptoir-skeleton-columns">
          @for (col of [1, 2, 3]; track col) {
            <div class="space-y-3">
              <div class="rb-skeleton h-6 w-44"></div>
              @for (card of [1, 2, 3]; track card) {
                <div class="rb-card p-4 space-y-3">
                  <div class="flex justify-between gap-2">
                    <div class="rb-skeleton h-5 w-28"></div>
                    <div class="rb-skeleton h-5 w-16"></div>
                  </div>
                  <div class="rb-skeleton h-5 w-40"></div>
                  <div class="rb-skeleton h-4 w-32"></div>
                  <div class="rb-skeleton h-7 w-36"></div>
                  <div class="rb-skeleton h-2 w-full"></div>
                  <div class="grid grid-cols-2 gap-2 pt-1">
                    <div class="rb-skeleton h-10 w-full"></div>
                    <div class="rb-skeleton h-10 w-full"></div>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      } @else {
        <section aria-label="Notes de séjour par statut" class="rb-grid-cols" data-testid="comptoir-columns">
          @for (col of columnsMeta(); track col.key) {
            <div class="min-w-0" [attr.data-testid]="'column-' + col.key">
              <div class="mb-3 flex items-center justify-between gap-2 border-b-2 pb-2" [style.border-color]="col.accent">
                <h2 class="rb-title text-lg font-bold text-[#161d20]">{{ col.title }}</h2>
                <span
                  class="inline-flex min-h-[26px] items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold"
                  [style.background-color]="col.badgeBg"
                  [style.color]="col.badgeText"
                >
                  {{ col.data.total }}
                </span>
              </div>

              @if (col.data.items.length === 0) {
                <div
                  class="rb-card p-6 text-center text-sm font-medium text-[#3d494a]"
                  [attr.data-testid]="'empty-' + col.key"
                >
                  Aucune note dans « {{ col.title }} ».
                </div>
              } @else {
                <div class="space-y-3">
                  @for (note of col.data.items; track note.id) {
                    <article class="rb-card p-4 shadow-sm" [attr.data-testid]="'note-card-' + note.id">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <span
                          class="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-extrabold"
                          [class.bg-[#e6f3f4]]="note.documentType !== 'CREDIT_NOTE'"
                          [class.text-[#004f56]]="note.documentType !== 'CREDIT_NOTE'"
                          [class.bg-[#ffdad6]]="note.documentType === 'CREDIT_NOTE'"
                          [class.text-[#93000a]]="note.documentType === 'CREDIT_NOTE'"
                        >
                          {{ note.displayNumber }}
                        </span>
                        <span class="text-xs font-bold text-[#161d20]">
                          Ch. {{ note.roomNumber }}
                        </span>
                      </div>

                      <h3 class="mt-2.5 text-base font-extrabold text-[#161d20]">
                        {{ note.guestName }}
                      </h3>
                      <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
                        {{ note.stayLabel }}
                      </p>

                      <div class="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-[#e3ecee] pt-3">
                        <span class="text-xs font-semibold text-[#3d494a]">
                          Total : {{ formatFcfa(note.totalFcfa) }}
                        </span>
                        <span
                          class="rb-title text-lg font-bold"
                          [class.text-[#ba1a1a]]="note.balanceFcfa > 0"
                          [class.text-[#00666f]]="note.balanceFcfa <= 0"
                        >
                          Reste : {{ formatFcfa(note.balanceFcfa) }}
                        </span>
                      </div>

                      <!-- Barre de progression du paiement -->
                      <div class="mt-2.5">
                        <div class="mb-1 flex items-center justify-between text-[11px] font-bold text-[#3d494a]">
                          <span>Progression du règlement</span>
                          <span>{{ note.progressPercent }}%</span>
                        </div>
                        <div
                          class="h-2.5 w-full overflow-hidden rounded-full bg-[#e3ecee]"
                          role="progressbar"
                          [attr.aria-valuenow]="note.progressPercent"
                          aria-valuemin="0"
                          aria-valuemax="100"
                        >
                          <div
                            class="h-full rounded-full"
                            [style.width.%]="note.progressPercent"
                            [style.background-color]="note.balanceFcfa <= 0 ? '#00666f' : '#1b7a83'"
                          ></div>
                        </div>
                      </div>

                      <!-- Deux boutons toujours visibles -->
                      <div class="mt-3.5 grid grid-cols-2 gap-2">
                        <a
                          [routerLink]="['/facturation', note.id]"
                          [attr.data-testid]="'open-note-' + note.id"
                          class="rb-btn rb-btn-outline"
                        >
                          Ouvrir
                        </a>
                        <a
                          [routerLink]="['/facturation', note.id]"
                          fragment="encaissement"
                          [attr.data-testid]="'pay-note-' + note.id"
                          class="rb-btn rb-btn-primary"
                        >
                          Encaisser
                        </a>
                      </div>
                    </article>
                  }
                </div>

                @if (col.data.hasMore) {
                  <div class="mt-3">
                    <button
                      type="button"
                      [disabled]="service.busyAction()"
                      (click)="loadMore(col.key)"
                      [attr.data-testid]="'load-more-' + col.key"
                      class="rb-btn rb-btn-outline w-full"
                    >
                      Voir plus (lot de 8) — {{ col.data.total - col.data.items.length }} restante(s)
                    </button>
                  </div>
                }
              }
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class ComptoirPageComponent implements OnInit, OnDestroy {
  readonly service = inject(FacturationService);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly searchQuery = signal<string>('');
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

  readonly columnsMeta = computed<
    Array<{
      key: ColumnKey;
      title: string;
      accent: string;
      badgeBg: string;
      badgeText: string;
      data: { items: BillingSummaryCard[]; total: number; hasMore: boolean };
    }>
  >(() => {
    const cols = this.service.counter()?.columns ?? {
      toPay: { items: [], total: 0, hasMore: false },
      partial: { items: [], total: 0, hasMore: false },
      paid: { items: [], total: 0, hasMore: false },
    };
    return [
      {
        key: 'toPay',
        title: 'À régler',
        accent: '#ba1a1a',
        badgeBg: '#ffdad6',
        badgeText: '#93000a',
        data: cols.toPay,
      },
      {
        key: 'partial',
        title: 'Partiellement payées',
        accent: '#92400e',
        badgeBg: '#fef3c7',
        badgeText: '#78350f',
        data: cols.partial,
      },
      {
        key: 'paid',
        title: 'Soldées',
        accent: '#00666f',
        badgeBg: '#d8f0f2',
        badgeText: '#004f56',
        data: cols.paid,
      },
    ];
  });

  ngOnInit(): void {
    this.service.loadCounter({ search: '' });
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

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement)?.value ?? '';
    this.searchQuery.set(val);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.service.loadCounter({ search: val });
    }, 200);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.service.loadCounter({ search: '' });
    this.searchInput?.nativeElement?.focus();
  }

  loadMore(column: ColumnKey): void {
    this.service.loadMoreForColumn(column, this.searchQuery());
  }

  formatFcfa(amount: number): string {
    return formatFcfaPlain(amount);
  }
}
