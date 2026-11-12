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
import { RapportsService } from '../src/rapports/rapports.service';
import {
  addDakarDays,
  dakarStartOfDay,
  resolveDakarPeriodWindow,
  toDakarIsoDate,
} from '../src/rapports/rapports-date.util';
import { issueDbTestToken } from './auth-test.helper';

// Forcer strictement la base de test séparée residence_blue_e2e (jamais la base de développement)
function ensureSeparateTestDatabaseUrl(): void {
  const raw = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '';
  const parsed = new URL(raw);
  parsed.pathname = '/residence_blue_e2e';
  process.env.DATABASE_URL = parsed.toString();
}
ensureSeparateTestDatabaseUrl();

describe('Rapports — GET /api/rapports (e2e sur base de test séparée)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rapportsService: RapportsService;

  const roleTokens: Record<string, string> = {};
  const createdGuestIds: string[] = [];
  const createdResIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdOrderIds: string[] = [];

  async function cleanupRapportsFixtures() {
    const staleOrders = await prisma.restaurantOrder.findMany({
      where: { ticketNumber: { startsWith: '#CMD-RAP-' } },
      select: { id: true },
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
      where: { invoiceNumber: { startsWith: 'FA-RAP-' } },
      select: { id: true },
    });
    if (staleInvs.length > 0) {
      const ids = staleInvs.map((i) => i.id);
      await prisma.payment.deleteMany({ where: { invoiceId: { in: ids } } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
      await prisma.invoice.deleteMany({ where: { parentInvoiceId: { in: ids } } });
      await prisma.invoice.deleteMany({ where: { id: { in: ids } } });
    }
    const staleRes = await prisma.reservation.findMany({
      where: { reference: { startsWith: 'RES-RAP-' } },
      select: { id: true },
    });
    if (staleRes.length > 0) {
      await prisma.reservation.deleteMany({
        where: { id: { in: staleRes.map((r) => r.id) } },
      });
    }
  }

  beforeAll(async () => {
    expect(process.env.DATABASE_URL).toContain('residence_blue_e2e');
    expect(process.env.DATABASE_URL).not.toContain('/residence_blue_db');

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
    rapportsService = moduleFixture.get<RapportsService>(RapportsService);

    await cleanupRapportsFixtures();

    for (const r of [
      Role.DIRECTION,
      Role.COMPTABLE,
      Role.RECEPTION,
      Role.RESTAURANT,
      Role.SERVEUR,
      Role.CUISINE,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
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

  it('vérifie le RBAC strict : 200 pour DIRECTION et COMPTABLE, 403 pour tous les autres rôles', async () => {
    const okDir = await request(app.getHttpServer())
      .get('/api/rapports?periode=30j')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`);
    expect(okDir.status).toBe(200);

    const okComptable = await request(app.getHttpServer())
      .get('/api/rapports?periode=30j')
      .set('Authorization', `Bearer ${roleTokens[Role.COMPTABLE]}`);
    expect(okComptable.status).toBe(200);

    for (const denied of [
      Role.RECEPTION,
      Role.RESTAURANT,
      Role.SERVEUR,
      Role.CUISINE,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
    ]) {
      const res = await request(app.getHttpServer())
        .get('/api/rapports?periode=30j')
        .set('Authorization', `Bearer ${roleTokens[denied]}`);
      expect(res.status).toBe(403);
    }
  });

  it('période vide : aucune tuile, aucun diagramme, aucun tableau ; une seule facture : seuls les blocs avec assez de données apparaissent', async () => {
    // Choisir une date de référence isolée dans le passé (ex. 2021-06-15) sans aucune donnée en base
    const emptyRef = new Date('2021-06-15T12:00:00.000Z');
    const emptyRep = await rapportsService.getReport('30j', emptyRef);

    expect(emptyRep.hasData).toBe(false);
    expect(emptyRep.previousPeriodHasData).toBe(false);
    expect(emptyRep.tiles).toBeUndefined();
    expect(emptyRep.revenueEvolution).toBeUndefined();
    expect(emptyRep.salesByTypeByWeek).toBeUndefined();
    expect(emptyRep.occupancyByDay).toBeUndefined();
    expect(emptyRep.paymentsByMethod).toBeUndefined();
    expect(emptyRep.reservationSources).toBeUndefined();
    expect(emptyRep.salesByRoomCategory).toBeUndefined();
    expect(emptyRep.weekdayAverages).toBeUndefined();
    expect(emptyRep.topDishes).toBeUndefined();
    expect(emptyRep.dailyTable).toBeUndefined();

    // Créer UNE SEULE facture d'hébergement sur cette période isolée (2021-06-10) sans période précédente
    const room = await prisma.room.findFirstOrThrow({ where: { isActive: true } });
    const singleInv = await prisma.invoice.create({
      data: {
        invoiceNumber: `FA-RAP-SINGLE-${Date.now()}`,
        documentType: InvoiceDocumentType.INVOICE,
        isIssued: true,
        roomId: room.id,
        subtotalHtFcfa: 45000,
        vatRatePercent: 10,
        vatAmountFcfa: 4500,
        totalFcfa: 49500,
        paidAmountFcfa: 0,
        balanceFcfa: 49500,
        status: InvoiceStatus.OPEN,
        issuedAt: new Date('2021-06-10T14:00:00.000Z'),
        lines: {
          create: [
            {
              description: 'Nuitée chambre',
              category: 'HEBERGEMENT',
              quantity: 1,
              unitPriceFcfa: 49500,
              totalPriceFcfa: 49500,
            },
          ],
        },
      },
    });
    createdInvoiceIds.push(singleInv.id);

    const singleRep = await rapportsService.getReport('30j', emptyRef);
    expect(singleRep.hasData).toBe(true);
    expect(singleRep.previousPeriodHasData).toBe(false);
    // Pas de comparaison car période précédente vide
    expect(singleRep.tiles?.revenue).toEqual({ amountFcfa: 45000 });
    expect(singleRep.tiles?.accommodation).toEqual({ amountFcfa: 45000, sharePercent: 100 });
    expect(singleRep.tiles?.remaining).toEqual({ amountFcfa: 49500 });
    expect(singleRep.tiles?.restaurant).toBeUndefined();
    expect(singleRep.tiles?.collected).toBeUndefined();
    expect(singleRep.tiles?.occupancy).toBeUndefined();
    // 1 seul point non nul -> pas de courbe d'évolution
    expect(singleRep.revenueEvolution).toBeUndefined();
    expect(singleRep.paymentsByMethod).toBeUndefined();
    expect(singleRep.topDishes).toBeUndefined();
    expect(singleRep.salesByTypeByWeek?.some((w) => w.totalFcfa === 45000)).toBe(true);
  });

  it('chaque tuile égale une requête SQL directe, exclut les annulations, déduit les avoirs et respecte minuit de Dakar en < 1 s', async () => {
    const now = new Date();
    const todayIso = toDakarIsoDate(now);
    const twoDaysAgoIso = addDakarDays(todayIso, -2);
    const fiveDaysAgoIso = addDakarDays(todayIso, -5);
    const beforePeriodMidnight = new Date(
      dakarStartOfDay(addDakarDays(todayIso, -29)).getTime() - 1000,
    ); // 23:59:59 UTC la veille du début de la fenêtre 30j

    const room = await prisma.room.findFirstOrThrow({ where: { isActive: true } });
    const guest = await prisma.guest.create({
      data: {
        firstName: 'Awa',
        lastName: 'TestsRapports',
        fullName: 'Awa TestsRapports',
        phone: `+22177${String(Date.now()).slice(-7)}`,
      },
    });
    createdGuestIds.push(guest.id);

    const resStay = await prisma.reservation.create({
      data: {
        reference: `RES-RAP-${Date.now()}-1`,
        guestId: guest.id,
        roomId: room.id,
        checkInDate: dakarStartOfDay(fiveDaysAgoIso),
        checkOutDate: dakarStartOfDay(twoDaysAgoIso),
        nights: 3,
        status: ReservationStatus.CHECKED_OUT,
        source: 'BOOKING',
        totalFcfa: 120000,
      },
    });
    createdResIds.push(resStay.id);

    // 1. Facture valide jour J-5 (Hébergement + Restaurant)
    const invValid1 = await prisma.invoice.create({
      data: {
        invoiceNumber: `FA-RAP-${Date.now()}-1`,
        documentType: InvoiceDocumentType.INVOICE,
        isIssued: true,
        roomId: room.id,
        reservationId: resStay.id,
        guestId: guest.id,
        subtotalHtFcfa: 100000,
        vatRatePercent: 10,
        vatAmountFcfa: 10000,
        totalFcfa: 110000,
        paidAmountFcfa: 80000,
        balanceFcfa: 30000,
        status: InvoiceStatus.PARTIAL,
        issuedAt: new Date(`${fiveDaysAgoIso}T15:00:00.000Z`),
        lines: {
          create: [
            {
              description: 'Séjour 2 nuits',
              category: 'HEBERGEMENT',
              quantity: 2,
              unitPriceFcfa: 38500,
              totalPriceFcfa: 77000,
            },
            {
              description: 'Repas chambre',
              category: 'RESTAURANT',
              quantity: 1,
              unitPriceFcfa: 33000,
              totalPriceFcfa: 33000,
            },
          ],
        },
        payments: {
          create: [
            {
              method: PaymentMethod.WAVE,
              amountFcfa: 80000,
              paidAt: new Date(`${fiveDaysAgoIso}T16:00:00.000Z`),
            },
          ],
        },
      },
    });
    createdInvoiceIds.push(invValid1.id);

    // 2. Facture valide jour J-2 + Avoir déduit
    const invValid2 = await prisma.invoice.create({
      data: {
        invoiceNumber: `FA-RAP-${Date.now()}-2`,
        documentType: InvoiceDocumentType.INVOICE,
        isIssued: true,
        roomId: room.id,
        guestId: guest.id,
        subtotalHtFcfa: 60000,
        vatRatePercent: 10,
        vatAmountFcfa: 6000,
        totalFcfa: 66000,
        paidAmountFcfa: 66000,
        balanceFcfa: 0,
        status: InvoiceStatus.PAID,
        issuedAt: new Date(`${twoDaysAgoIso}T11:00:00.000Z`),
        lines: {
          create: [
            {
              description: 'Nuitée',
              category: 'HEBERGEMENT',
              quantity: 1,
              unitPriceFcfa: 66000,
              totalPriceFcfa: 66000,
            },
          ],
        },
        payments: {
          create: [
            {
              method: PaymentMethod.CASH,
              amountFcfa: 66000,
              paidAt: new Date(`${twoDaysAgoIso}T11:30:00.000Z`),
            },
          ],
        },
      },
    });
    createdInvoiceIds.push(invValid2.id);

    const creditNote = await prisma.invoice.create({
      data: {
        invoiceNumber: `FA-RAP-AV-${Date.now()}`,
        documentType: InvoiceDocumentType.CREDIT_NOTE,
        isIssued: true,
        parentInvoiceId: invValid2.id,
        roomId: room.id,
        guestId: guest.id,
        subtotalHtFcfa: -15000,
        vatRatePercent: 10,
        vatAmountFcfa: -1500,
        totalFcfa: -16500,
        paidAmountFcfa: 0,
        balanceFcfa: 0,
        status: InvoiceStatus.PAID,
        issuedAt: new Date(`${twoDaysAgoIso}T18:00:00.000Z`),
        lines: {
          create: [
            {
              description: 'Avoir geste commercial',
              category: 'AUTRES',
              quantity: 1,
              unitPriceFcfa: -16500,
              totalPriceFcfa: -16500,
            },
          ],
        },
      },
    });
    createdInvoiceIds.push(creditNote.id);

    // 3. Facture ANNULÉE aujourd'hui (ne doit JAMAIS être comptée)
    const invCancelled = await prisma.invoice.create({
      data: {
        invoiceNumber: `FA-RAP-CANC-${Date.now()}`,
        documentType: InvoiceDocumentType.INVOICE,
        isIssued: true,
        subtotalHtFcfa: 500000,
        totalFcfa: 550000,
        balanceFcfa: 550000,
        status: InvoiceStatus.CANCELLED,
        issuedAt: new Date(`${todayIso}T10:00:00.000Z`),
      },
    });
    createdInvoiceIds.push(invCancelled.id);

    // 4. Facture à 23:59:59 UTC juste avant le début de la période 30j (appartient à la période précédente !)
    const invPrevBoundary = await prisma.invoice.create({
      data: {
        invoiceNumber: `FA-RAP-PREV-${Date.now()}`,
        documentType: InvoiceDocumentType.INVOICE,
        isIssued: true,
        roomId: room.id,
        subtotalHtFcfa: 40000,
        totalFcfa: 44000,
        balanceFcfa: 0,
        status: InvoiceStatus.PAID,
        issuedAt: beforePeriodMidnight,
      },
    });
    createdInvoiceIds.push(invPrevBoundary.id);

    // 5. Commande restaurant servie + commande annulée
    const orderServed = await prisma.restaurantOrder.create({
      data: {
        ticketNumber: `#CMD-RAP-${Date.now()}-1`,
        destinationType: 'TABLE',
        tableLabel: 'Table 2',
        status: 'SERVED',
        subtotalHtFcfa: 20000,
        vatAmountFcfa: 2000,
        totalTtcFcfa: 22000,
        createdAt: new Date(`${twoDaysAgoIso}T13:00:00.000Z`),
        lines: {
          create: [
            {
              name: 'Thiéboudienne Royal',
              quantity: 2,
              unitPriceFcfa: 11000,
              totalPriceFcfa: 22000,
            },
          ],
        },
      },
    });
    createdOrderIds.push(orderServed.id);

    const orderCancelled = await prisma.restaurantOrder.create({
      data: {
        ticketNumber: `#CMD-RAP-${Date.now()}-2`,
        destinationType: 'TABLE',
        tableLabel: 'Table 3',
        status: 'CANCELLED',
        subtotalHtFcfa: 90000,
        vatAmountFcfa: 9000,
        totalTtcFcfa: 99000,
        createdAt: new Date(`${twoDaysAgoIso}T14:00:00.000Z`),
        lines: {
          create: [
            {
              name: 'Plat Annulé Fantôme',
              quantity: 9,
              unitPriceFcfa: 11000,
              totalPriceFcfa: 99000,
            },
          ],
        },
      },
    });
    createdOrderIds.push(orderCancelled.id);

    const t0 = Date.now();
    const res = await request(app.getHttpServer())
      .get('/api/rapports?periode=30j')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`);
    const elapsedMs = Date.now() - t0;

    expect(res.status).toBe(200);
    expect(elapsedMs).toBeLessThan(1000);

    const body = res.body;
    const window = resolveDakarPeriodWindow('30j', now);

    // Requêtes SQL directes de référence sur la base de test
    const [sqlRevRow] = await prisma.$queryRaw<Array<{ rev: bigint }>>`
      SELECT COALESCE(SUM("subtotal_ht_fcfa"), 0)::bigint AS rev
      FROM "invoices"
      WHERE "status"::text <> 'CANCELLED'
        AND "issued_at" >= ${window.startDate}
        AND "issued_at" < ${window.endExclusiveDate}
    `;
    const [sqlRemRow] = await prisma.$queryRaw<Array<{ rem: bigint }>>`
      SELECT COALESCE(SUM("balance_fcfa"), 0)::bigint AS rem
      FROM "invoices"
      WHERE "status"::text IN ('OPEN', 'PARTIAL')
        AND "document_type"::text = 'INVOICE'
        AND "balance_fcfa" > 0
        AND "issued_at" >= ${window.startDate}
        AND "issued_at" < ${window.endExclusiveDate}
    `;
    const [sqlColRow] = await prisma.$queryRaw<Array<{ col: bigint }>>`
      SELECT COALESCE(SUM(p."amount_fcfa"), 0)::bigint AS col
      FROM "payments" p
      INNER JOIN "invoices" i ON i."id" = p."invoice_id"
      WHERE i."status"::text <> 'CANCELLED'
        AND p."paid_at" >= ${window.startDate}
        AND p."paid_at" < ${window.endExclusiveDate}
    `;
    const [sqlOccRow] = await prisma.$queryRaw<Array<{ nights: number }>>`
      SELECT COALESCE(SUM(cnt), 0)::int AS nights
      FROM (
        SELECT COUNT(DISTINCT r."room_id")::int AS cnt
        FROM generate_series(${window.startIso}::date, ${window.endInclusiveIso}::date, INTERVAL '1 day') gs
        INNER JOIN "reservations" r
          ON r."check_in_date" <= gs::date
         AND r."check_out_date" > gs::date
         AND r."status"::text IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
        GROUP BY gs
      ) sub
    `;

    expect(body.tiles?.revenue?.amountFcfa).toBe(Number(sqlRevRow.rev));
    expect(body.tiles?.remaining?.amountFcfa).toBe(Number(sqlRemRow.rem));
    expect(body.tiles?.collected?.amountFcfa).toBe(Number(sqlColRow.col));
    expect(body.tiles?.occupancy?.occupiedRoomNights).toBe(Number(sqlOccRow.nights));

    // La commande annulée n'apparaît jamais dans topDishes
    const dishNames = (body.topDishes || []).map((d: any) => d.name);
    expect(dishNames).toContain('Thiéboudienne Royal');
    expect(dishNames).not.toContain('Plat Annulé Fantôme');
  });
});
