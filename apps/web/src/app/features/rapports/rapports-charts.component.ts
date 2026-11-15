import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  computed,
  inject,
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
  formatPlainNumber,
  formatShortDateLabel,
  formatWeekSummaryLabel,
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
        gap: 20px;
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
        padding: 16px;
        box-shadow: 0 1px 4px rgba(10, 37, 64, 0.04);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      @media (min-width: 768px) {
        .rb-chart-card {
          padding: 24px;
        }
      }

      .rb-chart-help {
        font-size: 12px;
        line-height: 1.45;
        font-weight: 600;
        color: #2b3638;
      }

      .rb-chart-legend {
        font-size: 12px;
        line-height: 1.4;
        font-weight: 700;
        color: #161d20;
      }

      .rb-chart-summary {
        margin-top: 14px;
        padding: 10px 14px;
        border-radius: 10px;
        background-color: #f3fafe;
        border: 1px solid #dce4e7;
        font-size: 12px;
        line-height: 1.45;
        font-weight: 700;
        color: #161d20;
      }

      .rb-tooltip-pill {
        min-height: 30px;
        padding: 6px 12px;
        border-radius: 8px;
        background-color: #eef5f9;
        border: 1px solid #8fa3a6;
        color: #161d20;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
      }

      .rb-svg-host {
        width: 100%;
        min-width: 0;
        overflow: hidden;
      }

      .rb-chart-svg {
        display: block;
        max-width: 100%;
      }

      .rb-chart-svg text {
        font-family: Manrope, sans-serif;
        font-size: 12px;
        font-weight: 700;
        fill: #161d20;
      }

      .rb-chart-svg text.rb-axis-label {
        fill: #2b3638;
        font-weight: 700;
      }

      .rb-chart-svg text.rb-value-label {
        font-size: 12px;
        font-weight: 800;
        fill: #161d20;
      }

      .rb-chart-svg text.rb-star-label {
        font-size: 14px;
        font-weight: 800;
        fill: #604100;
      }

      .rb-chart-svg text.rb-avg-label {
        font-size: 12px;
        font-weight: 800;
        fill: #93000a;
      }

      @media (min-width: 768px) {
        .rb-chart-help,
        .rb-chart-legend,
        .rb-chart-summary,
        .rb-tooltip-pill {
          font-size: 14px;
        }

        .rb-chart-svg text {
          font-size: 14px;
        }

        .rb-chart-svg text.rb-value-label {
          font-size: 14px;
        }

        .rb-chart-svg text.rb-star-label {
          font-size: 16px;
        }

        .rb-chart-svg text.rb-avg-label {
          font-size: 14px;
        }
      }
    `,
  ],
  template: `
    @if (reportSignal(); as rep) {
      <section
        aria-label="Diagrammes d'analyse"
        data-testid="rapports-charts-grid"
        class="rb-charts-grid mb-6"
      >
        <!-- a) Évolution du chiffre d'affaires (PLEINE LARGEUR) -->
        @if (rep.revenueEvolution; as evo) {
          @if (evolutionGeo(); as geo) {
            <article
              data-testid="chart-revenue-evolution"
              class="rb-chart-card rb-chart-wide"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[22px] text-[#004f56]" aria-hidden="true">show_chart</span>
                    <h2 class="text-lg font-extrabold text-[#161d20]">Évolution du chiffre d'affaires</h2>
                  </div>
                  <p class="rb-chart-help mt-1">
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
                  <div class="flex items-center gap-1.5 text-xs md:text-sm font-extrabold uppercase tracking-wider text-[#004f56]">
                    <span aria-hidden="true">&#9733;</span>
                    <span>Meilleur jour</span>
                  </div>
                  <div class="mt-0.5 text-base font-extrabold text-[#161d20]" data-testid="best-day-amount">
                    {{ fcfa(evo.bestPoint.amountFcfa) }}
                  </div>
                  <div class="text-sm font-bold text-[#004f56]" data-testid="best-day-label">
                    {{ cleanDate(evo.bestPoint.label) }}
                  </div>
                </div>
              </div>

              <!-- Légende juste sous le titre + infobulle au survol -->
              <div class="rb-chart-legend mt-3 flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-4">
                  <span class="inline-flex items-center gap-2 text-[#161d20]">
                    <span class="inline-block h-1 w-5 rounded bg-[#00666f]"></span>
                    <span>Période en cours</span>
                  </span>
                  @if (comparePrevious && evo.previousPoints?.length) {
                    <span class="inline-flex items-center gap-2 text-[#2b3638]" data-testid="legend-previous-dashed">
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
                    <span>Plus bas : {{ cleanDate(evo.lowestPoint.label) }} ({{ fcfa(evo.lowestPoint.amountFcfa) }})</span>
                  </span>
                </div>

                @if (hoveredEvo(); as hov) {
                  <div class="rb-tooltip-pill" data-testid="tooltip-evolution">
                    {{ hov.label }} : {{ fcfa(hov.amountFcfa) }}
                  </div>
                }
              </div>

              <div class="rb-svg-host mt-3">
                <svg
                  class="rb-chart-svg"
                  [attr.width]="geo.width"
                  [attr.height]="geo.height"
                  [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height"
                  role="img"
                  [attr.aria-label]="'Évolution du chiffre d affaires : meilleur point ' + cleanDate(evo.bestPoint.label) + ' à ' + fcfa(evo.bestPoint.amountFcfa)"
                >
                  <defs>
                    <linearGradient id="rbRapportsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#00666f" stop-opacity="0.22"></stop>
                      <stop offset="100%" stop-color="#00666f" stop-opacity="0.02"></stop>
                    </linearGradient>
                  </defs>

                  <rect
                    data-testid="plot-area-revenue-evolution"
                    [attr.x]="geo.padLeft"
                    [attr.y]="geo.padTop"
                    [attr.width]="geo.plotW"
                    [attr.height]="geo.plotH"
                    fill="transparent"
                  ></rect>

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
                      class="rb-axis-label"
                      [attr.x]="geo.padLeft - 10"
                      [attr.y]="yt.y + 5"
                      text-anchor="end"
                    >
                      {{ yt.label }}
                    </text>
                  }

                  <path [attr.d]="geo.areaPath" fill="url(#rbRapportsArea)"></path>

                  @if (comparePrevious && geo.prevPath) {
                    <path
                      [attr.d]="geo.prevPath"
                      fill="none"
                      stroke="#465d7b"
                      stroke-width="2.5"
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
                        [attr.r]="pt.isTop ? 6.5 : pt.isLowest ? 5.5 : 4.5"
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
                          class="rb-star-label"
                          [attr.x]="pt.x"
                          [attr.y]="pt.y - 12"
                          text-anchor="middle"
                        >
                          &#9733;
                        </text>
                      }
                      @if (pt.isLowest && !pt.isTop) {
                        <text
                          class="rb-avg-label"
                          [attr.x]="pt.x"
                          [attr.y]="pt.y + 18"
                          text-anchor="middle"
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
                    stroke="#4a585a"
                    stroke-width="1.5"
                  ></line>

                  @for (xt of geo.xTicks; track xt.x) {
                    <text
                      class="rb-axis-label"
                      [attr.x]="xt.x"
                      [attr.y]="geo.baseY + 24"
                      text-anchor="middle"
                    >
                      {{ xt.label }}
                    </text>
                  }
                </svg>
              </div>

              <!-- Liste explicite des 3 plus hauts jours (étoiles) -->
              <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="top-3-points">
                @for (tp of evo.topPoints; track tp.key) {
                  <div class="rounded-lg border border-[#dce4e7] bg-[#f3fafe] px-3 py-2 text-xs md:text-sm">
                    <span class="font-extrabold text-[#604100]">&#9733; #{{ tp.rank }} &bull; {{ cleanDate(tp.label) }}</span>
                    <div class="mt-0.5 font-extrabold text-[#161d20]">{{ fcfa(tp.amountFcfa) }}</div>
                  </div>
                }
              </div>

              @if (evolutionSummary(); as summary) {
                <p class="rb-chart-summary" data-testid="summary-revenue-evolution">
                  {{ summary }}
                </p>
              }
            </article>
          }
        }

        <!-- b) Ventes par type et par semaine (PLEINE LARGEUR) -->
        @if (rep.salesByTypeByWeek; as weeks) {
          @if (stackedWeeksGeo(); as geo) {
            <article data-testid="chart-sales-by-week" class="rb-chart-card rb-chart-wide">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-lg font-extrabold text-[#161d20]">Ventes par type et par semaine</h2>
                  <p class="rb-chart-help mt-1">
                    Répartition hebdomadaire entre hébergement, restaurant et bar, et autres prestations.
                  </p>
                </div>
                @if (activeWeek(); as hw) {
                  <div class="rb-tooltip-pill" data-testid="tooltip-week">
                    {{ hw.summaryLabel }} : {{ fcfa(hw.total) }} — Hébergement : {{ fcfa(hw.heb) }} | Restaurant et bar : {{ fcfa(hw.rest) }} | Autres : {{ fcfa(hw.other) }}
                  </div>
                }
              </div>

              <div class="rb-chart-legend mt-3 flex flex-wrap gap-4">
                <span class="inline-flex items-center gap-2">
                  <span class="h-3.5 w-3.5 rounded-sm bg-[#00666f]"></span>
                  <span>Hébergement</span>
                </span>
                <span class="inline-flex items-center gap-2">
                  <span class="h-3.5 w-3.5 rounded-sm border border-[#7e5700] bg-[#d97706]"></span>
                  <span>Restaurant et bar</span>
                </span>
                <span class="inline-flex items-center gap-2">
                  <span class="h-3.5 w-3.5 rounded-sm border border-[#314865] bg-[#465d7b]"></span>
                  <span>Autres</span>
                </span>
              </div>

              <div class="rb-svg-host mt-3">
                <svg
                  class="rb-chart-svg"
                  [attr.width]="geo.width"
                  [attr.height]="geo.height"
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

                  <rect
                    data-testid="plot-area-sales-by-week"
                    [attr.x]="geo.padLeft"
                    [attr.y]="geo.padTop"
                    [attr.width]="geo.plotW"
                    [attr.height]="geo.plotH"
                    fill="transparent"
                  ></rect>

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
                      class="rb-axis-label"
                      [attr.x]="geo.padLeft - 10"
                      [attr.y]="yt.y + 5"
                      text-anchor="end"
                    >
                      {{ yt.label }}
                    </text>
                  }

                  @for (b of geo.bars; track b.weekKey; let i = $index) {
                    <g
                      tabindex="0"
                      [attr.aria-label]="b.summaryLabel + ' : Total ' + fcfa(b.total) + ', hébergement ' + fcfa(b.heb) + ', restaurant et bar ' + fcfa(b.rest) + ', autres ' + fcfa(b.other)"
                      (mouseenter)="hoveredWeek.set(b)"
                      (focus)="hoveredWeek.set(b)"
                      (click)="selectedWeek.set(b)"
                      (mouseleave)="hoveredWeek.set(null)"
                      (blur)="hoveredWeek.set(null)"
                      style="cursor: pointer"
                    >
                      <title>{{ b.summaryLabel }} — Hébergement : {{ fcfa(b.heb) }} | Restaurant et bar : {{ fcfa(b.rest) }} | Autres : {{ fcfa(b.other) }}</title>
                      @if (b.hHeb > 0) {
                        <rect [attr.x]="b.x" [attr.y]="b.yHeb" [attr.width]="b.barW" [attr.height]="b.hHeb" fill="#00666f" rx="4"></rect>
                      }
                      @if (b.hRest > 0) {
                        <rect [attr.x]="b.x" [attr.y]="b.yRest" [attr.width]="b.barW" [attr.height]="b.hRest" fill="url(#rbPatternResto)" rx="2"></rect>
                      }
                      @if (b.hOther > 0) {
                        <rect [attr.x]="b.x" [attr.y]="b.yOther" [attr.width]="b.barW" [attr.height]="b.hOther" fill="url(#rbPatternOther)" rx="4"></rect>
                      }
                      @if (b.showValue) {
                        <text
                          class="rb-value-label"
                          [attr.x]="b.x + b.barW / 2"
                          [attr.y]="b.topY - 8"
                          text-anchor="middle"
                        >
                          {{ b.valueLabel }}
                        </text>
                      }
                      @if (geo.tickIndices.has(i)) {
                        <text
                          class="rb-axis-label"
                          [attr.x]="b.x + b.barW / 2"
                          [attr.y]="geo.baseY + 24"
                          text-anchor="middle"
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
                    stroke="#4a585a"
                    stroke-width="1.5"
                  ></line>
                </svg>
              </div>

              @if (stackedWeeksSummary(); as summary) {
                <p class="rb-chart-summary" data-testid="summary-sales-by-week">
                  {{ summary }}
                </p>
              }
            </article>
          }
        }

        <!-- c) Chambres occupées par jour (PLEINE LARGEUR) -->
        @if (rep.occupancyByDay; as occ) {
          @if (occupancyGeo(); as geo) {
            <article data-testid="chart-occupancy-by-day" class="rb-chart-card rb-chart-wide">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-lg font-extrabold text-[#161d20]">Chambres occupées par jour</h2>
                  <p class="rb-chart-help mt-1 text-[#004f56]" data-testid="occupancy-help-text">
                    {{ occupancyHelpText() }}
                  </p>
                </div>
                @if (activeOcc(); as ao) {
                  <div class="rb-tooltip-pill" data-testid="tooltip-occupancy">
                    {{ ao.cleanLabel }} : {{ ao.occupiedRooms }} {{ ao.occupiedRooms === 1 ? 'chambre' : 'chambres' }} sur {{ ao.activeRooms }}
                  </div>
                }
              </div>

              <div class="rb-chart-legend mt-3 flex flex-wrap gap-4">
                <span class="inline-flex items-center gap-2">
                  <span class="h-3.5 w-3.5 rounded-sm bg-[#00666f]"></span>
                  <span>Chambres occupées</span>
                </span>
                <span class="inline-flex items-center gap-2 text-[#93000a]">
                  <span class="inline-block h-0 w-5 border-t-2 border-dashed border-[#93000a]"></span>
                  <span>Moyenne sur la période</span>
                </span>
              </div>

              <div class="rb-svg-host mt-3">
                <svg
                  class="rb-chart-svg"
                  [attr.width]="geo.width"
                  [attr.height]="geo.height"
                  [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height"
                  role="img"
                  [attr.aria-label]="'Chambres occupées par jour : ' + occupancyHelpText()"
                >
                  <rect
                    data-testid="plot-area-occupancy-by-day"
                    [attr.x]="geo.padLeft"
                    [attr.y]="geo.padTop"
                    [attr.width]="geo.plotW"
                    [attr.height]="geo.plotH"
                    fill="transparent"
                  ></rect>

                  @for (yt of geo.yTicks; track yt.value) {
                    <line
                      [attr.x1]="geo.padLeft"
                      [attr.x2]="geo.plotRight"
                      [attr.y1]="yt.y"
                      [attr.y2]="yt.y"
                      stroke="#dce4e7"
                      stroke-dasharray="4 4"
                      stroke-width="1"
                    ></line>
                    <text
                      class="rb-axis-label"
                      [attr.x]="geo.padLeft - 10"
                      [attr.y]="yt.y + 5"
                      text-anchor="end"
                    >
                      {{ yt.label }}
                    </text>
                  }

                  @for (b of geo.bars; track b.dateIso; let i = $index) {
                    <g
                      tabindex="0"
                      [attr.aria-label]="b.cleanLabel + ' : ' + b.occupiedRooms + ' chambres sur ' + b.activeRooms"
                      (mouseenter)="hoveredOcc.set(b)"
                      (focus)="hoveredOcc.set(b)"
                      (click)="selectedOcc.set(b)"
                      (mouseleave)="hoveredOcc.set(null)"
                      (blur)="hoveredOcc.set(null)"
                      style="cursor: pointer"
                    >
                      <title>{{ b.cleanLabel }} : {{ b.occupiedRooms }} {{ b.occupiedRooms === 1 ? 'chambre' : 'chambres' }} sur {{ b.activeRooms }}</title>
                      <rect
                        [attr.x]="b.x"
                        [attr.y]="b.y"
                        [attr.width]="b.barW"
                        [attr.height]="b.h"
                        fill="#00666f"
                        rx="4"
                      ></rect>
                      @if (b.showValue) {
                        <text
                          class="rb-value-label"
                          [attr.x]="b.x + b.barW / 2"
                          [attr.y]="b.y - 8"
                          text-anchor="middle"
                        >
                          {{ b.occupiedRooms }}
                        </text>
                      }
                      @if (geo.tickIndices.has(i)) {
                        <text
                          class="rb-axis-label"
                          [attr.x]="b.x + b.barW / 2"
                          [attr.y]="geo.baseY + 24"
                          text-anchor="middle"
                        >
                          {{ b.cleanLabel }}
                        </text>
                      }
                    </g>
                  }

                  <!-- Ligne moyenne en pointillé, étiquette placée à droite hors des barres -->
                  <line
                    [attr.x1]="geo.padLeft"
                    [attr.x2]="geo.plotRight"
                    [attr.y1]="geo.avgY"
                    [attr.y2]="geo.avgY"
                    stroke="#93000a"
                    stroke-width="2"
                    stroke-dasharray="6 4"
                  ></line>
                  <text
                    class="rb-avg-label"
                    data-testid="occupancy-avg-label"
                    [attr.x]="geo.plotRight + 8"
                    [attr.y]="geo.avgY + 5"
                    text-anchor="start"
                  >
                    Moy. {{ roundedAvgRooms() }} ch.
                  </text>

                  <line
                    [attr.x1]="geo.padLeft"
                    [attr.x2]="geo.plotRight"
                    [attr.y1]="geo.baseY"
                    [attr.y2]="geo.baseY"
                    stroke="#4a585a"
                    stroke-width="1.5"
                  ></line>
                </svg>
              </div>

              @if (occupancySummary(); as summary) {
                <p class="rb-chart-summary" data-testid="summary-occupancy-by-day">
                  {{ summary }}
                </p>
              }
            </article>
          }
        }

        <!-- g) Jours de la semaine (PLEINE LARGEUR) -->
        @if (rep.weekdayAverages; as weekdays) {
          @if (weekdayGeo(); as geo) {
            <article data-testid="chart-weekday-averages" class="rb-chart-card rb-chart-wide">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-lg font-extrabold text-[#161d20]">Jours de la semaine</h2>
                  <p class="rb-chart-help mt-1">
                    Moyenne des ventes hors taxes par jour de la semaine sur la période.
                  </p>
                </div>
                @if (hoveredWeekday(); as hwd) {
                  <div class="rb-tooltip-pill" data-testid="tooltip-weekday">
                    {{ hwd.label }} : {{ fcfa(hwd.averageFcfa) }} / jour
                  </div>
                }
              </div>

              <div class="rb-chart-legend mt-3 flex flex-wrap gap-4">
                <span class="inline-flex items-center gap-2">
                  <span class="h-3.5 w-3.5 rounded-sm bg-[#00666f]"></span>
                  <span>Moyenne habituelle</span>
                </span>
                <span class="inline-flex items-center gap-2 text-[#604100]">
                  <span class="h-3.5 w-3.5 rounded-sm bg-[#7e5700]"></span>
                  <span>Jour le plus rentable</span>
                </span>
              </div>

              <div class="rb-svg-host mt-3">
                <svg
                  class="rb-chart-svg"
                  [attr.width]="geo.width"
                  [attr.height]="geo.height"
                  [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height"
                  role="img"
                  aria-label="Moyenne des ventes hors taxes par jour de la semaine du lundi au dimanche"
                >
                  <rect
                    data-testid="plot-area-weekday-averages"
                    [attr.x]="geo.padLeft"
                    [attr.y]="geo.padTop"
                    [attr.width]="geo.plotW"
                    [attr.height]="geo.plotH"
                    fill="transparent"
                  ></rect>

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
                      class="rb-axis-label"
                      [attr.x]="geo.padLeft - 10"
                      [attr.y]="yt.y + 5"
                      text-anchor="end"
                    >
                      {{ yt.label }}
                    </text>
                  }

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
                      @if (b.showValue) {
                        <text
                          class="rb-value-label"
                          [attr.x]="b.x + b.barW / 2"
                          [attr.y]="b.y - 8"
                          text-anchor="middle"
                          [attr.fill]="b.isBest ? '#604100' : '#161d20'"
                        >
                          {{ b.valueLabel }}
                        </text>
                      }
                      <text
                        class="rb-axis-label"
                        [attr.x]="b.x + b.barW / 2"
                        [attr.y]="geo.baseY + 24"
                        text-anchor="middle"
                      >
                        {{ isMobile() ? b.label.slice(0, 3) + '.' : b.label }}
                      </text>
                    </g>
                  }

                  <line
                    [attr.x1]="geo.padLeft"
                    [attr.x2]="geo.width - geo.padRight"
                    [attr.y1]="geo.baseY"
                    [attr.y2]="geo.baseY"
                    stroke="#4a585a"
                    stroke-width="1.5"
                  ></line>
                </svg>
              </div>

              @if (weekdaySummary(); as summary) {
                <p class="rb-chart-summary" data-testid="summary-weekday-averages">
                  {{ summary }}
                </p>
              }
            </article>
          }
        }

        <!-- d) Argent encaissé par mode de paiement (2 colonnes sur desktop, 1 sur mobile) -->
        @if (rep.paymentsByMethod; as pay) {
          <article data-testid="chart-payments-by-method" class="rb-chart-card">
            <div>
              <h2 class="text-lg font-extrabold text-[#161d20]">Argent encaissé par mode de paiement</h2>
              <p class="rb-chart-help mt-1">
                Part de chaque moyen d'encaissement reçu sur la période.
              </p>
            </div>

            <div class="mt-4 flex flex-col items-center gap-5 sm:flex-row min-h-[280px] md:min-h-[340px]">
              <div class="relative h-48 w-48 shrink-0">
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
                <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                  <span class="text-xs font-bold uppercase tracking-wide text-[#2b3638]">Total</span>
                  <span class="text-sm md:text-base font-extrabold text-[#161d20] leading-tight">
                    {{ plainNumber(pay.totalFcfa) }}
                  </span>
                  <span class="text-xs font-extrabold text-[#004f56]">FCFA</span>
                </div>
              </div>

              <div class="flex-1 w-full space-y-2.5">
                @for (item of pay.items; track item.method; let i = $index) {
                  <div class="flex items-center justify-between gap-2 rounded-lg bg-[#f3fafe] px-3 py-2.5 text-xs md:text-sm">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="h-3.5 w-3.5 shrink-0 rounded-full" [style.background-color]="donutColor(i)"></span>
                      <span class="font-bold text-[#161d20] truncate">{{ item.label }}</span>
                    </div>
                    <div class="text-right shrink-0">
                      <span class="font-extrabold text-[#161d20]">{{ fcfa(item.amountFcfa) }}</span>
                      <span class="ml-1.5 font-extrabold text-[#004f56]">({{ item.percent }} %)</span>
                    </div>
                  </div>
                }
              </div>
            </div>

            @if (paymentsSummary(); as summary) {
              <p class="rb-chart-summary" data-testid="summary-payments-by-method">
                {{ summary }}
              </p>
            }
          </article>
        }

        <!-- e) D'où viennent les réservations (2 colonnes sur desktop, 1 sur mobile) -->
        @if (rep.reservationSources; as src) {
          <article data-testid="chart-reservation-sources" class="rb-chart-card">
            <div>
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-lg font-extrabold text-[#161d20]">D'où viennent les réservations</h2>
                <span class="rounded-full bg-[#eef5f9] px-3 py-1 text-xs md:text-sm font-extrabold text-[#004f56]">
                  {{ src.totalCount }} {{ src.totalCount > 1 ? 'séjours' : 'séjour' }}
                </span>
              </div>
              <p class="rb-chart-help mt-1">
                Canaux par lesquels les clients ont réservé leur séjour.
              </p>
            </div>

            <div
              class="mt-4 space-y-3.5 min-h-[280px] md:min-h-[340px] flex flex-col justify-center"
              role="img"
              [attr.aria-label]="'Origine des réservations sur ' + src.totalCount + ' séjours'"
            >
              @for (item of src.items; track item.source; let i = $index) {
                <div>
                  <div class="flex items-center justify-between gap-2 text-xs md:text-sm font-bold">
                    <span class="text-[#161d20]">{{ item.label }}</span>
                    <span class="font-extrabold text-[#004f56]">{{ item.count }} ({{ item.percent }} %)</span>
                  </div>
                  <div class="mt-1.5 h-3.5 w-full overflow-hidden rounded-full bg-[#e8eff3]">
                    <div
                      class="h-full rounded-full"
                      [style.width.%]="item.percent"
                      [style.background-color]="sourceColor(i)"
                    ></div>
                  </div>
                </div>
              }
            </div>

            @if (sourcesSummary(); as summary) {
              <p class="rb-chart-summary" data-testid="summary-reservation-sources">
                {{ summary }}
              </p>
            }
          </article>
        }

        <!-- f) Ventes par catégorie de chambre (2 colonnes sur desktop, 1 sur mobile) -->
        @if (rep.salesByRoomCategory; as roomCats) {
          <article data-testid="chart-sales-by-room-category" class="rb-chart-card">
            <div>
              <h2 class="text-lg font-extrabold text-[#161d20]">Ventes par catégorie de chambre</h2>
              <p class="rb-chart-help mt-1">
                Contribution de chaque catégorie de chambre au revenu hébergement.
              </p>
            </div>

            <div
              class="mt-4 space-y-3.5 min-h-[280px] md:min-h-[340px] flex flex-col justify-center"
              role="img"
              [attr.aria-label]="'Ventes hébergement par catégorie de chambre pour ' + fcfa(roomCats.totalFcfa)"
            >
              @for (item of roomCats.items; track item.category) {
                <div class="rounded-xl border border-[#dce4e7] bg-[#f3fafe] p-3.5">
                  <div class="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
                    <div>
                      <span class="font-extrabold text-[#161d20]">{{ item.category }}</span>
                      @if (item.nightsCount > 0) {
                        <span class="ml-2 font-bold text-[#2b3638]">
                          ({{ item.nightsCount }} {{ item.nightsCount > 1 ? 'nuitées' : 'nuitée' }})
                        </span>
                      }
                    </div>
                    <div class="text-right">
                      <span class="font-extrabold text-[#004f56]">{{ fcfa(item.amountFcfa) }}</span>
                      <span class="ml-1.5 font-extrabold text-[#161d20]">({{ item.sharePercent }} %)</span>
                    </div>
                  </div>
                  <div class="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#dce4e7]">
                    <div class="h-full rounded-full bg-[#00666f]" [style.width.%]="item.sharePercent"></div>
                  </div>
                </div>
              }
            </div>

            @if (roomCategorySummary(); as summary) {
              <p class="rb-chart-summary" data-testid="summary-sales-by-room-category">
                {{ summary }}
              </p>
            }
          </article>
        }

        <!-- h) Les 10 plats les plus vendus (2 colonnes sur desktop, 1 sur mobile) -->
        @if (rep.topDishes; as dishes) {
          <article data-testid="chart-top-dishes" class="rb-chart-card">
            <div>
              <h2 class="text-lg font-extrabold text-[#161d20]">Les 10 plats les plus vendus</h2>
              <p class="rb-chart-help mt-1">
                Classement par quantités servies au restaurant et bar (commandes annulées exclues).
              </p>
            </div>

            <div
              class="mt-4 space-y-2.5 min-h-[280px] md:min-h-[340px]"
              role="img"
              aria-label="Classement horizontal des 10 plats les plus vendus"
            >
              @for (dish of dishes; track dish.name; let i = $index) {
                <div class="rounded-lg bg-[#f3fafe] px-3 py-2.5">
                  <div class="flex flex-wrap items-baseline justify-between gap-2 text-xs md:text-sm">
                    <span class="font-bold text-[#161d20]">
                      <span class="font-extrabold text-[#004f56]">#{{ i + 1 }}</span> {{ dish.name }}
                    </span>
                    <span class="font-extrabold text-[#604100] shrink-0">
                      {{ dish.quantity }} {{ dish.quantity > 1 ? 'ventes' : 'vente' }} &bull; {{ fcfa(dish.amountFcfa) }}
                    </span>
                  </div>
                  <div class="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-[#dce4e7]">
                    <div
                      class="h-full rounded-full bg-[#b45309]"
                      [style.width.%]="dishBarWidth(dish.quantity, dishes)"
                    ></div>
                  </div>
                </div>
              }
            </div>

            @if (topDishesSummary(); as summary) {
              <p class="rb-chart-summary" data-testid="summary-top-dishes">
                {{ summary }}
              </p>
            }
          </article>
        }
      </section>
    }
  `,
})
export class RapportsChartsComponent implements AfterViewInit, OnDestroy {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = null;

  readonly reportSignal = signal<RapportsResponse | null>(null);

  @Input({ required: true })
  set report(value: RapportsResponse) {
    this.reportSignal.set(value);
    this.selectedWeek.set(null);
    this.selectedOcc.set(null);
  }

  @Input() comparePrevious = true;

  readonly chartWidth = signal<number>(960);
  readonly isMobile = signal<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  readonly hoveredEvo = signal<{ label: string; amountFcfa: number } | null>(null);
  readonly hoveredWeek = signal<{
    summaryLabel: string;
    total: number;
    heb: number;
    rest: number;
    other: number;
  } | null>(null);
  readonly selectedWeek = signal<{
    summaryLabel: string;
    total: number;
    heb: number;
    rest: number;
    other: number;
  } | null>(null);
  readonly activeWeek = computed(() => this.hoveredWeek() ?? this.selectedWeek());

  readonly hoveredOcc = signal<{
    cleanLabel: string;
    occupiedRooms: number;
    activeRooms: number;
    percent: number;
  } | null>(null);
  readonly selectedOcc = signal<{
    cleanLabel: string;
    occupiedRooms: number;
    activeRooms: number;
    percent: number;
  } | null>(null);
  readonly activeOcc = computed(() => this.hoveredOcc() ?? this.selectedOcc());

  readonly hoveredWeekday = signal<{ label: string; averageFcfa: number } | null>(null);

  ngAfterViewInit(): void {
    this.measureContainer();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.measureContainer();
      });
      this.resizeObserver.observe(this.hostRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private measureContainer(): void {
    const el = this.hostRef.nativeElement;
    if (!el) return;
    const mobile = typeof window !== 'undefined' ? window.innerWidth < 768 : el.clientWidth < 640;
    this.isMobile.set(mobile);

    const svgHost = el.querySelector('.rb-svg-host') as HTMLElement | null;
    let measured = svgHost ? Math.floor(svgHost.getBoundingClientRect().width) : 0;
    if (measured < 200) {
      const hostW = Math.floor(el.getBoundingClientRect().width);
      measured = Math.max(260, hostW - (mobile ? 36 : 52));
    }
    if (measured > 0 && measured !== this.chartWidth()) {
      this.chartWidth.set(measured);
    }
  }

  readonly roundedAvgRooms = computed(() => {
    const occ = this.reportSignal()?.occupancyByDay;
    return occ ? Math.round(occ.averageRooms) : 0;
  });

  readonly occupancyHelpText = computed(() => {
    const occ = this.reportSignal()?.occupancyByDay;
    if (!occ) return '';
    const avgPct = Math.round(occ.averagePercent);
    const avgRooms = Math.round(occ.averageRooms);
    const unit = avgRooms === 1 ? 'chambre' : 'chambres';
    return `En moyenne ${avgPct} % des chambres occupées (${avgRooms} ${unit} sur ${occ.activeRoomsCount} en moyenne, arrondi à l'unité)`;
  });

  readonly evolutionGeo = computed(() => {
    const evo = this.reportSignal()?.revenueEvolution;
    if (!evo?.points?.length) return null;
    const mobile = this.isMobile();
    return buildEvolutionSvgGeometry({
      points: evo.points,
      previousPoints: evo.previousPoints,
      topKeys: evo.topPoints.map((t) => ({ key: t.key, rank: t.rank || 1 })),
      lowestKey: evo.lowestPoint.key,
      width: this.chartWidth(),
      plotHeight: mobile ? 290 : 350,
      isMobile: mobile,
    });
  });

  readonly stackedWeeksGeo = computed(() => {
    const weeks = this.reportSignal()?.salesByTypeByWeek;
    if (!weeks?.length) return null;
    const mobile = this.isMobile();
    return buildStackedWeeksGeometry(weeks, {
      width: this.chartWidth(),
      plotHeight: mobile ? 290 : 350,
      isMobile: mobile,
    });
  });

  readonly occupancyGeo = computed(() => {
    const occ = this.reportSignal()?.occupancyByDay;
    if (!occ?.points?.length) return null;
    const mobile = this.isMobile();
    return buildOccupancyBarsGeometry(occ.points, occ.averageRooms, occ.activeRoomsCount, {
      width: this.chartWidth(),
      plotHeight: mobile ? 290 : 350,
      isMobile: mobile,
    });
  });

  readonly weekdayGeo = computed(() => {
    const w = this.reportSignal()?.weekdayAverages;
    if (!w?.length) return null;
    const mobile = this.isMobile();
    return buildWeekdayGeometry(w, {
      width: this.chartWidth(),
      plotHeight: mobile ? 290 : 350,
      isMobile: mobile,
    });
  });

  // Phrases de résumé calculées sous chaque diagramme (absentes si aucune donnée)
  readonly evolutionSummary = computed<string | null>(() => {
    const evo = this.reportSignal()?.revenueEvolution;
    if (!evo?.points?.length || evo.bestPoint.amountFcfa <= 0) return null;
    return `Meilleur jour : ${formatShortDateLabel(evo.bestPoint.label)} avec ${formatRapportsFcfa(evo.bestPoint.amountFcfa)} ; point le plus bas : ${formatShortDateLabel(evo.lowestPoint.label)} (${formatRapportsFcfa(evo.lowestPoint.amountFcfa)}).`;
  });

  readonly stackedWeeksSummary = computed<string | null>(() => {
    const weeks = this.reportSignal()?.salesByTypeByWeek;
    if (!weeks?.length) return null;
    const best = weeks.reduce((acc, w) => (w.totalFcfa > acc.totalFcfa ? w : acc), weeks[0]);
    if (!best || best.totalFcfa <= 0) return null;
    const hebPct = Math.round((Math.max(0, best.accommodationFcfa) * 100) / best.totalFcfa);
    const restPct = Math.round((Math.max(0, best.restaurantFcfa) * 100) / best.totalFcfa);
    const weekTitle = formatWeekSummaryLabel(best.label);
    if (hebPct >= restPct && hebPct > 0) {
      return `${weekTitle} : ${formatRapportsFcfa(best.totalFcfa)}, dont ${hebPct} % d'hébergement.`;
    }
    if (restPct > 0) {
      return `${weekTitle} : ${formatRapportsFcfa(best.totalFcfa)}, dont ${restPct} % de restaurant et bar.`;
    }
    return `${weekTitle} : ${formatRapportsFcfa(best.totalFcfa)}.`;
  });

  readonly occupancySummary = computed<string | null>(() => {
    const occ = this.reportSignal()?.occupancyByDay;
    if (!occ?.points?.length) return null;
    const peak = occ.points.reduce(
      (acc, p) => (p.occupiedRooms > acc.occupiedRooms ? p : acc),
      occ.points[0],
    );
    if (!peak || peak.occupiedRooms <= 0) return null;
    const unit = peak.occupiedRooms === 1 ? 'chambre' : 'chambres';
    return `Jour le plus rempli : ${formatShortDateLabel(peak.label)}, ${peak.occupiedRooms} ${unit} sur ${peak.activeRooms}.`;
  });

  readonly weekdaySummary = computed<string | null>(() => {
    const items = this.reportSignal()?.weekdayAverages;
    if (!items?.length) return null;
    const best = items.reduce((acc, d) => (d.averageFcfa > acc.averageFcfa ? d : acc), items[0]);
    if (!best || best.averageFcfa <= 0) return null;
    return `Jour le plus rentable en moyenne : ${best.label} avec ${formatRapportsFcfa(best.averageFcfa)} par jour.`;
  });

  readonly paymentsSummary = computed<string | null>(() => {
    const pay = this.reportSignal()?.paymentsByMethod;
    if (!pay?.items?.length || pay.totalFcfa <= 0) return null;
    const top = pay.items.reduce((acc, it) => (it.amountFcfa > acc.amountFcfa ? it : acc), pay.items[0]);
    if (!top || top.amountFcfa <= 0) return null;
    return `Mode principal : ${top.label} avec ${formatRapportsFcfa(top.amountFcfa)} (${top.percent} % des encaissements).`;
  });

  readonly sourcesSummary = computed<string | null>(() => {
    const src = this.reportSignal()?.reservationSources;
    if (!src?.items?.length || src.totalCount <= 0) return null;
    const top = src.items.reduce((acc, it) => (it.count > acc.count ? it : acc), src.items[0]);
    if (!top || top.count <= 0) return null;
    const unit = top.count > 1 ? 'séjours' : 'séjour';
    return `Canal principal : ${top.label} avec ${top.count} ${unit} (${top.percent} % des réservations).`;
  });

  readonly roomCategorySummary = computed<string | null>(() => {
    const cats = this.reportSignal()?.salesByRoomCategory;
    if (!cats?.items?.length || cats.totalFcfa <= 0) return null;
    const top = cats.items.reduce((acc, it) => (it.amountFcfa > acc.amountFcfa ? it : acc), cats.items[0]);
    if (!top || top.amountFcfa <= 0) return null;
    return `Catégorie la plus demandée : ${top.category} avec ${formatRapportsFcfa(top.amountFcfa)} (${top.sharePercent} % de l'hébergement).`;
  });

  readonly topDishesSummary = computed<string | null>(() => {
    const dishes = this.reportSignal()?.topDishes;
    if (!dishes?.length) return null;
    const top = dishes[0];
    if (!top || top.quantity <= 0) return null;
    const unit = top.quantity > 1 ? 'ventes' : 'vente';
    return `Plat le plus commandé : ${top.name} avec ${top.quantity} ${unit} (${formatRapportsFcfa(top.amountFcfa)}).`;
  });

  donutSegments() {
    const items = this.reportSignal()?.paymentsByMethod?.items || [];
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
    return Math.max(6, Math.round((qty * 100) / maxQty));
  }

  fcfa(amount: number): string {
    return formatRapportsFcfa(amount);
  }

  plainNumber(amount: number): string {
    return formatPlainNumber(amount);
  }

  cleanDate(raw: string): string {
    return formatShortDateLabel(raw);
  }
}
