import { StatusBadgeComponent } from './status-badge.component';
import { RoomStatus } from '@residence-blue/shared';

describe('StatusBadgeComponent', () => {
  let component: StatusBadgeComponent;

  beforeEach(() => {
    component = new StatusBadgeComponent();
  });

  it('devrait normaliser le statut FREE avec le libellé Libre', () => {
    (component as any).status = () => RoomStatus.FREE;
    expect(component.normalizedVariant()).toBe('FREE');
    expect(component.displayLabel()).toBe('Libre');
  });

  it('devrait normaliser le statut OCCUPIED avec le libellé Occupée', () => {
    (component as any).status = () => RoomStatus.OCCUPIED;
    expect(component.normalizedVariant()).toBe('OCCUPIED');
    expect(component.displayLabel()).toBe('Occupée');
  });

  it('devrait normaliser le statut CLEANING avec le libellé Ménage', () => {
    (component as any).status = () => RoomStatus.CLEANING;
    expect(component.normalizedVariant()).toBe('CLEANING');
    expect(component.displayLabel()).toBe('Ménage');
  });

  it('devrait normaliser le statut MAINTENANCE avec le libellé Maintenance sans préfixe EN', () => {
    (component as any).status = () => RoomStatus.MAINTENANCE;
    expect(component.normalizedVariant()).toBe('MAINTENANCE');
    expect(component.displayLabel()).toBe('Maintenance');
  });

  it('devrait afficher INACTIVE quand isActive est false', () => {
    (component as any).status = () => RoomStatus.FREE;
    (component as any).isActive = () => false;
    expect(component.normalizedVariant()).toBe('INACTIVE');
    expect(component.displayLabel()).toBe('Inactive');
  });

  it('devrait respecter un label personnalisé fourni en entrée', () => {
    (component as any).status = () => RoomStatus.FREE;
    (component as any).label = () => 'Arrivée';
    expect(component.displayLabel()).toBe('Arrivée');
  });
});
