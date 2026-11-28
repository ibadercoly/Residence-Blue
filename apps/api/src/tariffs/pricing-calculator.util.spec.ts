import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { REAL_ROOM_TARIFFS } from '@residence-blue/shared';
import {
  TariffLookupRow,
  calculateStayPrice,
  formatTariffSummaryLine,
} from './pricing-calculator.util';

const buildRealTariffTable = (): TariffLookupRow[] =>
  REAL_ROOM_TARIFFS.map((row, idx) => ({
    id: `tariff-${idx + 1}`,
    categoryCode: row.categoryCode,
    categoryName:
      row.categoryCode === 'STANDARD'
        ? 'Standard'
        : row.categoryCode === 'CONFORT'
          ? 'Confort'
          : 'Appartement',
    guestsCount: row.guestsCount,
    roomsUsed: row.roomsUsed,
    label: row.label,
    pricePerNightFcfa: row.pricePerNightFcfa,
    isActive: true,
  }));

describe('calculateStayPrice — Grille tarifaire réelle Résidence Blue', () => {
  const realTariffs = buildRealTariffTable();

  describe('1. Toutes les cases définies du TARIF PUBLIC (valeurs exactes en FCFA)', () => {
    const definedCases: Array<{
      label: string;
      categoryCode: string;
      guestsCount: number;
      roomsUsed: number;
      expectedNightly: number;
    }> = [
      { label: 'Standard — 1 personne', categoryCode: 'STANDARD', guestsCount: 1, roomsUsed: 1, expectedNightly: 30000 },
      { label: 'Standard — 2 personnes', categoryCode: 'STANDARD', guestsCount: 2, roomsUsed: 1, expectedNightly: 35000 },
      { label: 'Confort — 1 personne', categoryCode: 'CONFORT', guestsCount: 1, roomsUsed: 1, expectedNightly: 35000 },
      { label: 'Confort — 2 personnes', categoryCode: 'CONFORT', guestsCount: 2, roomsUsed: 1, expectedNightly: 40000 },
      { label: 'Appartement — 1 personne (1 ch)', categoryCode: 'APPARTEMENT', guestsCount: 1, roomsUsed: 1, expectedNightly: 50000 },
      { label: 'Appartement — 2 personnes couple (1 ch)', categoryCode: 'APPARTEMENT', guestsCount: 2, roomsUsed: 1, expectedNightly: 55000 },
      { label: 'Appartement — 2 personnes (2 ch)', categoryCode: 'APPARTEMENT', guestsCount: 2, roomsUsed: 2, expectedNightly: 65000 },
      { label: 'Appartement — 3 personnes (2 ch)', categoryCode: 'APPARTEMENT', guestsCount: 3, roomsUsed: 2, expectedNightly: 75000 },
      { label: 'Appartement — 4 personnes (2 ch)', categoryCode: 'APPARTEMENT', guestsCount: 4, roomsUsed: 2, expectedNightly: 85000 },
      { label: 'Appartement — 5 personnes (2 ch)', categoryCode: 'APPARTEMENT', guestsCount: 5, roomsUsed: 2, expectedNightly: 95000 },
      { label: 'Appartement — 5 personnes (3 ch)', categoryCode: 'APPARTEMENT', guestsCount: 5, roomsUsed: 3, expectedNightly: 95000 },
      { label: 'Appartement — 6 personnes (3 ch)', categoryCode: 'APPARTEMENT', guestsCount: 6, roomsUsed: 3, expectedNightly: 105000 },
    ];

    it.each(definedCases)(
      '$label -> $expectedNightly FCFA / nuit',
      ({ categoryCode, guestsCount, roomsUsed, expectedNightly }) => {
        const res = calculateStayPrice({
          categoryCode,
          guestsCount,
          roomsUsed,
          nights: 1,
          tariffs: realTariffs,
        });
        expect(res.ratePerNightFcfa).toBe(expectedNightly);
        expect(res.accommodationTotalFcfa).toBe(expectedNightly);
        expect(res.priceOverriddenByDirector).toBe(false);
      },
    );
  });

  describe('2. Cases non proposées et cases non définies : erreur claire, jamais un prix par défaut', () => {
    const unavailableCases: Array<{
      label: string;
      categoryCode: string | null;
      guestsCount: number;
      roomsUsed: number;
      expectedSnippet: string;
    }> = [
      {
        label: 'Standard — 3 personnes (non proposé)',
        categoryCode: 'STANDARD',
        guestsCount: 3,
        roomsUsed: 1,
        expectedSnippet: 'Pas de tarif pour 3 personnes en chambre Standard. Choisissez un appartement ou demandez à la direction.',
      },
      {
        label: 'Standard — 4 personnes (non proposé)',
        categoryCode: 'STANDARD',
        guestsCount: 4,
        roomsUsed: 1,
        expectedSnippet: 'Pas de tarif pour 4 personnes en chambre Standard',
      },
      {
        label: 'Standard — 5 personnes (non proposé)',
        categoryCode: 'STANDARD',
        guestsCount: 5,
        roomsUsed: 1,
        expectedSnippet: 'Pas de tarif pour 5 personnes en chambre Standard',
      },
      {
        label: 'Standard — 6 personnes (non proposé)',
        categoryCode: 'STANDARD',
        guestsCount: 6,
        roomsUsed: 1,
        expectedSnippet: 'Pas de tarif pour 6 personnes en chambre Standard',
      },
      {
        label: 'Confort — 3 personnes (non proposé)',
        categoryCode: 'CONFORT',
        guestsCount: 3,
        roomsUsed: 1,
        expectedSnippet: 'Pas de tarif pour 3 personnes en chambre Confort. Choisissez un appartement ou demandez à la direction.',
      },
      {
        label: 'Confort — 4 personnes (non proposé)',
        categoryCode: 'CONFORT',
        guestsCount: 4,
        roomsUsed: 1,
        expectedSnippet: 'Pas de tarif pour 4 personnes en chambre Confort',
      },
      {
        label: 'Appartement — 3 personnes, 3 chambres (tarif non défini)',
        categoryCode: 'APPARTEMENT',
        guestsCount: 3,
        roomsUsed: 3,
        expectedSnippet: 'Tarif non défini pour 3 personnes (3 chambres) en Appartement',
      },
      {
        label: 'Appartement — 4 personnes, 3 chambres (tarif non défini)',
        categoryCode: 'APPARTEMENT',
        guestsCount: 4,
        roomsUsed: 3,
        expectedSnippet: 'Tarif non défini pour 4 personnes (3 chambres) en Appartement',
      },
      {
        label: 'Appartement — 3 personnes, 1 chambre (non proposé)',
        categoryCode: 'APPARTEMENT',
        guestsCount: 3,
        roomsUsed: 1,
        expectedSnippet: 'Pas de tarif pour 3 personnes (1 chambre) en Appartement',
      },
      {
        label: 'Chambre non classée (À classer)',
        categoryCode: null,
        guestsCount: 1,
        roomsUsed: 1,
        expectedSnippet: 'À classer',
      },
    ];

    it.each(unavailableCases)(
      '$label -> rejette avec erreur explicite',
      ({ categoryCode, guestsCount, roomsUsed, expectedSnippet }) => {
        expect(() =>
          calculateStayPrice({
            categoryCode,
            guestsCount,
            roomsUsed,
            nights: 2,
            tariffs: realTariffs,
          }),
        ).toThrow(BadRequestException);

        try {
          calculateStayPrice({
            categoryCode,
            guestsCount,
            roomsUsed,
            nights: 2,
            tariffs: realTariffs,
          });
        } catch (err: any) {
          expect(err.message).toContain(expectedSnippet);
        }
      },
    );
  });

  describe('3. Plusieurs nuits, ligne de résumé et Appartement 1 / 2 / 3 chambres', () => {
    it('calcule 3 nuits en Standard 2 personnes = 105 000 FCFA avec la ligne exacte attendue', () => {
      const res = calculateStayPrice({
        categoryCode: 'STANDARD',
        guestsCount: 2,
        roomsUsed: 1,
        nights: 3,
        breakfastIncluded: true,
        tariffs: realTariffs,
      });

      expect(res.ratePerNightFcfa).toBe(35000);
      expect(res.accommodationTotalFcfa).toBe(105000);
      expect(res.summaryLine).toBe(
        'Chambre Standard, 2 personnes, petit-déjeuner inclus : 35 000 FCFA par nuit, total 105 000 FCFA pour 3 nuits',
      );
    });

    it('calcule correctement Appartement 3 chambres dès que la direction définit son tarif', () => {
      const updatedTariffs = realTariffs.map((t) =>
        t.categoryCode === 'APPARTEMENT' && t.guestsCount === 3 && t.roomsUsed === 3
          ? { ...t, pricePerNightFcfa: 88000 }
          : t,
      );

      const res = calculateStayPrice({
        categoryCode: 'APPARTEMENT',
        guestsCount: 3,
        roomsUsed: 3,
        nights: 2,
        tariffs: updatedTariffs,
      });
      expect(res.ratePerNightFcfa).toBe(88000);
      expect(res.accommodationTotalFcfa).toBe(176000);
      expect(res.summaryLine).toContain('Appartement, 3 personnes, 3 chambres');
    });

    it('formate correctement le résumé au singulier pour 1 nuit et 1 personne', () => {
      const line = formatTariffSummaryLine({
        categoryCode: 'CONFORT',
        categoryName: 'Confort',
        guestsCount: 1,
        roomsUsed: 1,
        nights: 1,
        ratePerNightFcfa: 35000,
        accommodationTotalFcfa: 35000,
        breakfastIncluded: true,
      });
      expect(line).toBe(
        'Chambre Confort, 1 personne, petit-déjeuner inclus : 35 000 FCFA par nuit, total 35 000 FCFA pour 1 nuit',
      );
    });
  });

  describe('4. Prix négocié (modification manuelle par la direction uniquement)', () => {
    it('autorise DIRECTION avec un motif obligatoire', () => {
      const res = calculateStayPrice({
        categoryCode: 'STANDARD',
        guestsCount: 2,
        roomsUsed: 1,
        nights: 4,
        tariffs: realTariffs,
        directorOverride: {
          pricePerNightFcfa: 32000,
          reason: 'Tarif négocié convention entreprise locale',
          actorRole: 'DIRECTION',
        },
      });
      expect(res.ratePerNightFcfa).toBe(32000);
      expect(res.accommodationTotalFcfa).toBe(128000);
      expect(res.priceOverriddenByDirector).toBe(true);
      expect(res.tariffLabel).toBe('Prix fixé par la direction');
      expect(res.priceOverrideReason).toBe('Tarif négocié convention entreprise locale');
    });

    it('refuse (403) si RECEPTION tente de fixer un prix manuel', () => {
      expect(() =>
        calculateStayPrice({
          categoryCode: 'STANDARD',
          guestsCount: 2,
          roomsUsed: 1,
          nights: 2,
          tariffs: realTariffs,
          directorOverride: {
            pricePerNightFcfa: 25000,
            reason: 'Remise accordée au comptoir',
            actorRole: 'RECEPTION',
          },
        }),
      ).toThrow(ForbiddenException);
    });

    it('refuse (400) si DIRECTION ne fournit pas de motif', () => {
      expect(() =>
        calculateStayPrice({
          categoryCode: 'STANDARD',
          guestsCount: 2,
          roomsUsed: 1,
          nights: 2,
          tariffs: realTariffs,
          directorOverride: {
            pricePerNightFcfa: 30000,
            reason: ' ',
            actorRole: 'DIRECTION',
          },
        }),
      ).toThrow(BadRequestException);
    });
  });
});
