import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { isKitchenOnlyRole } from '@residence-blue/shared';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const checkRoleAccess = () => {
    const role = authService.currentRole();
    if (isKitchenOnlyRole(role) && !state.url.startsWith('/cuisine')) {
      return router.createUrlTree(['/cuisine']);
    }
    if (state.url.startsWith('/cuisine') && role !== 'DIRECTION' && !isKitchenOnlyRole(role)) {
      return router.createUrlTree(['/restaurant']);
    }
    return true;
  };

  if (authService.isAuthenticated()) {
    return checkRoleAccess();
  }

  const restored = await authService.bootstrapSession();
  if (restored && authService.isAuthenticated()) {
    return checkRoleAccess();
  }

  return router.createUrlTree(['/connexion']);
};
