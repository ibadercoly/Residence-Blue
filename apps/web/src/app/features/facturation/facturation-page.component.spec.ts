import { FacturationPageComponent } from './facturation-page.component';
import { FacturationMockService } from '../../core/services/facturation-mock.service';

describe('FacturationPageComponent', () => {
  let component: FacturationPageComponent;
  let service: FacturationMockService;

  beforeEach(() => {
    component = new FacturationPageComponent();
    service = component.facturationService;
  });

  it('devrait être instancié avec l’onglet folio actif', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab()).toBe('folio');
  });

  it('devrait afficher le numéro de facture séquentiel (#INV-2024-0542)', () => {
    expect(component.folio().invoiceNumber).toBe('#INV-2024-0542');
  });

  it('devrait basculer vers l’onglet Z de caisse', () => {
    component.selectTab('z-caisse');
    expect(component.activeTab()).toBe('z-caisse');
  });

  it('devrait formater les nombres avec des espaces insécables', () => {
    const formatted = component.formatNumber(150000);
    expect(formatted).toMatch(/150[\s\u202f]000/);
  });

  it('devrait calculer les pourcentages de ventilation pour le Z de caisse', () => {
    expect(component.calculatePercent(50, 100)).toBe(50);
    expect(component.calculatePercent(0, 100)).toBe(0);
    expect(component.calculatePercent(100, 0)).toBe(0);
  });

  it('devrait mettre à jour la ventilation Wave dynamiquement', () => {
    component.onWaveChange(100000);
    expect(service.inputWave()).toBe(100000);
    expect(component.remainingBalance()).toBe(50000);
  });

  it('devrait recalculer la monnaie à rendre en espèces', () => {
    component.onCashChange(80000);
    component.onReceivedChange(100000);
    expect(component.changeReturn()).toBe(20000);
  });

  it('devrait exécuter la validation de paiement', async () => {
    // Par défaut équilibré
    expect(component.isCheckoutAllowed()).toBe(true);
    await component.onCheckout();
    expect(component.folio().isPaid).toBe(true);
    expect(component.toastMessage()).toContain('Paiement validé avec succès');
  });
});
