import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { hashPassword } from '../src/auth/password-hash.util';
import { Role, STARTER_PROFILES } from '@residence-blue/shared';
import { issueDbTestToken } from './auth-test.helper';

const request: any = (supertest as any).default || supertest;

describe('Rapports — Restriction stricte Directeur & Comptable uniquement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auditService: AuditService;
  let dirToken: string;
  const createdUserIds: string[] = [];

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
    auditService = moduleFixture.get<AuditService>(AuditService);
    dirToken = (await issueDbTestToken(prisma, Role.DIRECTION)).token;
  }, 30000);

  afterAll(async () => {
    if (prisma && createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  it('refuse 403 /api/rapports, PDF, Excel, cash-closure et archives/export pour tous les profils non Comptable/Directeur et autorise Directeur & Comptable', async () => {
    const nonReportProfiles = STARTER_PROFILES.filter((p) => p.key !== 'COMPTABLE');
    for (const prof of nonReportProfiles) {
      const { token } = await issueDbTestToken(prisma, prof.role, {
        email: `e2e.rapports.denied.${prof.key.toLowerCase()}@residenceblue.sn`,
      });
      await request(app.getHttpServer())
        .get('/api/rapports?periode=30j')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/rapports/export/pdf?periode=30j')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/rapports/export/excel?periode=30j')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/invoices/cash-closure/export?format=pdf')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/invoices/archives/export?format=excel')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    }

    const comptableToken = (
      await issueDbTestToken(prisma, Role.COMPTABLE, {
        email: 'e2e.rapports.ok.comptable@residenceblue.sn',
      })
    ).token;

    await request(app.getHttpServer())
      .get('/api/rapports?periode=30j')
      .set('Authorization', `Bearer ${comptableToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/rapports?periode=30j')
      .set('Authorization', `Bearer ${dirToken}`)
      .expect(200);
  });

  it('refuse 403 "Seul le comptable peut voir les rapports" à la création ou modification pour un autre profil et même avec voir_montants=true', async () => {
    const baseScreens = {
      accueil: 'ECRITURE',
      planning: 'ECRITURE',
      chambres: 'ECRITURE',
      clients: 'ECRITURE',
      facturation: 'ECRITURE',
      restaurant: 'ECRITURE',
      cuisine: 'AUCUN',
      rapports: 'LECTURE',
    };
    const basePerms = {
      voir_montants: true,
      encaisser_paiement: true,
      changer_etat_chambre: true,
      annuler_commande_ou_reservation: true,
    };

    const denyCreate = await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${dirToken}`)
      .send({
        fullName: 'Assistante Test Rapports',
        email: `deny-rap-create-${Date.now()}@residenceblue.sn`,
        starterProfile: 'ASSISTANT_RECEPTION',
        screenAccess: baseScreens,
        specialPermissions: basePerms,
      })
      .expect(403);
    expect(denyCreate.body.message).toContain('Seul le comptable peut voir les rapports');

    // Création valide sans rapports puis tentative de modification via PATCH -> 403
    const validEmail = `valid-rec-${Date.now()}@residenceblue.sn`;
    const created = await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${dirToken}`)
      .send({
        fullName: 'Réceptionniste Valide',
        email: validEmail,
        starterProfile: 'ASSISTANT_RECEPTION',
        screenAccess: { ...baseScreens, rapports: 'AUCUN' },
        specialPermissions: basePerms,
      })
      .expect(201);
    createdUserIds.push(created.body.account.id);

    const denyPatch = await request(app.getHttpServer())
      .patch(`/api/administration/comptes/${created.body.account.id}`)
      .set('Authorization', `Bearer ${dirToken}`)
      .send({ screenAccess: { ...baseScreens, rapports: 'ECRITURE' } })
      .expect(403);
    expect(denyPatch.body.message).toContain('Seul le comptable peut voir les rapports');
  });

  it('bloque même un compte existant ayant un JSON périmé rapports=LECTURE et voir_montants=true, puis la migration SQL le nettoie sans perte et journalise audit_log', async () => {
    const staleEmail = `stale-reception-rapports-${Date.now()}@residenceblue.sn`;
    const pwd = 'StalePassword!2026';
    const staleUser = await prisma.user.create({
      data: {
        email: staleEmail,
        fullName: 'Ancien Assistant Avec Rapports',
        role: Role.RECEPTION,
        isActive: true,
        isPrimaryAdmin: false,
        mustChangePassword: false,
        starterProfile: 'ASSISTANT_RECEPTION',
        passwordHash: await hashPassword(pwd),
        screenAccess: {
          accueil: 'ECRITURE',
          planning: 'ECRITURE',
          chambres: 'ECRITURE',
          clients: 'ECRITURE',
          facturation: 'ECRITURE',
          restaurant: 'ECRITURE',
          cuisine: 'AUCUN',
          rapports: 'LECTURE',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: true,
          annuler_commande_ou_reservation: true,
        },
      },
    });
    createdUserIds.push(staleUser.id);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: staleEmail, password: pwd })
      .expect(200);
    const staleToken = loginRes.body.accessToken as string;

    // Même avant exécution de la migration, le serveur bloque 403 grâce au verrou structurel + voir_montants ne donne jamais Rapports
    await request(app.getHttpServer())
      .get('/api/rapports?periode=30j')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/rapports/export/pdf?periode=30j')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(403);

    // Exécuter la migration SQL idempotente et vérifier le retrait sans perte + audit_log
    const candidatePaths = [
      path.resolve(process.cwd(), 'prisma/migrations/20261116051500_rapports_acces_restreint/migration.sql'),
      path.resolve(process.cwd(), 'apps/api/prisma/migrations/20261116051500_rapports_acces_restreint/migration.sql'),
    ];
    const migrationPath = candidatePaths.find((p) => fs.existsSync(p))!;
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await prisma.$executeRawUnsafe(migrationSql);

    const afterUser = await prisma.user.findUnique({ where: { id: staleUser.id } });
    expect((afterUser?.screenAccess as any)?.rapports).toBe('AUCUN');
    // Toutes les autres permissions conservées intactes
    expect((afterUser?.screenAccess as any)?.planning).toBe('ECRITURE');
    expect((afterUser?.screenAccess as any)?.facturation).toBe('ECRITURE');
    expect((afterUser?.specialPermissions as any)?.voir_montants).toBe(true);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entity: 'User', entityId: staleUser.id, action: 'MIGRATION_RETRAIT_ACCES_RAPPORTS' },
    });
    expect(auditEntry).toBeTruthy();

    // L'intégrité de la chaîne SHA-256 audit_log reste valide
    const chain = await auditService.verifyChain();
    expect(chain.valid).toBe(true);
  });

  it('aucun montant global renvoyé sur Accueil et Comptoir pour un assistant sans voir_montants', async () => {
    const noAmountEmail = `assistant-no-amount-${Date.now()}@residenceblue.sn`;
    const pwd = 'NoAmountPass!2026';
    const user = await prisma.user.create({
      data: {
        email: noAmountEmail,
        fullName: 'Assistant Sans Montants',
        role: Role.RECEPTION,
        isActive: true,
        isPrimaryAdmin: false,
        mustChangePassword: false,
        starterProfile: 'ASSISTANT_RECEPTION',
        passwordHash: await hashPassword(pwd),
        screenAccess: {
          accueil: 'LECTURE',
          planning: 'LECTURE',
          chambres: 'LECTURE',
          clients: 'LECTURE',
          facturation: 'LECTURE',
          restaurant: 'LECTURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: false,
          encaisser_paiement: false,
          changer_etat_chambre: false,
          annuler_commande_ou_reservation: false,
        },
      },
    });
    createdUserIds.push(user.id);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: noAmountEmail, password: pwd })
      .expect(200);
    const token = loginRes.body.accessToken as string;

    const accueilRes = await request(app.getHttpServer())
      .get('/api/accueil/jour')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(accueilRes.body.billing).toBeUndefined();
    expect(accueilRes.body.restaurant?.revenueFcfa).toBeUndefined();

    const counterRes = await request(app.getHttpServer())
      .get('/api/invoices/counter')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(counterRes.body.kpis.collectedTodayFcfa).toBeNull();
    expect(counterRes.body.kpis.toCollectFcfa).toBeNull();
    expect(counterRes.body.dailyCash.totalTodayFcfa).toBeNull();

    const archivesRes = await request(app.getHttpServer())
      .get('/api/invoices/archives')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    for (const item of archivesRes.body.page?.items ?? []) {
      expect(item.totalFcfa).toBeNull();
      expect(item.balanceFcfa).toBeNull();
    }
  });
});
