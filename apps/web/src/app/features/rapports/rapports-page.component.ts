import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RapportsPeriodKey } from '@residence-blue/shared';
import { RapportsService } from './rapports.service';
import { RapportsChartsComponent } from './rapports-charts.component';
import { RapportsDailyTableComponent } from './rapports-daily-table.component';
import { formatRapportsDeltaPhrase, formatRapportsFcfa } from './rapports-formatting';

export { formatRapportsDeltaPhrase, formatRapportsFcfa } from './rapports-formatting';

interface PeriodOption {
  key: RapportsPeriodKey;
  label: string;
}

@Component({
  selector: 'app-rapports-page',
  standalone: true,
  imports: [CommonModule, RapportsChartsComponent, RapportsDailyTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  styles: [
    `
      :host {
        color: #161d20;
        font-family: 'Manrope', sans-serif;
      }

      .rb-rapports-wrap {
        width: 100%;
        max-width: 1380px;
        margin: 0 auto;
        padding: 16px;
        box-sizing: border-box;
      }

      @media (min-width: 768px) {
        .rb-rapports-wrap {
          padding: 24px 28px;
        }
      }

      .rb-rapports-title {
        font-family: 'Newsreader', serif;
        color: #161d20;
        letter-spacing: -0.01em;
      }

      .rb-period-btn {
        min-height: 40px;
        padding: 8px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        border: 1px solid #bdc9ca;
        background-color: #ffffff;
        color: #161d20;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
      }

      .rb-period-btn:hover {
        background-color: #eef5f9;
      }

      .rb-period-btn--active {
        background-color: #00666f;
        border-color: #00666f;
        color: #ffffff;
      }

      .rb-period-btn--active:hover {
        background-color: #004f56;
      }

      .rb-action-btn {
        min-height: 40px;
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        white-space: nowrap;
        border: 1px solid #00666f;
        cursor: pointer;
        transition: opacity 150ms ease, background-color 150ms ease;
      }

      .rb-action-btn--primary {
        background-color: #00666f;
        color: #ffffff;
      }

      .rb-action-btn--outline {
        background-color: #ffffff;
        color: #004f56;
      }

      .rb-action-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        border-color: #bdc9ca;
        background-color: #e8eff3;
        color: #3d494a;
      }

      .rb-tiles-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
      }

      @media (min-width: 768px) {
        .rb-tiles-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (min-width: 1200px) {
        .rb-tiles-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ],
  template: `
    <div class="rb-rapports-wrap" data-testid="rapports-page">
      <!-- En-tête -->
      <header class="mb-6 flex flex-col gap-4 border-b border-[#bdc9ca] pb-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <h1 class="rb-rapports-title text-3xl font-semibold leading-tight" data-testid="rapports-title">
              Rapports
            </h1>
            <p class="mt-1 text-sm font-medium text-[#3d494a]" data-testid="rapports-subtitle">
              @if (service.report(); as rep) {
                <span>{{ rep.hotelName }}</span>
                <span> &bull; {{ rep.periodLabel }}</span>
                <span> &bull; du {{ rep.startDateIso }} au {{ rep.endDateIso }}</span>
              } @else {
                <span>Activité financière et hébergement</span>
              }
            </p>
          </div>

          <!-- Exports -->
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="export-pdf-btn"
              class="rb-action-btn rb-action-btn--outline"
              [disabled]="!canExport() || service.exportingFormat() !== null"
              (click)="service.downloadExport('pdf')"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">picture_as_pdf</span>
              <span>{{ service.exportingFormat() === 'pdf' ? 'Export PDF...' : 'Exporter en PDF' }}</span>
            </button>
            <button
              type="button"
              data-testid="export-excel-btn"
              class="rb-action-btn rb-action-btn--primary"
              [disabled]="!canExport() || service.exportingFormat() !== null"
              (click)="service.downloadExport('excel')"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">table_chart</span>
              <span>{{ service.exportingFormat() === 'excel' ? 'Export Excel...' : 'Exporter en Excel' }}</span>
            </button>
          </div>
        </div>

        @if (service.exportError(); as expErr) {
          <div
            role="alert"
            data-testid="rapports-export-error"
            class="rounded-xl border border-[#ba1a1a] bg-[#ffdad6] px-4 py-2.5 text-xs font-bold text-[#410002]"
          >
            {{ expErr }}
          </div>
        }

        <!-- Périodes et case de comparaison -->
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Choix de la période">
            @for (opt of periodOptions; track opt.key) {
              <button
                type="button"
                [attr.data-testid]="'period-btn-' + opt.key"
                [attr.aria-pressed]="service.period() === opt.key"
                class="rb-period-btn"
                [class.rb-period-btn--active]="service.period() === opt.key"
                (click)="service.setPeriod(opt.key)"
              >
                {{ opt.label }}
              </button>
            }
          </div>

          <label class="inline-flex min-h-[40px] cursor-pointer items-center gap-2 text-sm font-semibold text-[#161d20]">
            <input
              type="checkbox"
              data-testid="compare-previous-checkbox"
              class="h-4 w-4 accent-[#00666f]"
              [checked]="service.comparePrevious()"
              (change)="onCompareToggle($event)"
            />
            <span>Comparer à la période précédente</span>
          </label>
        </div>
      </header>

      <!-- État hors ligne (aucune donnée financière en cache) -->
      @if (service.offlineBlocked()) {
        <section
          role="status"
          data-testid="rapports-offline-state"
          class="rounded-2xl border border-[#7e5700] bg-[#fef6e6] p-6 text-[#281900]"
        >
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-[24px] text-[#7e5700]" aria-hidden="true">cloud_off</span>
            <div class="min-w-0">
              <h2 class="text-base font-bold">Rapports indisponibles hors ligne</h2>
              <p class="mt-1 text-sm font-medium text-[#604100]">
                Les chiffres financiers ne sont jamais conservés sur l'appareil. Reconnectez-vous au serveur pour consulter et exporter les rapports à jour.
              </p>
            </div>
          </div>
        </section>
      } @else if (service.forbiddenMessage(); as forbidden) {
        <section
          role="alert"
          data-testid="rapports-forbidden-state"
          class="rounded-2xl border border-[#ba1a1a] bg-[#ffdad6] p-6 text-[#410002]"
        >
          <h2 class="text-base font-bold">Accès non autorisé</h2>
          <p class="mt-1 text-sm font-medium">{{ forbidden }}</p>
        </section>
      } @else if (service.loading()) {
        <section
          aria-label="Chargement des rapports"
          data-testid="rapports-loading-state"
          class="rb-tiles-grid"
        >
          @for (item of [1, 2, 3, 4, 5, 6]; track item) {
            <div class="h-36 animate-pulse rounded-2xl border border-[#dce4e7] bg-white p-5">
              <div class="h-4 w-32 rounded bg-[#e2e9ed]"></div>
              <div class="mt-4 h-8 w-44 rounded bg-[#d4dbdf]"></div>
              <div class="mt-4 h-3 w-56 rounded bg-[#e8eff3]"></div>
            </div>
          }
        </section>
      } @else if (service.errorMessage(); as err) {
        <section
          role="alert"
          data-testid="rapports-error-state"
          class="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#ba1a1a] bg-[#ffdad6] p-6 text-[#410002] sm:flex-row sm:items-center"
        >
          <div>
            <h2 class="text-base font-bold">Erreur de chargement</h2>
            <p class="mt-1 text-sm font-medium">{{ err }}</p>
          </div>
          <button
            type="button"
            data-testid="rapports-retry-btn"
            class="rb-action-btn rb-action-btn--outline"
            (click)="service.load()"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
            <span>Réessayer</span>
          </button>
        </section>
      } @else if (service.report(); as rep) {
        @if (!rep.hasData) {
          <!-- Base vide sur la période : uniquement le message et l'aide -->
          <section
            data-testid="rapports-empty-state"
            class="rounded-2xl border border-[#bdc9ca] bg-white p-8 text-center shadow-sm"
          >
            <span
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef5f9] text-[#004f56]"
              aria-hidden="true"
            >
              <span class="material-symbols-outlined text-[24px]">analytics</span>
            </span>
            <h2 class="mt-4 text-xl font-bold text-[#161d20]" data-testid="rapports-empty-title">
              Aucune donnée sur cette période
            </h2>
            <p class="mt-2 text-sm font-medium text-[#3d494a]" data-testid="rapports-empty-help">
              Changez de période ou commencez à enregistrer des séjours et des ventes
            </p>
          </section>
        } @else {
          <!-- Rappel visible en trois lignes -->
          <section
            aria-label="Règles de lecture des chiffres"
            data-testid="rapports-reading-note"
            class="mb-5 rounded-xl border border-[#bdc9ca] bg-[#eef5f9] px-4 py-3 text-xs font-medium text-[#161d20]"
          >
            <p>1. Ventes comptées le jour du service (nuit passée, repas servi).</p>
            <p>2. Annulations non comptées et avoirs déduits automatiquement.</p>
            <p>3. Montants hors taxes, exprimés en FCFA entiers.</p>
          </section>

          <!-- Tuiles colorées (affichées uniquement si présentes) -->
          @if (rep.tiles; as tiles) {
            <section
              aria-label="Chiffres clés de la période"
              data-testid="rapports-tiles-grid"
              class="rb-tiles-grid mb-6"
            >
              @if (tiles.revenue; as rev) {
                <article
                  data-testid="tile-revenue"
                  class="flex flex-col justify-between rounded-2xl border border-[#00666f] bg-white p-5 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-xs font-extrabold uppercase tracking-wider text-[#004f56]">
                      Chiffre d'affaires
                    </span>
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e6f3f4] text-[#004f56]">
                      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">payments</span>
                    </span>
                  </div>
                  <div class="mt-3 text-2xl font-extrabold tracking-tight text-[#161d20]" data-testid="tile-revenue-value">
                    {{ formatFcfa(rev.amountFcfa) }}
                  </div>
                  @if (service.comparePrevious() && rev.deltaPercent !== undefined) {
                    <p
                      data-testid="tile-revenue-delta"
                      class="mt-2 text-xs font-bold"
                      [class.text-[#004f56]]="rev.deltaPercent >= 0"
                      [class.text-[#93000a]]="rev.deltaPercent < 0"
                    >
                      {{ formatDelta(rev.deltaPercent) }}
                    </p>
                  }
                  <p class="mt-2 text-xs font-medium text-[#3d494a]">
                    Total des ventes de l'hôtel sur la période, avoirs déduits.
                  </p>
                </article>
              }

              @if (tiles.accommodation; as heb) {
                <article
                  data-testid="tile-accommodation"
                  class="flex flex-col justify-between rounded-2xl border border-[#465d7b] bg-white p-5 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-xs font-extrabold uppercase tracking-wider text-[#314865]">
                      Hébergement
                    </span>
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf3fc] text-[#314865]">
                      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">bed</span>
                    </span>
                  </div>
                  <div class="mt-3 text-2xl font-extrabold tracking-tight text-[#161d20]" data-testid="tile-accommodation-value">
                    {{ formatFcfa(heb.amountFcfa) }}
                  </div>
                  <p class="mt-2 text-xs font-bold text-[#314865]" data-testid="tile-accommodation-share">
                    Part : {{ heb.sharePercent }} % du chiffre d'affaires
                  </p>
                  <p class="mt-2 text-xs font-medium text-[#3d494a]">
                    Ventes liées aux nuitées des chambres sur la période.
                  </p>
                </article>
              }

              @if (tiles.restaurant; as rest) {
                <article
                  data-testid="tile-restaurant"
                  class="flex flex-col justify-between rounded-2xl border border-[#7e5700] bg-white p-5 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-xs font-extrabold uppercase tracking-wider text-[#604100]">
                      Restaurant et bar
                    </span>
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fef6e6] text-[#604100]">
                      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">restaurant</span>
                    </span>
                  </div>
                  <div class="mt-3 text-2xl font-extrabold tracking-tight text-[#161d20]" data-testid="tile-restaurant-value">
                    {{ formatFcfa(rest.amountFcfa) }}
                  </div>
                  <p class="mt-2 text-xs font-bold text-[#604100]" data-testid="tile-restaurant-share">
                    Part : {{ rest.sharePercent }} % du chiffre d'affaires
                  </p>
                  <p class="mt-2 text-xs font-medium text-[#3d494a]">
                    Repas et boissons servis en salle ou portés sur les chambres.
                  </p>
                </article>
              }

              @if (tiles.occupancy; as occ) {
                <article
                  data-testid="tile-occupancy"
                  class="flex flex-col justify-between rounded-2xl border border-[#00666f] bg-white p-5 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-xs font-extrabold uppercase tracking-wider text-[#004f56]">
                      Chambres occupées
                    </span>
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf7f1] text-[#004f56]">
                      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">hotel</span>
                    </span>
                  </div>
                  <div class="mt-3 text-2xl font-extrabold tracking-tight text-[#161d20]" data-testid="tile-occupancy-value">
                    {{ occ.averagePercent }} %
                  </div>
                  <p class="mt-2 text-xs font-bold text-[#004f56]">
                    {{ occ.occupiedRoomNights }} nuitées sur {{ occ.capacityRoomNights }} possibles
                  </p>
                  @if (service.comparePrevious() && occ.deltaPercent !== undefined) {
                    <p
                      data-testid="tile-occupancy-delta"
                      class="mt-1 text-xs font-bold"
                      [class.text-[#004f56]]="occ.deltaPercent >= 0"
                      [class.text-[#93000a]]="occ.deltaPercent < 0"
                    >
                      {{ formatDelta(occ.deltaPercent) }}
                    </p>
                  }
                  <p class="mt-2 text-xs font-medium text-[#3d494a]">
                    Part moyenne des chambres actives occupées chaque nuit.
                  </p>
                </article>
              }

              @if (tiles.collected; as col) {
                <article
                  data-testid="tile-collected"
                  class="flex flex-col justify-between rounded-2xl border border-[#006972] bg-white p-5 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-xs font-extrabold uppercase tracking-wider text-[#004f56]">
                      Argent encaissé
                    </span>
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3] text-[#004f56]">
                      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">account_balance_wallet</span>
                    </span>
                  </div>
                  <div class="mt-3 text-2xl font-extrabold tracking-tight text-[#161d20]" data-testid="tile-collected-value">
                    {{ formatFcfa(col.amountFcfa) }}
                  </div>
                  @if (service.comparePrevious() && col.deltaPercent !== undefined) {
                    <p
                      data-testid="tile-collected-delta"
                      class="mt-2 text-xs font-bold"
                      [class.text-[#004f56]]="col.deltaPercent >= 0"
                      [class.text-[#93000a]]="col.deltaPercent < 0"
                    >
                      {{ formatDelta(col.deltaPercent) }}
                    </p>
                  }
                  <p class="mt-2 text-xs font-medium text-[#3d494a]">
                    Encaissements reçus (espèces, mobile, carte, virement).
                  </p>
                </article>
              }

              @if (tiles.remaining; as rem) {
                <article
                  data-testid="tile-remaining"
                  class="flex flex-col justify-between rounded-2xl border border-[#ba1a1a] bg-white p-5 shadow-sm"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-xs font-extrabold uppercase tracking-wider text-[#93000a]">
                      Reste à encaisser
                    </span>
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffdad6] text-[#93000a]">
                      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">hourglass_top</span>
                    </span>
                  </div>
                  <div class="mt-3 text-2xl font-extrabold tracking-tight text-[#93000a]" data-testid="tile-remaining-value">
                    {{ formatFcfa(rem.amountFcfa) }}
                  </div>
                  <p class="mt-2 text-xs font-medium text-[#3d494a]">
                    Montants des notes de la période encore en attente de règlement.
                  </p>
                </article>
              }
            </section>
          }

          <!-- Les 8 diagrammes conditionnels -->
          <app-rapports-charts
            [report]="rep"
            [comparePrevious]="service.comparePrevious()"
          />

          <!-- Tableau Jour par jour -->
          @if (rep.dailyTable; as table) {
            <app-rapports-daily-table [table]="table" />
          }
        }
      }
    </div>
  `,
})
export class RapportsPageComponent implements OnInit {
  readonly service: RapportsService;

  readonly periodOptions: readonly PeriodOption[] = [
    { key: '30j', label: '30 jours' },
    { key: '3m', label: '3 mois' },
    { key: '12m', label: '12 mois' },
    { key: 'mois', label: 'Mois en cours' },
  ];

  readonly canExport = computed(
    () => !this.service.offlineBlocked() && Boolean(this.service.report()?.hasData),
  );

  constructor(serviceOverride?: RapportsService) {
    let injected: RapportsService | null = null;
    try {
      injected = inject(RapportsService, { optional: true });
    } catch {
      injected = null;
    }
    this.service = serviceOverride ?? injected ?? new RapportsService();
  }

  ngOnInit(): void {
    void this.service.load();
  }

  onCompareToggle(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.service.setComparePrevious(Boolean(input.checked));
  }

  formatFcfa(amount: number): string {
    return formatRapportsFcfa(amount);
  }

  formatDelta(deltaPercent: number): string {
    return formatRapportsDeltaPhrase(deltaPercent);
  }
}
