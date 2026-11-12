import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RapportsDailyTable } from '@residence-blue/shared';
import { formatRapportsFcfa } from './rapports-formatting';

@Component({
  selector: 'app-rapports-daily-table',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  styles: [
    `
      .rb-daily-scroll {
        width: 100%;
        /* En-tête (~44px) + 15 lignes maximum (~42px/ligne) */
        max-height: 674px;
        overflow-y: scroll;
        overflow-x: hidden;
        scrollbar-gutter: stable;
        scrollbar-width: auto;
        scrollbar-color: #4f6264 #e6f0f2;
        background-color: #ffffff;
      }

      /* Outrepasse ::-webkit-scrollbar { display: none } de styles.css */
      .rb-daily-scroll::-webkit-scrollbar {
        display: block;
        width: 12px;
      }

      .rb-daily-scroll::-webkit-scrollbar-track {
        background-color: #e6f0f2;
        border-left: 1px solid #d6e2e4;
      }

      .rb-daily-scroll::-webkit-scrollbar-thumb {
        background-color: #4f6264;
        border-radius: 6px;
        border: 2px solid #e6f0f2;
      }

      .rb-daily-scroll::-webkit-scrollbar-thumb:hover {
        background-color: #00666f;
      }

      .rb-daily-grid {
        display: grid;
        grid-template-columns:
          minmax(0, 1.35fr)
          minmax(0, 1.05fr)
          minmax(0, 1fr)
          minmax(0, 1.15fr)
          minmax(0, 0.9fr)
          minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        padding: 0 14px;
        box-sizing: border-box;
      }

      .rb-daily-head {
        position: sticky;
        top: 0;
        z-index: 10;
        min-height: 44px;
        background-color: #eef5f9;
        border-bottom: 2px solid #bdc9ca;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: #161d20;
      }

      .rb-daily-row {
        min-height: 42px;
        border-bottom: 1px solid #e8eff3;
        font-size: 13px;
        color: #161d20;
      }

      .rb-daily-row:hover {
        background-color: #f3fafe;
      }

      .rb-daily-total-row {
        min-height: 46px;
        background-color: #e6f3f4;
        border-top: 2px solid #00666f;
        font-size: 13px;
        font-weight: 800;
        color: #004f56;
      }
    `,
  ],
  template: `
    <section
      aria-label="Tableau jour par jour"
      data-testid="rapports-daily-table-section"
      class="rounded-2xl border border-[#bdc9ca] bg-white shadow-sm overflow-hidden"
    >
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-[#dce4e7] px-5 py-4">
        <div class="min-w-0">
          <h2 class="text-lg font-bold text-[#161d20]">Jour par jour</h2>
          <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
            Détail quotidien des chambres occupées et des ventes hors taxes sur la période.
          </p>
        </div>
        <span class="rounded-full bg-[#eef5f9] px-3 py-1 text-xs font-bold text-[#004f56]">
          {{ table.rows.length }} jours
        </span>
      </header>

      <!-- Vue bureau/tablette >= 768px : tableau à défilement vertical interne et total fixe -->
      <div class="hidden md:block" data-testid="daily-table-desktop">
        <div
          class="rb-daily-scroll"
          data-testid="daily-table-scroll"
          tabindex="0"
          aria-label="Lignes quotidiennes des ventes"
        >
          <div class="rb-daily-grid rb-daily-head" role="row">
            <div>Jour</div>
            <div>Chambres occupées</div>
            <div class="text-right">Hébergement</div>
            <div class="text-right">Restaurant et bar</div>
            <div class="text-right">Autres</div>
            <div class="text-right">Total</div>
          </div>

          @for (row of table.rows; track row.dateIso) {
            <div class="rb-daily-grid rb-daily-row" data-testid="daily-table-row" role="row">
              <div class="font-semibold text-[#161d20] truncate">{{ row.label }}</div>
              <div class="font-medium text-[#3d494a]">
                {{ row.occupiedRooms }} sur {{ row.activeRooms }}
              </div>
              <div class="text-right font-medium tabular-nums">{{ fcfa(row.accommodationFcfa) }}</div>
              <div class="text-right font-medium tabular-nums">{{ fcfa(row.restaurantFcfa) }}</div>
              <div class="text-right font-medium tabular-nums">{{ fcfa(row.otherFcfa) }}</div>
              <div class="text-right font-bold tabular-nums text-[#004f56]">{{ fcfa(row.totalFcfa) }}</div>
            </div>
          }
        </div>

        <!-- Ligne Total fixe en bas -->
        <div class="rb-daily-grid rb-daily-total-row pr-[26px]" data-testid="daily-table-total-row" role="row">
          <div>Total</div>
          <div>
            {{ table.totals.occupiedRoomNights }} / {{ table.totals.capacityRoomNights }} nuitées
          </div>
          <div class="text-right tabular-nums">{{ fcfa(table.totals.accommodationFcfa) }}</div>
          <div class="text-right tabular-nums">{{ fcfa(table.totals.restaurantFcfa) }}</div>
          <div class="text-right tabular-nums">{{ fcfa(table.totals.otherFcfa) }}</div>
          <div class="text-right tabular-nums">{{ fcfa(table.totals.totalFcfa) }}</div>
        </div>
      </div>

      <!-- Vue mobile < 768px : cartes compactes + carte Total fixe -->
      <div class="md:hidden" data-testid="daily-table-mobile">
        <div class="border-b border-[#00666f] bg-[#e6f3f4] px-4 py-3" data-testid="daily-mobile-total-card">
          <div class="flex items-center justify-between text-sm font-extrabold text-[#004f56]">
            <span>Total période</span>
            <span>{{ fcfa(table.totals.totalFcfa) }}</span>
          </div>
          <div class="mt-1 grid grid-cols-2 gap-1 text-xs font-semibold text-[#161d20]">
            <span>Chambres : {{ table.totals.occupiedRoomNights }} / {{ table.totals.capacityRoomNights }}</span>
            <span class="text-right">Héberg. : {{ fcfa(table.totals.accommodationFcfa) }}</span>
            <span>Resto/Bar : {{ fcfa(table.totals.restaurantFcfa) }}</span>
            <span class="text-right">Autres : {{ fcfa(table.totals.otherFcfa) }}</span>
          </div>
        </div>

        <div class="max-h-[540px] overflow-y-scroll divide-y divide-[#e8eff3]" data-testid="daily-mobile-scroll">
          @for (row of table.rows; track row.dateIso) {
            <article class="px-4 py-3 text-xs" data-testid="daily-mobile-card">
              <div class="flex items-center justify-between gap-2 font-bold text-[#161d20]">
                <span>{{ row.label }}</span>
                <span class="text-[#004f56]">{{ fcfa(row.totalFcfa) }}</span>
              </div>
              <div class="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[#3d494a]">
                <span>Occupées : <strong>{{ row.occupiedRooms }} sur {{ row.activeRooms }}</strong></span>
                <span>Héberg. : {{ fcfa(row.accommodationFcfa) }}</span>
                <span>Resto/Bar : {{ fcfa(row.restaurantFcfa) }}</span>
                <span>Autres : {{ fcfa(row.otherFcfa) }}</span>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class RapportsDailyTableComponent {
  @Input({ required: true }) table!: RapportsDailyTable;

  fcfa(amount: number): string {
    return formatRapportsFcfa(amount);
  }
}
