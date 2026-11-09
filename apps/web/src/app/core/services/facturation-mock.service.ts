import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CashierShiftZReport,
  ClosedFolioTransaction,
  InvoiceFolio,
  InvoiceLineItem
} from '@residence-blue/shared';
import { HotelSettingsService } from './hotel-settings.service';

export type FacturationTab = 'folio' | 'z-caisse';
export type ReconciliationStatus = 'BALANCED' | 'UNDERPAID' | 'OVERPAID';

@Injectable({
  providedIn: 'root'
})
export class FacturationMockService {
  private readonly hotelSettingsService: HotelSettingsService;

  constructor(customHotelSettings?: HotelSettingsService) {
    this.hotelSettingsService =
      customHotelSettings ?? inject(HotelSettingsService, { optional: true }) ?? new HotelSettingsService();
  }

  // Onglet actif
  private readonly _activeTab = signal<FacturationTab>('folio');
  readonly activeTab = this._activeTab.asReadonly();

  // Compteur séquentiel de factures
  private _invoiceSequence = signal<number>(542);
  readonly currentInvoiceNumber = computed(() => {
    const seq = this._invoiceSequence().toString().padStart(4, '0');
    return `#INV-2024-${seq}`;
  });

  // Heure locale dynamique (GMT Sénégal)
  readonly localTimeFormatted = computed(() => {
    const now = new Date();
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} GMT`;
  });

  // Lignes de prestations du folio 301 (données adaptées Thiès)
  private readonly _lineItems = signal<InvoiceLineItem[]>([
    {
      id: 'item-1',
      date: '23/05 - 27/05',
      description: 'Hébergement Suite Panoramique (Ch. 301)',
      subDescription: 'Vue dégagée sur jardin arboré, terrasse privée & petit-déjeuner inclus',
      category: 'ROOM',
      quantity: '4 nuits',
      unitPriceFcfa: 150000,
      totalPriceFcfa: 600000
    },
    {
      id: 'item-2',
      date: '24/05 13:40',
      description: "Restauration 'La Teranga' — Ticket #CMD-0428",
      subDescription: 'Thiéboudienne Royale, Thiof grillé, 2 Bissap, 1 Saloum Sunset',
      category: 'RESTAURANT',
      icon: 'restaurant',
      quantity: 1,
      unitPriceFcfa: 14500,
      totalPriceFcfa: 14500
    },
    {
      id: 'item-3',
      date: '25/05 20:50',
      description: "Restauration 'La Teranga' — Dîner Grillades",
      subDescription: 'Thiéboudienne Penda Mbaye royale & Bouteille de vin rouge',
      category: 'RESTAURANT',
      icon: 'wine_bar',
      quantity: 1,
      unitPriceFcfa: 38000,
      totalPriceFcfa: 38000
    },
    {
      id: 'item-4',
      date: '23/05 16:15',
      description: 'Conciergerie — Navette VIP SUV DSS Aéroport A/R',
      subDescription: 'Transfert privé climatisé aéroport Blaise Diagne (AIBD - Thiès)',
      category: 'CONCIERGE',
      icon: 'airport_shuttle',
      quantity: 1,
      unitPriceFcfa: 45000,
      totalPriceFcfa: 45000
    },
    {
      id: 'item-5',
      date: '25/05 11:00',
      description: 'Housekeeping — Blanchisserie Express',
      subDescription: '2 chemises en lin, 1 pantalon blanc repassage doux',
      category: 'HOUSEKEEPING',
      icon: 'local_laundry_service',
      quantity: '1 lot',
      unitPriceFcfa: 7500,
      totalPriceFcfa: 7500
    },
    {
      id: 'item-6',
      date: '26/05 08:30',
      description: 'Excursion guidée — Forêt de Bandia & Manufacture des Arts de Thiès',
      subDescription: 'Mise à disposition véhicule avec chauffeur (Excursion Réserve Bandia)',
      category: 'CONCIERGE',
      icon: 'directions_car',
      quantity: 1,
      unitPriceFcfa: 75000,
      totalPriceFcfa: 75000
    },
    {
      id: 'item-7',
      date: '27/05 08:00',
      description: 'Taxe Touristique de Séjour Réglementaire',
      subDescription: 'Barème légal République du Sénégal : 4 nuits x 2 adultes x 1 000 FCFA',
      category: 'TAX',
      icon: 'assured_workload',
      quantity: '8 pax',
      unitPriceFcfa: 1000,
      totalPriceFcfa: 8000
    }
  ]);

  readonly lineItems = this._lineItems.asReadonly();

  // Données de facturation et montants
  readonly subtotalHtFcfa = signal<number>(716364);
  readonly vatRatePercent = signal<number>(10);
  readonly vatAmountFcfa = signal<number>(71636);
  readonly tourismTaxAmountFcfa = signal<number>(8000);
  readonly totalTtcFcfa = signal<number>(788000);
  readonly depositAmountFcfa = signal<number>(500000);
  readonly depositLabel = signal<string>('Acompte versé à la réservation (Wave, 15/05)');
  readonly targetDueFcfa = signal<number>(288000);

  // Formulaire de ventilation multi-moyens de paiement (Split Payments)
  readonly inputWave = signal<number>(150000);
  readonly inputWaveRef = signal<string>('WAV-8921-DKR');

  readonly inputCash = signal<number>(88000);
  readonly inputReceived = signal<number>(100000);

  readonly inputOM = signal<number>(50000);
  readonly inputOMRef = signal<string>('OM-419824');

  readonly inputCard = signal<number>(0);

  readonly taxInvoiceChecked = signal<boolean>(true);

  // États de cycle de vie
  readonly isCheckingOut = signal<boolean>(false);
  readonly isFolioSettled = signal<boolean>(false);

  // Calculs réactifs en temps réel
  readonly allocatedTotal = computed(() => {
    return (
      (this.inputWave() || 0) +
      (this.inputCash() || 0) +
      (this.inputOM() || 0) +
      (this.inputCard() || 0)
    );
  });

  readonly remainingBalance = computed(() => {
    return this.targetDueFcfa() - this.allocatedTotal();
  });

  readonly changeReturn = computed(() => {
    const cash = this.inputCash() || 0;
    const rec = this.inputReceived() || 0;
    return Math.max(0, rec - cash);
  });

  readonly reconciliationStatus = computed<ReconciliationStatus>(() => {
    const diff = this.remainingBalance();
    if (diff === 0) return 'BALANCED';
    if (diff > 0) return 'UNDERPAID';
    return 'OVERPAID';
  });

  readonly isCheckoutAllowed = computed(() => {
    return this.reconciliationStatus() === 'BALANCED' && !this.isCheckingOut() && !this.isFolioSettled();
  });

  // Données de caisse / Shift Z de caisse
  private readonly _openingFloatFcfa = signal<number>(150000);
  private readonly _baseCollectedTodayFcfa = signal<number>(1420000);

  private readonly _closedFolios = signal<ClosedFolioTransaction[]>([
    {
      id: 'tx-1',
      invoiceNumber: '#INV-2024-0540',
      roomNumber: '102',
      guestName: 'Sarah Jenkins',
      amountFcfa: 95000,
      method: 'Carte CBAO',
      reference: 'TPE-902341',
      time: '08:15 GMT'
    },
    {
      id: 'tx-2',
      invoiceNumber: '#INV-2024-0541',
      roomNumber: '204',
      guestName: 'Cheikh Ndiaye',
      amountFcfa: 185000,
      method: 'Wave',
      reference: 'WAV-7712-THS',
      time: '09:30 GMT'
    },
    {
      id: 'tx-3',
      invoiceNumber: '#CMD-2024-0891',
      roomNumber: 'Restaurant',
      guestName: 'Tables passagers La Teranga',
      amountFcfa: 1140000,
      method: 'Espèces / OM',
      time: '10:00 GMT'
    }
  ]);

  readonly closedFolios = this._closedFolios.asReadonly();

  readonly totalCollectedTodayFcfa = computed(() => {
    const additional = this.isFolioSettled() ? this.targetDueFcfa() : 0;
    return this._baseCollectedTodayFcfa() + additional;
  });

  readonly totalPhysicalCashInDrawer = computed(() => {
    const additionalCash = this.isFolioSettled() ? this.inputCash() : 0;
    return this._openingFloatFcfa() + 450000 + additionalCash;
  });

  // Folio complet assemblé
  readonly currentFolio = computed<InvoiceFolio>(() => {
    const hotel = this.hotelSettingsService.settings();
    return {
      id: 'folio-301',
      invoiceNumber: this.currentInvoiceNumber(),
      issueDate: '27 Mai 2024',
      issueTime: this.localTimeFormatted(),
      roomNumber: '301',
      roomCategory: 'Suite',
      roomName: 'Chambre 301 — Suite Panoramique',
      guestName: 'M. Mamadou Diop',
      vipTier: 'VIP Gold',
      passportNumber: 'SN-982341-B',
      phone: '+221 77 645 12 89',
      staySummary: 'Séjour de 4 nuits (23 Mai — 27 Mai 2024)',
      billingEntity: {
        companyName: 'Teranga Group Dakar S.A.',
        ninea: '0029103-2V2',
        address: '12 Bd de la République, Dakar Plateau'
      },
      items: this._lineItems(),
      subtotalHtFcfa: this.subtotalHtFcfa(),
      vatRatePercent: hotel.vatRatePercent,
      vatAmountFcfa: this.vatAmountFcfa(),
      tourismTaxAmountFcfa: this.tourismTaxAmountFcfa(),
      totalTtcFcfa: this.totalTtcFcfa(),
      depositAmountFcfa: this.depositAmountFcfa(),
      depositLabel: this.depositLabel(),
      targetDueFcfa: this.targetDueFcfa(),
      isPaid: this.isFolioSettled()
    };
  });

  // Données du rapport Z de caisse
  readonly cashierShiftZReport = computed<CashierShiftZReport>(() => {
    const additionalWave = this.isFolioSettled() ? this.inputWave() : 0;
    const additionalCash = this.isFolioSettled() ? this.inputCash() : 0;
    const additionalOM = this.isFolioSettled() ? this.inputOM() : 0;
    const additionalCard = this.isFolioSettled() ? this.inputCard() : 0;

    return {
      shiftId: 'SHIFT-20240527-01',
      date: '27 Mai 2024',
      operatorName: 'Aïssatou Ba',
      operatorRole: 'Directrice Générale',
      openingFloatFcfa: this._openingFloatFcfa(),
      totalCollectedTodayFcfa: this.totalCollectedTodayFcfa(),
      collectedByMethod: {
        wave: 520000 + additionalWave,
        cash: 450000 + additionalCash,
        orangeMoney: 250000 + additionalOM,
        card: 200000 + additionalCard
      },
      transactionsCount: this._closedFolios().length + (this.isFolioSettled() ? 1 : 0),
      closedFolios: this._closedFolios()
    };
  });

  setActiveTab(tab: FacturationTab): void {
    this._activeTab.set(tab);
  }

  setWaveAmount(amount: number): void {
    this.inputWave.set(Math.max(0, Math.floor(amount || 0)));
  }

  setWaveRef(ref: string): void {
    this.inputWaveRef.set(ref);
  }

  setCashAmount(amount: number): void {
    this.inputCash.set(Math.max(0, Math.floor(amount || 0)));
  }

  setCashReceived(amount: number): void {
    this.inputReceived.set(Math.max(0, Math.floor(amount || 0)));
  }

  setOMAmount(amount: number): void {
    this.inputOM.set(Math.max(0, Math.floor(amount || 0)));
  }

  setOMRef(ref: string): void {
    this.inputOMRef.set(ref);
  }

  setCardAmount(amount: number): void {
    this.inputCard.set(Math.max(0, Math.floor(amount || 0)));
  }

  setTaxInvoiceChecked(checked: boolean): void {
    this.taxInvoiceChecked.set(checked);
  }

  async processCheckout(): Promise<boolean> {
    if (!this.isCheckoutAllowed()) {
      return false;
    }

    this.isCheckingOut.set(true);

    // Simulation de délai réseau / traitement
    await new Promise(resolve => setTimeout(resolve, 600));

    this.isFolioSettled.set(true);
    this.isCheckingOut.set(false);

    // Ajout aux transactions clôturées
    this._closedFolios.update(list => [
      {
        id: `tx-${Date.now()}`,
        invoiceNumber: this.currentInvoiceNumber(),
        roomNumber: '301',
        guestName: 'M. Mamadou Diop',
        amountFcfa: this.targetDueFcfa(),
        method: 'Split (Wave + Cash + OM)',
        reference: this.inputWaveRef(),
        time: this.localTimeFormatted()
      },
      ...list
    ]);

    return true;
  }

  generateNextInvoice(): void {
    this._invoiceSequence.update(s => s + 1);
    this.isFolioSettled.set(false);
  }

  printInvoice(): void {
    window.print();
  }
}
