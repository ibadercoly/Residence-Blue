import { SetMetadata } from '@nestjs/common';
import { AccessLevel, ScreenKey, SpecialPermissionKey } from '@residence-blue/shared';

export const ACCES_KEY = 'acces_requirement';

export interface AccesRequirement {
  screen?: ScreenKey;
  level?: Exclude<AccessLevel, 'AUCUN'>;
  anyScreens?: Array<{ screen: ScreenKey; level?: Exclude<AccessLevel, 'AUCUN'> }>;
  allScreens?: Array<{ screen: ScreenKey; level?: Exclude<AccessLevel, 'AUCUN'> }>;
  specialPermission?: SpecialPermissionKey;
  directorOnly?: boolean;
  allowAuthenticated?: boolean;
}

/**
 * Décorateur serveur de contrôle d'accès par écran / droit particulier / directeur unique.
 * Exemple : @Acces('planning', 'ECRITURE') ou @Acces({ specialPermission: 'encaisser_paiement' })
 */
export function Acces(
  screenOrOptions: ScreenKey | AccesRequirement,
  level: Exclude<AccessLevel, 'AUCUN'> = 'LECTURE',
) {
  const metadata: AccesRequirement =
    typeof screenOrOptions === 'string'
      ? { screen: screenOrOptions, level }
      : screenOrOptions;
  return SetMetadata(ACCES_KEY, metadata);
}
