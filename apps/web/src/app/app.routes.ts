import { Routes } from '@angular/router';
import { moduleCanMatch } from './core/guards/module-match.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tableau-de-bord'
  },
  {
    path: 'connexion',
    loadComponent: () =>
      import('./features/connexion/connexion-page.component').then((m) => m.ConnexionPageComponent)
  },
  {
    path: 'tableau-de-bord',
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: 'planning',
    loadComponent: () =>
      import('./features/planning/planning-page.component').then((m) => m.PlanningPageComponent)
  },
  {
    path: 'chambres',
    loadComponent: () =>
      import('./features/rooms/rooms.component').then((m) => m.RoomsComponent)
  },
  {
    path: 'clients/:id',
    loadComponent: () =>
      import('./features/clients/client-profile-page.component').then(
        (m) => m.ClientProfilePageComponent
      )
  },
  {
    path: 'clients',
    redirectTo: 'clients/c1',
    pathMatch: 'full'
  },
  {
    path: 'restaurant',
    loadComponent: () =>
      import('./features/restaurant/restaurant-page.component').then(
        (m) => m.RestaurantPageComponent
      )
  },
  {
    path: 'cuisine',
    loadComponent: () =>
      import('./features/restaurant/kitchen-screen/kitchen-screen.component').then(
        (m) => m.KitchenScreenComponent
      )
  },
  {
    path: 'facturation/:id',
    loadComponent: () =>
      import('./features/facturation/facturation-page.component').then(
        (m) => m.FacturationPageComponent
      )
  },
  {
    path: 'facturation',
    loadComponent: () =>
      import('./features/facturation/facturation-page.component').then(
        (m) => m.FacturationPageComponent
      )
  },
  {
    path: 'exports',
    loadComponent: () =>
      import('./features/exports/exports-page.component').then(
        (m) => m.ExportsPageComponent
      )
  },
  // Modules reportés V2/V3 (protégés par canMatch pour empêcher le téléchargement de code)
  {
    path: 'housekeeping',
    canMatch: [moduleCanMatch('housekeeping')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: 'maintenance',
    canMatch: [moduleCanMatch('maintenance')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: 'stocks',
    canMatch: [moduleCanMatch('inventory')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: 'parametres',
    canMatch: [moduleCanMatch('parametres')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: 'marketing',
    canMatch: [moduleCanMatch('marketing_crm')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: 'channel-manager',
    canMatch: [moduleCanMatch('channel_manager')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: 'comptabilite',
    canMatch: [moduleCanMatch('accounting')],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: '**',
    redirectTo: 'tableau-de-bord'
  }
];
