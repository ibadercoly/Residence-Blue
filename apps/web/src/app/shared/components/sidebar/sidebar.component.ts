import { Component, inject, signal } from '@angular/core';
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
    <aside
      class="fixed left-0 top-0 h-full w-64 bg-inverse-surface z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
      aria-label="Navigation principale"
    >
      <div class="flex flex-col">
        <!-- Brand Header -->
        <div class="h-20 flex items-center gap-space-md px-gutter">
          <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span class="material-symbols-outlined text-[24px]">hotel</span>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <span class="font-headline-sm text-headline-sm text-surface-bright tracking-tight truncate leading-tight">
              Résidence Blue
            </span>
            <span class="font-label-md text-label-md text-outline-variant uppercase tracking-wider truncate">
              Hôtel 12 Clés &bull; Thiès
            </span>
          </div>
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
                [routerLinkActiveOptions]="{ exact: item.route === '/tableau-de-bord' || item.route === '/' }"
                [attr.aria-current]="rla.isActive ? 'page' : null"
                [attr.data-testid]="'nav-' + item.id"
                [class]="rla.isActive
                  ? 'flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-colors bg-primary text-on-primary font-title-md'
                  : 'flex items-center gap-space-md px-space-md py-space-sm rounded-lg text-surface-container-high hover:bg-surface-variant/20 hover:text-surface-bright transition-colors font-title-md text-title-md'"
              >
                <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
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
            <span class="font-body-sm text-[11px] text-outline-variant">Légère &bull; 12 Chambres</span>
          </div>
          <span class="material-symbols-outlined text-primary-fixed-dim text-[20px]">speed</span>
        </div>
      </div>
    </aside>
  `
})
export class SidebarComponent {
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

  readonly activeMenuItems = this.moduleConfig?.menuItems || signal(
    this.navItems.slice(0, 6).map(i => ({
      id: i.path.replace('/', ''),
      route: i.path,
      label: i.label,
      icon: i.icon
    }))
  );
}
