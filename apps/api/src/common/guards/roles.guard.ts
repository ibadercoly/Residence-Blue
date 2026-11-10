import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@residence-blue/shared';
import { ServerModuleConfigService } from '../services/server-module-config.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Optional() private moduleConfig?: ServerModuleConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Vérifier si la route est marquée explicitement comme @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Vérifier les rôles autorisés sur la route
    const requiredRoles = this.reflector.getAllAndOverride<(UserRole | string)[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // RÈGLE SÉCURITÉ AGENTS.MD : « Accès refusé par défaut : chaque route déclare ses rôles autorisés »
    // Si la route n'a ni @Public() ni @Roles(), l'accès est strictement refusé !
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'Accès refusé par défaut : cette ressource ne déclare aucun rôle autorisé.',
      );
    }

    // 3. Récupérer l'utilisateur courant (injecté par l'authentification ou les headers de test)
    const request = context.switchToHttp().getRequest();
    const user =
      request.user ||
      (request.headers['x-user-role'] ? { role: request.headers['x-user-role'] } : null);

    if (!user || !user.role) {
      throw new ForbiddenException(
        'Authentification requise : aucun utilisateur ou rôle identifié.',
      );
    }

    // RÈGLE : Le rôle reporté (ex. HOUSEKEEPING, MAINTENANCE, COMPTABLE) ne peut pas être attribué ou utilisé si le module est inactif
    if (this.moduleConfig && !this.moduleConfig.isRoleEnabled(user.role)) {
      throw new ForbiddenException(
        `Le rôle ${user.role} est reporté en version ultérieure et ne peut pas être utilisé en V1.`,
      );
    }

    const normalizedRole =
      user.role === 'ADMIN' || user.role === 'MANAGER'
        ? 'DIRECTION'
        : user.role === 'RECEPTIONIST'
          ? 'RECEPTION'
          : user.role === 'RESTAURANT_STAFF'
            ? 'RESTAURANT'
            : user.role;

    const hasRole = requiredRoles.includes(user.role) || requiredRoles.includes(normalizedRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Rôle non autorisé (${user.role}). Rôles autorisés : ${requiredRoles.join(', ')}.`,
      );
    }

    return true;
  }
}
