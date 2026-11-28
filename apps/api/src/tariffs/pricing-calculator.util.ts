import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  TariffCategoryCode,
  UNCLASSIFIED_ROOM_CATEGORY,
  getTariffCategoryDisplayName,
  normalizeTariffCategoryCode,
} from '@residence-blue/shared';

export interface TariffLookupRow {
  id: string;
  categoryCode: string;
  categoryName: string;
  guestsCount: number;
  roomsUsed: number | null;
  label: string;
  pricePerNightFcfa: number | null;
  isActive: boolean;
}

export interface DirectorPriceOverrideInput {
  pricePerNightFcfa: number;
  reason: string;
  actorRole: string;
}

export interface CalculateStayPriceInput {
  categoryCode: string | null | undefined;
  categoryName?: string | null;
  guestsCount: number;
  roomsUsed?: number | null;
  nights: number;
  breakfastIncluded?: boolean;
  tariffs: readonly TariffLookupRow[];
  directorOverride?: DirectorPriceOverrideInput | null;
}

export interface CalculateStayPriceResult {
  categoryCode: TariffCategoryCode | string | null;
  categoryName: string;
  guestsCount: number;
  roomsUsed: number;
  nights: number;
  ratePerNightFcfa: number;
  accommodationTotalFcfa: number;
  tariffId: string | null;
  tariffLabel: string;
  summaryLine: string;
  priceOverriddenByDirector: boolean;
  priceOverrideReason: string | null;
}

