import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationModalService } from '../../../core/services/reservation-modal.service';
import { AuthService, ConnectedSessionItem } from '../../../core/services/auth.service';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';
import { Role } from '@residence-blue/shared';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ModalShellComponent],
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

      <!-- Action items & authenticated profile -->
      <div class="flex items-center gap-gutter">
        @if (canCreateReservation()) {
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
        }

        <div class="h-8 w-px bg-surface-variant/60" aria-hidden="true"></div>

        <!-- Authenticated User Profile Menu -->
        <div class="relative" data-testid="user-profile">
          <button
            type="button"
            (click)="toggleMenu($event)"
            data-testid="user-profile-dropdown-btn"
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
                  {{ displayName() }}
                </span>
                <span class="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true"></span>
              </div>
              <span class="font-label-md text-label-md text-on-surface-variant" data-testid="header-user-role">
                {{ displayRoleLabel() }}
              </span>
            </div>
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform" [class.rotate-180]="isMenuOpen()">
              expand_more
            </span>
          </button>

          @if (isMenuOpen()) {
            <div
              class="absolute right-0 mt-2 w-72 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/60 py-2 z-50"
              role="menu"
              data-testid="user-profile-dropdown"
              (click)="$event.stopPropagation()"
            >
              <div class="px-4 py-2 border-b border-outline-variant/40">
                <span class="text-xs font-bold text-on-surface block">{{ displayName() }}</span>
                <span class="text-[11px] text-outline block">{{ currentUser()?.email }}</span>
              </div>

              <div class="py-1">
                <button
                  type="button"
                  (click)="openSessionsModal()"
                  data-testid="menu-sessions-btn"
                  role="menuitem"
                  class="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[20px] text-primary">devices</span>
                  <div>
                    <div class="font-medium text-sm text-on-surface">Appareils connectés</div>
                    <div class="text-[11px] text-outline">
                      {{ isDirection() ? 'Supervision & révocation Direction' : 'Vos sessions actives' }}
                    </div>
                  </div>
                </button>

                <div class="my-1 border-t border-outline-variant/40"></div>

                <button
                  type="button"
                  (click)="logout()"
                  data-testid="menu-logout-btn"
                  role="menuitem"
                  class="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-error-container/20 text-error transition-colors cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[20px]">logout</span>
                  <span class="font-medium text-sm">Se déconnecter</span>
                </button>
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
          <div class="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm flex-shrink-0">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">hotel</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-title-md text-title-md text-primary tracking-tight truncate leading-tight">Résidence Blue</span>
            <span class="font-label-md text-label-md text-on-surface-variant truncate">{{ displayRoleLabel() }}</span>
          </div>
        </div>
        <div class="flex items-center gap-space-xs flex-shrink-0">
          @if (canCreateReservation()) {
            <button
              aria-label="Nouvelle réservation"
              type="button"
              (click)="openNewReservation()"
              data-testid="header-new-reservation-mobile-btn"
              class="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm cursor-pointer min-h-[44px] min-w-[44px]"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
            </button>
          }
          <div class="relative" data-testid="user-profile-mobile">
            <button
              type="button"
              (click)="toggleMenu($event)"
              data-testid="user-profile-dropdown-mobile-btn"
              class="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer"
              aria-label="Menu utilisateur"
            >
              <span class="material-symbols-outlined text-[20px]">person</span>
            </button>

            @if (isMenuOpen()) {
              <div
                class="absolute right-0 top-12 w-64 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/60 py-2 z-50"
                role="menu"
                data-testid="user-profile-dropdown-mobile"
                (click)="$event.stopPropagation()"
              >
                <div class="px-3 py-1.5 border-b border-outline-variant/40">
                  <span class="text-xs font-bold text-on-surface block truncate">{{ displayName() }}</span>
                  <span class="text-[11px] text-outline block truncate">{{ displayRoleLabel() }}</span>
                </div>
                <div class="py-1">
                  <button
                    type="button"
                    (click)="openSessionsModal()"
                    class="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface-container-low text-sm text-on-surface"
                  >
                    <span class="material-symbols-outlined text-[18px] text-primary">devices</span>
                    <span>Appareils connectés</span>
                  </button>
                  <button
                    type="button"
                    (click)="logout()"
                    class="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-error-container/20 text-sm text-error"
                  >
                    <span class="material-symbols-outlined text-[18px]">logout</span>
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </header>

    @if (isMenuOpen()) {
      <div class="fixed inset-0 z-30" (click)="closeMenu()" aria-hidden="true"></div>
    }

    <!-- Modal Appareils connectés & Révocation (ModalShellComponent) -->
    <app-modal-shell
      [isOpen]="isSessionsModalOpen()"
      title="Appareils connectés"
      [subtitle]="isDirection() ? 'Supervision et révocation des sessions actives' : 'Vos sessions ouvertes'"
      icon="devices"
      testId="sessions-modal"
      (closed)="closeSessionsModal()"
    >
      <div class="flex flex-col gap-3">
        @if (sessionsLoading()) {
          <p class="text-sm text-outline py-4 text-center">Chargement des sessions actives...</p>
        } @else if (sessions().length === 0) {
          <p class="text-sm text-outline py-4 text-center">Aucune session active détectée.</p>
        } @else {
          @for (s of sessions(); track s.familyId) {
            <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm text-on-surface">{{ s.deviceLabel }}</span>
                  @if (s.isCurrentSession) {
                    <span class="px-2 py-0.5 rounded-full text-[11px] bg-primary/10 text-primary font-semibold">
                      Session actuelle
                    </span>
                  }
                </div>
                <div class="text-xs text-on-surface-variant">
                  {{ s.userName }} ({{ s.userRole }}) • IP : {{ s.ipAddress || 'Locale' }}
                </div>
                <div class="text-[11px] text-outline">
                  Dernière activité : {{ s.lastUsedAt | date:'short' }}
                </div>
              </div>
              <button
                type="button"
                (click)="revokeSession(s.familyId)"
                [attr.data-testid]="'revoke-session-' + s.familyId"
                class="px-3 py-1.5 rounded-lg bg-error-container/30 text-error hover:bg-error-container/50 text-xs font-semibold cursor-pointer"
              >
                Révoquer
              </button>
            </div>
          }
        }
      </div>
      <div modal-footer class="flex justify-end">
        <button
          type="button"
          (click)="closeSessionsModal()"
          class="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          Fermer
        </button>
      </div>
    </app-modal-shell>
  `,
})
export class HeaderComponent {
  readonly modalService = inject(ReservationModalService);
  readonly authService = inject(AuthService);

  readonly isMenuOpen = signal<boolean>(false);
  readonly currentUser = this.authService.currentUser;

  readonly isSessionsModalOpen = signal<boolean>(false);
  readonly sessionsLoading = signal<boolean>(false);
  readonly sessions = signal<ConnectedSessionItem[]>([]);

  readonly displayName = computed(() => this.currentUser()?.fullName || 'Collaborateur');
  readonly displayRoleLabel = computed(() => {
    const u = this.currentUser();
    if (!u) return '';
    return u.jobTitle || u.role;
  });

  readonly isDirection = computed(() => this.currentUser()?.role === Role.DIRECTION);
  readonly canCreateReservation = computed(() => {
    const r = this.currentUser()?.role;
    return r === Role.DIRECTION || r === Role.RECEPTION;
  });

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isMenuOpen()) {
      this.closeMenu();
    }
  }

  toggleMenu(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isMenuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  openNewReservation(): void {
    this.modalService.open();
  }

  async openSessionsModal(): Promise<void> {
    this.closeMenu();
    this.isSessionsModalOpen.set(true);
    this.sessionsLoading.set(true);
    try {
      this.sessions.set(await this.authService.listConnectedSessions());
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  closeSessionsModal(): void {
    this.isSessionsModalOpen.set(false);
  }

  async revokeSession(familyId: string): Promise<void> {
    const ok = await this.authService.revokeConnectedSession(familyId);
    if (ok) {
      this.sessions.set(await this.authService.listConnectedSessions());
    }
  }

  async logout(): Promise<void> {
    this.closeMenu();
    await this.authService.logout('manual');
  }
}
