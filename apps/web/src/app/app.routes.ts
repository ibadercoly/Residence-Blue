import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tableau-de-bord'
  },
  {
    path: 'tableau-de-bord',
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        m => m.DashboardPageComponent
      )
  },
  {
    path: 'chambres',
    loadComponent: () =>
      import('./features/rooms/rooms.component').then(m => m.RoomsComponent)
  },
  {
    path: '**',
    redirectTo: 'tableau-de-bord'
  }
];
