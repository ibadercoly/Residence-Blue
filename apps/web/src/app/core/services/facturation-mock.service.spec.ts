import { FacturationMockService } from './facturation-mock.service';
import { HotelSettingsService } from './hotel-settings.service';

describe('FacturationMockService', () => {
  let service: FacturationMockService;
  let hotelSettingsService: HotelSettingsService;

  beforeEach(() => {
    hotelSettingsService = new HotelSettingsService();
    service = new FacturationMockService(hotelSettingsService);
  });

  it('devrait être initialisé correctement', () => {
    expect(service).toBeTruthy();
    expect(service.activeTab()).toBe('folio');
    expect(service.currentInvoiceNumber()).toBe('#INV-2024-0542');
  });

  it('devrait équilibrer la ventilation par défaut (288 000 FCFA)', () => {
    expect(service.allocatedTotal()).toBe(288000);
    expect(service.targetDueFcfa()).toBe(288000);
    expect(service.remainingBalance()).toBe(0);
    expect(service.reconciliationStatus()).toBe('BALANCED');
    expect(service.isCheckoutAllowed()).toBe(true);
  });

  it('devrait calculer correctement la monnaie à rendre en espèces', () => {
    // 100 000 reçus - 88 000 imputés = 12 000 FCFA
    expect(service.changeReturn()).toBe(12000);

    service.setCashReceived(90000);
    expect(service.changeReturn()).toBe(2000);

    service.setCashReceived(80000); // Reçu inférieur au montant imputé
    expect(service.changeReturn()).toBe(0);
  });

  it('devrait détecter un solde sous-payé (UNDERPAID) et bloquer l’encaissement', () => {
    service.setWaveAmount(100000); // Réduit de 50 000
    expect(service.allocatedTotal()).toBe(238000);
    expect(service.remainingBalance()).toBe(50000);
    expect(service.reconciliationStatus()).toBe('UNDERPAID');
    expect(service.isCheckoutAllowed()).toBe(false);
  });

  it('devrait détecter un trop-perçu (OVERPAID) et bloquer l’encaissement', () => {
    service.setWaveAmount(200000); // Augmenté de 50 000
    expect(service.allocatedTotal()).toBe(338000);
    expect(service.remainingBalance()).toBe(-50000);
    expect(service.reconciliationStatus()).toBe('OVERPAID');
    expect(service.isCheckoutAllowed()).toBe(false);
  });

  it('devrait basculer d’onglet entre folio et Z de caisse', () => {
    service.setActiveTab('z-caisse');
    expect(service.activeTab()).toBe('z-caisse');

    service.setActiveTab('folio');
    expect(service.activeTab()).toBe('folio');
  });

  it('devrait alimenter les informations de l’hôtel depuis HotelSettingsService', () => {
    const folio = service.currentFolio();
    const settings = hotelSettingsService.settings();

    expect(settings.ninea).toBe('004819230');
    expect(settings.rccm).toBe('SN-THS-2021-B-114');
    expect(folio.vatRatePercent).toBe(10);
    expect(folio.roomName).toContain('Chambre 301');
  });

  it('devrait incrémenter le numéro séquentiel de facture', () => {
    expect(service.currentInvoiceNumber()).toBe('#INV-2024-0542');
    service.generateNextInvoice();
    expect(service.currentInvoiceNumber()).toBe('#INV-2024-0543');
  });

  it('devrait effectuer le checkout et enregistrer la transaction dans le Z de caisse', async () => {
    const initialZ = service.cashierShiftZReport();
    const initialTotal = initialZ.totalCollectedTodayFcfa;

    expect(service.isFolioSettled()).toBe(false);
    const success = await service.processCheckout();

    expect(success).toBe(true);
    expect(service.isFolioSettled()).toBe(true);
    expect(service.isCheckoutAllowed()).toBe(false); // Déjà payé

    const updatedZ = service.cashierShiftZReport();
    expect(updatedZ.totalCollectedTodayFcfa).toBe(initialTotal + 288000);
    expect(updatedZ.closedFolios[0].invoiceNumber).toBe('#INV-2024-0542');
    expect(updatedZ.closedFolios[0].roomNumber).toBe('301');
  });
});
