import { RestaurantPageComponent } from './restaurant-page.component';
import { RestaurantMockService } from '../../core/services/restaurant-mock.service';
import { AuthMockService } from '../../core/services/auth-mock.service';
import { Role } from '@residence-blue/shared';

describe('RestaurantPageComponent', () => {
  let component: RestaurantPageComponent;
  let service: RestaurantMockService;
  let authService: AuthMockService;

  beforeEach(() => {
    component = new RestaurantPageComponent();
    service = component.restaurantService;
    authService = component.authService;
  });

  it('devrait être initialisé avec les catégories et les plats', () => {
    expect(component).toBeTruthy();
    expect(component.categories().length).toBe(5);
    expect(component.filteredDishes().length).toBeGreaterThan(0);
  });

  it('devrait basculer de catégorie active', () => {
    component.selectCategory('cat-2');
    expect(component.activeCategory()).toBe('cat-2');
  });

  it('devrait ajouter un plat disponible au ticket', () => {
    const dish = component.filteredDishes()[0];
    const initialQty = component.ticketItems().find(it => it.dishId === dish.id)?.quantity || 0;

    component.onDishClick(dish);
    const updatedQty = component.ticketItems().find(it => it.dishId === dish.id)?.quantity || 0;
    expect(updatedQty).toBe(initialQty + 1);
  });

  it('devrait refuser d’ajouter un plat épuisé et afficher un message toast', () => {
    const dish = component.filteredDishes()[0];
    service.updateDishStatus(dish.id, 'SOLD_OUT');

    const updatedDish = service.dishes().find(d => d.id === dish.id)!;
    const initialTotal = component.ticketTotalTtc();
    component.onDishClick(updatedDish);

    expect(component.ticketTotalTtc()).toBe(initialTotal);
    expect(component.toastMessage()).toContain('épuisé');
  });

  it('devrait vider le ticket de commande', () => {
    expect(component.ticketItems().length).toBeGreaterThan(0);
    component.clearTicket();
    expect(component.ticketItems().length).toBe(0);
    expect(component.ticketTotalTtc()).toBe(0);
  });

  it('devrait autoriser la gestion du menu pour DIRECTION et RESTAURANT', () => {
    // Par défaut Aïssatou Ba ou DIRECTION
    expect(component.canManageMenu()).toBe(true);
  });

  it('devrait masquer la gestion du menu pour MAINTENANCE', () => {
    // Simuler un utilisateur maintenance
    const sessionSpy = jest.spyOn(authService, 'currentUser').mockReturnValue({
      id: 'usr-maint',
      email: 'maint@residenceblue.sn',
      fullName: 'Moussa Ndiaye',
      role: Role.MAINTENANCE,
      jobTitle: 'Maintenance'
    });

    expect(component.canManageMenu()).toBe(false);
    sessionSpy.mockRestore();
  });
});
