import { Component, input } from '@angular/core';

export interface ArrivalItem {
  id: string;
  initials: string;
  name: string;
  badge: string;
  badgeIcon?: string;
  room: string;
  nights: string;
  arrivalTime: string;
  colorVariant: 'primary' | 'tertiary';
}

@Component({
  selector: 'app-expected-arrivals',
  standalone: true,
  template: `
    <section class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm" aria-labelledby="expected-arrivals-title">
      <div class="flex items-center justify-between mb-space-lg">
        <div>
          <span class="font-label-md text-label-md text-outline uppercase tracking-wider">Réception &amp; Conciergerie</span>
          <h2 id="expected-arrivals-title" class="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Arrivées attendues aujourd'hui
          </h2>
        </div>
        <span class="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-md text-label-md">
          {{ arrivals().length }} clients attendus
        </span>
      </div>

      <div class="space-y-space-md">
        @for (guest of arrivals(); track guest.id) {
          <div class="bg-surface-container-low/60 hover:bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md transition-colors">
            <div class="flex items-center gap-space-md">
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center font-title-md text-title-md shadow-sm shrink-0"
                [class.bg-primary]="guest.colorVariant === 'primary'"
                [class.text-on-primary]="guest.colorVariant === 'primary'"
                [class.bg-tertiary]="guest.colorVariant === 'tertiary'"
                [class.text-on-tertiary]="guest.colorVariant === 'tertiary'"
                aria-hidden="true"
              >
                {{ guest.initials }}
              </div>
              <div>
                <div class="flex flex-wrap items-center gap-space-xs">
                  <h3 class="font-title-md text-title-md text-on-surface font-semibold">{{ guest.name }}</h3>
                  @if (guest.badgeIcon === 'workspace_premium') {
                    <span class="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md flex items-center gap-1">
                      <span class="material-symbols-outlined text-[13px] text-secondary" aria-hidden="true">workspace_premium</span>
                      {{ guest.badge }}
                    </span>
                  } @else {
                    <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-md text-label-md flex items-center gap-1">
                      <span class="material-symbols-outlined text-[13px] text-primary" aria-hidden="true">directions_car</span>
                      {{ guest.badge }}
                    </span>
                  }
                </div>
                <div class="flex flex-wrap items-center gap-y-1 gap-x-space-md mt-1 text-on-surface-variant font-body-sm text-body-sm">
                  <span class="inline-flex items-center gap-1 text-primary font-medium">
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">meeting_room</span>
                    {{ guest.room }}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span>{{ guest.nights }}</span>
                  <span aria-hidden="true">•</span>
                  <span
                    class="inline-flex items-center gap-1"
                    [class.text-secondary]="guest.colorVariant === 'primary'"
                    [class.font-medium]="guest.colorVariant === 'primary'"
                    [class.text-on-surface-variant]="guest.colorVariant !== 'primary'"
                  >
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">schedule</span>
                    {{ guest.arrivalTime }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-space-sm self-end md:self-center shrink-0">
              <button
                class="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                title="Appeler le client"
                type="button"
                aria-label="Appeler {{ guest.name }}"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">phone</span>
              </button>
              <button
                class="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                title="Voir fiche réservation"
                type="button"
                aria-label="Voir la fiche de réservation de {{ guest.name }}"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">receipt_long</span>
              </button>
              <button
                class="h-10 px-gutter bg-primary hover:bg-primary-container text-on-primary rounded-xl font-label-lg text-label-lg shadow-sm flex items-center gap-1.5 transition-all focus-visible:ring-2 focus-visible:ring-primary"
                type="button"
                aria-label="Enregistrer le check-in de {{ guest.name }}"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">how_to_reg</span>
                <span>Check-in</span>
              </button>
            </div>
          </div>
        }
      </div>
    </section>
  `
})
export class ExpectedArrivalsComponent {
  readonly arrivals = input<ArrivalItem[]>([
    {
      id: 'guest-1',
      initials: 'MD',
      name: 'M. Mamadou Diop',
      badge: 'VIP Gold',
      badgeIcon: 'workspace_premium',
      room: 'Suite Océan (Ch. 01)',
      nights: '3 nuits',
      arrivalTime: 'Arrivée prévue 14h30',
      colorVariant: 'primary'
    },
    {
      id: 'guest-2',
      initials: 'CL',
      name: 'Mme Claire Lefèvre',
      badge: 'Navette aéroport confirmée',
      badgeIcon: 'directions_car',
      room: 'Deluxe Plage (Ch. 05)',
      nights: '2 nuits',
      arrivalTime: 'Arrivée prévue 16h00',
      colorVariant: 'tertiary'
    }
  ]);
}
