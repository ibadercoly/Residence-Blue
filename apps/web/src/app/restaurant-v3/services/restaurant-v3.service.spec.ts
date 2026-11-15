import { RestaurantV3Service } from './restaurant-v3.service';
import { hasPotentialCardPan } from '../models/restaurant-v3.model';

describe('RestaurantV3Service', () => {
  let service: RestaurantV3Service;

  beforeEach(() => {
    service = new RestaurantV3Service();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('charge le catalogue et pagine les commandes par lots de 50', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          categories: [{ id: 'cat-1', name: 'Plats', displayOrder: 1, isArchived: false }],
          products: [
            {
              id: 'p1',
              name: 'Thiéboudienne',
              description: '',
              categoryId: 'cat-1',
              categoryName: 'Plats',
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
          ],
          roomsInStay: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          total: 52,
          offset: 0,
          limit: 50,
          hasMore: true,
        }),
      } as Response);

    await service.loadCatalog();
    await service.loadOrdersPage({ offset: 0, limit: 50 });

    expect(fetchMock).toHaveBeenCalledWith('/api/restaurant/catalog', expect.any(Object));
    expect(service.products()).toHaveLength(1);
    expect(service.ordersPage().hasMore).toBe(true);
    expect(service.ordersPage().total).toBe(52);
  });

  it('retourne conflict409=true et un message clair quand DELETE /products/:id répond 409', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Historique présent : utiliser Désactiver.' }),
    } as Response);

    const res = await service.deleteProduct('prod-used');
    expect(res).toEqual({ ok: false, conflict409: true });
    expect(service.errorMessage()).toContain('Désactiver');
  });

  it('met en file locale hors ligne et bloque la saisie de PAN bancaire', async () => {
    expect(hasPotentialCardPan('4532 1234 5678 9012')).toBe(true);
    expect(hasPotentialCardPan('WAV-7788')).toBe(false);

    const enqueueMock = jest.fn(async () => ({} as any));
    (service as any).network = { isOnline: () => false };
    (service as any).outbox = { enqueue: enqueueMock, syncOutbox: jest.fn(async () => {}) };

    const cardRejected = await service.submitOrder({
      ticketNumber: '#CMD-OFF-1',
      destinationType: 'TAKEAWAY',
      action: 'PAY',
      paymentMethod: 'CARD',
      items: [
        { productId: 'p1', name: 'Bissap', quantity: 1, unitPriceFcfa: 1500, prepStation: 'BAR' },
      ],
    });
    expect(cardRejected).toBe(false);
    expect(service.errorMessage()).toContain('carte');

    const queued = await service.submitOrder({
      ticketNumber: '#CMD-OFF-2',
      destinationType: 'TAKEAWAY',
      action: 'SEND_TO_KITCHEN',
      items: [
        { productId: 'p1', name: 'Bissap', quantity: 2, unitPriceFcfa: 1500, prepStation: 'BAR' },
      ],
    });
    expect(queued).toBe(true);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });
});
