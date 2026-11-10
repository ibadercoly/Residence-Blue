import { RoomStatusCardComponent } from './room-status-card.component';
import { RoomStatus, Role } from '@residence-blue/shared';

describe('RoomStatusCardComponent', () => {
  let component: RoomStatusCardComponent;

  beforeEach(() => {
    component = new RoomStatusCardComponent();
    component.room = {
      id: 'room-101',
      number: '101',
      floor: 1,
      category: 'Standard',
      status: RoomStatus.FREE,
      amenities: ['Climatisation', 'Wi-Fi Fibre'],
      type: { id: 'type-1', name: 'Standard', pricePerNight: 35000, createdAt: new Date(), updatedAt: new Date() },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    component.currentRole = Role.DIRECTION;
  });

  it('devrait être instancié avec le menu fermé', () => {
    expect(component).toBeTruthy();
    expect(component.isMenuOpen()).toBe(false);
  });

  it('devrait basculer l’état du menu avec toggleMenu', () => {
    component.toggleMenu();
    expect(component.isMenuOpen()).toBe(true);
    component.closeMenu();
    expect(component.isMenuOpen()).toBe(false);
  });

  it('devrait fermer le menu sur touche Escape', () => {
    component.toggleMenu();
    expect(component.isMenuOpen()).toBe(true);
    component.onEscape();
    expect(component.isMenuOpen()).toBe(false);
  });

  it('devrait formater les prix en FCFA sans décimaux', () => {
    const formatted = component.formatPrice(35000);
    expect(formatted).toMatch(/35[\s\u202f\u00a0]000/);
    expect(formatted).toContain('FCFA');
  });

  it('devrait émettre onEdit et fermer le menu lors de onActionEdit', () => {
    let editedRoom: any = null;
    component.onEdit.subscribe((r) => {
      editedRoom = r;
    });

    component.toggleMenu();
    component.onActionEdit();
    expect(component.isMenuOpen()).toBe(false);
    expect(editedRoom).toBe(component.room);
  });

  it('devrait émettre onDeactivate et fermer le menu lors de onActionDeactivate', () => {
    let deactivatedRoom: any = null;
    component.onDeactivate.subscribe((r) => {
      deactivatedRoom = r;
    });

    component.toggleMenu();
    component.onActionDeactivate();
    expect(component.isMenuOpen()).toBe(false);
    expect(deactivatedRoom).toBe(component.room);
  });
});
