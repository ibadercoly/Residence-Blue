import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_DEFERRED_ROLES_KEY, IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/roles.decorator';
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

    // Accès refusé par défaut : toute route protégée doit déclarer @Roles(...)
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'Accès refusé par défaut : cette route ne déclare aucun rôle autorisé.',
      );
    }

    const userRole = this.normalizeRole(user.role);

    const allowDeferredRoles = this.reflector.getAllAndOverride<boolean>(
      ALLOW_DEFERRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowDeferredRoles && this.moduleConfig && !this.moduleConfig.isRoleEnabled(userRole)) {
      throw new ForbiddenException(
        `Accès refusé : le rôle « ${userRole} » est désactivé ou reporté en version ultérieure dans la configuration de l'établissement.`,
      );
    }

    const normalizedRequired = requiredRoles.map((r) => this.normalizeRole(r));
    if (!normalizedRequired.includes(userRole)) {
      throw new ForbiddenException(
        `Accès refusé : le rôle « ${userRole} » n'est pas autorisé sur cette ressource.`,
      );
    }

    return true;
  }
}
