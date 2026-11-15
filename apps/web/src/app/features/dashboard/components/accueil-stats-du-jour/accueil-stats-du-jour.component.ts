import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccueilPaymentMethodCode } from '@residence-blue/shared';
import { AuthService } from '../../../../core/services/auth.service';
import { AccueilJourService } from '../../services/accueil-jour.service';

const PAYMENT_BAR_COLORS: Record<AccueilPaymentMethodCode, string> = {
  CASH: '#047857',
  ORANGE_MONEY: '#d97706',
  WAVE: '#0284c7',
  CARD: '#4338ca',
  BANK_TRANSFER: '#475569',
};

const TOP_DISH_BAR_COLORS = [
  '#c2410c',
  '#0284c7',
  '#047857',
  '#4338ca',
  '#b45309',
];

export function formatAccueilFcfa(amount: number | undefined | null): string {
  const safe = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(safe)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ');
  return `${formatted} FCFA`;
}

@Component({
  selector: 'app-accueil-stats-du-jour',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  styles: [
    `
      .rb-accueil-stats-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
      }

      @media (min-width: 900px) {
        .rb-accueil-stats-grid--multi {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      .rb-accueil-stats-grid > article {
        min-width: 0;
      }
    `,
  ],
  template: `
    <section
      aria-label="Statistiques du jour"
      data-testid="accueil-stats-du-jour"
      class="space-y-4 font-['Manrope']"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <h2 class="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
            Statistiques du jour
          </h2>
          <p class="text-xs text-stone-600">
            Activité consolidée de 00:00 à 23:59 (heure de Dakar)
            @if (service.stats()?.dateDakarIso; as dIso) {
              <span> &bull; {{ dIso }}</span>
            }
          </p>
        </div>

        @if (service.offlineMode()) {
          <span
            role="status"
            data-testid="accueil-offline-banner"
            class="inline-flex items-center gap-1.5 rounded-full border border-amber-700/40 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900"
          >
            <span class="material-symbols-outlined text-base" aria-hidden="true">cloud_off</span>
            <span>Hors ligne &bull; dernières valeurs affichées</span>
          </span>
        }
      </div>

      @if (service.forbiddenError(); as errMsg) {
        <div
          role="alert"
          data-testid="accueil-forbidden-banner"
          class="rounded-2xl border border-stone-300 bg-stone-50 p-4 text-sm font-semibold text-stone-700"
        >
          {{ errMsg }}
        </div>
      } @else if (service.loading() && !service.stats()) {
        <div class="rb-accueil-stats-grid rb-accueil-stats-grid--multi">
          @for (s of [1, 2, 3]; track s) {
            <div class="h-64 animate-pulse rounded-2xl border border-stone-200 bg-white"></div>
          }
        </div>
      } @else if (service.stats(); as stats) {
        <div
          class="rb-accueil-stats-grid"
          [class.rb-accueil-stats-grid--multi]="stats.visibleBlocks.length > 1"
        >
          <!-- BLOC 1 : CLIENTS DU JOUR (Bleu) -->
          @if (stats.clients; as c) {
            <article
              data-testid="accueil-block-clients"
              class="flex flex-col overflow-hidden rounded-2xl border border-[#bfdbfe] bg-white shadow-sm"
            >
              <header class="flex items-center justify-between gap-2 border-b border-[#bfdbfe] bg-[#eff6ff] px-4 py-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1d4ed8] text-white"
                    aria-hidden="true"
                  >
                    <span class="material-symbols-outlined text-xl">groups</span>
                  </span>
                  <div class="min-w-0">
                    <h3 class="text-sm font-extrabold uppercase tracking-wide text-[#1e3a8a]">
                      Clients du jour
                    </h3>
                    <p class="text-[11px] font-semibold text-[#1e40af]">
                      Mouvements &amp; présences
                    </p>
                  </div>
                </div>
              </header>

              <div class="grid grid-cols-2 gap-3 p-4">
                <div class="rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-3">
                  <span class="block text-xs font-bold text-[#1e3a8a]">Arrivées</span>
                  <div class="mt-1 text-xl font-black text-stone-900 font-mono" data-testid="stat-clients-arrivals">
                    {{ c.arrivalsDone }} / {{ c.arrivalsExpected }}
                  </div>
                  <span class="text-[11px] font-medium text-stone-600">faites / attendues</span>
                </div>

                <div class="rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-3">
                  <span class="block text-xs font-bold text-[#1e3a8a]">Départs</span>
                  <div class="mt-1 text-xl font-black text-stone-900 font-mono" data-testid="stat-clients-departures">
                    {{ c.departuresDone }} / {{ c.departuresExpected }}
                  </div>
                  <span class="text-[11px] font-medium text-stone-600">faits / attendus</span>
                </div>

                <div class="rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-3">
                  <span class="block text-xs font-bold text-[#1e3a8a]">En séjour</span>
                  <div class="mt-1 text-xl font-black text-stone-900 font-mono" data-testid="stat-clients-instay">
                    {{ c.guestsInStay }}
                  </div>
                  <span class="text-[11px] font-medium text-stone-600">client(s) présent(s)</span>
                </div>

                <div class="rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-3">
                  <span class="block text-xs font-bold text-[#1e3a8a]">Nouveaux clients</span>
                  <div class="mt-1 text-xl font-black text-stone-900 font-mono" data-testid="stat-clients-new">
                    {{ c.newGuestsToday }}
                  </div>
                  <span class="text-[11px] font-medium text-stone-600">enregistrés aujourd'hui</span>
                </div>
              </div>
            </article>
          }

          <!-- BLOC 2 : FACTURES DU JOUR (Vert) -->
          @if (stats.billing; as b) {
            <article
              data-testid="accueil-block-billing"
              class="flex flex-col overflow-hidden rounded-2xl border border-[#a7f3d0] bg-white shadow-sm"
            >
              <header class="flex items-center justify-between gap-2 border-b border-[#a7f3d0] bg-[#ecfdf5] px-4 py-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#047857] text-white"
                    aria-hidden="true"
                  >
                    <span class="material-symbols-outlined text-xl">receipt_long</span>
                  </span>
                  <div class="min-w-0">
                    <h3 class="text-sm font-extrabold uppercase tracking-wide text-[#065f46]">
                      Factures du jour
                    </h3>
                    <p class="text-[11px] font-semibold text-[#047857]">
                      Émission &amp; encaissements
                    </p>
                  </div>
                </div>
              </header>

              <div class="flex flex-1 flex-col justify-between gap-3 p-4">
                <div class="grid grid-cols-2 gap-2.5">
                  <div class="rounded-xl border border-[#d1fae5] bg-[#f6fef9] p-2.5">
                    <span class="block text-[11px] font-bold text-[#065f46]">Factures émises</span>
                    <span class="text-lg font-black text-stone-900 font-mono" data-testid="stat-billing-issued">
                      {{ b.issuedInvoicesToday }}
                    </span>
                  </div>
                  <div class="rounded-xl border border-[#d1fae5] bg-[#f6fef9] p-2.5">
                    <span class="block text-[11px] font-bold text-[#065f46]">Notes à régler</span>
                    <span class="text-lg font-black text-stone-900 font-mono" data-testid="stat-billing-pending">
                      {{ b.notesToSettleCount }}
                    </span>
                  </div>
                </div>

                <dl class="space-y-1.5 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <dt class="font-semibold text-stone-700">Total facturé</dt>
                    <dd class="font-extrabold text-stone-900 font-mono" data-testid="stat-billing-billed">
                      {{ formatFcfa(b.totalBilledTodayFcfa) }}
                    </dd>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <dt class="font-semibold text-stone-700">Total encaissé</dt>
                    <dd class="font-extrabold text-[#065f46] font-mono" data-testid="stat-billing-collected">
                      {{ formatFcfa(b.totalCollectedTodayFcfa) }}
                    </dd>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <dt class="font-semibold text-stone-700">Reste à encaisser</dt>
                    <dd class="font-extrabold text-stone-900 font-mono" data-testid="stat-billing-remaining">
                      {{ formatFcfa(b.remainingToCollectFcfa) }}
                    </dd>
                  </div>
                </dl>

                <!-- Barre empilée encaissé par mode de paiement + légende visible -->
                <div class="space-y-2 border-t border-stone-200 pt-2.5">
                  <div class="flex items-center justify-between text-[11px] font-bold text-[#065f46]">
                    <span>Encaissé par mode de paiement</span>
                  </div>
                  @if (b.totalCollectedTodayFcfa > 0) {
                    <div
                      data-testid="accueil-billing-stacked-bar"
                      class="flex h-3.5 w-full overflow-hidden rounded-full bg-stone-200"
                      role="img"
                      aria-label="Répartition des encaissements du jour par mode de paiement"
                    >
                      @for (slice of b.collectedByMethod; track slice.method) {
                        @if (slice.amountFcfa > 0) {
                          <div
                            class="h-full transition-all"
                            [style.width.%]="slice.percent"
                            [style.backgroundColor]="paymentColor(slice.method)"
                            [title]="slice.label + ': ' + formatFcfa(slice.amountFcfa)"
                          ></div>
                        }
                      }
                    </div>
                  } @else {
                    <div
                      data-testid="accueil-billing-empty"
                      class="rounded-lg bg-stone-100 px-3 py-1.5 text-center text-[11px] font-semibold text-stone-600"
                    >
                      Aucune vente aujourd'hui
                    </div>
                  }

                  <ul data-testid="accueil-billing-legend" class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    @for (slice of b.collectedByMethod; track slice.method) {
                      <li class="flex items-center justify-between gap-1.5 text-stone-700">
                        <span class="inline-flex items-center gap-1.5 min-w-0">
                          <span
                            class="h-2.5 w-2.5 shrink-0 rounded-sm"
                            [style.backgroundColor]="paymentColor(slice.method)"
                            aria-hidden="true"
                          ></span>
                          <span class="font-semibold">{{ slice.label }}</span>
                        </span>
                        <span class="font-bold font-mono text-stone-900 whitespace-nowrap">
                          {{ formatFcfa(slice.amountFcfa) }}
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              </div>
            </article>
          }

          <!-- BLOC 3 : RESTAURANT DU JOUR (Orange) -->
          @if (stats.restaurant; as r) {
            <article
              data-testid="accueil-block-restaurant"
              class="flex flex-col overflow-hidden rounded-2xl border border-[#fed7aa] bg-white shadow-sm"
            >
              <header class="flex items-center justify-between gap-2 border-b border-[#fed7aa] bg-[#fff7ed] px-4 py-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c2410c] text-white"
                    aria-hidden="true"
                  >
                    <span class="material-symbols-outlined text-xl">restaurant</span>
                  </span>
                  <div class="min-w-0">
                    <h3 class="text-sm font-extrabold uppercase tracking-wide text-[#9a3412]">
                      Restaurant du jour
                    </h3>
                    <p class="text-[11px] font-semibold text-[#c2410c]">
                      La Teranga &bull; Service du jour
                    </p>
                  </div>
                </div>
              </header>

              <div class="flex flex-1 flex-col justify-between gap-3 p-4">
                <!-- Plat le plus vendu en grand -->
                <div
                  data-testid="accueil-top-dish"
                  class="rounded-xl border border-[#fed7aa] bg-[#fffaf5] p-3"
                >
                  <span class="block text-[11px] font-bold uppercase tracking-wide text-[#9a3412]">
                    Plat le plus vendu
                  </span>
                  @if (r.topDish; as top) {
                    <div class="mt-1 text-base font-extrabold text-stone-900 leading-snug break-words" data-testid="stat-restaurant-top-dish-name">
                      {{ top.name }}
                    </div>
                    <div class="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span class="font-bold text-[#9a3412]" data-testid="stat-restaurant-top-dish-qty">
                        {{ top.quantity }} vendu(s)
                      </span>
                      <span class="font-extrabold text-stone-900 font-mono" data-testid="stat-restaurant-top-dish-amount">
                        {{ formatFcfa(top.amountFcfa) }}
                      </span>
                    </div>
                  } @else {
                    <p class="mt-1 text-sm font-bold text-stone-600" data-testid="accueil-restaurant-empty">
                      Aucune vente aujourd'hui
                    </p>
                  }
                </div>

                <div class="grid grid-cols-2 gap-2.5">
                  <div class="rounded-xl border border-[#ffedd5] bg-[#fffaf5] p-2.5">
                    <span class="block text-[11px] font-bold text-[#9a3412]">Commandes</span>
                    <span class="text-lg font-black text-stone-900 font-mono" data-testid="stat-restaurant-orders">
                      {{ r.ordersCount }}
                    </span>
                  </div>
                  <div class="rounded-xl border border-[#ffedd5] bg-[#fffaf5] p-2.5">
                    <span class="block text-[11px] font-bold text-[#9a3412]">Chiffre d'affaires</span>
                    <span class="text-sm sm:text-base font-black text-stone-900 font-mono break-words" data-testid="stat-restaurant-revenue">
                      {{ formatFcfa(r.revenueFcfa) }}
                    </span>
                  </div>
                </div>

                <!-- Top 5 des plats en barres colorées -->
                <div class="space-y-2 border-t border-stone-200 pt-2.5">
                  <span class="block text-[11px] font-bold text-[#9a3412]">
                    Top 5 des plats du jour
                  </span>
                  @if (r.topDishes.length > 0) {
                    <ol data-testid="accueil-top-5-bars" class="space-y-2">
                      @for (dish of r.topDishes; track dish.name; let i = $index) {
                        <li class="space-y-1 text-xs">
                          <div class="flex items-baseline justify-between gap-2">
                            <span class="font-bold text-stone-900 break-words">
                              {{ i + 1 }}. {{ dish.name }}
                            </span>
                            <span class="shrink-0 font-mono font-bold text-stone-700 whitespace-nowrap">
                              {{ dish.quantity }} &bull; {{ formatFcfa(dish.amountFcfa) }}
                            </span>
                          </div>
                          <div class="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                            <div
                              class="h-full rounded-full transition-all"
                              [style.width.%]="dishBarWidthPercent(dish.amountFcfa, r.topDishes)"
                              [style.backgroundColor]="topDishBarColor(i)"
                            ></div>
                          </div>
                        </li>
                      }
                    </ol>
                  } @else {
                    <p class="text-xs font-semibold text-stone-600">
                      Aucune vente aujourd'hui
                    </p>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class AccueilStatsDuJourComponent implements OnInit, OnDestroy {
  readonly service = inject(AccueilJourService);
  private readonly authService = inject(AuthService, { optional: true });

  readonly formatFcfa = formatAccueilFcfa;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void this.service.loadTodayStats();
    }
  };
  private readonly onNetworkReconnect = () => {
    void this.service.loadTodayStats();
  };
  private readonly onNetworkOffline = () => {
    void this.service.loadTodayStats();
  };

  readonly maxTopDishAmount = computed(() => {
    const list = this.service.stats()?.restaurant?.topDishes || [];
    return list.reduce((max, item) => Math.max(max, item.amountFcfa), 0);
  });

  constructor() {
    effect(() => {
      const authed = this.authService ? this.authService.isAuthenticated() : true;
      if (authed) {
        void this.service.loadTodayStats();
      }
    });
  }

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onNetworkReconnect);
      window.addEventListener('offline', this.onNetworkOffline);
      this.pollTimer = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          void this.service.loadTodayStats();
        }
      }, 60_000);
    }
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onNetworkReconnect);
      window.removeEventListener('offline', this.onNetworkOffline);
    }
  }

  paymentColor(code: AccueilPaymentMethodCode): string {
    return PAYMENT_BAR_COLORS[code] || '#475569';
  }

  topDishBarColor(index: number): string {
    return TOP_DISH_BAR_COLORS[index % TOP_DISH_BAR_COLORS.length];
  }

  dishBarWidthPercent(
    amountFcfa: number,
    list: Array<{ amountFcfa: number }>,
  ): number {
    const maxAmt = list.reduce((m, d) => Math.max(m, d.amountFcfa), 0);
    if (maxAmt <= 0) return 0;
    return Math.max(6, Math.round((amountFcfa * 100) / maxAmt));
  }
}
