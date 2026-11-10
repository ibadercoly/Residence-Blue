import { inject } from '@angular/core';
import { HttpEvent, HttpHandlerFn, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ModuleConfigService } from '../services/module-config.service';

const DEFERRED_API_PREFIXES: Record<string, string> = {
  '/api/housekeeping': 'housekeeping',
  '/api/maintenance': 'maintenance',
  '/api/inventory': 'inventory',
  '/api/stocks': 'inventory',
  '/api/settings': 'parametres',
  '/api/parametres': 'parametres',
  '/api/marketing': 'marketing_crm',
  '/api/channel-manager': 'channel_manager',
  '/api/accounting': 'accounting',
  '/api/comptabilite': 'accounting',
};

/**
 * Intercepteur HTTP qui empêche toute requête réseau sortante vers l'API
 * pour un module reporté / désactivé dans config/modules.json.
 * RÈGLE : « Quand l'interrupteur est à false : aucune requête API n'est faite ».
 */
export const moduleBlockerInterceptor = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const config = inject(ModuleConfigService, { optional: true });
  if (!config) {
    return next(req);
  }

  const url = req.url.toLowerCase();

  for (const [prefix, moduleId] of Object.entries(DEFERRED_API_PREFIXES)) {
    if (url.includes(prefix) && !config.isModuleEnabled(moduleId)) {
      console.warn(`[ModuleBlocker] Requête HTTP bloquée côté client : le module « ${moduleId} » est reporté.`);
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            statusText: 'Not Found (Module Disabled)',
            url: req.url,
            error: {
              statusCode: 404,
              message: `Le module ${moduleId} est reporté et désactivé en V1. Aucune requête réseau n'est émise.`,
            },
          })
      );
    }
  }

  return next(req);
};
