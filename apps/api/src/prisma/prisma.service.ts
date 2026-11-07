import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Dans le cadre des tests ou en dev sans DB active, on gère proprement la connexion
    try {
      await this.$connect();
    } catch {
      // La connexion sera établie lorsque PostgreSQL sera disponible
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
