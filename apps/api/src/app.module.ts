import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RolesGuard } from './common/guards/roles.guard';
import { CryptoService } from './common/security/crypto.service';
import { SecurityTestController } from './security-test/security-test.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    HealthModule,
  ],
  controllers: [SecurityTestController],
  providers: [
    CryptoService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [CryptoService],
})
export class AppModule {}
