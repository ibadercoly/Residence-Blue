import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReservationStatus, RoomStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

describe('Facturation V3 — Règles métier, Atomicité, Sécurité & PDF (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createdGuestIds: string[] = [];
  const createdReservationIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  let savedSettingsSnapshot: {
    id: string;
    vatRatePercent: number;
    serviceRatePercent: number | null;
    tourismTaxPerNightPerPerson: number;
    discountThresholdPercent: number | null;
  } | null = null;

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

    const existingTestRes = await prisma.reservation.findMany({
      where: { reference: { startsWith: 'RES-TST-' } },
      select: { id: true, guestId: true, roomId: true },
    });
    if (existingTestRes.length > 0) {
      const resIds = existingTestRes.map((r) => r.id);
      const staleInvs = await prisma.invoice.findMany({
        where: { reservationId: { in: resIds } },
        select: { id: true },
      });
      const invIds = staleInvs.map((i) => i.id);
      if (invIds.length > 0) {
        await prisma.payment.deleteMany({ where: { invoiceId: { in: invIds } } });
        await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: invIds } } });
      }
      await prisma.reservation.deleteMany({ where: { id: { in: resIds } } });
      await prisma.guest.deleteMany({
        where: { id: { in: existingTestRes.map((r) => r.guestId) } },
      });
      await prisma.room.updateMany({
        where: { id: { in: existingTestRes.map((r) => r.roomId) } },
        data: { status: RoomStatus.FREE },
      });
    }

    const st = await prisma.hotelSetting.findFirst();
    if (st) {
      savedSettingsSnapshot = {
        id: st.id,
        vatRatePercent: st.vatRatePercent,
        serviceRatePercent: st.serviceRatePercent,
        tourismTaxPerNightPerPerson: st.tourismTaxPerNightPerPerson,
        discountThresholdPercent: st.discountThresholdPercent,
      };
      await prisma.hotelSetting.update({
        where: { id: st.id },
        data: {
          vatRatePercent: 10,
          serviceRatePercent: 5,
          tourismTaxPerNightPerPerson: 1000,
          discountThresholdPercent: 10,
        },
      });
    }
  });

  afterAll(async () => {
    if (prisma) {
      if (savedSettingsSnapshot) {
        await prisma.hotelSetting.update({
          where: { id: savedSettingsSnapshot.id },
          data: {
            vatRatePercent: savedSettingsSnapshot.vatRatePercent,
            serviceRatePercent: savedSettingsSnapshot.serviceRatePercent,
            tourismTaxPerNightPerPerson: savedSettingsSnapshot.tourismTaxPerNightPerPerson,
            discountThresholdPercent: savedSettingsSnapshot.discountThresholdPercent,
          },
        });
      }
      if (createdInvoiceIds.length > 0) {
        const linked = await prisma.invoice.findMany({
          where: {
            OR: [
              { id: { in: createdInvoiceIds } },
              { parentInvoiceId: { in: createdInvoiceIds } },
            ],
          },
          select: { id: true, roomId: true },
        });
        const allIds = linked.map((i) => i.id);
        await prisma.payment.deleteMany({ where: { invoiceId: { in: allIds } } });
        await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: allIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: allIds } } });
        const roomIds = linked.map((i) => i.roomId).filter((r): r is string => Boolean(r));
        if (roomIds.length > 0) {
          await prisma.room.updateMany({
            where: { id: { in: roomIds } },
            data: { status: RoomStatus.FREE },
          });
        }
      }
      if (createdReservationIds.length > 0) {
        await prisma.reservation.deleteMany({ where: { id: { in: createdReservationIds } } });
      }
      if (createdGuestIds.length > 0) {
        await prisma.guest.deleteMany({ where: { id: { in: createdGuestIds } } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  async function createTestStay(roomNum: string, guestName: string) {
    const room = await prisma.room.findUnique({ where: { number: roomNum } });
    if (!room) throw new Error(`Chambre ${roomNum} introuvable dans la base`);
    await prisma.room.update({ where: { id: room.id }, data: { status: 'OCCUPIED' } });

    const guest = await prisma.guest.create({
      data: {
        firstName: guestName.split(' ')[0],
        lastName: guestName.split(' ').slice(1).join(' ') || 'Test',
        fullName: guestName,
        phone: `+22177${Math.floor(1000000 + Math.random() * 8999999)}`,
      },
    });
    createdGuestIds.push(guest.id);

    const checkIn = new Date('2028-05-10T00:00:00.000Z');
    const checkOut = new Date('2028-05-12T00:00:00.000Z');
    const reservation = await prisma.reservation.create({
      data: {
        reference: `RES-TST-${randomUUID().slice(0, 8)}`,
        guestId: guest.id,
        roomId: room.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights: 2,
        adultsCount: 2,
        childrenCount: 0,
        status: 'CHECKED_IN',
        totalFcfa: 104000,
        depositFcfa: 0,
      },
    });
    createdReservationIds.push(reservation.id);

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: null,
        isIssued: false,
        reservationId: reservation.id,
        guestId: guest.id,
        roomId: room.id,
        vatRatePercent: 10,
        serviceRatePercent: 5,
        subtotalHtFcfa: 86580,
        serviceAmountFcfa: 4329,
        vatAmountFcfa: 9091,
        tourismTaxFcfa: 4000,
        totalFcfa: 104000,
        paidAmountFcfa: 0,
        balanceFcfa: 104000,
        status: 'OPEN',
        lines: {
          create: [
            {
              dateLabel: '12/11/2026',
              description: `Séjour Chambre ${room.number}`,
              subDescription: '2 nuit(s) × 50 000 FCFA',
              category: 'HEBERGEMENT',
              quantity: 2,
              quantityLabel: '2',
              unitPriceFcfa: 50000,
              totalPriceFcfa: 100000,
              isSystem: true,
            },
            {
              dateLabel: '12/11/2026',
              description: 'Taxe de séjour',
              subDescription: '2 adulte(s) × 2 nuit(s)',
              category: 'TAX',
              quantity: 4,
              quantityLabel: '4',
              unitPriceFcfa: 1000,
              totalPriceFcfa: 4000,
              isSystem: true,
            },
          ],
        },
      },
    });
    createdInvoiceIds.push(inv.id);
    return { room, guest, reservation, invoice: inv };
  }

  it('devrait rejeter les montants décimaux et calculer en entiers FCFA depuis HotelSetting', async () => {
    const stay = await createTestStay('101', 'Mamadou Facture');

    await request(app.getHttpServer())
      .post(`/api/invoices/${stay.invoice.id}/lines`)
      .set('x-user-role', 'RECEPTION')
      .send({
        description: 'Café décimal interdit',
        category: 'RESTAURANT',
        quantity: 1,
        unitPriceFcfa: 2500.5,
      })
      .expect(400);

    const added = await request(app.getHttpServer())
      .post(`/api/invoices/${stay.invoice.id}/lines`)
      .set('x-user-role', 'RECEPTION')
      .send({
        description: 'Navette Thiès',
        category: 'AUTRES',
        quantity: 1,
        unitPriceFcfa: 15000,
      })
      .expect(201);

    expect(Number.isInteger(added.body.subtotalHtFcfa)).toBe(true);
    expect(Number.isInteger(added.body.serviceAmountFcfa)).toBe(true);
    expect(Number.isInteger(added.body.vatAmountFcfa)).toBe(true);
    expect(added.body.serviceRatePercent).toBe(5);
    expect(added.body.vatRatePercent).toBe(10);
    expect(added.body.totalFcfa).toBe(124749);
  });

  it('devrait faire respecter les seuils de remise et la matrice RBAC (403)', async () => {
    const stay = await createTestStay('102', 'Awa Sene');

    // Rôles interdits sur la facturation
    for (const forbiddenRole of [
      'GOUVERNANTE',
      'TECHNIQUE',
      'HOUSEKEEPING',
      'MAINTENANCE',
      'SERVEUR',
      'CUISINE',
      'RESTAURANT',
    ]) {
      await request(app.getHttpServer())
        .get('/api/invoices/counter')
        .set('x-user-role', forbiddenRole)
        .expect(403);
    }

    // RESTAURANT peut uniquement ajouter une ligne RESTAURANT, sans totaux généraux
    const restoRes = await request(app.getHttpServer())
      .post(`/api/invoices/${stay.invoice.id}/lines`)
      .set('x-user-role', 'RESTAURANT')
      .send({
        description: 'Jus de bissap',
        category: 'RESTAURANT',
        quantity: 2,
        unitPriceFcfa: 1500,
      })
      .expect(201);

    expect(restoRes.body.restrictedView).toBe(true);
    expect(restoRes.body.totalFcfa).toBeUndefined();

    await request(app.getHttpServer())
      .post(`/api/invoices/${stay.invoice.id}/lines`)
      .set('x-user-role', 'RESTAURANT')
      .send({
        description: 'Nuitée cachée',
        category: 'HEBERGEMENT',
        quantity: 1,
        unitPriceFcfa: 5000,
      })
      .expect(403);

    // Remise > 10% refusée pour RECEPTION, autorisée pour DIRECTION
    await request(app.getHttpServer())
      .patch(`/api/invoices/${stay.invoice.id}/discount`)
      .set('x-user-role', 'RECEPTION')
      .send({ discountFcfa: 30000 })
      .expect(403);

    const discOk = await request(app.getHttpServer())
      .patch(`/api/invoices/${stay.invoice.id}/discount`)
      .set('x-user-role', 'DIRECTION')
      .send({ discountFcfa: 20000 })
      .expect(200);

    expect(discOk.body.discountFcfa).toBe(20000);

    // Clôture de caisse réservée à DIRECTION et COMPTABLE
    await request(app.getHttpServer())
      .get('/api/invoices/cash-closure/export?format=pdf')
      .set('x-user-role', 'RECEPTION')
      .expect(403);

    const comptablePdf = await request(app.getHttpServer())
      .get('/api/invoices/cash-closure/export?format=pdf')
      .set('x-user-role', 'COMPTABLE')
      .expect(200);
    expect(comptablePdf.headers['content-type']).toContain('application/pdf');
  });

  it('devrait gérer idempotence, écriture inverse DIRECTION, check-out atomique et numérotation concurrente sans trou', async () => {
    const stayA = await createTestStay('103', 'Ibrahima Concurrent A');
    const stayB = await createTestStay('104', 'Fatou Concurrent B');

    // Surpaiement et zéro/PAN refusés
    await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/payments`)
      .set('x-user-role', 'RECEPTION')
      .send({ method: 'CASH', amountFcfa: 999999 })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/payments`)
      .set('x-user-role', 'RECEPTION')
      .send({ method: 'CARD', amountFcfa: 10000, transactionRef: '4532111122223333' })
      .expect(400);

    // Idempotency-Key rejouée deux fois -> 1 seul paiement créé
    const idemKey = randomUUID();
    const p1 = await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/payments`)
      .set('x-user-role', 'RECEPTION')
      .set('x-user-name', 'Oumar Réception')
      .set('Idempotency-Key', idemKey)
      .send({ method: 'WAVE', amountFcfa: 50000, transactionRef: 'WAV-001' })
      .expect(201);

    const p2 = await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/payments`)
      .set('x-user-role', 'RECEPTION')
      .set('x-user-name', 'Oumar Réception')
      .set('Idempotency-Key', idemKey)
      .send({ method: 'WAVE', amountFcfa: 50000, transactionRef: 'WAV-001' })
      .expect(201);

    expect(p1.body.payments.length).toBe(1);
    expect(p2.body.payments.length).toBe(1);
    expect(p2.body.paidAmountFcfa).toBe(50000);
    const paymentId = p2.body.payments[0].id;

    // Écriture inverse réservée à DIRECTION
    await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/payments/${paymentId}/reverse`)
      .set('x-user-role', 'RECEPTION')
      .send({ reason: 'Erreur saisie' })
      .expect(403);

    const reversed = await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/payments/${paymentId}/reverse`)
      .set('x-user-role', 'DIRECTION')
      .send({ reason: 'Double encaissement Wave' })
      .expect(201);

    expect(reversed.body.paidAmountFcfa).toBe(0);
    expect(reversed.body.payments.length).toBe(2);
    expect(reversed.body.payments[0].isReversal).toBe(true);
    expect(reversed.body.payments[0].amountFcfa).toBe(-50000);

    // Check-out refusé tant que solde > 0 (sans force)
    await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/checkout`)
      .set('x-user-role', 'RECEPTION')
      .send({})
      .expect(400);

    // Check-out forcé interdit pour RECEPTION
    await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/checkout`)
      .set('x-user-role', 'RECEPTION')
      .send({ force: true, reason: 'Départ sans payer' })
      .expect(403);

    // Solder A et B (recalculé à 109000 avec service 5%) puis lancer 2 check-outs concurrents
    const payARes = await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/payments`)
      .set('x-user-role', 'RECEPTION')
      .set('Idempotency-Key', randomUUID())
      .send({ method: 'CASH', amountFcfa: 104000 })
      .expect(201);
    if (payARes.body.balanceFcfa > 0) {
      await request(app.getHttpServer())
        .post(`/api/invoices/${stayA.invoice.id}/payments`)
        .set('x-user-role', 'RECEPTION')
        .set('Idempotency-Key', randomUUID())
        .send({ method: 'CASH', amountFcfa: payARes.body.balanceFcfa })
        .expect(201);
    }

    const payBRes = await request(app.getHttpServer())
      .post(`/api/invoices/${stayB.invoice.id}/payments`)
      .set('x-user-role', 'RECEPTION')
      .set('Idempotency-Key', randomUUID())
      .send({ method: 'ORANGE_MONEY', amountFcfa: 104000, transactionRef: 'OM-104' })
      .expect(201);
    if (payBRes.body.balanceFcfa > 0) {
      await request(app.getHttpServer())
        .post(`/api/invoices/${stayB.invoice.id}/payments`)
        .set('x-user-role', 'RECEPTION')
        .set('Idempotency-Key', randomUUID())
        .send({ method: 'ORANGE_MONEY', amountFcfa: payBRes.body.balanceFcfa, transactionRef: 'OM-105' })
        .expect(201);
    }

    const [coA, coB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/invoices/${stayA.invoice.id}/checkout`)
        .set('x-user-role', 'RECEPTION')
        .send({}),
      request(app.getHttpServer())
        .post(`/api/invoices/${stayB.invoice.id}/checkout`)
        .set('x-user-role', 'RECEPTION')
        .send({}),
    ]);

    expect(coA.status).toBe(200);
    expect(coB.status).toBe(200);
    expect(coA.body.isIssued).toBe(true);
    expect(coB.body.isIssued).toBe(true);
    expect(coA.body.invoiceNumber).toMatch(/^FA-\d{4}-\d{4}$/);
    expect(coB.body.invoiceNumber).toMatch(/^FA-\d{4}-\d{4}$/);
    expect(coA.body.invoiceNumber).not.toBe(coB.body.invoiceNumber);

    const seqA = Number(coA.body.invoiceNumber.split('-')[2]);
    const seqB = Number(coB.body.invoiceNumber.split('-')[2]);
    expect(Math.abs(seqA - seqB)).toBe(1);

    // Vérifier chambre passée à CLEANING et réservation CHECKED_OUT en BD
    const roomAfter = await prisma.room.findUnique({ where: { id: stayA.room.id } });
    const resAfter = await prisma.reservation.findUnique({ where: { id: stayA.reservation.id } });
    expect(roomAfter?.status).toBe(RoomStatus.CLEANING);
    expect(resAfter?.status).toBe(ReservationStatus.CHECKED_OUT);

    // Immuabilité absolue après émission
    await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/lines`)
      .set('x-user-role', 'DIRECTION')
      .send({ description: 'Ajout tardif', category: 'AUTRES', quantity: 1, unitPriceFcfa: 2000 })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/invoices/${stayA.invoice.id}`)
      .set('x-user-role', 'DIRECTION')
      .expect(400);

    // PDF serveur valide
    const pdfRes = await request(app.getHttpServer())
      .get(`/api/invoices/${stayA.invoice.id}/pdf`)
      .set('x-user-role', 'COMPTABLE')
      .expect(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.body.slice(0, 4).toString()).toBe('%PDF');

    // Création d'avoir (RECEPTION interdit, COMPTABLE autorisé)
    await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/credit-notes`)
      .set('x-user-role', 'RECEPTION')
      .send({ reason: 'Geste' })
      .expect(403);

    const creditRes = await request(app.getHttpServer())
      .post(`/api/invoices/${stayA.invoice.id}/credit-notes`)
      .set('x-user-role', 'COMPTABLE')
      .send({ reason: 'Erreur facturation nuitée' })
      .expect(201);

    createdInvoiceIds.push(creditRes.body.id);
    expect(creditRes.body.documentType).toBe('CREDIT_NOTE');
    expect(creditRes.body.invoiceNumber).toMatch(/^AV-\d{4}-\d{4}$/);
    expect(creditRes.body.totalFcfa).toBe(-coA.body.totalFcfa);
    expect(creditRes.body.parentInvoiceId).toBe(stayA.invoice.id);
  });
});
