import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_KEY } from '../decorators/module.decorator';
import { ServerModuleConfigService } from '../services/server-module-config.service';

/**
 * RÈGLE D'ARCHITECTURE : Les routes des modules désactivés répondent 404 Not Found.
 * Elles ne sont pas seulement cachées côté interface.
 */
@Injectable()
export class ModuleStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleConfig: ServerModuleConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Vérification par décorateur @RequireModule('nom_module')
    const moduleId = this.reflector.getAllAndOverride<string>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (moduleId) {
      const isEnabled = this.moduleConfig.isModuleEnabled(moduleId);
      if (!isEnabled) {
        throw new NotFoundException(
          `Module « ${moduleId} » reporté ou désactivé dans la configuration de l'établissement (404 Not Found).`,
        );
      }
    }

    // 2. Vérification par chemin d'URL
    const request = context.switchToHttp().getRequest();
    const url = request?.url || '';
    if (!this.moduleConfig.isRouteEnabled(url)) {
      throw new NotFoundException(
        `La ressource demandée correspond à un module reporté (404 Not Found).`,
      );
    }

    return true;
  }
}
