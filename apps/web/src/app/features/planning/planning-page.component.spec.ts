import { PlanningPageComponent } from './planning-page.component';
import { PlanningMockService } from '../../core/services/planning-mock.service';

describe('PlanningPageComponent', () => {
  let component: PlanningPageComponent;
  let service: PlanningMockService;

  beforeEach(() => {
    service = new PlanningMockService();
    component = new PlanningPageComponent(service);
  });

  it('devrait être initialisé correctement', () => {
    expect(component).toBeTruthy();
    expect(component.planningService).toBe(service);
  });

  it('devrait formater les montants en FCFA entiers', () => {
    expect(component.formatAmount(780000)).toBe('780\u202f000 FCFA');
    expect(component.formatAmount(0)).toBe('0 FCFA');
  });

  it('devrait calculer les classes de ligne de chambre correctement', () => {
    const room301 = service.roomsState().find((r) => r.number === '301')!;
    const rowClasses301 = component.getRoomRowClasses(room301);
    expect(rowClasses301).toContain('bg-primary/10');

    const room202 = service.roomsState().find((r) => r.number === '202')!;
    const rowClasses202 = component.getRoomRowClasses(room202);
    expect(rowClasses202).toContain('bg-error-container/20');
  });

  it('devrait calculer les classes de badge de chambre correctement', () => {
    const room301 = service.roomsState().find((r) => r.number === '301')!;
    const badge301 = component.getRoomBadgeClasses(room301);
    expect(badge301).toContain('bg-surface-bright text-primary');

    const room202 = service.roomsState().find((r) => r.number === '202')!;
    const badge202 = component.getRoomBadgeClasses(room202);
    expect(badge202).toContain('bg-error text-on-error');

    const room101 = service.roomsState().find((r) => r.number === '101')!;
    const badge101 = component.getRoomBadgeClasses(room101);
    expect(badge101).toContain('bg-surface-container-high');
  });

  it('devrait mettre à jour la sélection de réservation', () => {
    const res = service.roomsState().find((r) => r.number === '103')?.reservations[0]!;
    component.onSelectReservation(res);
    expect(service.selectedReservationId()).toBe(res.id);
  });

  it('devrait exécuter le relogement du conflit', () => {
    expect(service.conflictBannerVisible()).toBe(true);
    component.onRelocate();
    expect(service.conflictBannerVisible()).toBe(false);
  });

  it('devrait gérer les actions de réception et export Tape Chart', () => {
    component.onExportTapeChart();
    expect(service.lastDragEventMessage()).toContain('Tape Chart (PDF/Excel)');

    component.onAction('Modifier la réservation');
    expect(service.lastDragEventMessage()).toContain('Modifier la réservation');
  });

  it('devrait intercepter les événements de glisser-déposer inactifs', () => {
    const res = service.roomsState().find((r) => r.number === '101')?.reservations[0]!;
    const dummyDragEvent = {
      dataTransfer: {
        setData: jest.fn(),
        effectAllowed: ''
      }
    } as unknown as DragEvent;

    component.onDragStart(dummyDragEvent, res);
    expect(dummyDragEvent.dataTransfer?.setData).toHaveBeenCalled();
    expect(service.lastDragEventMessage()).toContain(res.guestName);

    const dummyDropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        getData: jest.fn().mockReturnValue(JSON.stringify(res))
      }
    } as unknown as DragEvent;

    const targetRoom = service.roomsState().find((r) => r.number === '102')!;
    component.onDrop(dummyDropEvent, targetRoom);
    expect(service.lastDragEventMessage()).toContain('Chambre 102');
  });
});
