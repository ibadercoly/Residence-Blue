import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { RoomsService } from '../../../core/services/rooms.service';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ModuleConfigService } from '../../../core/services/module-config.service';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string | number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  host: { class: 'block' },
  template: `
    @if (mobileOpen) {
      <div
        class="fixed inset-0 z-40 bg-black/45 md:hidden"
        data-testid="sidebar-backdrop"
        aria-hidden="true"
        (click)="closeMobile.emit()"
      ></div>
    }

    <aside
      data-testid="app-sidebar-aside"
      [class]="
        'fixed left-0 top-0 h-full w-64 bg-inverse-surface z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-transform duration-200 md:translate-x-0 ' +
        (mobileOpen ? 'translate-x-0' : '-translate-x-full')
      "
      aria-label="Navigation principale"
    >
      <div class="flex flex-col">
        <!-- Brand Header -->
        <div class="h-20 flex items-center justify-between gap-space-md px-gutter">
          <div class="flex items-center gap-space-md min-w-0">
            <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
              <span class="material-symbols-outlined text-[24px]">hotel</span>
            </div>
            <div class="flex flex-col justify-center min-w-0">
              <span class="font-headline-sm text-headline-sm text-surface-bright tracking-tight truncate leading-tight">
                Résidence Blue
              </span>
              <span class="font-label-md text-label-md text-outline-variant uppercase tracking-wider truncate">
                Hôtel {{ roomsCount() }} Clés &bull; Thiès
              </span>
            </div>
          </div>

          <button
            type="button"
            class="md:hidden w-9 h-9 rounded-lg text-surface-container-high hover:bg-surface-variant/20 flex items-center justify-center shrink-0"
            aria-label="Fermer le menu"
            data-testid="sidebar-close-mobile"
            (click)="closeMobile.emit()"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Section Navigation principale (Maximum 7 modules actifs V1) -->
        <div class="px-space-md py-space-sm">
          <div class="px-space-md py-space-xs mb-space-xs font-label-md text-label-md text-outline-variant uppercase tracking-wider">
            Menu Principal
          </div>
          <nav class="flex flex-col gap-space-xs" data-testid="sidebar-nav">
            @for (item of activeMenuItems(); track item.route) {
              <a
                [routerLink]="item.route"
                #rla="routerLinkActive"
                routerLinkActive
                [routerLinkActiveOptions]="{ exact: item.route === '/tableau-de-bord' || item.route === '/accueil' || item.route === '/' }"
                [attr.aria-current]="rla.isActive ? 'page' : null"
                [attr.data-testid]="'nav-' + item.id"
                (click)="closeMobile.emit()"
                [class]="
                  'flex items-center gap-space-md px-space-md py-space-sm rounded-lg font-title-md text-title-md rb-menu-entry rb-menu-color-' +
                  item.id +
                  (rla.isActive ? ' rb-menu-entry-active' : '')
                "
              >
                <svg
                  class="rb-menu-svg-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  @switch (item.id) {
                    @case ('dashboard') {
                      <!-- Accueil : 4 tuiles, accent sur les 2 tuiles diagonales -->
                      <rect class="accent" x="3" y="3" width="8" height="8" rx="2" />
                      <rect class="accent" x="13" y="13" width="8" height="8" rx="2" />
                      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.9" />
                      <rect x="13" y="3" width="8" height="5" rx="1.8" stroke="currentColor" stroke-width="1.9" />
                      <rect x="3" y="14" width="8" height="7" rx="1.8" stroke="currentColor" stroke-width="1.9" />
                      <rect x="13" y="11" width="8" height="10" rx="2" stroke="currentColor" stroke-width="1.9" />
                    }
                    @case ('planning') {
                      <!-- Planning : calendrier avec bandeau supérieur en accent -->
                      <rect class="accent" x="3.5" y="4.5" width="17" height="5" rx="1.5" />
                      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="currentColor" stroke-width="1.9" />
                      <line x1="8" y1="2.5" x2="8" y2="6.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                      <line x1="16" y1="2.5" x2="16" y2="6.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" stroke="currentColor" stroke-width="1.9" />
                      <circle cx="8.5" cy="13.5" r="1.1" fill="currentColor" />
                      <circle cx="12" cy="13.5" r="1.1" fill="currentColor" />
                      <circle cx="15.5" cy="13.5" r="1.1" fill="currentColor" />
                      <circle cx="8.5" cy="17" r="1.1" fill="currentColor" />
                      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
                    }
                    @case ('rooms') {
                      <!-- Chambres : lit avec matelas et oreillers en accent -->
                      <rect class="accent" x="4" y="11" width="16" height="5" rx="1.5" />
                      <path d="M3 19V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                      <path d="M3 15h18" stroke="currentColor" stroke-width="1.9" />
                      <path d="M6 11V9.5A1.5 1.5 0 0 1 7.5 8h2A1.5 1.5 0 0 1 11 9.5V11" stroke="currentColor" stroke-width="1.8" />
                      <path d="M13 11V9.5A1.5 1.5 0 0 1 14.5 8h2A1.5 1.5 0 0 1 18 9.5V11" stroke="currentColor" stroke-width="1.8" />
                    }
                    @case ('clients') {
                      <!-- Clients : duo avec silhouette principale en accent -->
                      <circle class="accent" cx="9" cy="8" r="3.5" />
                      <path class="accent" d="M3.5 19c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
                      <circle cx="9" cy="8" r="3.5" stroke="currentColor" stroke-width="1.9" />
                      <path d="M3.5 19c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                      <circle cx="16.5" cy="9" r="2.5" stroke="currentColor" stroke-width="1.8" />
                      <path d="M16 14.2c2.4.2 4.3 2 4.5 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    }
                    @case ('facturation') {
                      <!-- Facturation : reçu avec corps en accent -->
                      <path class="accent" d="M5 4.5h14v15l-2.3-1.6-2.4 1.6-2.3-1.6-2.3 1.6-2.4-1.6L5 19.5V4.5Z" />
                      <path d="M5 4.5h14v15l-2.3-1.6-2.4 1.6-2.3-1.6-2.3 1.6-2.4-1.6L5 19.5V4.5Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" />
                      <line x1="8.5" y1="9" x2="15.5" y2="9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                      <line x1="8.5" y1="13" x2="13.5" y2="13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                    }
                    @case ('rapports') {
                      <!-- Rapports : barres analytiques avec zone en accent -->
                      <rect class="accent" x="4.5" y="13" width="3.5" height="6.5" rx="1" />
                      <rect class="accent" x="10.25" y="8" width="3.5" height="11.5" rx="1" />
                      <rect class="accent" x="16" y="4.5" width="3.5" height="15" rx="1" />
                      <rect x="4.5" y="13" width="3.5" height="6.5" rx="1" stroke="currentColor" stroke-width="1.8" />
                      <rect x="10.25" y="8" width="3.5" height="11.5" rx="1" stroke="currentColor" stroke-width="1.8" />
                      <rect x="16" y="4.5" width="3.5" height="15" rx="1" stroke="currentColor" stroke-width="1.8" />
                      <line x1="3" y1="19.5" x2="21" y2="19.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                    }
                    @default {
                      <!-- Restaurant & Bar : cloche / service avec dôme en accent -->
                      <path class="accent" d="M4.5 15a7.5 7.5 0 0 1 15 0H4.5Z" />
                      <path d="M4.5 15a7.5 7.5 0 0 1 15 0H4.5Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" />
                      <circle cx="12" cy="5.5" r="1.3" stroke="currentColor" stroke-width="1.8" />
                      <line x1="3" y1="18.5" x2="21" y2="18.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                    }
                  }
                </svg>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
        </div>
      </div>

      <!-- Badge Mode V1 Minimale & Version -->
      <div class="p-gutter">
        <div class="bg-surface-variant/10 rounded-xl p-space-md flex items-center justify-between">
          <div class="flex flex-col">
            <span class="font-label-md text-label-md text-surface-container-high">Version 1.0</span>
            <span class="font-body-sm text-[11px] text-outline-variant">Légère &bull; {{ roomsCount() }} Chambres</span>
          </div>
          <span class="material-symbols-outlined text-primary-fixed-dim text-[20px]">speed</span>
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  @Input() mobileOpen = false;
  @Output() closeMobile = new EventEmitter<void>();

  readonly roomsService = inject(RoomsService, { optional: true });
  readonly roomsCount = computed(() => (this.roomsService ? this.roomsService.rooms().length : 12));
  private readonly moduleConfig = inject(ModuleConfigService, { optional: true });

  readonly navItems: NavItem[] = [
    { path: '/tableau-de-bord', label: 'Tableau de bord', icon: 'dashboard' },
    { path: '/planning', label: 'Planning', icon: 'calendar_month' },
    { path: '/chambres', label: 'Chambres', icon: 'meeting_room' },
    { path: '/clients', label: 'Clients', icon: 'people' },
    { path: '/facturation', label: 'Facturation & Caisse', icon: 'receipt_long' },
    { path: '/restaurant', label: 'Restaurant & Bar', icon: 'restaurant' },
    { path: '/stocks', label: 'Stocks & Économat', icon: 'inventory_2' },
    { path: '/maintenance', label: 'Maintenance', icon: 'build' },
    { path: '/housekeeping', label: 'Housekeeping', icon: 'cleaning_services' },
    { path: '/parametres', label: 'Paramètres', icon: 'settings' },
  ];

  readonly activeMenuItems =
    this.moduleConfig?.menuItems ||
    signal(
      this.navItems.slice(0, 6).map((i) => ({
        id: i.path.replace('/', ''),
        route: i.path,
        label: i.label,
        icon: i.icon,
      })),
    );
}
