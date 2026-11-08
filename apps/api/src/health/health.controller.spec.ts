import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController (Test Unitaire)', () => {
  it('doit renvoyer { status: "ok" } lorsque la base de données répond', async () => {
    const mockPrisma = {
      $queryRaw: async () => [{ 1: 1 }],
    } as unknown as PrismaService;

    const controller = new HealthController(mockPrisma);
    const result = await controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
  });

  it('doit renvoyer { status: "ok", database: "offline_mode" } si la base est hors ligne', async () => {
    const mockPrisma = {
      $queryRaw: async () => {
        throw new Error('DB down');
      },
    } as unknown as PrismaService;

    const controller = new HealthController(mockPrisma);
    const result = await controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('offline_mode');
  });
});
