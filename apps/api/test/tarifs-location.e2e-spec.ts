import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillingService } from '../src/billing/billing.service';
import { loadRealTariffsAndIdentity } from '../src/tariffs/real-tariffs-loader.util';
import { Role } from '@residence-blue/shared';
import { issueDbTestToken } from './auth-test.helper';

const request: any = (supertest as any).default || supertest;

describe('Tarifs réels & Côté Location — Intégration et Sécurité (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let billingService: BillingService;
  const roleTokens: Record<string, string> = {};

  const createdRoomIds: string[] = [];
  const createdGuestIds: string[] = [];
  const createdReservationIds: string[] = [];
  const createdInvoiceIds: string[] = [];

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

    prisma = app.get(PrismaService);
    billingService = app.get(BillingService);

    await loadRealTariffsAndIdentity(prisma);

    for (const r of [
      Role.DIRECTION,
      Role.RECEPTION,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
      Role.COMPTABLE,
      Role.RESTAURANT,
    ]) {
      const issued = await issueDbTestToken(prisma, r, {
        email: `tarifs.e2e.${r.toLowerCase()}@residenceblue.sn`,
      });
      roleTokens[r] = issued.token;
    }
  });

  afterAll(async () => {
    if (createdInvoiceIds.length > 0) {
      await prisma.payment.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    }
    if (createdReservationIds.length > 0) {
      await prisma.invoice.deleteMany({ where: { reservationId: { in: createdReservationIds } } });
      await prisma.reservation.deleteMany({ where: { id: { in: createdReservationIds } } });
    }
    if (createdRoomIds.length > 0) {
      await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
    }
    if (createdGuestIds.length > 0) {
      await prisma.guest.deleteMany({ where: { id: { in: createdGuestIds } } });
    }
    await app.close();
  });

  it('charge de manière idempotente la grille tarifaire réelle et les 4 prestations sans écraser les modifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tariffs')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .expect(200);

    expect(res.body.categories.map((c: any) => c.code)).toEqual([
      'STANDARD',
      'CONFORT',
      'APPARTEMENT',
    ]);
    expect(res.body.tariffs.length).toBeGreaterThanOrEqual(13);

    const std1 = res.body.tariffs.find(
      (t: any) => t.categoryCode === 'STANDARD' && t.guestsCount === 1,
    );
    const apt3r3 = res.body.tariffs.find(
      (t: any) => t.categoryCode === 'APPARTEMENT' && t.guestsCount === 3 && t.roomsUsed === 3,
    );
    expect(std1.pricePerNightFcfa).toBe(30000);
    expect(apt3r3.pricePerNightFcfa).toBeNull();

    const extraNames = res.body.extraServices.map((s: any) => s.code);
    expect(extraNames).toEqual(
      expect.arrayContaining([
        'SALLE_SEMINAIRE',
        'PAUSE_CAFE',
        'PAUSE_DEJEUNER_MENU_1_PLAT',
        'PAUSE_DEJEUNER_BUFFET_2_PLATS',
      ]),
    );

    // Relancer loadRealTariffsAndIdentity ne doit rien dupliquer ni écraser
    const secondReport = await loadRealTariffsAndIdentity(prisma);
    expect(secondReport.categoriesCreated).toBe(0);
    expect(secondReport.tariffsCreated).toBe(0);
    expect(secondReport.extraServicesCreated).toBe(0);
  });

  it('refuse le prix envoyé par le navigateur (400), fige le prix après changement de tarif et préserve les factures émises', async () => {
    const suffix = Date.now().toString().slice(-4);
    const stdCat = await prisma.tariffCategory.findUniqueOrThrow({ where: { code: 'STANDARD' } });
    const stdType = await prisma.roomType.upsert({
      where: { name: 'Standard' },
      update: {},
      create: { name: 'Standard', pricePerNight: null },
    });

    const room = await prisma.room.create({
      data: {
        number: `T${suffix}`,
        typeId: stdType.id,
        tariffCategoryId: stdCat.id,
        category: 'Standard',
        floor: 1,
        status: 'FREE',
        adultsCapacity: 2,
        childrenCapacity: 0,
        pricePerNight: null,
      },
    });
    createdRoomIds.push(room.id);

    const guest = await prisma.guest.create({
      data: {
        civility: 'M.',
        firstName: 'Ousmane',
        lastName: `Diallo${suffix}`,
        fullName: `Ousmane Diallo${suffix}`,
        phone: `+221 77 400 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`,
      },
    });
    createdGuestIds.push(guest.id);

    // 1. Le serveur REFUSE un prix envoyé par le navigateur (totalFcfa interdit) -> 400
    await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`)
      .send({
        roomId: room.id,
        guestId: guest.id,
        checkInDate: '2027-04-01',
        checkOutDate: '2027-04-04',
        adultsCount: 2,
        totalFcfa: 5000,
      })
      .expect(400);

    // 2. Réservation valide : Standard, 2 personnes, 3 nuits -> 35 000 × 3 = 105 000 + taxe (2*3*1000=6000) = 111 000
    const resBefore = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`)
      .send({
        roomId: room.id,
        guestId: guest.id,
        checkInDate: '2027-04-01',
        checkOutDate: '2027-04-04',
        adultsCount: 2,
        depositFcfa: 10000,
        paymentMethod: 'CASH',
      })
      .expect(201);
    createdReservationIds.push(resBefore.body.id);

    expect(resBefore.body.ratePerNightFcfa).toBe(35000);
    expect(resBefore.body.totalFcfa).toBe(111000);

    const invoiceBefore = await prisma.invoice.findFirstOrThrow({
      where: { reservationId: resBefore.body.id },
      include: { lines: true },
    });
    createdInvoiceIds.push(invoiceBefore.id);
    const totalInvoiceBefore = invoiceBefore.totalFcfa;

    // 3. La direction modifie le tarif Standard 2 personnes : 35 000 -> 38 000 FCFA
    const std2Tariff = await prisma.roomTariff.findFirstOrThrow({
      where: { categoryId: stdCat.id, guestsCount: 2, roomsUsed: null },
    });

    try {
      await request(app.getHttpServer())
        .put('/api/tariffs/grid')
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
        .send({
          items: [{ id: std2Tariff.id, pricePerNightFcfa: 38000, isActive: true }],
        })
        .expect(200);

      // Vérifier écriture dans le journal d'actions
      const tariffAudit = await prisma.auditLog.findFirst({
        where: { action: 'TARIFF_UPDATE', entity: 'RoomTariff', entityId: std2Tariff.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(tariffAudit).toBeTruthy();
      expect((tariffAudit?.before as any)?.pricePerNightFcfa).toBe(35000);
      expect((tariffAudit?.after as any)?.pricePerNightFcfa).toBe(38000);

      // 4. La réservation existante et sa facture N'ONT PAS BOUGÉ
      const reloadedResBefore = await request(app.getHttpServer())
        .get(`/api/reservations/${resBefore.body.id}`)
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
        .expect(200);
      expect(reloadedResBefore.body.ratePerNightFcfa).toBe(35000);
      expect(reloadedResBefore.body.totalFcfa).toBe(111000);

      const reloadedInvoiceBefore = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceBefore.id },
      });
      expect(reloadedInvoiceBefore.totalFcfa).toBe(totalInvoiceBefore);

      // 5. Une NOUVELLE réservation utilise le nouveau tarif 38 000 FCFA (2 nuits = 76 000 + 4 000 taxe = 80 000)
      const resAfter = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`)
        .send({
          roomId: room.id,
          guestId: guest.id,
          checkInDate: '2027-04-10',
          checkOutDate: '2027-04-12',
          adultsCount: 2,
        })
        .expect(201);
      createdReservationIds.push(resAfter.body.id);

      expect(resAfter.body.ratePerNightFcfa).toBe(38000);
      expect(resAfter.body.totalFcfa).toBe(80000);
    } finally {
      // Restaurer le tarif public d'origine (35 000 FCFA)
      await prisma.roomTariff.update({
        where: { id: std2Tariff.id },
        data: { pricePerNightFcfa: 35000 },
      });
    }
  });

  it('applique les règles de sécurité (403 hors DIRECTION), prix négocié direction + motif, chambres À classer, TVA inchangée et prestations sur note', async () => {
    const suffix = Date.now().toString().slice(-4);
    const stdCat = await prisma.tariffCategory.findUniqueOrThrow({ where: { code: 'STANDARD' } });
    const stdType = await prisma.roomType.upsert({
      where: { name: 'Standard' },
      update: {},
      create: { name: 'Standard', pricePerNight: null },
    });

    // 1. 403 pour tous les profils non-DIRECTION sur les routes d'administration des tarifs
    const std1 = await prisma.roomTariff.findFirstOrThrow({
      where: { categoryId: stdCat.id, guestsCount: 1, roomsUsed: null },
    });
    const seminar = await prisma.extraServiceItem.findUniqueOrThrow({
      where: { code: 'SALLE_SEMINAIRE' },
    });

    for (const forbiddenRole of [
      Role.RECEPTION,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
      Role.COMPTABLE,
      Role.RESTAURANT,
    ]) {
      await request(app.getHttpServer())
        .put('/api/tariffs/grid')
        .set('Authorization', `Bearer ${roleTokens[forbiddenRole]}`)
        .send({ items: [{ id: std1.id, pricePerNightFcfa: 10000 }] })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/tariffs/extra-services/${seminar.id}`)
        .set('Authorization', `Bearer ${roleTokens[forbiddenRole]}`)
        .send({ priceFcfa: 50000 })
        .expect(403);
    }

    // 2. Chambre non classée (« À classer ») refusée à la réservation
    const unclassifiedRoom = await prisma.room.create({
      data: {
        number: `U${suffix}`,
        typeId: stdType.id,
        tariffCategoryId: null,
        category: 'À classer',
        floor: 2,
        status: 'FREE',
        adultsCapacity: 2,
        childrenCapacity: 0,
        pricePerNight: null,
      },
    });
    createdRoomIds.push(unclassifiedRoom.id);

    const guest = await prisma.guest.create({
      data: {
        civility: 'Mme',
        firstName: 'Awa',
        lastName: `Sarr${suffix}`,
        fullName: `Awa Sarr${suffix}`,
        phone: `+221 78 500 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`,
      },
    });
    createdGuestIds.push(guest.id);

    const unclassifiedErr = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`)
      .send({
        roomId: unclassifiedRoom.id,
        guestId: guest.id,
        checkInDate: '2027-05-01',
        checkOutDate: '2027-05-03',
        adultsCount: 1,
      })
      .expect(400);
    expect(unclassifiedErr.body.message).toContain('À classer');

    // 3. Prix négocié par RECEPTION -> 403 ; par DIRECTION avec motif -> 201 + audit + label
    const stdRoom = await prisma.room.create({
      data: {
        number: `N${suffix}`,
        typeId: stdType.id,
        tariffCategoryId: stdCat.id,
        category: 'Standard',
        floor: 1,
        status: 'FREE',
        adultsCapacity: 2,
        childrenCapacity: 0,
        pricePerNight: null,
      },
    });
    createdRoomIds.push(stdRoom.id);

    await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`)
      .send({
        roomId: stdRoom.id,
        guestId: guest.id,
        checkInDate: '2027-05-10',
        checkOutDate: '2027-05-12',
        adultsCount: 2,
        overridePricePerNightFcfa: 28000,
        priceOverrideReason: 'Essai réception interdit',
      })
      .expect(403);

    const dirOverrideRes = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        roomId: stdRoom.id,
        guestId: guest.id,
        checkInDate: '2027-05-10',
        checkOutDate: '2027-05-12',
        adultsCount: 2,
        overridePricePerNightFcfa: 31000,
        priceOverrideReason: 'Accord spécial séminaire entreprise',
      })
      .expect(201);
    createdReservationIds.push(dirOverrideRes.body.id);

    expect(dirOverrideRes.body.ratePerNightFcfa).toBe(31000);
    expect(dirOverrideRes.body.priceOverriddenByDirector).toBe(true);
    expect(dirOverrideRes.body.priceDisplayNote).toBe('Prix fixé par la direction');

    const overrideAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'RESERVATION_PRICE_OVERRIDE',
        entity: 'Reservation',
        entityId: dirOverrideRes.body.id,
      },
    });
    expect(overrideAudit).toBeTruthy();

    // 4. Ajout d'une prestation du catalogue (Salle de séminaire + Pause-café) à une facture entreprise / passage
    const pauseCafe = await prisma.extraServiceItem.findUniqueOrThrow({
      where: { code: 'PAUSE_CAFE' },
    });

    const companyInv = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`)
      .send({
        billingCompanyName: 'Société Thiès Énergie',
        lines: [
          { extraServiceId: seminar.id, quantity: 2 },
          { extraServiceId: pauseCafe.id, quantity: 15 },
        ],
      })
      .expect(201);
    createdInvoiceIds.push(companyInv.body.id);

    // 2 * 100 000 + 15 * 3 000 = 245 000 FCFA
    expect(companyInv.body.totalFcfa).toBe(245000);
    expect(companyInv.body.lines.every((l: any) => l.category === 'AUTRES')).toBe(true);

    // 5. Non-régression TVA et taxe de séjour sur cas de référence
    const refTotals = billingService.computeInvoiceTotals({
      lines: [
        { category: 'HEBERGEMENT', totalPriceFcfa: 105000 },
        { category: 'TAX', totalPriceFcfa: 6000 },
      ],
      discountFcfa: 0,
      depositFcfa: 0,
      paidAmountFcfa: 0,
      vatRatePercent: 10,
      serviceRatePercent: 0,
    });
    expect(refTotals.subtotalHtFcfa).toBe(95455);
    expect(refTotals.vatAmountFcfa).toBe(9545);
    expect(refTotals.tourismTaxFcfa).toBe(6000);
    expect(refTotals.totalFcfa).toBe(111000);
  });
});
