import { Component, input } from '@angular/core';

// TODO(API): Connecter les données météo de Thiès à l'API météo externe en temps réel
@Component({
  selector: 'app-weather-widget',
  standalone: true,
  template: `
    <section class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm" aria-labelledby="weather-widget-title">
      <div class="flex items-center justify-between mb-space-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">wb_sunny</span>
          <h3 id="weather-widget-title" class="font-title-lg text-title-lg text-on-surface font-semibold">
            {{ title() }}
          </h3>
        </div>
        <span class="font-label-md text-label-md text-outline">{{ locationBadge() }}</span>
      </div>
      <div class="bg-gradient-to-br from-surface-container-low to-surface-container rounded-xl p-space-md space-y-space-md">
        <!-- Température & Ciel Thiès (TODO(API)) -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-space-sm">
            <div class="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm" aria-hidden="true">
              <span class="material-symbols-outlined text-[22px]">sunny</span>
            </div>
            <div>
              <span class="font-body-sm text-body-sm text-on-surface-variant">Ciel &amp; Climat</span>
              <p class="font-title-md text-title-md text-on-surface font-bold">{{ temperature() }}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="font-body-sm text-body-sm text-on-surface-variant">Indice UV</span>
            <p class="font-title-md text-title-md text-primary font-bold">{{ uvIndex() }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-space-sm pt-space-xs border-t-0">
          <div class="bg-surface-container-lowest/80 rounded-lg p-2.5 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary" aria-hidden="true">pool</span>
            <div>
              <span class="font-label-md text-[11px] text-outline block leading-none">Bassin piscine</span>
              <span class="font-title-md text-title-md text-on-surface font-bold">{{ poolTemp() }}</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest/80 rounded-lg p-2.5 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-tertiary" aria-hidden="true">air</span>
            <div>
              <span class="font-label-md text-[11px] text-outline block leading-none">Harmattan léger</span>
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
  // TODO(API): Remplacer les valeurs fictives par l'API météo de Thiès
  readonly title = input<string>('Climat & Espaces Extérieurs');
  readonly locationBadge = input<string>('Grand Standing');
  readonly temperature = input<string>('29°C Ensoleillé');
  readonly uvIndex = input<string>('Modéré (6)');
  readonly poolTemp = input<string>('28°C');
  readonly wind = input<string>('12 km/h E');
  readonly note = input<string>('Transats & parasols installés autour de la piscine et du patio');
}
