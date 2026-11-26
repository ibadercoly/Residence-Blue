import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { ScreenKey, isKitchenAccount, isTechniqueAccount } from '@residence-blue/shared';
import { AuthService } from '../services/auth.service';

function resolveRequiredScreenForUrl(url: string): ScreenKey | null {
  if (url.startsWith('/tableau-de-bord') || url.startsWith('/accueil')) return 'accueil';
  if (url.startsWith('/planning')) return 'planning';
  if (url.startsWith('/chambres')) return 'chambres';
  if (url.startsWith('/clients')) return 'clients';
  if (url.startsWith('/facturation')) return 'facturation';
  if (url.startsWith('/restaurant')) return 'restaurant';
  if (url.startsWith('/cuisine')) return 'cuisine';
  if (url.startsWith('/technique')) return 'technique';
  if (url.startsWith('/rapports')) return 'rapports';
  return null;
}

export const authGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    const restored = await authService.bootstrapSession();
    if (!restored || !authService.isAuthenticated()) {
      return router.createUrlTree(['/connexion']);
    }
  } else {
    const stillValid = await authService.syncUserFromMe();
    if (!stillValid) {
      return router.createUrlTree(['/connexion']);
    }
  }

  const user = authService.currentUser();
  if (!user) {
    return router.createUrlTree(['/connexion']);
  }

  if (state.url.startsWith('/parametres') && !authService.isDirector()) {
    return router.createUrlTree([authService.getFirstAuthorizedRoute()]);
  }

  // Changement obligatoire du mot de passe provisoire avant tout autre écran
  if (user.mustChangePassword) {
    if (state.url.startsWith('/changer-mot-de-passe')) {
      return true;
    }
    return router.createUrlTree(['/changer-mot-de-passe']);
  }

  if (state.url.startsWith('/changer-mot-de-passe')) {
    return router.createUrlTree([authService.getFirstAuthorizedRoute()]);
  }

  // Le cuisinier n'accède qu'à /cuisine ; toute autre adresse le redirige vers /cuisine.
  if (isKitchenAccount(user) && !state.url.startsWith('/cuisine')) {
    return router.createUrlTree(['/cuisine']);
  }

  // Le technicien n'accède qu'à /technique ; toute autre adresse le redirige vers /technique.
  if (isTechniqueAccount(user) && !state.url.startsWith('/technique')) {
    return router.createUrlTree(['/technique']);
  }

  // L'écran Technique est réservé au compte Technique
  if (state.url.startsWith('/technique') && !isTechniqueAccount(user)) {
    return router.createUrlTree([authService.getFirstAuthorizedRoute()]);
  }

  // L'écran Administration est réservé au directeur ; le composant /administration
  // affiche lui-même une page 403 explicite pour les non-directeurs.
  if (state.url.startsWith('/administration')) {
    return true;
  }

  // Gestion de la carte restaurant réservée au directeur
  if (state.url.startsWith('/restaurant/carte') && !authService.isDirector()) {
    return router.createUrlTree([authService.getFirstAuthorizedRoute()]);
  }

  const requiredScreen = resolveRequiredScreenForUrl(state.url);
  if (requiredScreen && !authService.hasScreen(requiredScreen, 'LECTURE')) {
    return router.createUrlTree([authService.getFirstAuthorizedRoute()]);
  }

  return true;
};
