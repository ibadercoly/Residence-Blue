import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  hasScreenAccess,
  hasSpecialPermission,
  isDirectorAccount,
} from '@residence-blue/shared';
import {
  ACCES_KEY,
  AccesRequirement,
} from '../decorators/acces.decorator';
import {
  ALLOW_DEFERRED_ROLES_KEY,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from '../decorators/roles.decorator';
import { ServerModuleConfigService } from '../services/server-module-config.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly moduleConfig?: ServerModuleConfigService,
  ) {}

  private normalizeRole(role: string): string {
    if (role === 'ADMIN' || role === 'MANAGER') return 'DIRECTION';
    if (role === 'RECEPTIONIST') return 'RECEPTION';
    if (role === 'RESTAURANT_STAFF') return 'RESTAURANT';
    return role;
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user || !user.role) {
      throw new UnauthorizedException('Authentification requise.');
    }

    const accesRequirement = this.reflector.getAllAndOverride<AccesRequirement | undefined>(
      ACCES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Accès refusé par défaut : toute route protégée doit déclarer @Acces(...) ou @Roles(...)
    if (!accesRequirement && (!requiredRoles || requiredRoles.length === 0)) {
      throw new ForbiddenException(
        'Accès refusé par défaut : cette route ne déclare aucun contrôle d’accès.',
      );
    }

    // Changement obligatoire du mot de passe provisoire avant tout accès métier
    const reqUrl = String(request?.originalUrl ?? request?.url ?? '');
    const isAuthUtilityRoute =
      reqUrl.startsWith('/api/auth/me') ||
      reqUrl.startsWith('/api/auth/logout') ||
      reqUrl.startsWith('/api/auth/refresh') ||
      reqUrl.startsWith('/api/auth/change-initial-password');

    if (user.mustChangePassword && !isAuthUtilityRoute) {
      throw new ForbiddenException(
        'Vous devez d’abord choisir un nouveau mot de passe personnel.',
      );
    }

    const userRole = this.normalizeRole(user.role);
    const allowDeferredRoles = this.reflector.getAllAndOverride<boolean>(
      ALLOW_DEFERRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (accesRequirement) {
      if (accesRequirement.allowAuthenticated) {
        return true;
      }

      if (accesRequirement.directorOnly) {
        if (!isDirectorAccount(user)) {
          throw new ForbiddenException(
            'Accès réservé au compte directeur.',
          );
        }
        return true;
      }

      if (accesRequirement.screen) {
        const needed = accesRequirement.level ?? 'LECTURE';
        if (!hasScreenAccess(user, accesRequirement.screen, needed)) {
          throw new ForbiddenException(
            'Vous n’avez pas l’autorisation d’accéder à cet écran.',
          );
        }
      }

      if (accesRequirement.anyScreens && accesRequirement.anyScreens.length > 0) {
        const anyAllowed = accesRequirement.anyScreens.some((req) =>
          hasScreenAccess(user, req.screen, req.level ?? 'LECTURE'),
        );
        if (!anyAllowed) {
          throw new ForbiddenException(
            'Vous n’avez pas l’autorisation d’accéder à cette ressource.',
          );
        }
      }

      if (accesRequirement.allScreens && accesRequirement.allScreens.length > 0) {
        const allAllowed = accesRequirement.allScreens.every((req) =>
          hasScreenAccess(user, req.screen, req.level ?? 'LECTURE'),
        );
        if (!allAllowed) {
          throw new ForbiddenException(
            'Vous n’avez pas toutes les autorisations requises pour cette ressource.',
          );
        }
      }

      if (accesRequirement.specialPermission) {
        if (!hasSpecialPermission(user, accesRequirement.specialPermission)) {
          throw new ForbiddenException(
            'Vous n’avez pas l’autorisation pour cette action.',
          );
        }
      }

      if (
        !user.hasExplicitAccess &&
        !allowDeferredRoles &&
        this.moduleConfig &&
        !this.moduleConfig.isRoleEnabled(userRole)
      ) {
        throw new ForbiddenException(
          `Accès refusé : le rôle « ${userRole} » est désactivé ou reporté en version ultérieure dans la configuration de l'établissement.`,
        );
      }

      return true;
    }

    if (!allowDeferredRoles && this.moduleConfig && !this.moduleConfig.isRoleEnabled(userRole)) {
      throw new ForbiddenException(
        `Accès refusé : le rôle « ${userRole} » est désactivé ou reporté en version ultérieure dans la configuration de l'établissement.`,
      );
    }

    const normalizedRequired = (requiredRoles ?? []).map((r) => this.normalizeRole(r));
    if (!normalizedRequired.includes(userRole)) {
      throw new ForbiddenException(
        `Accès refusé : le rôle « ${userRole} » n'est pas autorisé sur cette ressource.`,
      );
    }

    return true;
  }
}
