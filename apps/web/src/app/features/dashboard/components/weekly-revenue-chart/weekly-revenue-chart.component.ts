import { Component, input } from '@angular/core';

export interface RevenueDayItem {
  day: string;
  amountLabel: string;
  heightPercent: number;
  isToday?: boolean;
  isConfirmed?: boolean;
}

@Component({
  selector: 'app-weekly-revenue-chart',
  standalone: true,
  template: `
    <section class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm" aria-labelledby="weekly-revenue-title">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-lg">
        <div>
          <div class="flex items-center gap-space-xs">
            <span class="font-label-md text-label-md text-outline uppercase tracking-wider">Performances financières</span>
            <span class="w-1 h-1 rounded-full bg-outline" aria-hidden="true"></span>
            <span class="font-label-md text-label-md text-primary font-semibold">{{ weekLabel() }}</span>
          </div>
          <h2 id="weekly-revenue-title" class="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            {{ title() }}
          </h2>
        </div>
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low font-body-sm text-body-sm text-on-surface">
          <span class="w-2 h-2 rounded-full bg-secondary" aria-hidden="true"></span>
          <span>Total estimé : <strong class="text-on-surface font-semibold">{{ totalEstimated() }}</strong></span>
        </div>
      </div>

      <!-- Bar Chart Container -->
      <div class="w-full pt-4 pb-2">
        <div class="h-56 w-full flex items-end justify-between gap-2 md:gap-4 px-2" role="img" aria-label="Graphique des revenus de la semaine">
          @for (item of days(); track item.day) {
            @if (item.isToday) {
              <!-- Today Bar (Ven) with teal highlight -->
              <div class="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative">
                <span class="px-1.5 py-0.5 rounded bg-primary text-on-primary font-label-md text-[10px] shadow-sm mb-1">
                  Aujourd'hui
                </span>
                <div
                  class="w-full max-w-[44px] bg-primary rounded-t-lg shadow-sm hover:brightness-110 transition-all duration-300 relative overflow-hidden"
                  [style.height.%]="item.heightPercent"
                >
                  <div class="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent"></div>
                </div>
                <span class="font-body-sm text-body-sm text-primary font-bold mt-2">{{ item.day }}</span>
                <span class="font-label-md text-[11px] text-primary font-semibold">{{ item.amountLabel }}</span>
              </div>
            } @else if (item.isConfirmed && item.day === 'Sam') {
              <!-- Confirmed Saturday Bar (Gold Highlight) -->
              <div class="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                <span class="font-label-md text-[11px] text-secondary opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                  {{ item.amountLabel.replace('*', '') }}
                </span>
                <div
                  class="w-full max-w-[44px] bg-secondary-container hover:bg-secondary rounded-t-lg transition-all duration-300"
                  [style.height.%]="item.heightPercent"
                ></div>
                <span class="font-body-sm text-body-sm text-on-surface-variant mt-2 font-medium">{{ item.day }}</span>
                <span class="font-label-md text-[10px] text-secondary font-medium">{{ item.amountLabel }}</span>
              </div>
            } @else {
              <!-- Regular Days (Lun, Mar, Mer, Jeu, Dim) -->
              <div class="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                <span class="font-label-md text-[11px] text-outline opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                  {{ item.amountLabel.replace('*', '') }}
                </span>
                <div
                  class="w-full max-w-[44px] bg-surface-variant hover:bg-tertiary-container rounded-t-lg transition-all duration-300"
                  [style.height.%]="item.heightPercent"
                ></div>
                <span class="font-body-sm text-body-sm text-on-surface-variant mt-2 font-medium">{{ item.day }}</span>
                <span class="font-label-md text-[10px] text-outline">{{ item.amountLabel }}</span>
              </div>
            }
          }
        </div>
      </div>

      <!-- Legend Footer -->
      <div class="flex items-center justify-between pt-space-md mt-space-sm border-t-0 bg-surface-container-low/40 rounded-xl px-space-md py-space-xs text-on-surface-variant">
        <div class="flex items-center gap-space-md">
          <span class="flex items-center gap-1.5 font-label-md text-label-md">
            <span class="w-2.5 h-2.5 rounded-sm bg-primary" aria-hidden="true"></span> Réalisé
          </span>
          <span class="flex items-center gap-1.5 font-label-md text-label-md">
            <span class="w-2.5 h-2.5 rounded-sm bg-secondary-container" aria-hidden="true"></span> Réservations confirmées (*)
          </span>
        </div>
        <span class="font-body-sm text-body-sm text-outline">{{ averageRate() }}</span>
      </div>
    </section>
  `
})
export class WeeklyRevenueChartComponent {
  readonly weekLabel = input<string>('Semaine 21');
  readonly title = input<string>('Revenus de la semaine');
  readonly totalEstimated = input<string>('3 465 000 FCFA');
  readonly averageRate = input<string>('Taux moyen semaine : 78.4%');
  readonly days = input<RevenueDayItem[]>([
    { day: 'Lun', amountLabel: '420k', heightPercent: 67 },
    { day: 'Mar', amountLabel: '380k', heightPercent: 61 },
    { day: 'Mer', amountLabel: '510k', heightPercent: 82 },
    { day: 'Jeu', amountLabel: '460k', heightPercent: 74 },
    { day: 'Ven', amountLabel: '485k', heightPercent: 78, isToday: true },
    { day: 'Sam', amountLabel: '620k*', heightPercent: 100, isConfirmed: true },
    { day: 'Dim', amountLabel: '590k*', heightPercent: 95, isConfirmed: true }
  ]);
}
