import { Component, inject } from '@angular/core';
import { DashboardMockService } from '../../../../core/services/dashboard-mock.service';
import { HeroBannerComponent } from '../../components/hero-banner/hero-banner.component';
import { KpiGridComponent } from '../../components/kpi-grid/kpi-grid.component';
import { WeeklyRevenueChartComponent } from '../../components/weekly-revenue-chart/weekly-revenue-chart.component';
import { ExpectedArrivalsComponent } from '../../components/expected-arrivals/expected-arrivals.component';
import { PriorityAlertsComponent } from '../../components/priority-alerts/priority-alerts.component';
import { WeatherWidgetComponent } from '../../components/weather-widget/weather-widget.component';
import { MobileDashboardComponent } from '../../components/mobile-dashboard/mobile-dashboard.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    HeroBannerComponent,
    KpiGridComponent,
    WeeklyRevenueChartComponent,
    ExpectedArrivalsComponent,
    PriorityAlertsComponent,
    WeatherWidgetComponent,
    MobileDashboardComponent
  ],
  host: { class: 'block w-full' },
  template: `
    <!-- Desktop / Tablet View (tableau_de_bord) -->
    <div class="hidden md:flex flex-col w-full pb-16 space-y-8">
      <!-- 1. Top Wide Hero Banner -->
      <app-hero-banner
        [seasonTag]="data().hero.seasonTag"
        [weatherTag]="data().hero.weatherTag"
        [title]="data().hero.title"
        [subtitle]="data().hero.subtitle"
        [imageUrl]="data().hero.imageUrl"
      />

      <!-- 2. Four KPI Cards Grid -->
      <app-kpi-grid
        [occupancyRate]="data().kpis.occupancyRate.value"
        [occupancyChange]="data().kpis.occupancyRate.changeLabel"
        [occupiedRooms]="data().kpis.occupiedRooms.occupied"
        [totalRooms]="data().kpis.occupiedRooms.total"
        [availableBadge]="data().kpis.occupiedRooms.availableBadge"
        [roomsDetail]="data().kpis.occupiedRooms.detailLabel"
        [todayRevenueAmount]="data().kpis.todayRevenue.amount"
        [checkIns]="data().kpis.keyMovements.checkIns"
        [checkOuts]="data().kpis.keyMovements.checkOuts"
        [movementsDetail]="data().kpis.keyMovements.detailLabel"
      />

      <!-- 3. Main Content Split Section (65% / 35%) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <!-- LEFT COLUMN (65% -> col-span-8) -->
        <div class="lg:col-span-8 space-y-gutter">
          <app-weekly-revenue-chart
            [weekLabel]="data().weeklyRevenue.weekLabel"
            [title]="data().weeklyRevenue.title"
            [totalEstimated]="'3 465 000 FCFA'"
            [averageRate]="data().weeklyRevenue.averageRate"
            [days]="data().weeklyRevenue.days"
          />

          <app-expected-arrivals
            [arrivals]="data().arrivals"
          />
        </div>

        <!-- RIGHT COLUMN (35% -> col-span-4) -->
        <div class="lg:col-span-4 space-y-gutter">
          <app-priority-alerts
            [alerts]="data().priorityAlerts"
          />

          <app-weather-widget
            [title]="data().marineWeather.title"
            [locationBadge]="data().marineWeather.locationBadge"
            [tideTime]="data().marineWeather.tideTime"
            [coefficient]="data().marineWeather.coefficient"
            [waterTemp]="data().marineWeather.waterTemp"
            [wind]="data().marineWeather.wind"
            [note]="data().marineWeather.note"
          />
        </div>
      </div>
    </div>

    <!-- Mobile View (tableau_de_bord_mode_clair) -->
    <app-mobile-dashboard class="md:hidden" />
  `
})
export class DashboardPageComponent {
  private readonly dashboardService = inject(DashboardMockService);
  readonly data = this.dashboardService.data;
}
