import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import * as express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { PrismaClient, Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SanitizedExceptionFilter } from '../src/common/filters/http-exception.filter';
import { signJwt } from '../src/auth/jwt.util';
import { generateTotpCode } from '../src/auth/totp.util';
import { issueDbTestToken } from './auth-test.helper';

describe('Sécurité En Ligne — Tests complets d’intrusion et de conformité (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdGuestIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.disable('x-powered-by');
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ limit: '1mb', extended: true }));
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        frameguard: { action: 'deny' },
      }),
    );
    app.enableCors({
      origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || origin === 'http://localhost:4200') {
          cb(null, true);
        } else {
          cb(new Error('CORS non autorisé'), false);
        }
      },
      credentials: true,
    });
    app.setGlobalPrefix('api', { exclude: ['health', 'api/health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new SanitizedExceptionFilter());

    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (createdGuestIds.length > 0) {
        await prisma.guest.deleteMany({ where: { id: { in: createdGuestIds } } }).catch(() => {});
      }
      if (createdUserIds.length > 0) {
        await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
      }
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('1. Jetons JWT : absence, falsification, expiration & rejet total de x-user-role', () => {
    it('renvoie 401 sans jeton Bearer même si x-user-role: DIRECTION est envoyé', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('x-user-role', 'DIRECTION')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/guests')
        .set('x-user-role', 'RECEPTION')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/invoices/counter')
        .set('x-user-role', 'COMPTABLE')
        .expect(401);
    });

    it('renvoie 401 sur un jeton falsifié, alg=none, mauvais type (mfa_pending) ou expiré', async () => {
      // Jeton forgé avec mauvaise signature
      const forged = signJwt(
        {
          sub: '00000000-0000-4000-8000-000000000001',
          email: 'fake@residenceblue.sn',
          fullName: 'Fake',
          role: 'DIRECTION',
          sid: '00000000-0000-4000-8000-000000000002',
          jti: 'jti-1',
          type: 'access',
        },
        900,
        'wrong-secret-key-not-matching-server-key',
      );
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);

      // Jeton alg: none
      const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const p = Buffer.from(
        JSON.stringify({
          sub: '00000000-0000-4000-8000-000000000001',
          role: 'DIRECTION',
          type: 'access',
          exp: Math.floor(Date.now() / 1000) + 900,
        }),
      ).toString('base64url');
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${h}.${p}.`)
        .expect(401);

      // Jeton expiré (TTL négatif)
      const { token: validDirToken, userId, familyId } = await issueDbTestToken(prisma, Role.DIRECTION);
      expect(validDirToken).toBeDefined();
      const expired = signJwt(
        {
          sub: userId,
          email: 'dir@residenceblue.sn',
          fullName: 'Dir',
          role: 'DIRECTION',
          sid: familyId,
          jti: 'jti-exp',
          type: 'access',
        },
        -60,
      );
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);

      // Jeton de type mfa_pending refusé comme access token
      const mfaToken = signJwt(
        { sub: userId, email: 'dir@residenceblue.sn', role: 'DIRECTION', type: 'mfa_pending' },
        300,
      );
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${mfaToken}`)
        .expect(401);
    });

    it('ignore x-user-role: DIRECTION quand le JWT appartient à un rôle inférieur (403)', async () => {
      const { token: serveurToken } = await issueDbTestToken(prisma, Role.SERVEUR);
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${serveurToken}`)
        .set('x-user-role', 'DIRECTION')
        .expect(403);
    });
  });

  describe('2. Rôles interdits (403) pour chaque rôle & Accès refusé par défaut', () => {
    it('applique 403 Forbidden pour chaque rôle hors périmètre et sur toute route sans @Roles', async () => {
      const dir = await issueDbTestToken(prisma, Role.DIRECTION);
      const rec = await issueDbTestToken(prisma, Role.RECEPTION);
      const resto = await issueDbTestToken(prisma, Role.RESTAURANT);
      const serveur = await issueDbTestToken(prisma, Role.SERVEUR);
      const cuisine = await issueDbTestToken(prisma, Role.CUISINE);
      const comptable = await issueDbTestToken(prisma, Role.COMPTABLE);

      // DIRECTION sur une route sans @Roles -> 403 (accès refusé par défaut)
      await request(app.getHttpServer())
        .get('/api/security-test/undecorated-route')
        .set('Authorization', `Bearer ${dir.token}`)
        .expect(403);

      // RECEPTION -> interdit sur création utilisateur & audit/verify & clôture caisse
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${rec.token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('Authorization', `Bearer ${rec.token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/invoices/cash-closure/export')
        .set('Authorization', `Bearer ${rec.token}`)
        .expect(403);

      // RESTAURANT -> interdit sur clients et factures
      await request(app.getHttpServer())
        .get('/api/guests')
        .set('Authorization', `Bearer ${resto.token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/invoices')
        .set('Authorization', `Bearer ${resto.token}`)
        .expect(403);

      // SERVEUR -> interdit sur création de plat, clients, factures
      await request(app.getHttpServer())
        .post('/api/restaurant/products')
        .set('Authorization', `Bearer ${serveur.token}`)
        .send({ name: 'Test', categoryName: 'Plats', priceFcfa: 1000 })
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/guests')
        .set('Authorization', `Bearer ${serveur.token}`)
        .expect(403);

      // CUISINE -> interdit sur création de commande et sur clients
      await request(app.getHttpServer())
        .post('/api/restaurant/orders')
        .set('Authorization', `Bearer ${cuisine.token}`)
        .send({ items: [{ name: 'Plat', quantity: 1, unitPriceFcfa: 1000 }] })
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/guests')
        .set('Authorization', `Bearer ${cuisine.token}`)
        .expect(403);

      // COMPTABLE -> interdit sur pièces d’identité (reveal-document) et suppression d’utilisateurs
      await request(app.getHttpServer())
        .post('/api/guests/00000000-0000-4000-8000-000000000001/reveal-document')
        .set('Authorization', `Bearer ${comptable.token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${comptable.token}`)
        .expect(403);

      // COMPTABLE autorisé sur /api/audit/verify
      await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('Authorization', `Bearer ${comptable.token}`)
        .expect(200);
    });
  });

  describe('3. Mots de passe argon2id, TOTP (2FA obligatoire/facultative) & Codes de secours', () => {
    it('exige 10+ caractères, rejette les mots de passe courants et stocke en argon2id', async () => {
      const dir = await issueDbTestToken(prisma, Role.DIRECTION);
      const email = `pwd.policy.${Date.now()}@residenceblue.sn`;

      // Trop court (< 10)
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({ email, fullName: 'Policy Test', password: 'Court9!', role: Role.RECEPTION })
        .expect(400);

      // Mot de passe courant (>= 10 mais interdit)
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({ email, fullName: 'Policy Test', password: 'motdepasse123', role: Role.RECEPTION })
        .expect(400);

      // Mot de passe fort accepté et haché en argon2id
      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({
          email,
          fullName: 'Policy OK',
          password: 'TerangaSecurity2026#Thies',
          role: Role.RECEPTION,
        })
        .expect(201);

      createdUserIds.push(created.body.id);
      const dbUser = await prisma.user.findUnique({ where: { id: created.body.id } });
      expect(dbUser!.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('impose le 2FA TOTP pour DIRECTION/COMPTABLE avec codes de secours à usage unique', async () => {
      const dir = await issueDbTestToken(prisma, Role.DIRECTION);
      const email = `totp.comptable.${Date.now()}@residenceblue.sn`;
      const pwd = 'ComptableStrong2026#!';

      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({ email, fullName: 'Comptable Test', password: pwd, role: Role.COMPTABLE })
        .expect(201);
      createdUserIds.push(created.body.id);

      // 1re connexion -> MFA_SETUP_REQUIRED
      const step1 = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: email, password: pwd })
        .expect(200);

      expect(step1.body.status).toBe('MFA_SETUP_REQUIRED');
      expect(step1.body.accessToken).toBeUndefined();
      const secret = step1.body.totpSetup.secret as string;
      const totpCode = generateTotpCode(secret);

      // Validation setup -> jeton d'accès + cookie httpOnly Secure SameSite=Strict + 8 codes de secours
      const setupDone = await request(app.getHttpServer())
        .post('/api/auth/login/totp-setup')
        .send({ mfaToken: step1.body.mfaToken, code: totpCode })
        .expect(200);

      expect(setupDone.body.status).toBe('AUTHENTICATED');
      expect(setupDone.body.accessToken).toBeDefined();
      expect(setupDone.body.backupCodes).toHaveLength(8);
      const setCookie = setupDone.headers['set-cookie'] as string[];
      expect(setCookie.join(';')).toContain('HttpOnly');
      expect(setCookie.join(';')).toContain('Secure');
      expect(setCookie.join(';')).toContain('SameSite=Strict');

      // Impossible pour COMPTABLE de désactiver sa 2FA
      await request(app.getHttpServer())
        .post('/api/auth/totp/disable')
        .set('Authorization', `Bearer ${setupDone.body.accessToken}`)
        .send({ password: pwd, code: generateTotpCode(secret) })
        .expect(403);

      // Connexion suivante -> MFA_REQUIRED, puis usage d'un code de secours (usage unique)
      const step2 = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: email, password: pwd })
        .expect(200);
      expect(step2.body.status).toBe('MFA_REQUIRED');

      const oneBackup = setupDone.body.backupCodes[0] as string;
      await request(app.getHttpServer())
        .post('/api/auth/login/totp')
        .send({ mfaToken: step2.body.mfaToken, code: oneBackup })
        .expect(200);

      // Rejouer le même code de secours doit échouer (401)
      const step3 = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: email, password: pwd })
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/auth/login/totp')
        .send({ mfaToken: step3.body.mfaToken, code: oneBackup })
        .expect(401);
    });
  });

  describe('4. Rotation & Détection de réutilisation, Révocation, Inactivité & Désactivation', () => {
    it('effectue la rotation du refresh token et révoque toute la famille en cas de réutilisation', async () => {
      const dir = await issueDbTestToken(prisma, Role.DIRECTION);
      const email = `rot.user.${Date.now()}@residenceblue.sn`;
      const pwd = 'RotationStrong2026#!';
      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({ email, fullName: 'Rotation User', password: pwd, role: Role.RECEPTION })
        .expect(201);
      createdUserIds.push(created.body.id);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: email, password: pwd })
        .expect(200);

      const cookie1 = (loginRes.headers['set-cookie'] as string[])[0].split(';')[0];

      // 1re rotation légitime -> nouveau cookie2
      const refresh1 = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie1)
        .expect(200);
      const cookie2 = (refresh1.headers['set-cookie'] as string[])[0].split(';')[0];
      expect(cookie2).not.toBe(cookie1);
      expect(refresh1.body.accessToken).toBeDefined();

      // Réutilisation de l'ancien cookie1 -> 401 ET révocation de toute la famille !
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie1)
        .expect(401);

      // Même le cookie2 légitime est maintenant révoqué -> 401 !
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie2)
        .expect(401);

      // Et l'ancien jeton d'accès est également rejeté car sa famille sid est révoquée
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refresh1.body.accessToken}`)
        .expect(401);
    });

    it('révoque immédiatement tous les jetons si le compte est désactivé ou la session révoquée par DIRECTION', async () => {
      const dir = await issueDbTestToken(prisma, Role.DIRECTION);
      const email = `deact.${Date.now()}@residenceblue.sn`;
      const pwd = 'DeactivateStrong2026!';
      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({ email, fullName: 'Deact User', password: pwd, role: Role.RECEPTION })
        .expect(201);
      createdUserIds.push(created.body.id);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: email, password: pwd })
        .expect(200);
      const tokenA = loginRes.body.accessToken as string;
      const cookieA = (loginRes.headers['set-cookie'] as string[])[0].split(';')[0];

      // Vérifier que DIRECTION voit la session dans /api/auth/sessions et peut la révoquer
      const sessionsRes = await request(app.getHttpServer())
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${dir.token}`)
        .expect(200);
      const targetSession = (sessionsRes.body as any[]).find((s) => s.userId === created.body.id);
      expect(targetSession).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/auth/sessions/${targetSession.familyId}`)
        .set('Authorization', `Bearer ${dir.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(401);

      // Se reconnecter puis désactiver le compte -> tout est immédiatement révoqué
      const loginRes2 = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: email, password: pwd })
        .expect(200);
      const tokenB = loginRes2.body.accessToken as string;
      const cookieB = (loginRes2.headers['set-cookie'] as string[])[0].split(';')[0];

      await request(app.getHttpServer())
        .patch(`/api/users/${created.body.id}`)
        .set('Authorization', `Bearer ${dir.token}`)
        .send({ isActive: false })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookieB)
        .expect(401);
      expect(cookieA).toBeDefined();
    });

    it('expire la session après 30 minutes d’inactivité', async () => {
      const dir = await issueDbTestToken(prisma, Role.DIRECTION);
      const email = `idle.${Date.now()}@residenceblue.sn`;
      const pwd = 'IdleTestStrong2026!';
      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({ email, fullName: 'Idle User', password: pwd, role: Role.RECEPTION })
        .expect(201);
      createdUserIds.push(created.body.id);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: email, password: pwd })
        .expect(200);
      const cookie = (loginRes.headers['set-cookie'] as string[])[0].split(';')[0];

      // Simuler 31 minutes d'inactivité sur les refresh_tokens de l'utilisateur
      await prisma.refreshToken.updateMany({
        where: { userId: created.body.id },
        data: { lastUsedAt: new Date(Date.now() - 31 * 60 * 1000) },
      });

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    });
  });

  describe('5. Limitation tentatives brute-force & messages génériques identiques', () => {
    it('bloque après 5 échecs avec le même message que le compte existe ou non', async () => {
      const dir = await issueDbTestToken(prisma, Role.DIRECTION);
      const realEmail = `bf.real.${Date.now()}@residenceblue.sn`;
      const fakeEmail = `bf.fake.${Date.now()}@residenceblue.sn`;
      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({
          email: realEmail,
          fullName: 'Brute Force',
          password: 'BruteForceStrong2026!',
          role: Role.SERVEUR,
        })
        .expect(201);
      createdUserIds.push(created.body.id);

      const realMsgs: string[] = [];
      const fakeMsgs: string[] = [];

      // Utiliser des IP distinctes X-Forwarded-For par scénario pour tester le throttling par compte sans bloquer d'autres tests
      for (let i = 0; i < 4; i++) {
        const r = await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', `198.51.100.${10 + i}`)
          .send({ login: realEmail, password: 'WrongPassword123!' })
          .expect(401);
        realMsgs.push(r.body.message);

        const f = await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', `198.51.100.${50 + i}`)
          .send({ login: fakeEmail, password: 'WrongPassword123!' })
          .expect(401);
        fakeMsgs.push(f.body.message);
      }

      expect(realMsgs).toEqual(fakeMsgs);

      const lockReal = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.19')
        .send({ login: realEmail, password: 'WrongPassword123!' })
        .expect(429);

      const lockFake = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.59')
        .send({ login: fakeEmail, password: 'WrongPassword123!' })
        .expect(429);

      expect(lockReal.body.message).toBe(lockFake.body.message);
    });
  });

  describe('6. Injection SQL, En-têtes HTTP, Limite de taille, Idempotence & Chaîne AuditLog', () => {
    it('résiste aux injections SQL et retourne des réponses sans détails internes', async () => {
      const rec = await issueDbTestToken(prisma, Role.RECEPTION);

      const sqliRes = await request(app.getHttpServer())
        .get('/api/guests')
        .query({ search: "' OR '1'='1'; DROP TABLE users; --" })
        .set('Authorization', `Bearer ${rec.token}`)
        .expect(200);
      expect(Array.isArray(sqliRes.body.items)).toBe(true);

      const invRes = await request(app.getHttpServer())
        .get('/api/invoices/counter')
        .query({ search: "1' UNION SELECT password_hash FROM users--" })
        .set('Authorization', `Bearer ${rec.token}`)
        .expect(200);
      expect(invRes.body.kpis).toBeDefined();
    }, 20000);

    it('applique les en-têtes CSP, HSTS, X-Frame-Options, limite 1 Mo et Idempotency-Key restaurant', async () => {
      const rec = await issueDbTestToken(prisma, Role.RECEPTION);
      const healthRes = await request(app.getHttpServer())
        .get('/api/health')
        .set('Origin', 'http://localhost:4200')
        .expect(200);

      expect(healthRes.headers['content-security-policy']).toContain("default-src 'self'");
      expect(healthRes.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(healthRes.headers['x-frame-options']).toBe('DENY');
      expect(healthRes.headers['access-control-allow-origin']).toBe('http://localhost:4200');

      // Requête trop lourde (> 1 Mo) rejetée 413
      const oversized = 'A'.repeat(1_200_000);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: 'x@test.sn', password: oversized })
        .expect(413);

      // Idempotence sur POST /api/restaurant/orders
      const idemKey = crypto.randomUUID();
      const orderPayload = {
        ticketNumber: `#TST-${Date.now()}`,
        destinationType: 'TABLE',
        tableLabel: 'T2',
        items: [{ name: 'Jus de Bissap', quantity: 2, unitPriceFcfa: 1500 }],
      };
      const o1 = await request(app.getHttpServer())
        .post('/api/restaurant/orders')
        .set('Authorization', `Bearer ${rec.token}`)
        .set('Idempotency-Key', idemKey)
        .send(orderPayload)
        .expect(201);
      const o2 = await request(app.getHttpServer())
        .post('/api/restaurant/orders')
        .set('Authorization', `Bearer ${rec.token}`)
        .set('Idempotency-Key', idemKey)
        .send(orderPayload)
        .expect(201);

      expect(o2.body.id).toBe(o1.body.id);
    });

    it('détecte toute altération du journal d’audit via GET /api/audit/verify', async () => {
      const dir = await issueDbTestToken(prisma, Role.DIRECTION);

      // Générer une entrée fraîche via création client
      const gRes = await request(app.getHttpServer())
        .post('/api/guests')
        .set('Authorization', `Bearer ${dir.token}`)
        .send({
          fullName: `Audit Check ${Date.now()}`,
          phone: `+22177${Math.floor(1000000 + Math.random() * 8999999)}`,
          idDocumentNumber: 'CNI-AUDIT-9999',
        })
        .expect(201);
      createdGuestIds.push(gRes.body.id);

      // Vérifier qu'aucune donnée brute de CNI n'a été stockée dans audit_log
      const guestAudit = await prisma.auditLog.findFirst({
        where: { entity: 'GUEST', entityId: gRes.body.id },
        orderBy: { seq: 'desc' },
      });
      expect(JSON.stringify(guestAudit)).not.toContain('CNI-AUDIT-9999');

      // Vérifier l'intégrité avant altération
      const verifyOk = await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('Authorization', `Bearer ${dir.token}`)
        .expect(200);
      expect(verifyOk.body.valid).toBe(true);

      // Simuler une attaque directe en base (app_owner contournant le trigger) et vérifier la détection
      const dbHost = process.env.TEST_DB_HOST || 'localhost';
      const dbPort = process.env.TEST_DB_PORT || '5432';
      const dbName = process.env.TEST_DB_NAME || 'residence_blue_db';
      const ownerPwd = process.env.TEST_APP_OWNER_PASSWORD as string;
      const ownerPrisma = new PrismaClient({
        datasources: {
          db: {
            url: `postgresql://app_owner:${encodeURIComponent(ownerPwd)}@${dbHost}:${dbPort}/${dbName}?schema=public`,
          },
        },
      });
      await ownerPrisma.$connect();
      try {
        await ownerPrisma.$executeRawUnsafe(
          'ALTER TABLE "audit_log" DISABLE TRIGGER trg_audit_log_append_only;',
        );
        await ownerPrisma.$executeRawUnsafe(
          'UPDATE "audit_log" SET action = $1 WHERE id = $2::uuid',
          'TAMPERED_ACTION',
          guestAudit!.id,
        );
        await ownerPrisma.$executeRawUnsafe(
          'ALTER TABLE "audit_log" ENABLE TRIGGER trg_audit_log_append_only;',
        );

        const verifyTampered = await request(app.getHttpServer())
          .get('/api/audit/verify')
          .set('Authorization', `Bearer ${dir.token}`)
          .expect(200);

        expect(verifyTampered.body.valid).toBe(false);
        expect(verifyTampered.body.brokenAtId).toBe(guestAudit!.id);

        // Restaurer la valeur légitime pour laisser la base propre
        await ownerPrisma.$executeRawUnsafe(
          'ALTER TABLE "audit_log" DISABLE TRIGGER trg_audit_log_append_only;',
        );
        await ownerPrisma.$executeRawUnsafe(
          'UPDATE "audit_log" SET action = $1 WHERE id = $2::uuid',
          guestAudit!.action,
          guestAudit!.id,
        );
        await ownerPrisma.$executeRawUnsafe(
          'ALTER TABLE "audit_log" ENABLE TRIGGER trg_audit_log_append_only;',
        );
      } finally {
        await ownerPrisma.$disconnect();
      }

      const verifyRestored = await request(app.getHttpServer())
        .get('/api/audit/verify')
        .set('Authorization', `Bearer ${dir.token}`)
        .expect(200);
      expect(verifyRestored.body.valid).toBe(true);
    }, 25000);
  });
});
