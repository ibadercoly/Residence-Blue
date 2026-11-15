import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { RoomsService } from '../../../core/services/rooms.service';
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
  styles: [
    `
      .rb-sidebar-aside {
        width: 272px;
        max-width: 85vw;
      }

      .rb-sidebar-scroll {
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
      }

      .rb-sidebar-scroll::-webkit-scrollbar {
        display: block;
        width: 6px;
      }

      .rb-sidebar-scroll::-webkit-scrollbar-track {
        background: transparent;
      }

      .rb-sidebar-scroll::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.35);
        border-radius: 9999px;
      }

      .rb-sidebar-heading {
        font-size: 13px;
        line-height: 1.25;
        letter-spacing: 0.08em;
      }

      .rb-sidebar-nav {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .rb-sidebar-link {
        display: flex;
        align-items: center;
        gap: 16px;
        width: 100%;
        height: 56px;
        min-height: 56px;
        padding: 0 16px;
        border-radius: 14px;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 500;
        text-decoration: none;
        white-space: nowrap;
        transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease;
      }

      .rb-sidebar-link.rb-sidebar-link-active {
        font-weight: 600;
      }

      .rb-sidebar-link:focus-visible {
        outline: 2px solid #9ef0f8;
        outline-offset: 2px;
      }

      .rb-sidebar-icon {
        font-size: var(--icone-menu, 26px);
        width: var(--icone-menu, 26px);
        height: var(--icone-menu, 26px);
        line-height: 1;
        color: currentColor;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .rb-sidebar-label {
        font-size: 18px;
        line-height: 1.2;
        white-space: nowrap;
      }
    `,
  ],
  template: `
    <!-- Backdrop mobile (< 900 px) -->
    @if (mobileOpen) {
      <div
        class="fixed inset-0 z-40 bg-black/45 min-[900px]:hidden"
        data-testid="sidebar-backdrop"
        aria-hidden="true"
        (click)="closeMobile.emit()"
      ></div>
    }

    <aside
      data-testid="app-sidebar-aside"
      [class]="
        'rb-sidebar-aside fixed left-0 top-0 h-dvh bg-inverse-surface z-50 flex flex-col shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-transform duration-200 min-[900px]:translate-x-0 ' +
        (mobileOpen ? 'translate-x-0' : '-translate-x-full')
      "
      aria-label="Navigation principale"
    >
      <!-- Brand Header (fixe en haut, espace aéré sous le logo) -->
      <div class="shrink-0 flex items-center justify-between gap-2 px-4 pt-5 pb-5">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">hotel</span>
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

        <!-- Bouton fermer sur mobile (< 900 px) -->
        <button
          type="button"
          class="min-[900px]:hidden w-10 h-10 rounded-xl text-surface-container-high hover:bg-surface-variant/20 flex items-center justify-center shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-fixed"
          aria-label="Fermer le menu"
          data-testid="sidebar-close-mobile"
          (click)="closeMobile.emit()"
        >
          <span class="material-symbols-outlined text-[24px]" aria-hidden="true">close</span>
        </button>
      </div>

      <!-- Titre de section (13 px) -->
      <div class="shrink-0 px-4 mb-2">
        <div
          class="rb-sidebar-heading px-4 font-semibold text-outline-variant uppercase"
          data-testid="sidebar-section-title"
        >
          Menu Principal
        </div>
      </div>

      <!-- Liste du menu (défile verticalement si hauteur < 720 px, jamais de scroll horizontal) -->
      <div
        class="rb-sidebar-scroll flex-1 min-h-0 px-4 pb-2"
        data-testid="sidebar-scroll-container"
      >
        <nav class="rb-sidebar-nav" data-testid="sidebar-nav">
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
                rla.isActive
                  ? 'rb-sidebar-link rb-sidebar-link-active bg-primary text-on-primary shadow-sm'
                  : 'rb-sidebar-link text-surface-container-high hover:bg-surface-variant/20 hover:text-surface-bright'
              "
            >
              <span class="material-symbols-outlined rb-sidebar-icon" aria-hidden="true">{{ item.icon }}</span>
              <span class="rb-sidebar-label">{{ item.label }}</span>
            </a>
          }
        </nav>
      </div>

      <!-- Bloc Version fixe en bas (ne chevauche jamais le menu) -->
      <div class="shrink-0 px-4 py-3" data-testid="sidebar-version-block">
        <div class="bg-surface-variant/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <div class="flex flex-col min-w-0">
            <span class="font-label-md text-label-md text-surface-container-high">Version 1.0</span>
            <span class="font-body-sm text-[11px] text-outline-variant truncate">Légère &bull; {{ roomsCount() }} Chambres</span>
          </div>
          <span class="material-symbols-outlined text-primary-fixed-dim text-[20px] shrink-0" aria-hidden="true">speed</span>
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
