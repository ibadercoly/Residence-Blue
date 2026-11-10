import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationModalService } from '../../../core/services/reservation-modal.service';
import { RoomsService } from '../../../core/services/rooms.service';
import { Role } from '@residence-blue/shared';

export interface DemoRoleItem {
  role: Role;
  label: string;
  name: string;
  title: string;
  icon: string;
  description: string;
  testId: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
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

        <!-- User Profile avec Sélecteur « Profil de démonstration » -->
        <div class="relative" data-testid="user-profile">
          <button
            type="button"
            (click)="toggleMenu($event)"
            data-testid="demo-profile-dropdown-btn"
            class="flex items-center gap-space-md p-1.5 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-primary"
            aria-haspopup="menu"
            [attr.aria-expanded]="isMenuOpen()"
          >
            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span class="material-symbols-outlined text-on-primary text-[18px]" aria-hidden="true">person</span>
            </div>
            <div class="hidden xl:flex flex-col text-left">
              <div class="flex items-center gap-space-xs">
                <span class="font-label-lg text-label-lg text-on-surface leading-tight font-semibold" data-testid="header-user-name">
                  {{ currentProfile().name }}
                </span>
                <span class="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true"></span>
              </div>
              <span class="font-label-md text-label-md text-on-surface-variant" data-testid="header-user-role">
                {{ currentProfile().title }}
              </span>
            </div>
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform" [class.rotate-180]="isMenuOpen()">
              expand_more
            </span>
          </button>

          <!-- Dropdown menu : Profil de démonstration -->
          @if (isMenuOpen()) {
            <div
              class="absolute right-0 mt-2 w-72 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/60 py-2 z-50"
              role="menu"
              data-testid="demo-profile-dropdown"
              (click)="$event.stopPropagation()"
            >
              <div class="px-4 py-2 border-b border-outline-variant/40">
                <span class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                  Profil de démonstration
                </span>
                <span class="text-xs text-outline block mt-0.5">
                  Basculez de rôle pour tester les droits applicatifs
                </span>
              </div>

              <div class="py-1">
                @for (item of demoRoles; track item.role) {
                  <button
                    type="button"
                    (click)="selectRole(item.role)"
                    [attr.data-testid]="item.testId"
                    role="menuitem"
                    class="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-surface-container-low transition-colors cursor-pointer"
                    [class.bg-surface-container-high]="roomsService.currentRole() === item.role"
                  >
                    <div class="flex items-center gap-3">
                      <span class="material-symbols-outlined text-[20px]" [class.text-primary]="roomsService.currentRole() === item.role" [class.text-on-surface-variant]="roomsService.currentRole() !== item.role">
                        {{ item.icon }}
                      </span>
                      <div>
                        <div class="font-medium text-sm text-on-surface leading-tight" [class.font-bold]="roomsService.currentRole() === item.role">
                          {{ item.label }}
                        </div>
                        <div class="text-[11px] text-on-surface-variant">
                          {{ item.description }}
                        </div>
                      </div>
                    </div>
                    @if (roomsService.currentRole() === item.role) {
                      <span class="material-symbols-outlined text-[18px] text-primary">check</span>
                    }
                  </button>
                }
              </div>
            </div>
          }
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
          <div class="relative" data-testid="user-profile-mobile">
            <button
              type="button"
              (click)="toggleMenu($event)"
              data-testid="demo-profile-dropdown-mobile-btn"
              class="flex items-center p-0.5 rounded-full cursor-pointer focus:ring-2 focus:ring-primary"
              aria-label="Menu profil de démonstration"
            >
              <img
                alt="Profil utilisateur"
                class="w-8 h-8 rounded-full object-cover shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
                src="assets/images/avatar-aissatou-ba.jpg"
              />
            </button>

            <!-- Menu mobile -->
            @if (isMenuOpen()) {
              <div
                class="absolute right-0 top-12 w-64 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/60 py-2 z-50"
                role="menu"
                data-testid="demo-profile-dropdown-mobile"
                (click)="$event.stopPropagation()"
              >
                <div class="px-3 py-1.5 border-b border-outline-variant/40">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                    Profil de démonstration
                  </span>
                </div>
                <div class="py-1">
                  @for (item of demoRoles; track item.role) {
                    <button
                      type="button"
                      (click)="selectRole(item.role)"
                      [attr.data-testid]="item.testId"
                      class="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-surface-container-low transition-colors"
                      [class.bg-surface-container-high]="roomsService.currentRole() === item.role"
                    >
                      <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[18px]" [class.text-primary]="roomsService.currentRole() === item.role">
                          {{ item.icon }}
                        </span>
                        <div>
                          <div class="font-medium text-xs text-on-surface">
                            {{ item.label }}
                          </div>
                        </div>
                      </div>
                      @if (roomsService.currentRole() === item.role) {
                        <span class="material-symbols-outlined text-[16px] text-primary">check</span>
                      }
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </header>

    <!-- Backdrop transparent pour fermer le menu lors d'un clic en dehors -->
    @if (isMenuOpen()) {
      <div
        class="fixed inset-0 z-30"
        (click)="closeMenu()"
        aria-hidden="true"
      ></div>
    }
  `
})
export class HeaderComponent {
  readonly modalService = inject(ReservationModalService);
  readonly roomsService = inject(RoomsService);

  readonly isMenuOpen = signal<boolean>(false);

  readonly demoRoles: DemoRoleItem[] = [
    {
      role: Role.DIRECTION,
      label: 'Direction',
      name: 'Aïssatou Ba',
      title: 'Directrice Générale',
      icon: 'admin_panel_settings',
      description: 'Accès complet (ajout, modif, prix)',
      testId: 'demo-role-direction',
    },
    {
      role: Role.RECEPTION,
      label: 'Réception',
      name: 'Fatou Sow',
      title: 'Chef de Réception',
      icon: 'desk',
      description: 'Planning, check-in, réservations',
      testId: 'demo-role-reception',
    },
    {
      role: Role.HOUSEKEEPING,
      label: 'Gouvernance',
      name: 'Mariama Diallo',
      title: 'Gouvernante Générale',
      icon: 'cleaning_services',
      description: 'Statuts de ménage et chambres',
      testId: 'demo-role-housekeeping',
    },
    {
      role: Role.MAINTENANCE,
      label: 'Technique',
      name: 'Moussa Ndiaye',
      title: 'Responsable Technique',
      icon: 'handyman',
      description: 'Maintenance et réparations',
      testId: 'demo-role-maintenance',
    },
  ];

  readonly currentProfile = computed(() => {
    const role = this.roomsService.currentRole();
    const matched = this.demoRoles.find((r) => r.role === role);
    return (
      matched || {
        role: Role.DIRECTION,
        label: 'Direction',
        name: 'Aïssatou Ba',
        title: 'Directrice Générale',
        icon: 'admin_panel_settings',
        description: 'Accès complet',
        testId: 'demo-role-direction',
      }
    );
  });

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isMenuOpen()) {
      this.closeMenu();
    }
  }

  toggleMenu(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isMenuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  selectRole(role: Role): void {
    this.roomsService.setRole(role);
    this.closeMenu();
  }

  openNewReservation(): void {
    this.modalService.open();
  }
}
