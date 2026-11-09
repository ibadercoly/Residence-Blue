import { NewReservationModalComponent } from './new-reservation-modal.component';
import { ReservationModalService } from '../../../core/services/reservation-modal.service';

describe('NewReservationModalComponent', () => {
  let component: NewReservationModalComponent;
  let service: ReservationModalService;

  beforeEach(() => {
    service = new ReservationModalService();
    component = new NewReservationModalComponent(service);
  });

  it('devrait être initialisé correctement', () => {
    expect(component).toBeTruthy();
    expect(component.modalService).toBe(service);
  });

  it('devrait calculer le récapitulatif tarifaire par défaut conforme à la maquette', () => {
    // 3 nuits, Deluxe (130 000), 2 adultes, 1 enfant lit supp (25 000), navette (35 000)
    expect(component.nightsCount()).toBe(3);
    expect(component.accommodationTotalFcfa()).toBe(390000);
    expect(component.extraChildBedFcfa()).toBe(25000);
    expect(component.airportShuttleFcfa()).toBe(35000);
    expect(component.cityTaxFcfa()).toBe(6000); // 1000 * 2 adultes * 3 nuits

    // Total TTC = 390 000 + 25 000 + 35 000 + 6 000 = 456 000 FCFA
    expect(component.totalStayTtcFcfa()).toBe(456000);
    expect(component.depositAmountFcfa()).toBe(150000);
    expect(component.depositPercentage()).toBe(33); // ~33%
    expect(component.remainingBalanceFcfa()).toBe(306000); // 456 000 - 150 000 = 306 000 FCFA
  });

  it('devrait recalculer en direct lors du changement de catégorie', () => {
    // Basculer sur Standard (85 000 FCFA/nuit)
    component.selectCategory('Standard');
    expect(component.selectedCategory()).toBe('Standard');
    expect(component.currentCategoryOption().ratePerNightFcfa).toBe(85000);
    expect(component.selectedRoomNumber()).toBe('101');
    expect(component.accommodationTotalFcfa()).toBe(3 * 85000); // 255 000

    // Basculer sur Suite (210 000 FCFA/nuit)
    component.selectCategory('Suite');
    expect(component.selectedCategory()).toBe('Suite');
    expect(component.currentCategoryOption().ratePerNightFcfa).toBe(210000);
    expect(component.selectedRoomNumber()).toBe('301');
    expect(component.accommodationTotalFcfa()).toBe(3 * 210000); // 630 000
  });

  it('devrait gérer les steppers des occupants avec leurs bornes minimales', () => {
    // Adultes (initial 2, min 1)
    component.decrementAdults();
    expect(component.adultsCount()).toBe(1);
    component.decrementAdults();
    expect(component.adultsCount()).toBe(1); // Bloqué à 1

    component.incrementAdults();
    expect(component.adultsCount()).toBe(2);

    // Enfants (initial 1, min 0)
    component.decrementChildren();
    expect(component.childrenCount()).toBe(0);
    expect(component.extraChildBedFcfa()).toBe(0); // Pas de supplément lit si 0 enfant
    component.decrementChildren();
    expect(component.childrenCount()).toBe(0); // Bloqué à 0

    component.incrementChildren();
    expect(component.childrenCount()).toBe(1);
    expect(component.extraChildBedFcfa()).toBe(25000);
  });

  it('devrait valider et désactiver le bouton quand le formulaire est incomplet', () => {
    // Mode régulier : valide
    expect(component.isSubmitDisabled()).toBe(false);

    // Passer en mode Nouveau client sans nom ni téléphone : invalide
    component.setGuestMode('NEW');
    expect(component.newGuest().fullName).toBe('');
    expect(component.isSubmitDisabled()).toBe(true);

    // Remplir le nom uniquement : encore invalide (téléphone requis)
    component.newGuest.update((g) => ({ ...g, fullName: 'Moustapha Cissé' }));
    expect(component.isSubmitDisabled()).toBe(true);

    // Remplir le téléphone : devient valide
    component.newGuest.update((g) => ({ ...g, phone: '+221 77 111 22 33' }));
    expect(component.isSubmitDisabled()).toBe(false);
  });

  it('devrait basculer les canaux de paiement et le statut', () => {
    component.setPaymentStatus('EN_ATTENTE');
    expect(component.paymentStatus()).toBe('EN_ATTENTE');

    component.setPaymentChannel('ORANGE_MONEY');
    expect(component.paymentChannel()).toBe('ORANGE_MONEY');
    expect(component.paymentChannelLabel()).toBe('Orange Money');

    component.setPaymentChannel('CARTE_TPE');
    expect(component.paymentChannel()).toBe('CARTE_TPE');
    expect(component.paymentChannelLabel()).toBe('Carte TPE');

    component.setPaymentChannel('ESPECES');
    expect(component.paymentChannel()).toBe('ESPECES');
    expect(component.paymentChannelLabel()).toBe('Espèces');
  });

  it('devrait fermer la modal sur Échap', () => {
    service.open();
    expect(service.isOpen()).toBe(true);
    component.handleEscape();
    expect(service.isOpen()).toBe(false);
  });

  it('devrait confirmer la réservation avec le payload complet', async () => {
    service.open();
    component.onConfirm();
    expect(service.isOpen()).toBe(false);
    expect(service.lastSubmittedReservation()).not.toBeNull();
    expect(service.lastSubmittedReservation()?.roomNumber).toBe('201');
    expect(service.lastSubmittedReservation()?.breakdown.totalStayTtcFcfa).toBe(456000);
  });

  it('devrait sauvegarder un devis ou option temporaire', async () => {
    service.open();
    component.onSaveDraft();
    expect(service.isOpen()).toBe(false);
    expect(service.feedbackMessage()).toContain('Option temporaire 48h');
  });
});
