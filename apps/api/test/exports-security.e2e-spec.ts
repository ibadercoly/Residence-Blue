import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { sanitizeSpreadsheetCell } from '../src/exports/exports.service';
import { Role } from '@residence-blue/shared';

const request: any = (supertest as any).default || supertest;

describe('Porte de Sécurité : Module Exports (API)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: async () => {},
        $disconnect: async () => {},
        $queryRaw: async () => [{ 1: 1 }],
      })
      .compile();

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Protection contre l\'injection de formules (CSV / Excel Formula Injection)', () => {
    it('doit neutraliser les formules commençant par =, +, -, @ avec une apostrophe', () => {
      expect(sanitizeSpreadsheetCell('=SUM(A1:A100)')).toBe("'=SUM(A1:A100)");
      expect(sanitizeSpreadsheetCell('+cmd|/C calc!A0')).toBe("'+cmd|/C calc!A0");
      expect(sanitizeSpreadsheetCell('-2+5')).toBe("'-2+5");
      expect(sanitizeSpreadsheetCell('@HYPERLINK("evil.com")')).toBe("'@HYPERLINK(\"evil.com\")");
    });

    it('ne doit pas altérer les valeurs normales et numériques', () => {
      expect(sanitizeSpreadsheetCell('Chambre Standard')).toBe('Chambre Standard');
      expect(sanitizeSpreadsheetCell('Mamadou Diop')).toBe('Mamadou Diop');
      expect(sanitizeSpreadsheetCell(45000)).toBe(45000);
      expect(sanitizeSpreadsheetCell(null)).toBe(null);
    });
  });

  describe('2. Contrôle d\'accès RBAC strict', () => {
    it('doit refuser l\'accès au journal d\'audit sans authentification (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/exports/audit')
        .expect(403);
    });

    it('doit refuser l\'accès au journal d\'audit au rôle RECEPTION (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/exports/audit')
        .set('x-user-role', Role.RECEPTION)
        .expect(403);
    });

    it('doit autoriser l\'accès au journal d\'audit au rôle DIRECTION (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/audit')
        .set('x-user-role', Role.DIRECTION)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('doit refuser l\'export CLIENTS_LIST_EXCEL au rôle RECEPTION (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/download?type=CLIENTS_LIST_EXCEL')
        .set('x-user-role', Role.RECEPTION)
        .expect(403);

      expect(res.body.message).toMatch(/Rôle non autorisé/);
    });

    it('doit autoriser l\'export CLIENTS_LIST_EXCEL au rôle DIRECTION (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/download?type=CLIENTS_LIST_EXCEL')
        .set('x-user-role', Role.DIRECTION)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/openxmlformats-officedocument/);
    });
  });

  describe('3. Validation des bornes et limites temporelles', () => {
    it('doit refuser une période excédant 12 mois (400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/download?type=RESTAURANT_POOL_SALES_EXCEL&startDate=2024-01-01&endDate=2025-06-01')
        .set('x-user-role', Role.DIRECTION)
        .expect(400);

      expect(res.body.message).toMatch(/dépasse la limite stricte de 12 mois/);
    });

    it('doit refuser si la date de début est postérieure à la date de fin (400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/download?type=RESTAURANT_POOL_SALES_EXCEL&startDate=2026-11-10&endDate=2026-11-01')
        .set('x-user-role', Role.DIRECTION)
        .expect(400);

      expect(res.body.message).toMatch(/ne peut pas être postérieure/);
    });

    it('doit refuser si les dates sont manquantes pour un rapport périodique (400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/download?type=RESTAURANT_POOL_SALES_EXCEL')
        .set('x-user-role', Role.DIRECTION)
        .expect(400);

      expect(res.body.message).toMatch(/obligatoires/);
    });
  });

  describe('4. Streaming certifié et Journalisation d\'audit', () => {
    it('doit streamer un fichier PDF valide avec en-têtes corrects', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/download?type=DAILY_SALES_CLOSURE_PDF')
        .set('x-user-role', Role.RECEPTION)
        .set('x-user-name', 'Aminata Diallo')
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/daily_sales_closure_pdf.*\.pdf/);
    });

    it('doit enregistrer une entrée d\'audit pour chaque export généré', async () => {
      const auditRes = await request(app.getHttpServer())
        .get('/api/exports/audit')
        .set('x-user-role', Role.DIRECTION)
        .expect(200);

      expect(auditRes.body.length).toBeGreaterThan(0);
      const lastAudit = auditRes.body[0];
      expect(lastAudit.documentType).toBe('DAILY_SALES_CLOSURE_PDF');
      expect(lastAudit.format).toBe('PDF');
      expect(lastAudit.userFullName).toBe('Aminata Diallo');
      expect(lastAudit.userRole).toBe(Role.RECEPTION);
    });
  });
});
