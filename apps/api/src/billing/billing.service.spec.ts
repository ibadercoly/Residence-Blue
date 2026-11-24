import { jest } from '@jest/globals';
import { BillingService } from './billing.service';

describe('BillingService — Lot 6 : justesse des montants, année Dakar et taxe de séjour', () => {
  let service: BillingService;

  beforeEach(() => {
    service = new BillingService({} as any, {} as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('A. Calcul exact de TVA sans écart d’arrondi (LOG-003)', () => {
    const cases = [
      { label: '5 000 FCFA (TVA 10 %, sans remise)', price: 5000, discount: 0, vat: 10, service: 0, tax: 0 },
      { label: '35 000 FCFA (TVA 10 %, sans remise)', price: 35000, discount: 0, vat: 10, service: 0, tax: 1000 },
      { label: '47 500 FCFA (TVA 10 %, sans remise)', price: 47500, discount: 0, vat: 10, service: 0, tax: 2000 },
      { label: '47 500 FCFA (TVA 18 %, remise 2 500)', price: 47500, discount: 2500, vat: 18, service: 0, tax: 1000 },
      { label: '35 000 FCFA (TVA 10 %, service 5 %, remise 3 000)', price: 35000, discount: 3000, vat: 10, service: 5, tax: 2000 },
      { label: '5 000 FCFA (TVA 18 %, service 10 %)', price: 5000, discount: 0, vat: 18, service: 10, tax: 0 },
    ];

    for (const c of cases) {
      it(`garantit subtotal + service + vat + tax === total pour ${c.label}`, () => {
        const lines: Array<{ category?: string | null; totalPriceFcfa: number }> = [
          { category: 'HEBERGEMENT', totalPriceFcfa: c.price },
        ];
        if (c.tax > 0) {
          lines.push({ category: 'TAX', totalPriceFcfa: c.tax });
        }

        const result = service.computeInvoiceTotals({
          lines,
          discountFcfa: c.discount,
          depositFcfa: 0,
          paidAmountFcfa: 0,
          vatRatePercent: c.vat,
          serviceRatePercent: c.service,
        });

        expect(
          result.subtotalHtFcfa +
            result.serviceAmountFcfa +
            result.vatAmountFcfa +
            result.tourismTaxFcfa,
        ).toBe(result.totalFcfa);

        if (c.service === 0) {
          // Prix TTC exact : aucun écart de 1 FCFA par rapport au net TTC + taxe
          expect(result.subtotalHtFcfa + result.vatAmountFcfa).toBe(c.price - c.discount);
          expect(result.totalFcfa).toBe(c.price - c.discount + c.tax);
        }
      });
    }

    it('garantit aussi zéro écart pour un avoir (isCreditNote = true)', () => {
      const credit = service.computeInvoiceTotals({
        lines: [{ category: 'HEBERGEMENT', totalPriceFcfa: -47500 }],
        discountFcfa: 0,
        depositFcfa: 0,
        paidAmountFcfa: 0,
        vatRatePercent: 18,
        serviceRatePercent: 0,
        isCreditNote: true,
      });

      expect(credit.subtotalHtFcfa + credit.serviceAmountFcfa + credit.vatAmountFcfa).toBe(-47500);
      expect(credit.totalFcfa).toBe(-47500);
    });
  });

  describe('B. Année du numéro de facture en heure de Dakar (LOG-004)', () => {
    it('génère FA-2026-0001 le 31 décembre 2026 à 23 h 59 heure de Dakar (même si le serveur est en UTC+1)', async () => {
      const dec31Dakar = new Date('2026-12-31T23:59:00.000Z');
      jest.useFakeTimers().setSystemTime(dec31Dakar);
      const tzSpy = jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-60); // Paris UTC+1 = 00h59 le 01/01/2027

      const queryRaw = jest.fn(async () => [{ last_seq: 1 }]);
      const fakeTx = { $queryRaw: queryRaw } as any;

      try {
        expect(service.getDakarYear()).toBe(2026);
        const invoiceNumber = await service.nextSequenceNumber(fakeTx, 'FA');
        expect(invoiceNumber).toBe('FA-2026-0001');
      } finally {
        tzSpy.mockRestore();
      }
    });

    it('génère FA-2027-0001 le 1er janvier 2027 à 00 h 01 heure de Dakar', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2027-01-01T00:01:00.000Z'));
      const fakeTx = { $queryRaw: jest.fn(async () => [{ last_seq: 1 }]) } as any;

      expect(service.getDakarYear()).toBe(2027);
      const invoiceNumber = await service.nextSequenceNumber(fakeTx, 'FA');
      expect(invoiceNumber).toBe('FA-2027-0001');
    });
  });

  describe('C. Taxe de séjour configurable (LOG-002)', () => {
    it('applique la taxe uniquement aux adultes quand tourismTaxIncludesChildren = false', () => {
      const res = service.computeTourismTaxFcfa({
        ratePerNightPerPerson: 1000,
        adultsCount: 2,
        childrenCount: 3,
        nights: 4,
        includesChildren: false,
      });

      expect(res.taxablePersons).toBe(2);
      expect(res.quantity).toBe(8);
      expect(res.amountFcfa).toBe(8000);
    });

    it('inclut les enfants (adultsCount + childrenCount) quand tourismTaxIncludesChildren = true', () => {
      const res = service.computeTourismTaxFcfa({
        ratePerNightPerPerson: 1000,
        adultsCount: 2,
        childrenCount: 3,
        nights: 4,
        includesChildren: true,
      });

      expect(res.taxablePersons).toBe(5);
      expect(res.quantity).toBe(20);
      expect(res.amountFcfa).toBe(20000);
    });
  });
});
