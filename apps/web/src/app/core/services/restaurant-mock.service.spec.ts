import { RestaurantMockService } from './restaurant-mock.service';

describe('RestaurantMockService', () => {
  let service: RestaurantMockService;

  beforeEach(() => {
    service = new RestaurantMockService();
  });

  it('devrait initialiser les catégories et les plats du menu', () => {
    expect(service.categories().length).toBe(5);
    expect(service.dishes().length).toBe(8);
    expect(service.activeCategoryId()).toBe('cat-1');
  });

  it('devrait calculer le total TTC et la TVA du ticket de commande', () => {
    // Ticket initial : Thiéboudienne (4500) + Poisson (6000) + 2x Bissap (3000) + Saloum (3500) = 17 000 FCFA
    expect(service.ticketTotalTtcFcfa()).toBe(17000);
    // TVA 10%
    expect(service.ticketSubtotalHtFcfa()).toBe(15455);
    expect(service.ticketVatAmountFcfa()).toBe(1545);
  });

  it('devrait ajouter un plat au ticket de commande et mettre à jour la quantité', () => {
    const dish = service.dishes()[0]; // Thiéboudienne (déjà 1 dans le ticket)
    service.addDishToTicket(dish);

    const ticketItem = service.ticketItems().find(it => it.dishId === dish.id);
    expect(ticketItem?.quantity).toBe(2);
    expect(ticketItem?.totalPriceFcfa).toBe(9000);
  });

  it('devrait refuser d’ajouter un plat marqué Épuisé (SOLD_OUT) au ticket', () => {
    const dish = service.dishes()[1];
    service.updateDishStatus(dish.id, 'SOLD_OUT');

    const initialCount = service.ticketItems().length;
    service.addDishToTicket(service.dishes().find(d => d.id === dish.id)!);

    // Aucun nouvel ajout
    expect(service.ticketItems().length).toBe(initialCount);
  });

  it('devrait décrémenter et retirer un article quand la quantité atteint 0', () => {
    const item = service.ticketItems()[0]; // qty 1
    service.decrementItem(item.id);

    const exists = service.ticketItems().some(it => it.id === item.id);
    expect(exists).toBe(false);
  });

  it('devrait filtrer les plats par catégorie et par recherche textuelle', () => {
    service.setActiveCategory('cat-2'); // Boissons
    expect(service.filteredDishes().length).toBe(2);

    service.setSearchQuery('Bissap');
    expect(service.filteredDishes().length).toBe(1);
    expect(service.filteredDishes()[0].name).toContain('Bissap');
  });

  it('devrait masquer les plats archivés dans le catalogue caisse', () => {
    const dishId = service.dishes()[0].id;
    service.updateDishStatus(dishId, 'ARCHIVED');

    const inCatalog = service.filteredDishes().some(d => d.id === dishId);
    expect(inCatalog).toBe(false);
  });
});
