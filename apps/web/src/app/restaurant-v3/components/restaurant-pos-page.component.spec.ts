import { RestaurantPosPageComponent } from './restaurant-pos-page.component';
import { RestaurantV3Service } from '../services/restaurant-v3.service';
import { RESTAURANT_DEFAULT_PLATE_SVG_URI } from '../models/restaurant-v3.model';

describe('RestaurantPosPageComponent', () => {
  let component: RestaurantPosPageComponent;
  let service: RestaurantV3Service;

  beforeEach(() => {
    component = new RestaurantPosPageComponent();
    service = component.service;
    service.categories.set([
      { id: 'cat-1', name: 'Plats sénégalais & Mer', displayOrder: 1, isArchived: false },
    ]);
    service.products.set([
      {
        id: 'prod-1',
        name: 'Thiéboudienne Royale',
        description: '',
        categoryId: 'cat-1',
        categoryName: 'Plats sénégalais & Mer',
        priceFcfa: 4500,
        tags: [],
        allergens: [],
        prepTimeMinutes: 25,
        prepStation: 'CUISINE',
        availability: { type: 'ALWAYS' },
        options: [],
        vatRatePercent: 10,
        displayOrder: 1,
        status: 'AVAILABLE',
      },
      {
        id: 'prod-2',
        name: 'Poisson Grillé du Jour',
        description: '',
        categoryId: 'cat-1',
        categoryName: 'Plats sénégalais & Mer',
        priceFcfa: 6000,
        tags: [],
        allergens: [],
        prepTimeMinutes: 30,
        prepStation: 'CUISINE',
        availability: { type: 'ALWAYS' },
        options: [],
        vatRatePercent: 10,
        displayOrder: 2,
        status: 'SOLD_OUT',
      },
    ]);
    service.roomsInStay.set([
      {
        roomId: 'r-102',
        roomNumber: '102',
        roomCategory: 'Standard',
        reservationId: 'res-102',
        guestName: 'Amadou Ba',
        checkInDate: '2026-11-12T10:00:00Z',
        checkOutDate: '2026-11-14T12:00:00Z',
      },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ajoute un produit disponible au ticket, calcule le total et ignore un produit épuisé', () => {
    const avail = service.products()[0];
    const soldOut = service.products()[1];

    component.addProductToTicket(soldOut);
    expect(component.draftLines()).toHaveLength(0);

    component.addProductToTicket(avail);
    component.addProductToTicket(avail);
    expect(component.draftLines()).toHaveLength(1);
    expect(component.draftLines()[0].quantity).toBe(2);
    expect(component.ticketTotalFcfa()).toBe(9000);

    component.changeQuantity('prod-1', -1);
    expect(component.ticketTotalFcfa()).toBe(4500);
  });

  it('envoie une commande chambre via ROOM_CHARGE avec les identifiants du séjour actif', async () => {
    const spy = jest.spyOn(service, 'submitOrder').mockResolvedValue(true);

    component.addProductToTicket(service.products()[0]);
    component.selectDestination('ROOM');
    await component.submitTicket('ROOM_CHARGE');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationType: 'ROOM',
        roomNumber: '102',
        reservationId: 'res-102',
        action: 'ROOM_CHARGE',
      }),
    );
  });

  it('utilise la miniature 200 px si présente et bascule sur le SVG par défaut sans image ou après erreur', () => {
    const withThumb = {
      ...service.products()[0],
      photoUrl: '/api/restaurant/products/images/abc-full.webp',
      thumbnailUrl: '/api/restaurant/products/images/abc-200.webp',
    };
    const withoutThumb = {
      ...service.products()[0],
      id: 'prod-no-img',
      photoUrl: '/api/restaurant/products/images/big-only.webp',
      thumbnailUrl: null,
    };

    expect(component.resolveProductImageSrc(withThumb)).toBe(
      '/api/restaurant/products/images/abc-200.webp',
    );
    expect(component.isDefaultProductImage(withThumb)).toBe(false);

    // Ne doit jamais charger l'image grand format dans la grille si la miniature est absente
    expect(component.resolveProductImageSrc(withoutThumb)).toBe(RESTAURANT_DEFAULT_PLATE_SVG_URI);
    expect(component.isDefaultProductImage(withoutThumb)).toBe(true);

    // Bascule immédiate vers le SVG en cas d'erreur de chargement réseau
    component.onProductImageError(withThumb.id);
    expect(component.resolveProductImageSrc(withThumb)).toBe(RESTAURANT_DEFAULT_PLATE_SVG_URI);
    expect(component.isDefaultProductImage(withThumb)).toBe(true);
    expect(component.isProductDisabled(service.products()[1])).toBe(true);
  });
});
