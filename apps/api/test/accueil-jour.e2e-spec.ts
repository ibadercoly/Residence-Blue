import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import {
  InvoiceDocumentType,
  InvoiceStatus,
  PaymentMethod,
  ReservationStatus,
} from '@prisma/client';
import { Role } from '@residence-blue/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccueilService, getDakarDayBounds } from '../src/accueil/accueil.service';
import { issueDbTestToken } from './auth-test.helper';

describe('Accueil du jour — GET /api/accueil/jour (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accueilService: AccueilService;

  const roleTokens: Record<string, string> = {};
  const createdGuestIds: string[] = [];
  const createdResIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    accueilService = moduleFixture.get<AccueilService>(AccueilService);

    // Nettoyer d'éventuels résidus RES-ACC- / #CMD-ACC-
    const staleOrders = await prisma.restaurantOrder.findMany({
      where: { ticketNumber: { startsWith: '#CMD-ACC-' } },
      select: { id: true, invoiceId: true },
    });
    if (staleOrders.length > 0) {
      await prisma.restaurantOrderLine.deleteMany({
        where: { orderId: { in: staleOrders.map((o) => o.id) } },
      });
      await prisma.restaurantOrder.deleteMany({
        where: { id: { in: staleOrders.map((o) => o.id) } },
      });
    }
    const staleInvs = await prisma.invoice.findMany({
      where: { invoiceNumber: { startsWith: 'FA-ACC-' } },
      select: { id: true },
    });
    if (staleInvs.length > 0) {
      const ids = staleInvs.map((i) => i.id);
      await prisma.payment.deleteMany({ where: { invoiceId: { in: ids } } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
      await prisma.invoice.deleteMany({ where: { id: { in: ids } } });
    }
    const staleRes = await prisma.reservation.findMany({
      where: { reference: { startsWith: 'RES-ACC-' } },
      select: { id: true },
    });
    if (staleRes.length > 0) {
      await prisma.reservation.deleteMany({ where: { id: { in: staleRes.map((r) => r.id) } } });
    }

    for (const r of [
      Role.DIRECTION,
      Role.COMPTABLE,
      Role.RECEPTION,
      Role.RESTAURANT,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
      Role.CUISINE,
    ]) {
      roleTokens[r] = (await issueDbTestToken(prisma, r)).token;
    }
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (createdOrderIds.length > 0) {
        await prisma.restaurantOrderLine.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
        await prisma.restaurantOrder.deleteMany({
          where: { id: { in: createdOrderIds } },
        });
      }
      if (createdInvoiceIds.length > 0) {
        await prisma.payment.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
        await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
      }
      if (createdResIds.length > 0) {
        await prisma.reservation.deleteMany({ where: { id: { in: createdResIds } } });
      }
      if (createdGuestIds.length > 0) {
        await prisma.guest.deleteMany({ where: { id: { in: createdGuestIds } } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('correspond exactement aux requêtes directes en base, exclut la veille/annulées, respecte minuit Dakar et le RBAC en < 300 ms', async () => {
    const bounds = getDakarDayBounds(new Date());
    const yesterday = new Date(bounds.startOfDay.getTime() - 3 * 3600_000);
    const twoDaysAgo = new Date(bounds.startOfDay.getTime() - 48 * 3600_000);
    const todayNoon = new Date(bounds.startOfDay.getTime() + 12 * 3600_000);
    const suffix = Date.now();

    // 1. Clients : 1 d'aujourd'hui + 1 d'hier
    const guestToday = await prisma.guest.create({
      data: {
        civility: 'M.',
        firstName: 'Cheikh',
        lastName: `AccToday_${suffix}`,
        fullName: `Cheikh AccToday_${suffix}`,
        phone: `+22177${String(suffix).slice(-7)}`,
        createdAt: todayNoon,
      },
    });
    createdGuestIds.push(guestToday.id);

    const guestYesterday = await prisma.guest.create({
      data: {
        civility: 'Mme',
        firstName: 'Mariama',
        lastName: `AccYest_${suffix}`,
        fullName: `Mariama AccYest_${suffix}`,
        phone: `+22178${String(suffix).slice(-7)}`,
        createdAt: yesterday,
      },
    });
    createdGuestIds.push(guestYesterday.id);

    // Trouver deux chambres disponibles sur une fenêtre distincte pour les réservations du test
    const rooms = await prisma.room.findMany({ orderBy: { number: 'asc' } });
    const occupiedTodayRoomIds = new Set(
      (
        await prisma.reservation.findMany({
          where: {
            status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
            checkInDate: { lt: bounds.endOfDay },
            checkOutDate: { gt: twoDaysAgo },
          },
          select: { roomId: true },
        })
      ).map((r) => r.roomId),
    );
    const freeRooms = rooms.filter((r) => !occupiedTodayRoomIds.has(r.id));
    if (freeRooms.length >= 2) {
      const tomorrow = new Date(bounds.startOfDay.getTime() + 86_400_000);
      const resArrival = await prisma.reservation.create({
        data: {
          reference: `RES-ACC-${suffix}-1`,
          guestId: guestToday.id,
          roomId: freeRooms[0].id,
          checkInDate: bounds.startOfDay,
          checkOutDate: tomorrow,
          nights: 1,
          status: ReservationStatus.CHECKED_IN,
          checkedInAt: todayNoon,
          totalFcfa: 35000,
        },
      });
      createdResIds.push(resArrival.id);

      const resDeparture = await prisma.reservation.create({
        data: {
          reference: `RES-ACC-${suffix}-2`,
          guestId: guestYesterday.id,
          roomId: freeRooms[1].id,
          checkInDate: twoDaysAgo,
          checkOutDate: bounds.startOfDay,
          nights: 2,
          status: ReservationStatus.CHECKED_OUT,
          checkedInAt: twoDaysAgo,
          checkedOutAt: todayNoon,
          totalFcfa: 70000,
        },
      });
      createdResIds.push(resDeparture.id);
    }

    // 2. Factures & paiements : aujourd'hui vs veille (la veille ne doit pas être comptée aujourd'hui)
    const invYesterday = await prisma.invoice.create({
      data: {
        invoiceNumber: `FA-ACC-Y-${suffix}`,
        documentType: InvoiceDocumentType.INVOICE,
        isIssued: true,
        guestId: guestYesterday.id,
        totalFcfa: 99000,
        paidAmountFcfa: 99000,
        balanceFcfa: 0,
        status: InvoiceStatus.PAID,
        issuedAt: yesterday,
        settledAt: yesterday,
      },
    });
    createdInvoiceIds.push(invYesterday.id);

    await prisma.payment.create({
      data: {
        invoiceId: invYesterday.id,
        method: PaymentMethod.CASH,
        amountFcfa: 99000,
        paidAt: yesterday,
      },
    });

    const invTodayIssued = await prisma.invoice.create({
      data: {
        invoiceNumber: `FA-ACC-T-${suffix}`,
        documentType: InvoiceDocumentType.INVOICE,
        isIssued: true,
        guestId: guestToday.id,
        totalFcfa: 45000,
        paidAmountFcfa: 45000,
        balanceFcfa: 0,
        status: InvoiceStatus.PAID,
        issuedAt: todayNoon,
        settledAt: todayNoon,
      },
    });
    createdInvoiceIds.push(invTodayIssued.id);

    await prisma.payment.create({
      data: {
        invoiceId: invTodayIssued.id,
        method: PaymentMethod.WAVE,
        amountFcfa: 45000,
        paidAt: todayNoon,
      },
    });

    const invPendingNote = await prisma.invoice.create({
      data: {
        documentType: InvoiceDocumentType.INVOICE,
        isIssued: false,
        guestId: guestToday.id,
        totalFcfa: 25000,
        paidAmountFcfa: 0,
        balanceFcfa: 25000,
        status: InvoiceStatus.OPEN,
        issuedAt: todayNoon,
      },
    });
    createdInvoiceIds.push(invPendingNote.id);

    // 3. Commandes restaurant : égalité de quantité départagée par CA, commande annulée & veille exclues
    const ordTie = await prisma.restaurantOrder.create({
      data: {
        ticketNumber: `#CMD-ACC-${suffix}-1`,
        destinationType: 'TABLE',
        tableLabel: 'Table 2',
        status: 'SERVED',
        totalTtcFcfa: 28000,
        createdAt: todayNoon,
        lines: {
          create: [
            {
              name: `Plat Égalité Petit_${suffix}`,
              quantity: 4,
              unitPriceFcfa: 2000,
              totalPriceFcfa: 8000,
            },
            {
              name: `Plat Égalité Cher_${suffix}`,
              quantity: 4,
              unitPriceFcfa: 5000,
              totalPriceFcfa: 20000,
            },
          ],
        },
      },
    });
    createdOrderIds.push(ordTie.id);

    const ordCancelled = await prisma.restaurantOrder.create({
      data: {
        ticketNumber: `#CMD-ACC-${suffix}-C`,
        destinationType: 'TABLE',
        tableLabel: 'Table 3',
        status: 'CANCELLED',
        cancellationReason: 'Annulation test',
        totalTtcFcfa: 150000,
        createdAt: todayNoon,
        lines: {
          create: [
            {
              name: `Plat Annulé Exclu_${suffix}`,
              quantity: 20,
              unitPriceFcfa: 7500,
              totalPriceFcfa: 150000,
            },
          ],
        },
      },
    });
    createdOrderIds.push(ordCancelled.id);

    const ordYesterday = await prisma.restaurantOrder.create({
      data: {
        ticketNumber: `#CMD-ACC-${suffix}-Y`,
        destinationType: 'TAKEAWAY',
        status: 'SERVED',
        totalTtcFcfa: 80000,
        createdAt: yesterday,
        lines: {
          create: [
            {
              name: `Plat Veille Exclu_${suffix}`,
              quantity: 16,
              unitPriceFcfa: 5000,
              totalPriceFcfa: 80000,
            },
          ],
        },
      },
    });
    createdOrderIds.push(ordYesterday.id);

    // Préchauffer le pool Prisma puis mesurer la latence nominale de GET /api/accueil/jour (< 300 ms)
    await request(app.getHttpServer())
      .get('/api/accueil/jour')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .expect(200);

    const t0 = Date.now();
    const resDir = await request(app.getHttpServer())
      .get('/api/accueil/jour')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .expect(200);
    const elapsedMs = Date.now() - t0;
    console.log(`ACCUEIL_E2E_ELAPSED_MS=${elapsedMs}`);
    expect(elapsedMs).toBeLessThan(300);

    // Requêtes directes en base pour vérifier l'égalité stricte de chaque chiffre
    const [
      dbArrivalsExp,
      dbArrivalsDone,
      dbDepExp,
      dbDepDone,
      dbInStay,
      dbNewGuests,
      dbIssuedToday,
      dbNotesPending,
      dbTodayPayments,
      dbOrdersToday,
    ] = await Promise.all([
      prisma.reservation.count({
        where: {
          checkInDate: { gte: bounds.startOfDay, lt: bounds.endOfDay },
          status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
        },
      }),
      prisma.reservation.count({
        where: {
          checkInDate: { gte: bounds.startOfDay, lt: bounds.endOfDay },
          status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT] },
        },
      }),
      prisma.reservation.count({
        where: {
          checkOutDate: { gte: bounds.startOfDay, lt: bounds.endOfDay },
          status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
        },
      }),
      prisma.reservation.count({
        where: {
          checkOutDate: { gte: bounds.startOfDay, lt: bounds.endOfDay },
          status: ReservationStatus.CHECKED_OUT,
        },
      }),
      prisma.reservation.findMany({
        where: { status: ReservationStatus.CHECKED_IN },
        distinct: ['guestId'],
        select: { guestId: true },
      }),
      prisma.guest.count({
        where: { createdAt: { gte: bounds.startOfDay, lt: bounds.endOfDay } },
      }),
      prisma.invoice.aggregate({
        where: {
          documentType: InvoiceDocumentType.INVOICE,
          isIssued: true,
          status: { not: InvoiceStatus.CANCELLED },
          issuedAt: { gte: bounds.startOfDay, lt: bounds.endOfDay },
        },
        _sum: { totalFcfa: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: {
          documentType: InvoiceDocumentType.INVOICE,
          isIssued: false,
          status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIAL] },
          balanceFcfa: { gt: 0 },
        },
        _sum: { balanceFcfa: true },
        _count: { _all: true },
      }),
      prisma.payment.findMany({
        where: { paidAt: { gte: bounds.startOfDay, lt: bounds.endOfDay } },
        select: { amountFcfa: true },
      }),
      prisma.restaurantOrder.findMany({
        where: {
          createdAt: { gte: bounds.startOfDay, lt: bounds.endOfDay },
          status: { not: 'CANCELLED' },
        },
        select: { totalTtcFcfa: true },
      }),
    ]);

    const expectedCollected = dbTodayPayments.reduce((s, p) => s + p.amountFcfa, 0);
    const expectedRestoRevenue = dbOrdersToday.reduce((s, o) => s + o.totalTtcFcfa, 0);

    expect(resDir.body.timezone).toBe('Africa/Dakar');
    expect(resDir.body.dateDakarIso).toBe(bounds.dateDakarIso);
    expect(resDir.body.clients).toEqual({
      arrivalsDone: dbArrivalsDone,
      arrivalsExpected: dbArrivalsExp,
      departuresDone: dbDepDone,
      departuresExpected: dbDepExp,
      guestsInStay: dbInStay.length,
      newGuestsToday: dbNewGuests,
    });
    expect(resDir.body.billing.issuedInvoicesToday).toBe(dbIssuedToday._count._all);
    expect(resDir.body.billing.totalBilledTodayFcfa).toBe(dbIssuedToday._sum.totalFcfa ?? 0);
    expect(resDir.body.billing.notesToSettleCount).toBe(dbNotesPending._count._all);
    expect(resDir.body.billing.remainingToCollectFcfa).toBe(dbNotesPending._sum.balanceFcfa ?? 0);
    expect(resDir.body.billing.totalCollectedTodayFcfa).toBe(expectedCollected);
    expect(resDir.body.restaurant.ordersCount).toBe(dbOrdersToday.length);
    expect(resDir.body.restaurant.revenueFcfa).toBe(expectedRestoRevenue);

    // Vérifier qu'annulées et veille ne figurent pas dans les tops et que l'égalité privilégie le plus gros CA
    const dishNames = (resDir.body.restaurant.topDishes as Array<{ name: string }>).map((d) => d.name);
    expect(dishNames).not.toContain(`Plat Annulé Exclu_${suffix}`);
    expect(dishNames).not.toContain(`Plat Veille Exclu_${suffix}`);
    const idxCher = dishNames.indexOf(`Plat Égalité Cher_${suffix}`);
    const idxPetit = dishNames.indexOf(`Plat Égalité Petit_${suffix}`);
    if (idxCher !== -1 && idxPetit !== -1) {
      expect(idxCher).toBeLessThan(idxPetit);
    }

    // Changement de jour à minuit Dakar (test réel sur la base pour la journée de veille)
    const yesterdayStats = await accueilService.getDailyStats(Role.DIRECTION, yesterday);
    expect(yesterdayStats.dateDakarIso).not.toBe(bounds.dateDakarIso);
    expect(yesterdayStats.billing?.totalBilledTodayFcfa).toBeGreaterThanOrEqual(99000);
    expect(yesterdayStats.restaurant?.ordersCount).toBeGreaterThanOrEqual(1);

    // RBAC strict : blocs interdits absents du JSON
    for (const fullRole of [Role.COMPTABLE, Role.RECEPTION]) {
      const rFull = await request(app.getHttpServer())
        .get('/api/accueil/jour')
        .set('Authorization', `Bearer ${roleTokens[fullRole]}`)
        .expect(200);
      expect(rFull.body.visibleBlocks).toEqual(['CLIENTS', 'BILLING', 'RESTAURANT']);
    }

    const rResto = await request(app.getHttpServer())
      .get('/api/accueil/jour')
      .set('Authorization', `Bearer ${roleTokens[Role.RESTAURANT]}`)
      .expect(200);
    expect(rResto.body.visibleBlocks).toEqual(['RESTAURANT']);
    expect('clients' in rResto.body).toBe(false);
    expect('billing' in rResto.body).toBe(false);

    const rMaint = await request(app.getHttpServer())
      .get('/api/accueil/jour')
      .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`)
      .expect(200);
    expect(rMaint.body.visibleBlocks).toEqual(['CLIENTS']);
    expect('billing' in rMaint.body).toBe(false);
    expect('restaurant' in rMaint.body).toBe(false);
    expect(JSON.stringify(rMaint.body)).not.toContain('Fcfa');

    // HOUSEKEEPING n'a accès qu'à Chambres (aucun accès Accueil)
    await request(app.getHttpServer())
      .get('/api/accueil/jour')
      .set('Authorization', `Bearer ${roleTokens[Role.HOUSEKEEPING]}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/accueil/jour')
      .set('Authorization', `Bearer ${roleTokens[Role.CUISINE]}`)
      .expect(403);

    await request(app.getHttpServer()).get('/api/accueil/jour').expect(401);
  });
});
