import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-grid',
  standalone: true,
  template: `
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter" aria-label="Indicateurs clés du jour">
      <!-- KPI 1: Taux d'occupation -->
      <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between mb-space-sm">
            <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Taux d'occupation</span>
            <div class="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <span class="material-symbols-outlined text-[20px]">hotel</span>
            </div>
          </div>
          <div class="flex items-baseline gap-space-sm">
            <span class="font-headline-md text-headline-md text-on-surface font-semibold">{{ occupancyRate() }} %</span>
            <span class="inline-flex items-center text-primary font-label-md text-label-md">
              <span class="material-symbols-outlined text-[14px]">trending_up</span>
              {{ occupancyChange() }}
            </span>
          </div>
        </div>
        <div class="mt-space-md">
          <div class="w-full bg-surface-container rounded-full h-2 overflow-hidden">
            <div class="bg-primary h-2 rounded-full transition-all duration-1000 ease-out" [style.width.%]="occupancyRate()"></div>
          </div>
          <div class="flex justify-between items-center mt-space-xs">
            <span class="font-body-sm text-body-sm text-outline">Objectif mensuel: 80%</span>
            <span class="font-label-md text-label-md text-primary font-medium">9 clés actives</span>
          </div>
        </div>
      </div>

      <!-- KPI 2: Chambres occupées -->
      <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between mb-space-sm">
            <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Chambres occupées</span>
            <div class="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <span class="material-symbols-outlined text-[20px]">key</span>
            </div>
          </div>
          <div class="flex items-baseline justify-between">
            <span class="font-headline-md text-headline-md text-on-surface font-semibold">
              {{ occupiedRooms() }} <span class="text-on-surface-variant text-[18px] font-normal">/ {{ totalRooms() }}</span>
            </span>
            <span class="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-md text-label-md">
              {{ availableBadge() }}
            </span>
          </div>
        </div>
        <div class="mt-space-md pt-space-xs flex items-center gap-space-xs">
          <span class="w-2.5 h-2.5 rounded-full bg-primary-container"></span>
          <span class="font-body-sm text-body-sm text-on-surface-variant truncate">
            {{ roomsDetail() }}
          </span>
        </div>
      </div>

      <!-- KPI 3: Revenu du jour -->
      <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between mb-space-sm">
            <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Revenu du jour</span>
            <div class="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-secondary group-hover:scale-105 transition-transform">
              <span class="material-symbols-outlined text-[20px]">payments</span>
            </div>
          </div>
          <div class="flex items-baseline">
            <span class="font-title-lg text-title-lg text-on-surface font-bold tracking-tight">
              485 000 <span class="text-primary text-[14px]">FCFA</span>
            </span>
          </div>
        </div>
        <div class="mt-space-md bg-surface-container-low/70 rounded-xl p-space-xs px-space-sm">
          <p class="font-body-sm text-body-sm text-on-surface-variant truncate">
            Héberg. <strong class="text-on-surface font-medium">395 000 F</strong> • Resto <strong class="text-on-surface font-medium">90 000 F</strong>
          </p>
        </div>
      </div>

      <!-- KPI 4: Arrivées / Départs -->
      <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between mb-space-sm">
            <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Mouvements Clés</span>
            <div class="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <span class="material-symbols-outlined text-[20px]">swap_horiz</span>
            </div>
          </div>
          <div class="flex items-baseline gap-space-sm">
            <span class="font-headline-md text-headline-md text-on-surface font-semibold">
              {{ checkIns() }} <span class="text-on-surface-variant font-normal">/</span> {{ checkOuts() }}
            </span>
            <span class="font-body-sm text-body-sm text-outline">Entrées / Sorties</span>
          </div>
        </div>
        <div class="mt-space-md pt-space-xs flex items-center gap-space-xs text-on-surface-variant">
          <span class="material-symbols-outlined text-[16px] text-primary">schedule</span>
          <span class="font-body-sm text-body-sm truncate">
            {{ movementsDetail() }}
          </span>
        </div>
      </div>
    </section>
  `
})
export class KpiGridComponent {
  readonly occupancyRate = input<number>(75);
  readonly occupancyChange = input<string>('+5% vs hier');
  readonly occupiedRooms = input<number>(9);
  readonly totalRooms = input<number>(12);
  readonly availableBadge = input<string>('3 Disponibles');
  readonly roomsDetail = input<string>('2 en recouche • 1 prête');
  readonly todayRevenueAmount = input<number>(485000);
  readonly checkIns = input<number>(2);
  readonly checkOuts = input<number>(1);
  readonly movementsDetail = input<string>('1 départ réglé • 2 arrivées à suivre');
}
