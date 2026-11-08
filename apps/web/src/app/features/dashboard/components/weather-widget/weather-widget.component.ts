import { Component, input } from '@angular/core';

@Component({
  selector: 'app-weather-widget',
  standalone: true,
  template: `
    <section class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm" aria-labelledby="weather-widget-title">
      <div class="flex items-center justify-between mb-space-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">water</span>
          <h3 id="weather-widget-title" class="font-title-lg text-title-lg text-on-surface font-semibold">
            {{ title() }}
          </h3>
        </div>
        <span class="font-label-md text-label-md text-outline">{{ locationBadge() }}</span>
      </div>
      <div class="bg-gradient-to-br from-surface-container-low to-surface-container rounded-xl p-space-md space-y-space-md">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-space-sm">
            <div class="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm" aria-hidden="true">
              <span class="material-symbols-outlined text-[22px]">waves</span>
            </div>
            <div>
              <span class="font-body-sm text-body-sm text-on-surface-variant">Marée haute</span>
              <p class="font-title-md text-title-md text-on-surface font-bold">{{ tideTime() }}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="font-body-sm text-body-sm text-on-surface-variant">Coefficient</span>
            <p class="font-title-md text-title-md text-primary font-bold">{{ coefficient() }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-space-sm pt-space-xs border-t-0">
          <div class="bg-surface-container-lowest/80 rounded-lg p-2.5 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary" aria-hidden="true">thermostat</span>
            <div>
              <span class="font-label-md text-[11px] text-outline block leading-none">Eau de mer</span>
              <span class="font-title-md text-title-md text-on-surface font-bold">{{ waterTemp() }}</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest/80 rounded-lg p-2.5 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary" aria-hidden="true">air</span>
            <div>
              <span class="font-label-md text-[11px] text-outline block leading-none">Brise côtière</span>
              <span class="font-title-md text-title-md text-on-surface font-bold">{{ wind() }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm bg-surface-container-lowest/40 rounded-lg p-2">
          <span class="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">deck</span>
          <span>{{ note() }}</span>
        </div>
      </div>
    </section>
  `
})
export class WeatherWidgetComponent {
  readonly title = input<string>('Météo marine & Marée');
  readonly locationBadge = input<string>('Plage Privée');
  readonly tideTime = input<string>('16h40');
  readonly coefficient = input<string>('78 • Bon');
  readonly waterTemp = input<string>('27°C');
  readonly wind = input<string>('14 km/h NO');
  readonly note = input<string>('Transats & paillotes préparés au front de mer');
}
