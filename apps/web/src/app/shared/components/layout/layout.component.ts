import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ReservationModalComponent } from '../../../features/reservation-modal/reservation-modal.component';
import { ReservationModalService } from '../../../core/services/reservation-modal.service';

interface MobileNavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, SidebarComponent, HeaderComponent, ReservationModalComponent],
  host: { class: 'block' },
  template: `
    <div class="min-h-screen bg-surface text-on-surface font-body-md text-body-md antialiased selection:bg-primary selection:text-on-primary flex flex-col min-[900px]:block">
      <app-sidebar
        [mobileOpen]="mobileMenuOpen()"
        (closeMobile)="mobileMenuOpen.set(false)"
      />
      <div class="min-[900px]:pl-[272px] flex flex-col flex-1 min-w-0">
        <app-header (menuToggle)="mobileMenuOpen.set(!mobileMenuOpen())" />
        <main
          role="main"
          class="flex flex-col min-[900px]:block relative w-full min-w-0 pt-16 pb-24 min-[900px]:pt-20 min-[900px]:pb-0 min-[900px]:px-margin bg-surface min-h-screen min-[900px]:min-h-0"
        >
          <ng-content />
        </main>
      </div>

      <!-- Toast de confirmation -->
      @if (modalService?.feedbackMessage(); as toastMsg) {
        <div
          role="status"
          aria-live="polite"
          data-testid="reservation-toast"
          class="fixed bottom-20 min-[900px]:bottom-6 right-4 min-[900px]:right-6 z-50 px-4 py-3 rounded-xl bg-teal-900 text-white text-sm font-semibold shadow-sm flex items-center gap-3"
        >
          <span>{{ toastMsg }}</span>
          <button
            type="button"
            (click)="modalService.clearFeedback()"
            class="text-white/80 hover:text-white text-xs font-bold px-2 py-1"
            aria-label="Fermer la notification"
          >
            ✕
          </button>
        </div>
      }

      <!-- Modal Nouvelle Réservation Réutilisable (chargée à la demande) -->
      @defer (when modalService?.isOpen(); prefetch on immediate) {
        @if (modalService?.isOpen()) {
          <app-reservation-modal />
        }
      } @loading (minimum 0ms) {
        @if (modalService?.isOpen()) {
          <div
            class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 md:p-4"
            data-testid="reservation-modal-skeleton"
            role="status"
            aria-label="Chargement de la fenêtre de réservation"
          >
            <div class="w-full max-w-[960px] h-dvh md:h-[90dvh] md:rounded-2xl bg-white border border-slate-200 p-6 animate-pulse">
              <div class="h-6 w-48 bg-slate-200 rounded mb-4"></div>
              <div class="h-4 w-72 bg-slate-100 rounded mb-6"></div>
              <div class="h-32 w-full bg-slate-100 rounded mb-4"></div>
              <div class="h-32 w-full bg-slate-100 rounded"></div>
            </div>
          </div>
        }
      }

      <!-- Mobile Bottom Navigation (tableau_de_bord_mode_clair) -->
      <nav
        class="md:hidden fixed bottom-0 w-full z-40 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(10,37,64,0.05)]"
        aria-label="Navigation mobile"
      >
        <div class="flex justify-around items-center h-16 px-space-xs">
          @for (item of mobileNavItems; track item.path) {
            <a
              [routerLink]="item.path"
              #rla="routerLinkActive"
              routerLinkActive
              [routerLinkActiveOptions]="{ exact: item.path === '/tableau-de-bord' }"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              [class]="rla.isActive
                ? 'flex flex-col items-center justify-center min-w-[56px] h-12 gap-0.5 transition-colors text-primary font-title-md'
                : 'flex flex-col items-center justify-center min-w-[56px] h-12 gap-0.5 text-on-surface-variant hover:text-primary transition-colors'"
            >
              <span class="material-symbols-outlined text-[22px]" aria-hidden="true">{{ item.icon }}</span>
              <span class="font-label-md text-[11px] leading-tight">{{ item.label }}</span>
            </a>
          }
        </div>
      </nav>
    </div>
  `,
})
export class LayoutComponent implements OnDestroy {
  private readonly router = inject(Router, { optional: true });
  readonly modalService = inject(ReservationModalService, { optional: true });
  private readonly routerSub: Subscription | null = null;
  readonly mobileMenuOpen = signal(false);

  readonly mobileNavItems: MobileNavItem[] = [
    { path: '/tableau-de-bord', label: 'Bord', icon: 'dashboard' },
    { path: '/planning', label: 'Planning', icon: 'calendar_month' },
    { path: '/chambres', label: 'Chambres', icon: 'bed' },
    { path: '/reservations', label: 'Résas', icon: 'book_online' },
    { path: '/parametres', label: 'Plus', icon: 'widgets' },
  ];

  constructor() {
    if (this.router && this.modalService) {
      this.routerSub = this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          this.mobileMenuOpen.set(false);
          if (e.urlAfterRedirects?.includes('/reservations/nouvelle') || e.url?.includes('/reservations/nouvelle')) {
            this.modalService?.open();
          }
        });
      if (typeof window !== 'undefined' && window.location.pathname.includes('/reservations/nouvelle')) {
        this.modalService.open();
      }
    }
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
