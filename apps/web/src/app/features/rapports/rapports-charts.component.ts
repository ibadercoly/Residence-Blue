import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RapportsResponse } from '@residence-blue/shared';
import {
  buildDonutSegments,
  buildEvolutionSvgGeometry,
  buildOccupancyBarsGeometry,
  buildStackedWeeksGeometry,
  buildWeekdayGeometry,
  formatShortFcfa,
} from './rapports-charts.util';
import { formatRapportsFcfa } from './rapports-formatting';

const DONUT_COLORS = ['#00666f', '#b45309', '#314865', '#0f766e', '#7c2d12'];
const SOURCE_COLORS = ['#00666f', '#314865', '#b45309', '#047857', '#6d28d9', '#475569'];

@Component({
  selector: 'app-rapports-charts',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  styles: [
    `
      .rb-charts-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 18px;
      }

      @media (min-width: 1024px) {
        .rb-charts-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .rb-chart-wide {
          grid-column: span 2 / span 2;
        }
      }

      .rb-chart-card {
        min-width: 0;
        background-color: #ffffff;
        border: 1px solid #bdc9ca;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 1px 4px rgba(10, 37, 64, 0.04);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .rb-tooltip-pill {
        min-height: 28px;
        padding: 4px 10px;
        border-radius: 8px;
        background-color: #eef5f9;
        border: 1px solid #bdc9ca;
        color: #161d20;
        font-size: 12px;
        font-weight: 700;
      }
    `,
  ],
  template: `
    <section
      aria-label="Diagrammes d'analyse"
      data-testid="rapports-charts-grid"
      class="rb-charts-grid mb-6"
    >
      <!-- a) Évolution du chiffre d'affaires -->
      @if (report.revenueEvolution; as evo) {
        @if (evolutionGeo(); as geo) {
          <article
            data-testid="chart-revenue-evolution"
            class="rb-chart-card rb-chart-wide"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[20px] text-[#004f56]" aria-hidden="true">show_chart</span>
                  <h2 class="text-lg font-bold text-[#161d20]">Évolution du chiffre d'affaires</h2>
                </div>
                <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
                  {{
                    evo.granularity === 'day'
                      ? 'Ventes quotidiennes hors taxes sur la période.'
                      : evo.granularity === 'week'
                        ? 'Ventes hebdomadaires hors taxes sur 3 mois.'
                        : 'Ventes mensuelles hors taxes sur 12 mois.'
                  }}
                </p>
              </div>

              <!-- Carte Meilleur jour -->
              <div
                data-testid="card-best-day"
                class="rounded-xl border border-[#00666f] bg-[#e6f3f4] px-4 py-2.5 text-left shrink-0"
              >
                <div class="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#004f56]">
                  <span aria-hidden="true">&#9733;</span>
                  <span>Meilleur jour</span>
                </div>
                <div class="mt-0.5 text-sm font-extrabold text-[#161d20]" data-testid="best-day-amount">
                  {{ fcfa(evo.bestPoint.amountFcfa) }}
                </div>
                <div class="text-xs font-semibold text-[#004f56]" data-testid="best-day-label">
                  {{ evo.bestPoint.label }}
                </div>
              </div>
            </div>

            <!-- Légende + infobulle au survol -->
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
              <div class="flex flex-wrap items-center gap-4">
                <span class="inline-flex items-center gap-1.5 text-[#161d20]">
                  <span class="inline-block h-1 w-5 rounded bg-[#00666f]"></span>
                  <span>Période en cours</span>
                </span>
                @if (comparePrevious && evo.previousPoints?.length) {
                  <span class="inline-flex items-center gap-1.5 text-[#3d494a]" data-testid="legend-previous-dashed">
                    <span class="inline-block h-0 w-5 border-t-2 border-dashed border-[#465d7b]"></span>
                    <span>Période précédente</span>
                  </span>
                }
                <span class="inline-flex items-center gap-1 text-[#604100]">
                  <span aria-hidden="true">&#9733;</span>
                  <span>3 sommets</span>
                </span>
                <span class="inline-flex items-center gap-1 text-[#93000a]">
                  <span aria-hidden="true">&#9660;</span>
                  <span>Plus bas : {{ evo.lowestPoint.label }} ({{ fcfa(evo.lowestPoint.amountFcfa) }})</span>
                </span>
              </div>

              @if (hoveredEvo(); as hov) {
                <div class="rb-tooltip-pill" data-testid="tooltip-evolution">
                  {{ hov.label }} : {{ fcfa(hov.amountFcfa) }}
                </div>
              }
            </div>

            <div class="mt-3 w-full">
              <svg
                class="h-auto w-full overflow-visible"
                [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height"
                role="img"
                [attr.aria-label]="'Évolution du chiffre d affaires : meilleur point ' + evo.bestPoint.label + ' à ' + fcfa(evo.bestPoint.amountFcfa)"
              >
                <defs>
                  <linearGradient id="rbRapportsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#00666f" stop-opacity="0.22"></stop>
                    <stop offset="100%" stop-color="#00666f" stop-opacity="0.02"></stop>
                  </linearGradient>
                </defs>

                @for (yt of geo.yTicks; track yt.value) {
                  <line
                    [attr.x1]="geo.padLeft"
                    [attr.x2]="geo.width - geo.padRight"
                    [attr.y1]="yt.y"
                    [attr.y2]="yt.y"
                    stroke="#dce4e7"
                    stroke-dasharray="4 4"
                    stroke-width="1"
                  ></line>
                  <text
                    [attr.x]="geo.padLeft - 8"
                    [attr.y]="yt.y + 4"
                    text-anchor="end"
                    fill="#3d494a"
                    font-size="11"
                    font-family="Manrope, sans-serif"
                  >
                    {{ shortFcfa(yt.value) }}
                  </text>
                }

                <path [attr.d]="geo.areaPath" fill="url(#rbRapportsArea)"></path>

                @if (comparePrevious && geo.prevPath) {
                  <path
                    [attr.d]="geo.prevPath"
                    fill="none"
                    stroke="#465d7b"
                    stroke-width="2"
                    stroke-dasharray="6 5"
                    data-testid="svg-previous-dashed-line"
                  ></path>
                }

                <path
                  [attr.d]="geo.linePath"
                  fill="none"
                  stroke="#00666f"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>

                @for (pt of geo.currentCoords; track pt.key) {
                  <g>
                    <circle
                      [attr.cx]="pt.x"
                      [attr.cy]="pt.y"
                      [attr.r]="pt.isTop ? 6 : pt.isLowest ? 5 : 4"
                      [attr.fill]="pt.isTop ? '#7e5700' : pt.isLowest ? '#93000a' : '#00666f'"
                      stroke="#ffffff"
                      stroke-width="2"
                      tabindex="0"
                      [attr.aria-label]="pt.label + ' : ' + fcfa(pt.amountFcfa)"
                      (mouseenter)="hoveredEvo.set({ label: pt.label, amountFcfa: pt.amountFcfa })"
                      (focus)="hoveredEvo.set({ label: pt.label, amountFcfa: pt.amountFcfa })"
                      (mouseleave)="hoveredEvo.set(null)"
                      (blur)="hoveredEvo.set(null)"
                      style="cursor: pointer"
                    >
                      <title>{{ pt.label }} : {{ fcfa(pt.amountFcfa) }}</title>
                    </circle>
                    @if (pt.isTop) {
                      <text
                        [attr.x]="pt.x"
                        [attr.y]="pt.y - 11"
                        text-anchor="middle"
                        fill="#604100"
                        font-size="12"
                        font-weight="800"
                        font-family="Manrope, sans-serif"
                      >
                        &#9733;
                      </text>
                    }
                    @if (pt.isLowest && !pt.isTop) {
                      <text
                        [attr.x]="pt.x"
                        [attr.y]="pt.y + 15"
                        text-anchor="middle"
                        fill="#93000a"
                        font-size="11"
                        font-weight="800"
                        font-family="Manrope, sans-serif"
                      >
                        &#9660;
                      </text>
                    }
                  </g>
                }

                <line
                  [attr.x1]="geo.padLeft"
                  [attr.x2]="geo.width - geo.padRight"
                  [attr.y1]="geo.baseY"
                  [attr.y2]="geo.baseY"
                  stroke="#6d797b"
                  stroke-width="1"
                ></line>

                @for (xt of geo.xTicks; track xt.x) {
                  <text
                    [attr.x]="xt.x"
                    [attr.y]="geo.baseY + 20"
                    text-anchor="middle"
                    fill="#3d494a"
                    font-size="11"
                    font-family="Manrope, sans-serif"
                  >
                    {{ xt.label }}
                  </text>
                }
              </svg>
            </div>

            <!-- Liste explicite des 3 plus hauts jours (étoiles) -->
            <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="top-3-points">
              @for (tp of evo.topPoints; track tp.key) {
                <div class="rounded-lg border border-[#e2e9ed] bg-[#f3fafe] px-3 py-2 text-xs">
                  <span class="font-extrabold text-[#604100]">&#9733; #{{ tp.rank }} &bull; {{ tp.label }}</span>
                  <div class="mt-0.5 font-bold text-[#161d20]">{{ fcfa(tp.amountFcfa) }}</div>
                </div>
              }
            </div>

            <p class="mt-3 text-xs font-medium text-[#3d494a]">
              Cette courbe suit le montant total des ventes réalisées sur chaque créneau, avec les 3 jours records étoilés et le point le plus faible repéré.
            </p>
          </article>
        }
      }

      <!-- b) Ventes par type et par semaine -->
      @if (report.salesByTypeByWeek; as weeks) {
        @if (stackedWeeksGeo(); as geo) {
          <article data-testid="chart-sales-by-week" class="rb-chart-card">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="text-base font-bold text-[#161d20]">Ventes par type et par semaine</h2>
                <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
                  Répartition hebdomadaire entre chambres, restaurant et autres prestations.
                </p>
              </div>
              @if (hoveredWeek(); as hw) {
                <div class="rb-tooltip-pill text-right" data-testid="tooltip-week">
                  {{ hw.label }} : {{ fcfa(hw.total) }}
                </div>
              }
            </div>

            <div class="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#161d20]">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded-sm bg-[#00666f]"></span>
                <span>Hébergement</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded-sm border border-[#7e5700] bg-[#d97706]"></span>
                <span>Restaurant et bar</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded-sm border border-[#314865] bg-[#465d7b]"></span>
                <span>Autres</span>
              </span>
            </div>

            <div class="mt-3 w-full">
              <svg
                class="h-auto w-full overflow-visible"
                [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height"
                role="img"
                aria-label="Ventes hebdomadaires empilées par type : hébergement, restaurant et bar, autres"
              >
                <defs>
                  <pattern id="rbPatternResto" width="6" height="6" patternUnits="userSpaceOnUse">
                    <rect width="6" height="6" fill="#d97706"></rect>
                    <circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity="0.45"></circle>
                  </pattern>
                  <pattern id="rbPatternOther" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="#465d7b"></rect>
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2"></line>
                  </pattern>
                </defs>

                @for (yt of geo.yTicks; track yt.value) {
                  <line
                    [attr.x1]="geo.padLeft"
                    [attr.x2]="geo.width - geo.padRight"
                    [attr.y1]="yt.y"
                    [attr.y2]="yt.y"
                    stroke="#dce4e7"
                    stroke-dasharray="4 4"
                    stroke-width="1"
                  ></line>
                  <text
                    [attr.x]="geo.padLeft - 8"
                    [attr.y]="yt.y + 4"
                    text-anchor="end"
                    fill="#3d494a"
                    font-size="11"
                    font-family="Manrope, sans-serif"
                  >
                    {{ shortFcfa(yt.value) }}
                  </text>
                }

                @for (b of geo.bars; track b.weekKey; let i = $index) {
                  <g
                    tabindex="0"
                    [attr.aria-label]="b.label + ' : Total ' + fcfa(b.total)"
                    (mouseenter)="hoveredWeek.set({ label: b.label, total: b.total })"
                    (focus)="hoveredWeek.set({ label: b.label, total: b.total })"
                    (mouseleave)="hoveredWeek.set(null)"
                    (blur)="hoveredWeek.set(null)"
                    style="cursor: pointer"
                  >
                    <title>{{ b.label }} — Héberg: {{ fcfa(b.heb) }} | Resto: {{ fcfa(b.rest) }} | Autres: {{ fcfa(b.other) }}</title>
                    @if (b.hHeb > 0) {
                      <rect [attr.x]="b.x" [attr.y]="b.yHeb" [attr.width]="b.barW" [attr.height]="b.hHeb" fill="#00666f" rx="2"></rect>
                    }
                    @if (b.hRest > 0) {
                      <rect [attr.x]="b.x" [attr.y]="b.yRest" [attr.width]="b.barW" [attr.height]="b.hRest" fill="url(#rbPatternResto)"></rect>
                    }
                    @if (b.hOther > 0) {
                      <rect [attr.x]="b.x" [attr.y]="b.yOther" [attr.width]="b.barW" [attr.height]="b.hOther" fill="url(#rbPatternOther)" rx="2"></rect>
                    }
                    @if (geo.tickIndices.has(i)) {
                      <text
                        [attr.x]="b.x + b.barW / 2"
                        [attr.y]="geo.baseY + 18"
                        text-anchor="middle"
                        fill="#3d494a"
                        font-size="11"
                        font-family="Manrope, sans-serif"
                      >
                        {{ b.shortLabel }}
                      </text>
                    }
                  </g>
                }

                <line
                  [attr.x1]="geo.padLeft"
                  [attr.x2]="geo.width - geo.padRight"
                  [attr.y1]="geo.baseY"
                  [attr.y2]="geo.baseY"
                  stroke="#6d797b"
                  stroke-width="1"
                ></line>
              </svg>
            </div>

            <p class="mt-3 text-xs font-medium text-[#3d494a]">
              Chaque barre empile les trois sources de ventes de l'hôtel semaine par semaine.
            </p>
          </article>
        }
      }

      <!-- c) Chambres occupées par jour -->
      @if (report.occupancyByDay; as occ) {
        @if (occupancyGeo(); as geo) {
          <article data-testid="chart-occupancy-by-day" class="rb-chart-card">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="text-base font-bold text-[#161d20]">Chambres occupées par jour</h2>
                <p class="mt-0.5 text-xs font-bold text-[#004f56]">
                  Moyenne : {{ occ.averageRooms }} sur {{ occ.activeRoomsCount }} chambres ({{ occ.averagePercent }} %)
                </p>
              </div>
              @if (hoveredOcc(); as ho) {
                <div class="rb-tooltip-pill" data-testid="tooltip-occupancy">
                  {{ ho.label }} : {{ ho.occupiedRooms }}/{{ ho.activeRooms }} ({{ ho.percent }} %)
                </div>
              }
            </div>

            <div class="mt-3 w-full">
              <svg
                class="h-auto w-full overflow-visible"
                [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height"
                role="img"
                [attr.aria-label]="'Chambres occupées par jour : moyenne ' + occ.averageRooms + ' sur ' + occ.activeRoomsCount + ' chambres'"
              >
                @for (yt of geo.yTicks; track yt.value) {
                  <line
                    [attr.x1]="geo.padLeft"
                    [attr.x2]="geo.width - geo.padRight"
                    [attr.y1]="yt.y"
                    [attr.y2]="yt.y"
                    stroke="#dce4e7"
                    stroke-dasharray="4 4"
                    stroke-width="1"
                  ></line>
                  <text
                    [attr.x]="geo.padLeft - 8"
                    [attr.y]="yt.y + 4"
                    text-anchor="end"
                    fill="#3d494a"
                    font-size="11"
                    font-family="Manrope, sans-serif"
                  >
                    {{ yt.value }} ch.
                  </text>
                }

                @for (b of geo.bars; track b.dateIso; let i = $index) {
                  <g
                    tabindex="0"
                    [attr.aria-label]="b.label + ' : ' + b.occupiedRooms + ' sur ' + b.activeRooms"
                    (mouseenter)="hoveredOcc.set(b)"
                    (focus)="hoveredOcc.set(b)"
                    (mouseleave)="hoveredOcc.set(null)"
                    (blur)="hoveredOcc.set(null)"
                    style="cursor: pointer"
                  >
                    <title>{{ b.label }} : {{ b.occupiedRooms }} sur {{ b.activeRooms }} ({{ b.percent }} %)</title>
                    <rect
                      [attr.x]="b.x"
                      [attr.y]="b.y"
                      [attr.width]="b.barW"
                      [attr.height]="b.h"
                      fill="#00666f"
                      rx="2"
                    ></rect>
                    @if (geo.tickIndices.has(i)) {
                      <text
                        [attr.x]="b.x + b.barW / 2"
                        [attr.y]="geo.baseY + 18"
                        text-anchor="middle"
                        fill="#3d494a"
                        font-size="11"
                        font-family="Manrope, sans-serif"
                      >
                        {{ b.label }}
                      </text>
                    }
                  </g>
                }

                <!-- Ligne moyenne en pointillé -->
                <line
                  [attr.x1]="geo.padLeft"
                  [attr.x2]="geo.width - geo.padRight"
                  [attr.y1]="geo.avgY"
                  [attr.y2]="geo.avgY"
                  stroke="#93000a"
                  stroke-width="2"
                  stroke-dasharray="5 4"
                ></line>
                <text
                  [attr.x]="geo.width - geo.padRight"
                  [attr.y]="geo.avgY - 6"
                  text-anchor="end"
                  fill="#93000a"
                  font-size="11"
                  font-weight="700"
                  font-family="Manrope, sans-serif"
                >
                  Moy. {{ occ.averageRooms }}
                </text>

                <line
                  [attr.x1]="geo.padLeft"
                  [attr.x2]="geo.width - geo.padRight"
                  [attr.y1]="geo.baseY"
                  [attr.y2]="geo.baseY"
                  stroke="#6d797b"
                  stroke-width="1"
                ></line>
              </svg>
            </div>

            <p class="mt-3 text-xs font-medium text-[#3d494a]">
              Nombre de chambres occupées chaque nuit par rapport au total des chambres actives ({{ occ.activeRoomsCount }}).
            </p>
          </article>
        }
      }

      <!-- d) Argent encaissé par mode de paiement -->
      @if (report.paymentsByMethod; as pay) {
        <article data-testid="chart-payments-by-method" class="rb-chart-card">
          <div>
            <h2 class="text-base font-bold text-[#161d20]">Argent encaissé par mode de paiement</h2>
            <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
              Part de chaque moyen d'encaissement reçu sur la période.
            </p>
          </div>

          <div class="mt-4 flex flex-col items-center gap-5 sm:flex-row">
            <div class="relative h-44 w-44 shrink-0">
              <svg
                class="h-full w-full -rotate-90"
                viewBox="0 0 100 100"
                role="img"
                [attr.aria-label]="'Répartition des encaissements pour un total de ' + fcfa(pay.totalFcfa)"
              >
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#e8eff3" stroke-width="14"></circle>
                @for (seg of donutSegments(); track seg.label) {
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    [attr.stroke]="seg.color"
                    stroke-width="14"
                    [attr.stroke-dasharray]="seg.dasharray"
                    [attr.stroke-dashoffset]="seg.dashoffset"
                  >
                    <title>{{ seg.label }} : {{ fcfa(seg.amountFcfa) }} ({{ seg.percent }} %)</title>
                  </circle>
                }
              </svg>
              <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span class="text-[10px] font-bold uppercase tracking-wider text-[#3d494a]">Total encaissé</span>
                <span class="text-sm font-extrabold text-[#161d20]">{{ shortFcfa(pay.totalFcfa) }}</span>
                <span class="text-[11px] font-bold text-[#004f56]">FCFA</span>
              </div>
            </div>

            <div class="flex-1 w-full space-y-2">
              @for (item of pay.items; track item.method; let i = $index) {
                <div class="flex items-center justify-between gap-2 rounded-lg bg-[#f3fafe] px-3 py-2 text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="h-3 w-3 shrink-0 rounded-full" [style.background-color]="donutColor(i)"></span>
                    <span class="font-bold text-[#161d20] truncate">{{ item.label }}</span>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="font-extrabold text-[#161d20]">{{ fcfa(item.amountFcfa) }}</span>
                    <span class="ml-1.5 font-bold text-[#004f56]">({{ item.percent }} %)</span>
                  </div>
                </div>
              }
            </div>
          </div>

          <p class="mt-3 text-xs font-medium text-[#3d494a]">
            Seuls les encaissements réellement perçus sont répartis ci-dessus.
          </p>
        </article>
      }

      <!-- e) D'où viennent les réservations -->
      @if (report.reservationSources; as src) {
        <article data-testid="chart-reservation-sources" class="rb-chart-card">
          <div>
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-base font-bold text-[#161d20]">D'où viennent les réservations</h2>
              <span class="rounded-full bg-[#eef5f9] px-2.5 py-0.5 text-xs font-bold text-[#004f56]">
                {{ src.totalCount }} séjours
              </span>
            </div>
            <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
              Canaux par lesquels les clients ont réservé leur séjour.
            </p>
          </div>

          <div
            class="mt-4 space-y-3"
            role="img"
            [attr.aria-label]="'Origine des réservations sur ' + src.totalCount + ' séjours'"
          >
            @for (item of src.items; track item.source; let i = $index) {
              <div>
                <div class="flex items-center justify-between gap-2 text-xs font-bold">
                  <span class="text-[#161d20]">{{ item.label }}</span>
                  <span class="text-[#004f56]">{{ item.count }} ({{ item.percent }} %)</span>
                </div>
                <div class="mt-1 h-3 w-full overflow-hidden rounded-full bg-[#e8eff3]">
                  <div
                    class="h-full rounded-full"
                    [style.width.%]="item.percent"
                    [style.background-color]="sourceColor(i)"
                  ></div>
                </div>
              </div>
            }
          </div>

          <p class="mt-4 text-xs font-medium text-[#3d494a]">
            Permet de voir la part des réservations directes face aux intermédiaires.
          </p>
        </article>
      }

      <!-- f) Ventes par catégorie de chambre -->
      @if (report.salesByRoomCategory; as roomCats) {
        <article data-testid="chart-sales-by-room-category" class="rb-chart-card">
          <div>
            <h2 class="text-base font-bold text-[#161d20]">Ventes par catégorie de chambre</h2>
            <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
              Contribution de chaque catégorie de chambre au revenu hébergement.
            </p>
          </div>

          <div
            class="mt-4 space-y-3"
            role="img"
            [attr.aria-label]="'Ventes hébergement par catégorie de chambre pour ' + fcfa(roomCats.totalFcfa)"
          >
            @for (item of roomCats.items; track item.category) {
              <div class="rounded-xl border border-[#e2e9ed] bg-[#f3fafe] p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span class="text-sm font-bold text-[#161d20]">{{ item.category }}</span>
                    @if (item.nightsCount > 0) {
                      <span class="ml-2 text-xs font-semibold text-[#3d494a]">
                        ({{ item.nightsCount }} nuitées)
                      </span>
                    }
                  </div>
                  <div class="text-right">
                    <span class="text-sm font-extrabold text-[#004f56]">{{ fcfa(item.amountFcfa) }}</span>
                    <span class="ml-1.5 text-xs font-bold text-[#161d20]">({{ item.sharePercent }} %)</span>
                  </div>
                </div>
                <div class="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#dce4e7]">
                  <div class="h-full rounded-full bg-[#00666f]" [style.width.%]="item.sharePercent"></div>
                </div>
              </div>
            }
          </div>

          <p class="mt-4 text-xs font-medium text-[#3d494a]">
            Montants hors taxes des nuitées facturées par type de chambre.
          </p>
        </article>
      }

      <!-- g) Jours de la semaine -->
      @if (report.weekdayAverages; as weekdays) {
        @if (weekdayGeo(); as geo) {
          <article data-testid="chart-weekday-averages" class="rb-chart-card">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="text-base font-bold text-[#161d20]">Jours de la semaine</h2>
                <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
                  Moyenne des ventes par jour de la semaine sur la période.
                </p>
              </div>
              @if (hoveredWeekday(); as hwd) {
                <div class="rb-tooltip-pill" data-testid="tooltip-weekday">
                  {{ hwd.label }} : {{ fcfa(hwd.averageFcfa) }} / jour
                </div>
              }
            </div>

            <div class="mt-3 w-full">
              <svg
                class="h-auto w-full overflow-visible"
                [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height"
                role="img"
                aria-label="Moyenne des ventes hors taxes par jour de la semaine du lundi au dimanche"
              >
                @for (b of geo.bars; track b.weekdayIndex) {
                  <g
                    tabindex="0"
                    [attr.aria-label]="b.label + ' : moyenne ' + fcfa(b.averageFcfa)"
                    (mouseenter)="hoveredWeekday.set({ label: b.label, averageFcfa: b.averageFcfa })"
                    (focus)="hoveredWeekday.set({ label: b.label, averageFcfa: b.averageFcfa })"
                    (mouseleave)="hoveredWeekday.set(null)"
                    (blur)="hoveredWeekday.set(null)"
                    style="cursor: pointer"
                  >
                    <title>{{ b.label }} : moyenne {{ fcfa(b.averageFcfa) }}</title>
                    <rect
                      [attr.x]="b.x"
                      [attr.y]="b.y"
                      [attr.width]="b.barW"
                      [attr.height]="b.h"
                      [attr.fill]="b.isBest ? '#7e5700' : '#00666f'"
                      rx="4"
                    ></rect>
                    @if (b.averageFcfa > 0) {
                      <text
                        [attr.x]="b.x + b.barW / 2"
                        [attr.y]="b.y - 6"
                        text-anchor="middle"
                        [attr.fill]="b.isBest ? '#604100' : '#161d20'"
                        font-size="11"
                        font-weight="700"
                        font-family="Manrope, sans-serif"
                      >
                        {{ shortFcfa(b.averageFcfa) }}
                      </text>
                    }
                    <text
                      [attr.x]="b.x + b.barW / 2"
                      [attr.y]="geo.baseY + 18"
                      text-anchor="middle"
                      fill="#161d20"
                      font-size="11"
                      font-weight="600"
                      font-family="Manrope, sans-serif"
                    >
                      {{ b.label.slice(0, 3) }}.
                    </text>
                  </g>
                }
                <line
                  [attr.x1]="geo.padLeft"
                  [attr.x2]="geo.width - geo.padRight"
                  [attr.y1]="geo.baseY"
                  [attr.y2]="geo.baseY"
                  stroke="#6d797b"
                  stroke-width="1"
                ></line>
              </svg>
            </div>

            <p class="mt-3 text-xs font-medium text-[#3d494a]">
              Le jour le plus rentable en moyenne est mis en couleur dorée.
            </p>
          </article>
        }
      }

      <!-- h) Les 10 plats les plus vendus -->
      @if (report.topDishes; as dishes) {
        <article data-testid="chart-top-dishes" class="rb-chart-card">
          <div>
            <h2 class="text-base font-bold text-[#161d20]">Les 10 plats les plus vendus</h2>
            <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
              Classement par quantités servies au restaurant et bar (commandes annulées exclues).
            </p>
          </div>

          <div
            class="mt-4 space-y-2.5"
            role="img"
            aria-label="Classement horizontal des 10 plats les plus vendus"
          >
            @for (dish of dishes; track dish.name; let i = $index) {
              <div class="rounded-lg bg-[#f3fafe] px-3 py-2">
                <div class="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span class="font-bold text-[#161d20]">
                    <span class="text-[#004f56]">#{{ i + 1 }}</span> {{ dish.name }}
                  </span>
                  <span class="font-bold text-[#604100] shrink-0">
                    {{ dish.quantity }} {{ dish.quantity > 1 ? 'ventes' : 'vente' }} &bull; {{ fcfa(dish.amountFcfa) }}
                  </span>
                </div>
                <div class="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#dce4e7]">
                  <div
                    class="h-full rounded-full bg-[#b45309]"
                    [style.width.%]="dishBarWidth(dish.quantity, dishes)"
                  ></div>
                </div>
              </div>
            }
          </div>

          <p class="mt-3 text-xs font-medium text-[#3d494a]">
            Montants calculés hors taxes à partir des commandes enregistrées.
          </p>
        </article>
      }
    </section>
  `,
})
export class RapportsChartsComponent {
  @Input({ required: true }) report!: RapportsResponse;
  @Input() comparePrevious = true;

