import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RoomsModule } from './rooms/rooms.module';
import { ExportsModule } from './exports/exports.module';
import { RolesGuard } from './common/guards/roles.guard';
import { ModuleStatusGuard } from './common/guards/module-status.guard';
import { ServerModuleConfigService } from './common/services/server-module-config.service';
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
    RoomsModule,
    ExportsModule,
  ],
  controllers: [SecurityTestController],
  providers: [
    CryptoService,
    ServerModuleConfigService,
    {
      provide: APP_GUARD,
      useClass: ModuleStatusGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [CryptoService, ServerModuleConfigService],
})
export class AppModule {}
