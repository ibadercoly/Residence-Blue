import { BillingNoteDetail } from '@residence-blue/shared';
import { NoteSejourPageComponent } from './note-sejour-page.component';

describe('NoteSejourPageComponent (Facturation V3)', () => {
  let component: NoteSejourPageComponent;

  const sampleNote: BillingNoteDetail = {
    id: 'inv-1',
    invoiceNumber: null,
    displayNumber: 'Note ouverte',
    documentType: 'INVOICE',
    isIssued: false,
    status: 'PARTIAL',
    reservationId: 'res-1',
    reservationStatus: 'CHECKED_IN',
    guestId: 'g-1',
    guestName: 'Mamadou Diop',
    phone: '+221771112233',
    roomId: 'room-201',
    roomNumber: '201',
    roomCategory: 'Deluxe',
    stayStartDate: '2026-11-11',
    stayEndDate: '2026-11-13',
    stayLabel: '11/11/2026 → 13/11/2026',
    nights: 2,
    adultsCount: 2,
    lines: [
      {
        id: 'l-1',
        dateLabel: '11/11/2026',
        description: 'Nuitée Deluxe',
        subDescription: '2 nuits',
        category: 'HEBERGEMENT',
        rawCategory: 'HEBERGEMENT',
        quantity: 2,
        unitPriceFcfa: 55000,
        totalPriceFcfa: 110000,
        isSystem: true,
      },
      {
        id: 'l-2',
        dateLabel: '12/11/2026',
        description: 'Thiéboudienne',
        subDescription: '',
        category: 'RESTAURANT',
        rawCategory: 'RESTAURANT',
        quantity: 2,
        unitPriceFcfa: 5000,
        totalPriceFcfa: 10000,
        isSystem: true,
      },
      {
        id: 'l-tax',
        dateLabel: '11/11/2026',
        description: 'Taxe de séjour',
        subDescription: '2 adultes × 2 nuits',
        category: 'AUTRES',
        rawCategory: 'TAX',
        quantity: 4,
        unitPriceFcfa: 1000,
        totalPriceFcfa: 4000,
        isSystem: true,
      },
    ],
    subtotalHtFcfa: 109091,
    discountFcfa: 0,
    serviceRatePercent: 0,
    serviceAmountFcfa: 0,
    vatRatePercent: 10,
    vatAmountFcfa: 10909,
    tourismTaxFcfa: 4000,
    totalFcfa: 124000,
    depositFcfa: 0,
    paidAmountFcfa: 50000,
    balanceFcfa: 74000,
    totalInWordsFr: 'cent vingt-quatre mille francs CFA',
    payments: [],
    parentInvoiceId: null,
    parentInvoiceNumber: null,
    creditNotes: [],
    reason: null,
    forcedCheckout: false,
    forcedCheckoutReason: null,
    settings: {
      vatRatePercent: 10,
      serviceRatePercent: 0,
      tourismTaxPerNightPerPerson: 1000,
      discountThresholdPercent: 10,
    },
    canCheckout: false,
    issuedAt: '2026-11-11T14:00:00.000Z',
    settledAt: null,
  };

  beforeEach(() => {
    component = new NoteSejourPageComponent();
    component.service.currentNote.set(sampleNote);
  });

  it('devrait grouper les lignes par catégorie hors taxe de séjour et calculer les sous-totaux', () => {
    const groups = component.groupedLines();
    expect(groups.length).toBe(2);
    expect(groups[0].category).toBe('HEBERGEMENT');
    expect(groups[0].subtotalFcfa).toBe(110000);
    expect(groups[1].category).toBe('RESTAURANT');
    expect(groups[1].subtotalFcfa).toBe(10000);
  });

  it('devrait valider les entiers FCFA et bloquer les numéros de carte en référence', () => {
    component.fillBalance(74000);
    component.paymentRef.set('WAV-2026-0089');
    expect(component.panWarning()).toBe(false);
    expect(component.canSubmitPayment(74000)).toBe(true);

    component.paymentRef.set('4532 1111 2222 3333');
    expect(component.panWarning()).toBe(true);
    expect(component.canSubmitPayment(74000)).toBe(false);

    component.paymentRef.set('OK');
    component.paymentAmount.set(80000);
    expect(component.canSubmitPayment(74000)).toBe(false);
  });

  it('devrait calculer le total estimé de nouvelle ligne en entiers FCFA', () => {
    component.newLineDescription.set('Pass Piscine');
    component.newLineCategory.set('PISCINE');
    component.newLineQty.set(3);
    component.newLineUnitPrice.set(5000);

    expect(component.estimatedLineTotal()).toBe(15000);
    expect(component.canSubmitNewLine()).toBe(true);
  });
});
