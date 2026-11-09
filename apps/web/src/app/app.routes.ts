import { Routes } from '@angular/router';

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
  // Modules reportés V2 (gardés dans le dépôt sans alourdir le bundle initial)
  {
    path: 'housekeeping',
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      )
  },
  {
    path: 'maintenance',
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