export function formatFcfaSpaces(amount: number): string {
  const safe = Math.round(amount);
  return String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatTariffSummaryLine(params: {
  categoryName: string;
  categoryCode: string | null;
  guestsCount: number;
  roomsUsed: number;
  nights: number;
  ratePerNightFcfa: number;
  accommodationTotalFcfa: number;
  breakfastIncluded?: boolean;
}): string {
  const isApartment = params.categoryCode === 'APPARTEMENT';
  const unitPrefix = isApartment
    ? `Appartement`
    : `Chambre ${params.categoryName}`;
  const personsPart = `${params.guestsCount} ${params.guestsCount > 1 ? 'personnes' : 'personne'}`;
  const roomsPart = isApartment
    ? `, ${params.roomsUsed} ${params.roomsUsed > 1 ? 'chambres' : 'chambre'}`
    : '';
  const breakfastPart =
    params.breakfastIncluded === false ? '' : ', petit-déjeuner inclus';
  const nightsPart = `${params.nights} ${params.nights > 1 ? 'nuits' : 'nuit'}`;

  return `${unitPrefix}, ${personsPart}${roomsPart}${breakfastPart} : ${formatFcfaSpaces(params.ratePerNightFcfa)} FCFA par nuit, total ${formatFcfaSpaces(params.accommodationTotalFcfa)} FCFA pour ${nightsPart}`;
}

/**
 * Fonction unique et autoritaire de calcul du prix d'hébergement côté serveur.
 * RÈGLES STRICTES :
 * - Tous les montants sont en ENTIERS FCFA.
 * - Ne retourne JAMAIS un prix par défaut ni un prix inventé pour une case non proposée / non définie.
 * - La surcharge manuelle de prix est strictement réservée à la DIRECTION avec motif obligatoire.
 */
export function calculateStayPrice(
  input: CalculateStayPriceInput,
): CalculateStayPriceResult {
  const nights = Math.round(Number(input.nights));
  if (!Number.isInteger(nights) || nights < 1) {
    throw new BadRequestException('Le nombre de nuits doit être un entier supérieur ou égal à 1.');
  }

  const guestsCount = Math.round(Number(input.guestsCount));
  if (!Number.isInteger(guestsCount) || guestsCount < 1) {
    throw new BadRequestException('Le nombre de personnes doit être un entier supérieur ou égal à 1.');
  }

  const normalizedCode = normalizeTariffCategoryCode(input.categoryCode || input.categoryName);
  const categoryName = normalizedCode
    ? getTariffCategoryDisplayName(normalizedCode)
    : (input.categoryName || '').trim() || UNCLASSIFIED_ROOM_CATEGORY;

  const isApartment = normalizedCode === 'APPARTEMENT';
  const roomsUsed = isApartment ? Math.round(Number(input.roomsUsed ?? 1)) : 1;
  if (!Number.isInteger(roomsUsed) || roomsUsed < 1 || roomsUsed > 3) {
    throw new BadRequestException(
      'Le nombre de chambres utilisées doit être compris entre 1 et 3.',
    );
  }

  // Cas 1 : Prix négocié fixé manuellement par la DIRECTION (avec motif obligatoire)
  if (input.directorOverride) {
    const role = (input.directorOverride.actorRole || '').toUpperCase();
    if (role !== 'DIRECTION' && role !== 'ADMIN' && role !== 'MANAGER') {
      throw new ForbiddenException(
        'La modification manuelle du tarif de réservation est réservée à la direction.',
      );
    }
    const reason = (input.directorOverride.reason || '').trim();
    if (reason.length < 3) {
      throw new BadRequestException(
        'Un motif obligatoire (au moins 3 caractères) est requis lorsque la direction fixe un prix manuel.',
      );
    }
    const manualRate = Number(input.directorOverride.pricePerNightFcfa);
    if (!Number.isInteger(manualRate) || manualRate <= 0) {
      throw new BadRequestException(
        'Le prix manuel par nuit doit être un montant entier positif en FCFA.',
      );
    }

    const accommodationTotalFcfa = manualRate * nights;
    const summaryLine = formatTariffSummaryLine({
      categoryName,
      categoryCode: normalizedCode,
      guestsCount,
      roomsUsed,
      nights,
      ratePerNightFcfa: manualRate,
      accommodationTotalFcfa,
      breakfastIncluded: input.breakfastIncluded,
    });

    return {
      categoryCode: normalizedCode,
      categoryName,
      guestsCount,
      roomsUsed,
      nights,
      ratePerNightFcfa: manualRate,
      accommodationTotalFcfa,
      tariffId: null,
      tariffLabel: 'Prix fixé par la direction',
      summaryLine,
      priceOverriddenByDirector: true,
      priceOverrideReason: reason,
    };
  }

  // Cas 2 : Chambre non classée (« À classer ») -> refus strict, jamais de tarif par défaut
  if (!normalizedCode) {
    throw new BadRequestException(
      "Cette chambre n'est pas encore classée (À classer). Demandez à la direction de définir sa catégorie avant de réserver.",
    );
  }

  const activeCategoryRows = input.tariffs.filter(
    (t) =>
      t.isActive &&
      normalizeTariffCategoryCode(t.categoryCode || t.categoryName) === normalizedCode,
  );

  // Recherche exacte : pour Appartement, priorité à (guestsCount, roomsUsed), puis (guestsCount, null) pour 5/6 pers
  let matched: TariffLookupRow | undefined;
  if (isApartment) {
    matched =
      activeCategoryRows.find(
        (t) => t.guestsCount === guestsCount && t.roomsUsed === roomsUsed,
      ) ??
      activeCategoryRows.find(
        (t) => t.guestsCount === guestsCount && t.roomsUsed === null,
      );
  } else {
    matched = activeCategoryRows.find((t) => t.guestsCount === guestsCount);
  }

  // Case non proposée (aucune ligne active dans la grille)
  if (!matched) {
    const personWord = guestsCount > 1 ? 'personnes' : 'personne';
    if (isApartment) {
      const roomWord = roomsUsed > 1 ? 'chambres' : 'chambre';
      throw new BadRequestException(
        `Pas de tarif pour ${guestsCount} ${personWord} (${roomsUsed} ${roomWord}) en Appartement. Choisissez une autre formule ou demandez à la direction.`,
      );
    }
    throw new BadRequestException(
      `Pas de tarif pour ${guestsCount} ${personWord} en chambre ${categoryName}. Choisissez un appartement ou demandez à la direction.`,
    );
  }

  // Case « tarif non défini » (ligne existante avec pricePerNightFcfa = null)
  if (
    matched.pricePerNightFcfa === null ||
    matched.pricePerNightFcfa === undefined ||
    !Number.isInteger(matched.pricePerNightFcfa) ||
    matched.pricePerNightFcfa <= 0
  ) {
    const personWord = guestsCount > 1 ? 'personnes' : 'personne';
    const roomDetail = isApartment
      ? ` (${roomsUsed} ${roomsUsed > 1 ? 'chambres' : 'chambre'})`
      : '';
    throw new BadRequestException(
      `Tarif non défini pour ${guestsCount} ${personWord}${roomDetail} en ${isApartment ? 'Appartement' : `chambre ${categoryName}`}. Demandez à la direction de fixer ce tarif.`,
    );
  }

  const ratePerNightFcfa = matched.pricePerNightFcfa;
  const accommodationTotalFcfa = ratePerNightFcfa * nights;
  const summaryLine = formatTariffSummaryLine({
    categoryName,
    categoryCode: normalizedCode,
    guestsCount,
    roomsUsed,
    nights,
    ratePerNightFcfa,
    accommodationTotalFcfa,
    breakfastIncluded: input.breakfastIncluded,
  });

  return {
    categoryCode: normalizedCode,
    categoryName,
    guestsCount,
    roomsUsed,
    nights,
    ratePerNightFcfa,
    accommodationTotalFcfa,
    tariffId: matched.id,
    tariffLabel: matched.label,
    summaryLine,
    priceOverriddenByDirector: false,
    priceOverrideReason: null,
  };
}
