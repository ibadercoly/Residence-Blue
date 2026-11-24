import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import request from 'supertest';
import { PrismaClient, PaymentMethod } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { issueDbTestToken } from './auth-test.helper';

describe('Clôture de caisse — API intégration & droits (residence_blue_e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID().slice(0, 6);

  let receptionToken: string;
  let receptionUserId: string;
  let comptableToken: string;
  let comptableUserId: string;
  let cuisinierToken: string;
  let cuisinierUserId: string;
  let testInvoiceId: string;
  const createdClosureIds: string[] = [];

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || new URL(dbUrl).pathname !== '/residence_blue_e2e') {
      throw new Error('Ce test exige exclusivement la base residence_blue_e2e.');
    }

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health', 'api/health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const rec = await issueDbTestToken(prisma, 'RECEPTION', {
      email: `cc.reception.${suffix}@residenceblue.sn`,
      fullName: 'Test reception',
    });
    receptionToken = rec.token;
    receptionUserId = rec.userId;

    const comp = await issueDbTestToken(prisma, 'COMPTABLE', {
      email: `cc.comptable.${suffix}@residenceblue.sn`,
      fullName: 'Test comptable',
    });
    comptableToken = comp.token;
    comptableUserId = comp.userId;

    const cuis = await issueDbTestToken(prisma, 'CUISINIER', {
      email: `cc.cuisinier.${suffix}@residenceblue.sn`,
      fullName: 'Test cuisinier',
    });
    cuisinierToken = cuis.token;
    cuisinierUserId = cuis.userId;

    // Créer une facture et un paiement en espèces du jour (50 000 FCFA)
    const inv = await prisma.invoice.create({
      data: {
        id: crypto.randomUUID(),
        totalFcfa: 50000,
        paidAmountFcfa: 50000,
        balanceFcfa: 0,
        status: 'PAID',
      },
    });
    testInvoiceId = inv.id;

    await prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        invoiceId: testInvoiceId,
        method: PaymentMethod.CASH,
        amountFcfa: 50000,
        receivedById: receptionUserId,
        receivedByName: 'Test reception',
        paidAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (createdClosureIds.length > 0) {
      await prisma.cashClosure.deleteMany({ where: { id: { in: createdClosureIds } } });
    }
    if (testInvoiceId) {
      await prisma.payment.deleteMany({ where: { invoiceId: testInvoiceId } });
      await prisma.invoice.deleteMany({ where: { id: testInvoiceId } });
    }
    const userIds = [receptionUserId, comptableUserId, cuisinierUserId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { isActive: false, deletedAt: new Date() },
      });
    }
    await app?.close();
    await prisma.$disconnect();
  });

  it('calcule correctement écart = 0, écart positif et écart négatif, et journalise dans AuditLog', async () => {
    const todayRes = await request(app.getHttpServer())
      .get('/api/billing/cash-closure/today')
      .set('Authorization', `Bearer ${receptionToken}`)
      .expect(200);

    const theoretical = todayRes.body.totalTheoreticalCash as number;
    expect(theoretical).toBeGreaterThanOrEqual(50000);

    // 1. Écart = 0
    const resZero = await request(app.getHttpServer())
      .post('/api/billing/cash-closure')
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ totalCountedCash: theoretical, notes: 'Caisse juste' })
      .expect(201);
    createdClosureIds.push(resZero.body.id);
    expect(resZero.body.totalTheoreticalCash).toBe(theoretical);
    expect(resZero.body.totalCountedCash).toBe(theoretical);
    expect(resZero.body.difference).toBe(0);

    // 2. Écart positif (+5 000 FCFA)
    const resPos = await request(app.getHttpServer())
      .post('/api/billing/cash-closure')
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ totalCountedCash: theoretical + 5000, notes: 'Surplus test' })
      .expect(201);
    createdClosureIds.push(resPos.body.id);
    expect(resPos.body.difference).toBe(5000);

    // 3. Écart négatif (-3 000 FCFA)
    const resNeg = await request(app.getHttpServer())
      .post('/api/billing/cash-closure')
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ totalCountedCash: theoretical - 3000, notes: 'Manquant test' })
      .expect(201);
    createdClosureIds.push(resNeg.body.id);
    expect(resNeg.body.difference).toBe(-3000);

    // Vérifier AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'CashClosure', entityId: resZero.body.id, action: 'CASH_CLOSURE_CREATED' },
    });
    expect(audit).not.toBeNull();
  });

  it('applique strictement les droits : RECEPTION crée (201), COMPTABLE lit l’historique (200), CUISINIER reçoit 403', async () => {
    // RECEPTION ne peut pas lire l'historique réservé à DIRECTION et COMPTABLE
    await request(app.getHttpServer())
      .get('/api/billing/cash-closure/history')
      .set('Authorization', `Bearer ${receptionToken}`)
      .expect(403);

    // COMPTABLE peut lire l'historique (200) mais ne peut pas créer une clôture (403)
    const historyRes = await request(app.getHttpServer())
      .get('/api/billing/cash-closure/history')
      .set('Authorization', `Bearer ${comptableToken}`)
      .expect(200);
    expect(Array.isArray(historyRes.body)).toBe(true);
    expect(historyRes.body.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post('/api/billing/cash-closure')
      .set('Authorization', `Bearer ${comptableToken}`)
      .send({ totalCountedCash: 10000 })
      .expect(403);

    // CUISINIER reçoit 403 sur création ET historique
    await request(app.getHttpServer())
      .post('/api/billing/cash-closure')
      .set('Authorization', `Bearer ${cuisinierToken}`)
      .send({ totalCountedCash: 10000 })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/billing/cash-closure/history')
      .set('Authorization', `Bearer ${cuisinierToken}`)
      .expect(403);
  });
});
