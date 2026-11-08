import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside
      class="fixed left-0 top-0 h-full w-64 bg-inverse-surface z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
      aria-label="Navigation principale"
    >
      <div class="flex flex-col">
        <!-- Brand Header -->
        <div class="h-20 flex items-center gap-space-md px-gutter">
          <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span class="material-symbols-outlined text-[24px]">tsunami</span>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <span class="font-headline-sm text-headline-sm text-surface-bright tracking-tight truncate leading-tight">
              Résidence Blue
            </span>
            <span class="font-label-md text-label-md text-outline-variant uppercase tracking-wider truncate">
              Hôtel Boutique • Grand Standing, Thiès
            </span>
          </div>
        </div>

        <!-- Section Navigation -->
        <div class="px-space-md py-space-sm">
          <div class="px-space-md py-space-xs mb-space-xs font-label-md text-label-md text-outline-variant uppercase tracking-wider">
            Exploitation 12 Clés
          </div>
          <nav class="flex flex-col gap-space-xs">
            @for (item of navItems; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-primary text-on-primary font-title-md"
                [routerLinkActiveOptions]="{ exact: item.path === '/tableau-de-bord' }"
                class="flex items-center gap-space-md px-space-md py-space-sm rounded-lg text-surface-container-high hover:bg-surface-variant/20 hover:text-surface-bright transition-colors font-title-md text-title-md"
              >
                <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
        </div>
      </div>

      <!-- Ambiance / Météo footer widget -->
      <div class="p-gutter">
        <div class="bg-surface-variant/10 rounded-xl p-space-md flex items-center justify-between">
          <div class="flex flex-col">
            <span class="font-label-md text-label-md text-surface-container-high">Front de Mer</span>
            <span class="font-body-sm text-body-sm text-outline-variant">Marée haute • 28°C</span>
          </div>
          <span class="material-symbols-outlined text-primary-fixed-dim text-[20px]">wb_sunny</span>
        </div>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  readonly navItems: NavItem[] = [
    { path: '/tableau-de-bord', label: 'Tableau de bord', icon: 'dashboard' },
    { path: '/planning', label: 'Planning', icon: 'calendar_month' },
    { path: '/chambres', label: 'Chambres', icon: 'bed' },
    { path: '/clients', label: 'Clients', icon: 'group' },
    { path: '/restaurant', label: 'Restaurant', icon: 'restaurant' },
    { path: '/housekeeping', label: 'Housekeeping', icon: 'cleaning_services' },
    { path: '/maintenance', label: 'Maintenance', icon: 'build' },
    { path: '/facturation', label: 'Facturation', icon: 'receipt_long' },
    { path: '/rapports', label: 'Rapports', icon: 'analytics' },
    { path: '/parametres', label: 'Paramètres', icon: 'settings' }
  ];
}
