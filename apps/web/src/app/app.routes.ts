import { Routes } from '@angular/router';
import { moduleCanMatch } from './core/guards/module-match.guard';
import { authGuard } from './core/guards/auth.guard';
import { notFoundCanMatch } from './core/guards/not-found.guard';

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
    path: 'changer-mot-de-passe',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/administration/changer-mot-de-passe-page.component').then(
        (m) => m.ChangerMotDePassePageComponent,
      ),
  },
  {
    path: 'administration/comptes/nouveau',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/administration/administration-compte-form-page.component').then(
        (m) => m.AdministrationCompteFormPageComponent,
      ),
  },
  {
    path: 'administration/comptes/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/administration/administration-compte-form-page.component').then(
        (m) => m.AdministrationCompteFormPageComponent,
      ),
  },
  {
    path: 'administration/comptes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/administration/administration-liste-comptes-page.component').then(
        (m) => m.AdministrationListeComptesPageComponent,
      ),
  },
  {
    path: 'administration/tarifs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/administration/administration-tarifs-page.component').then(
        (m) => m.AdministrationTarifsPageComponent,
      ),
  },
  {
    path: 'administration/directeur',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/administration/administration-directeur-page.component').then(
        (m) => m.AdministrationDirecteurPageComponent,
      ),
  },
  {
    path: 'administration',
    pathMatch: 'full',
    redirectTo: 'administration/comptes',
  },
  {
    path: 'accueil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
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
    path: 'restaurant/carte',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./restaurant-v3/components/carte-admin-page.component').then(
        (m) => m.CarteAdminPageComponent,
      ),
  },
  {
    path: 'restaurant',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./restaurant-v3/components/restaurant-pos-page.component').then(
        (m) => m.RestaurantPosPageComponent,
      ),
  },
  {
    path: 'cuisine',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./restaurant-v3/components/cuisine-ecran-page.component').then(
        (m) => m.CuisineEcranPageComponent,
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
    path: 'rapports',
    canActivate: [authGuard],
    canMatch: [moduleCanMatch('rapports')],
    loadComponent: () =>
      import('./features/rapports/rapports-page.component').then(
        (m) => m.RapportsPageComponent,
      ),
  },
  {
    path: 'exports',
    pathMatch: 'full',
    redirectTo: 'accueil',
  },
  {
    path: 'parametres',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/administration/pages/hotel-settings-page/hotel-settings-page.component').then(
        (m) => m.HotelSettingsPageComponent,
      ),
  },
  {
    path: '**',
    canMatch: [notFoundCanMatch],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
  },
];
