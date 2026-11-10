import { inject } from '@angular/core';
import { CanMatchFn, Route, UrlSegment } from '@angular/router';
import { ModuleConfigService } from '../services/module-config.service';

/**
 * Garde canMatch qui empêche totalement le chargement et la résolution d'une route
 * si le module correspondant est désactivé dans config/modules.json.
 */
export function moduleCanMatch(moduleId: string): CanMatchFn {
  return (_route: Route, _segments: UrlSegment[]) => {
    const configService = inject(ModuleConfigService);
    return configService.isModuleEnabled(moduleId);
  };
}