  readonly hoveredEvo = signal<{ label: string; amountFcfa: number } | null>(null);
  readonly hoveredWeek = signal<{ label: string; total: number } | null>(null);
  readonly hoveredOcc = signal<{
    label: string;
    occupiedRooms: number;
    activeRooms: number;
    percent: number;
  } | null>(null);
  readonly hoveredWeekday = signal<{ label: string; averageFcfa: number } | null>(null);

  readonly evolutionGeo = computed(() => {
    const evo = this.report?.revenueEvolution;
    if (!evo) return null;
    return buildEvolutionSvgGeometry({
      points: evo.points,
      previousPoints: evo.previousPoints,
      topKeys: evo.topPoints.map((t) => ({ key: t.key, rank: t.rank || 1 })),
      lowestKey: evo.lowestPoint.key,
    });
  });

  readonly stackedWeeksGeo = computed(() => {
    const weeks = this.report?.salesByTypeByWeek;
    if (!weeks?.length) return null;
    return buildStackedWeeksGeometry(weeks);
  });

  readonly occupancyGeo = computed(() => {
    const occ = this.report?.occupancyByDay;
    if (!occ?.points.length) return null;
    return buildOccupancyBarsGeometry(occ.points, occ.averageRooms, occ.activeRoomsCount);
  });

  readonly weekdayGeo = computed(() => {
    const w = this.report?.weekdayAverages;
    if (!w?.length) return null;
    return buildWeekdayGeometry(w);
  });

  donutSegments() {
    const items = this.report?.paymentsByMethod?.items || [];
    return buildDonutSegments(
      items.map((it, idx) => ({
        label: it.label,
        amountFcfa: it.amountFcfa,
        percent: it.percent,
        color: this.donutColor(idx),
      })),
    );
  }

  donutColor(idx: number): string {
    return DONUT_COLORS[idx % DONUT_COLORS.length];
  }

  sourceColor(idx: number): string {
    return SOURCE_COLORS[idx % SOURCE_COLORS.length];
  }

  dishBarWidth(qty: number, list: Array<{ quantity: number }>): number {
    const maxQty = Math.max(...list.map((d) => d.quantity), 1);
    return Math.max(4, Math.round((qty * 100) / maxQty));
  }

  fcfa(amount: number): string {
    return formatRapportsFcfa(amount);
  }

  shortFcfa(amount: number): string {
    return formatShortFcfa(amount);
  }
}
