import { BillingCounterResponse, BillingNoteDetail } from '@residence-blue/shared';
import { FacturationService } from './facturation.service';
import { hasPotentialCardPan } from '../models/facturation.model';

describe('FacturationService (V3)', () => {
  let service: FacturationService;

  beforeEach(() => {
    service = new FacturationService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('devrait charger le comptoir serveur avec recherche, filtre, tri et pagination par lot de 50', async () => {
    const mockResp: BillingCounterResponse = {
      kpis: {
        toCollectFcfa: 70000,
        collectedTodayFcfa: 50000,
        unpaidCount: 1,
        departuresTodayToSettleCount: 1,
      },
      dailyCash: {
        dateIso: '2026-11-12',
        totalTodayFcfa: 50000,
        byMethod: {
          CASH: 50000,
          ORANGE_MONEY: 0,
          WAVE: 0,
          CARD: 0,
          BANK_TRANSFER: 0,
        },
      },
      page: {
        items: [
          {
            id: 'inv-1',
            invoiceNumber: null,
            displayNumber: 'Note ouverte',
            documentType: 'INVOICE',
            isIssued: false,
            status: 'OPEN',
            guestId: 'g-1',
            guestName: 'Awa Sene',
            roomNumber: '101',
            stayStartDate: '2026-11-12',
            stayEndDate: '2026-11-14',
            stayLabel: '12/11 → 14/11',
            totalFcfa: 70000,
            paidTotalFcfa: 0,
            balanceFcfa: 70000,
            progressPercent: 0,
            isDepartureToday: false,
            parentInvoiceId: null,
            updatedAt: '2026-11-12T10:00:00.000Z',
          },
        ],
        total: 51,
        offset: 0,
        limit: 50,
        hasMore: true,
      },
    };

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResp,
    } as Response);

    await service.loadCounter({
      search: 'Awa',
      filter: 'TO_PROCESS',
      sortBy: 'balance',
      sortOrder: 'desc',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/invoices/counter?');
    expect(String(url)).toContain('search=Awa');
    expect(String(url)).toContain('filter=TO_PROCESS');
    expect(String(url)).toContain('sortBy=balance');
    expect(String(url)).toContain('sortOrder=desc');
    expect(String(url)).toContain('limit=50');
    expect(service.counter()?.kpis.toCollectFcfa).toBe(70000);
    expect(service.counter()?.page.hasMore).toBe(true);
  });

  it('devrait envoyer une Idempotency-Key UUID unique à chaque encaissement', async () => {
    const updatedNote = {
      id: 'inv-1',
      displayNumber: 'Note ouverte',
      balanceFcfa: 20000,
      paidAmountFcfa: 50000,
    } as unknown as BillingNoteDetail;

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => updatedNote,
    } as Response);

    const ok = await service.recordPayment('inv-1', {
      method: 'WAVE',
      amountFcfa: 50000,
      transactionRef: 'WAV-2026-123',
    });

    expect(ok).toBe(true);
    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(service.currentNote()?.balanceFcfa).toBe(20000);
  });

  it('devrait rejeter les numéros complets de carte bancaire côté modèle', () => {
    expect(hasPotentialCardPan('4532 1111 2222 3333')).toBe(true);
    expect(hasPotentialCardPan('5123456789012345')).toBe(true);
    expect(hasPotentialCardPan('WAV-2026-0042')).toBe(false);
    expect(hasPotentialCardPan('TERMINAL-42')).toBe(false);
  });

  it('devrait rejouer les paiements CREATE_INVOICE_PAYMENT en attente avec leur Idempotency-Key', async () => {
    const fakeIdb = {
      getAll: jest.fn().mockResolvedValue([
        {
          id: 'item-1',
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
          type: 'CREATE_INVOICE_PAYMENT',
          endpoint: '/api/invoices/inv-1/payments',
          payload: { method: 'CASH', amountFcfa: 5000 },
          createdAt: Date.now(),
          status: 'PENDING',
          retryCount: 0,
        },
      ]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const fakeOutbox = {
      isSyncing: () => false,
      refreshPendingCount: jest.fn().mockResolvedValue(0),
    };
    (service as any).idb = fakeIdb;
    (service as any).outbox = fakeOutbox;
    (service as any).network = { isOnline: () => true };

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'inv-1' }),
    } as Response);

    const synced = await service.syncOfflinePayments();
    expect(synced).toBe(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/invoices/inv-1/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
        }),
      }),
    );
    expect(fakeIdb.delete).toHaveBeenCalledWith('outbox', 'item-1');
    expect(fakeOutbox.refreshPendingCount).toHaveBeenCalled();
  });
});
