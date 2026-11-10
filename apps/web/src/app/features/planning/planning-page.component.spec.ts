import { PlanningPageComponent } from './planning-page.component';
import { PlanningMockService } from '../../core/services/planning-mock.service';
import { ReservationModalService } from '../../core/services/reservation-modal.service';

describe('PlanningPageComponent', () => {
  let component: PlanningPageComponent;
  let service: PlanningMockService;
  let modalService: ReservationModalService;

  beforeEach(() => {
    service = new PlanningMockService();
    modalService = new ReservationModalService();
    component = new PlanningPageComponent(service, modalService);
  });

  it('devrait être initialisé correctement', () => {
    expect(component).toBeTruthy();
    expect(component.planningService).toBe(service);
    expect(component.modalService).toBe(modalService);
  });

  it('devrait formater les montants en FCFA entiers stricts', () => {
    expect(component.formatAmount(840000)).toBe('840\u202f000 FCFA');
    expect(component.formatAmount(0)).toBe('0 FCFA');
  });

  it('devrait retourner les 3 couleurs exactes selon le statut', () => {
    expect(component.getReservationColorClass('CONFIRME')).toContain('bg-blue-100');
    expect(component.getReservationColorClass('EN_SEJOUR')).toContain('bg-emerald-100');
    expect(component.getReservationColorClass('DEPART_AUJ')).toContain('bg-amber-100');
  });

  it('devrait mettre à jour la recherche lors de la saisie', () => {
    const dummyEvent = {
      target: { value: 'Mamadou' }
    } as unknown as Event;

    component.onSearchInput(dummyEvent);
    expect(service.searchQuery()).toBe('Mamadou');
  });

  it('devrait ouvrir le modal Nouvelle réservation lors du clic sur une case vide', () => {
    component.onEmptySlotClick('106', '2026-11-12');
    expect(modalService.isOpen()).toBe(true);
    expect(modalService.currentParams()?.roomNumber).toBe('106');
    expect(modalService.currentParams()?.checkInDate).toBe('2026-11-12');
    expect(modalService.currentParams()?.checkOutDate).toBe('2026-11-13');
  });

  it('devrait ouvrir le tiroir de détail lors du clic sur une réservation', () => {
    const stopPropagationMock = jest.fn();
    const dummyEvent = {
      stopPropagation: stopPropagationMock
    } as unknown as Event;

    component.onReservationClick('RB-2024-0894', dummyEvent);
    expect(stopPropagationMock).toHaveBeenCalled();
    expect(service.selectedReservationId()).toBe('RB-2024-0894');
  });

  it('devrait fermer le tiroir de détail avec la touche Échap', () => {
    service.openDetail('RB-2024-0894');
    expect(service.selectedReservationId()).toBe('RB-2024-0894');

    component.onEscapePressed();
    expect(service.selectedReservationId()).toBeNull();
  });

  it('devrait exécuter les 4 actions du tiroir : Modifier, Prolonger, Check-in/out, Annuler', () => {
    // 1. Modifier
    service.openDetail('RB-2024-0894');
    component.onModifier('RB-2024-0894');
    expect(modalService.isOpen()).toBe(true);
    expect(modalService.currentParams()?.roomNumber).toBe('301');

    // 2. Prolonger
    const extendSpy = jest.spyOn(service, 'extendReservation');
    component.onProlonger('res-103-faye');
    expect(extendSpy).toHaveBeenCalledWith('res-103-faye', 1);

    // 3. Check-in / out
    const checkInOutSpy = jest.spyOn(service, 'toggleCheckInCheckOut');
    component.onToggleCheckInOut('res-103-faye');
    expect(checkInOutSpy).toHaveBeenCalledWith('res-103-faye');

    // 4. Annuler
    const cancelSpy = jest.spyOn(service, 'cancelReservation');
    component.onAnnuler('res-201-moreau');
    expect(cancelSpy).toHaveBeenCalledWith('res-201-moreau');
  });

  it('devrait calculer les sections du jour mobile sélectionné', () => {
    component.selectedMobileDayIndex.set(0); // 10 nov 2026
    const sections = component.mobileSectionReservations();
    expect(sections).toBeDefined();
    expect(Array.isArray(sections.arrivals)).toBe(true);
    expect(Array.isArray(sections.departures)).toBe(true);
    expect(Array.isArray(sections.staying)).toBe(true);
  });
});
