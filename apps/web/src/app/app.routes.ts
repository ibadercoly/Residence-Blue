import { Routes } from '@angular/router';
import { moduleCanMatch } from './core/guards/module-match.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tableau-de-bord',
  },
  {
    path: 'connexion',
    loadComponent: () =>
      import('./features/connexion/connexion-page.component').then((m) => m.ConnexionPageComponent),
  },
  {
    path: 'tableau-de-bord',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: 'planning',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/planning/planning-page.component').then((m) => m.PlanningPageComponent),
  },
  {
    path: 'chambres',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/rooms/rooms.component').then((m) => m.RoomsComponent),
  },
  {
    path: 'clients/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/clients/clients-page.component').then((m) => m.ClientsPageComponent),
  },
  {
    path: 'clients',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/clients/clients-page.component').then((m) => m.ClientsPageComponent),
  },
  {
    path: 'restaurant',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/restaurant/restaurant-page.component').then(
        (m) => m.RestaurantPageComponent,
      ),
  },
  {
    path: 'cuisine',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/restaurant/kitchen-screen/kitchen-screen.component').then(
        (m) => m.KitchenScreenComponent,
      ),
  },
  {
    path: 'facturation/archives',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./facturation-v3/components/archives-page.component').then(
        (m) => m.ArchivesPageComponent,
      ),
  },
  {
    path: 'facturation/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./facturation-v3/components/note-sejour-page.component').then(
        (m) => m.NoteSejourPageComponent,
      ),
  },
  {
    path: 'facturation',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./facturation-v3/components/comptoir-page.component').then(
        (m) => m.ComptoirPageComponent,
      ),
  },
  {
    path: 'exports',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/exports/exports-page.component').then((m) => m.ExportsPageComponent),
  },
  // Modules reportés V2/V3 (protégés par canMatch et authGuard)
  {
    path: 'housekeeping',
    canActivate: [authGuard],
    canMatch: [moduleCanMatch('housekeeping')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: 'maintenance',
    canActivate: [authGuard],
    canMatch: [moduleCanMatch('maintenance')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: 'stocks',
    canActivate: [authGuard],
    canMatch: [moduleCanMatch('inventory')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: 'parametres',
    canActivate: [authGuard],
    canMatch: [moduleCanMatch('parametres')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: 'marketing',
    canActivate: [authGuard],
    canMatch: [moduleCanMatch('marketing_crm')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: 'channel-manager',
    canActivate: [authGuard],
    canMatch: [moduleCanMatch('channel_manager')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: 'comptabilite',
    canActivate: [authGuard],
    canMatch: [moduleCanMatch('accounting')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'tableau-de-bord',
  },
];
