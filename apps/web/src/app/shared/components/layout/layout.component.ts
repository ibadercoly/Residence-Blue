import { Component, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

interface MobileNavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SidebarComponent, HeaderComponent],
  host: { class: 'block' },
  template: `
    @if (isConnexion()) {
      <main role="main" class="min-h-screen w-full bg-surface">
        <ng-content />
      </main>
    } @else {
      <div class="min-h-screen bg-surface text-on-surface font-body-md text-body-md antialiased selection:bg-primary selection:text-on-primary flex flex-col md:block">
        <app-sidebar class="hidden md:block" />
        <div class="md:pl-64 flex flex-col flex-1">
          <app-header />
          <main
            role="main"
            class="flex flex-col md:block relative w-full pt-16 pb-24 md:pt-20 md:pb-0 md:px-margin bg-surface min-h-screen md:min-h-0"
          >
            <ng-content />
          </main>
        </div>

        <!-- Mobile Bottom Navigation (tableau_de_bord_mode_clair) -->
        <nav
          class="md:hidden fixed bottom-0 w-full z-50 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(10,37,64,0.05)]"
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
    }
  `
})
export class LayoutComponent {
  private readonly router = inject(Router);

  readonly isConnexion = signal<boolean>(
    typeof window !== 'undefined' ? window.location.pathname.startsWith('/connexion') : false
  );

  readonly mobileNavItems: MobileNavItem[] = [
    { path: '/tableau-de-bord', label: 'Bord', icon: 'dashboard' },
    { path: '/planning', label: 'Planning', icon: 'calendar_month' },
    { path: '/chambres', label: 'Chambres', icon: 'bed' },
    { path: '/reservations', label: 'Résas', icon: 'book_online' },
    { path: '/parametres', label: 'Plus', icon: 'widgets' }
  ];

  constructor() {
    if (this.router?.events?.subscribe) {
      this.router.events.subscribe((event: unknown) => {
        if (event instanceof NavigationEnd) {
          const url = event.urlAfterRedirects || event.url || '';
          this.isConnexion.set(url.startsWith('/connexion'));
        }
      });
    }
  }
}
