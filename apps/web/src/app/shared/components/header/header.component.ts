import { Component, inject } from '@angular/core';
import { ReservationModalService } from '../../../core/services/reservation-modal.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  host: { class: 'block' },
  template: `
    <!-- Desktop Header (tableau_de_bord) -->
    <header
      class="hidden md:flex fixed top-0 left-64 right-0 h-20 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 items-center justify-between px-margin"
      role="banner"
    >
      <!-- Global Search -->
      <div class="flex items-center gap-gutter flex-1 max-w-xl">
        <div class="relative w-full">
          <label for="global-search" class="sr-only">Rechercher une réservation, client, chambre</label>
          <span class="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none" aria-hidden="true">
            search
          </span>
          <input
            id="global-search"
            class="w-full h-11 pl-11 pr-space-md rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-body-sm outline-none shadow-[0_2px_8px_rgba(10,37,64,0.04)] focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="Rechercher une réservation, client, chambre..."
            type="text"
          />
        </div>
      </div>

      <!-- Action items & profile -->
      <div class="flex items-center gap-gutter">
        <!-- New reservation CTA -->
        <button
          type="button"
          (click)="openNewReservation()"
          class="inline-flex items-center gap-space-sm h-11 px-gutter bg-primary hover:bg-primary-container text-on-primary rounded-xl font-label-lg text-label-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
          aria-label="Créer une nouvelle réservation"
          data-testid="header-new-reservation-btn"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          <span>Nouvelle réservation</span>
        </button>

        <!-- Notifications button -->
        <button
          type="button"
          class="relative w-11 h-11 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-on-surface shadow-[0_2px_8px_rgba(10,37,64,0.04)] transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Notifications : 1 nouvelle notification"
        >
          <span class="material-symbols-outlined text-[22px]" aria-hidden="true">notifications</span>
          <span class="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-secondary ring-2 ring-surface-container-lowest"></span>
        </button>

        <!-- Separator -->
        <div class="h-8 w-px bg-surface-variant/60" aria-hidden="true"></div>

        <!-- User Profile (reproduction fidèle de la maquette originale) -->
        <div class="flex items-center gap-space-md" data-testid="user-profile">
          <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-on-primary text-[18px]" aria-hidden="true">person</span>
          </div>
          <div class="hidden xl:flex flex-col text-left">
            <div class="flex items-center gap-space-xs">
              <span class="font-label-lg text-label-lg text-on-surface leading-tight">Aïssatou Ba</span>
              <span class="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true"></span>
            </div>
            <span class="font-label-md text-label-md text-on-surface-variant">Directrice Générale</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Mobile Header (tableau_de_bord_mode_clair) -->
    <header
      class="md:hidden fixed top-0 w-full z-50 pt-safe bg-surface-container-lowest/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
      role="banner"
    >
      <div class="h-16 px-gutter-sm flex items-center justify-between gap-space-sm">
        <div class="flex items-center gap-space-sm min-w-0">
          <img
            alt="Logo Résidence Blue"
            class="h-8 w-auto object-contain flex-shrink-0"
            src="/assets/images/logo-missing.png"
          />
          <div class="flex flex-col min-w-0">
            <span class="font-title-md text-title-md text-primary tracking-tight truncate leading-tight">Résidence Blue</span>
            <span class="font-label-md text-label-md text-on-surface-variant truncate">Tableau De Bord</span>
          </div>
        </div>
        <div class="flex items-center gap-space-xs flex-shrink-0">
          <button
            aria-label="Nouvelle réservation"
            type="button"
            (click)="openNewReservation()"
            data-testid="header-new-reservation-mobile-btn"
            class="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm cursor-pointer min-h-[44px] min-w-[44px]"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
          </button>
          <button
            aria-label="Notifications"
            type="button"
            class="w-11 h-11 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors relative"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">notifications</span>
            <span class="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-secondary"></span>
          </button>
          <div class="flex items-center pl-1" data-testid="user-profile-mobile">
            <img
              alt="Profil Aïssatou Ba"
              class="w-8 h-8 rounded-full object-cover shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
              src="assets/images/avatar-aissatou-ba.jpg"
            />
          </div>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  readonly modalService = inject(ReservationModalService);

  openNewReservation(): void {
    this.modalService.open();
  }
}
