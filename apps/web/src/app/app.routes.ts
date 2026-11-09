import { Routes } from '@angular/router';
import { DashboardPageComponent } from './features/dashboard/pages/dashboard-page/dashboard-page.component';
import { RoomsComponent } from './features/rooms/rooms.component';
import { ConnexionPageComponent } from './features/connexion/connexion-page.component';
import { PlanningPageComponent } from './features/planning/planning-page.component';
import { ClientProfilePageComponent } from './features/clients/client-profile-page.component';
import { FacturationPageComponent } from './features/facturation/facturation-page.component';
import { RestaurantPageComponent } from './features/restaurant/restaurant-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tableau-de-bord'
  },
  {
    path: 'connexion',
    component: ConnexionPageComponent
  },
  {
    path: 'tableau-de-bord',
    component: DashboardPageComponent
  },
  {
    path: 'planning',
    component: PlanningPageComponent
  },
  {
    path: 'chambres',
    component: RoomsComponent
  },
  {
    path: 'clients/:id',
    component: ClientProfilePageComponent
  },
  {
    path: 'clients',
    redirectTo: 'clients/c1',
    pathMatch: 'full'
  },
  {
    path: 'restaurant',
    component: RestaurantPageComponent
  },
  {
    path: 'housekeeping',
    component: DashboardPageComponent
  },
  {
    path: 'maintenance',
    component: DashboardPageComponent
  },
  {
    path: 'facturation/:id',
    component: FacturationPageComponent
  },
  {
    path: 'facturation',
    component: FacturationPageComponent
  },
  {
    path: 'rapports',
    component: DashboardPageComponent
  },
  {
    path: 'parametres',
    component: DashboardPageComponent
  },
  {
    path: 'reservations',
    component: DashboardPageComponent
  },
  {
    path: 'reservations/nouvelle',
    component: DashboardPageComponent
  },
  {
    path: '**',
    redirectTo: 'tableau-de-bord'
  }
];
