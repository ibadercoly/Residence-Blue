import { SetMetadata } from '@nestjs/common';

export const MODULE_KEY = 'module_id';

/**
 * Associe un contrôleur ou un endpoint à un identifiant de module.
 * Si le module est désactivé dans config/modules.json, le serveur répondra 404 Not Found.
 */
export const RequireModule = (moduleId: string) => SetMetadata(MODULE_KEY, moduleId);
