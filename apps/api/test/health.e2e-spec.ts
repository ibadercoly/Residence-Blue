import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const request: any = (supertest as any).default || supertest;

describe('GET /health (Test d’Intégration)', () => {
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
    app.setGlobalPrefix('api', { exclude: ['health', 'api/health'] });
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health doit répondre 200 avec { status: "ok" }', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /api/health doit également répondre 200 avec { status: "ok" }', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
  });
});
