import { Component, input } from '@angular/core';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  template: `
    <section class="relative w-full rounded-2xl overflow-hidden shadow-lg -mt-2">
      <div
        class="w-full h-80 bg-cover bg-center relative transition-transform duration-700 ease-out"
        [style.backgroundImage]="'url(' + imageUrl() + ')'"
      >
        <!-- Gradient Scrim for atmospheric coastal depth -->
        <div class="absolute inset-0 bg-gradient-to-t from-inverse-surface via-inverse-surface/60 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-inverse-surface/80 via-transparent to-inverse-surface/30"></div>

        <!-- Content Overlay -->
        <div class="relative h-full flex flex-col justify-end p-gutter md:p-margin text-on-tertiary">
          <div class="flex flex-wrap items-center gap-space-sm mb-space-sm">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/90 text-on-secondary font-label-md text-label-md uppercase tracking-wider backdrop-blur-md shadow-sm">
              <span class="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-pulse"></span>
              {{ seasonTag() }}
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest/20 backdrop-blur-md text-surface-bright font-label-md text-label-md">
              <span class="material-symbols-outlined text-[16px] text-secondary-fixed-dim">sunny</span>
              {{ weatherTag() }}
            </span>
          </div>
          <h1 class="font-headline-lg text-headline-lg md:text-[38px] md:leading-[46px] text-surface-bright tracking-tight max-w-3xl drop-shadow-sm">
            {{ title() }}
          </h1>
          <p class="font-body-md text-body-md text-surface-variant/90 max-w-2xl mt-space-xs font-normal">
            {{ subtitle() }}
          </p>
        </div>
      </div>
    </section>
  `
})
export class HeroBannerComponent {
  readonly seasonTag = input<string>('Haute saison • 9 chambres occupées sur 12');
  readonly weatherTag = input<string>('Thiès, Grand Standing • 29°C Ensoleillé');
  readonly title = input<string>('Bienvenue à la Résidence Blue');
  readonly subtitle = input<string>('Boutique Hôtel 12 Chambres • Petite Côte, Sénégal • Vendredi 24 Mai • Service Conciergerie & Exploitation');
  readonly imageUrl = input<string>('assets/images/hero-dashboard.jpg');
}
