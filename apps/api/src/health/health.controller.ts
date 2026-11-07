import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async getHealth() {
    let dbStatus = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'offline_mode';
    }

    return {
      status: 'ok',
      service: 'residence-blue-api',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      offlineSupport: true,
    };
  }
}
