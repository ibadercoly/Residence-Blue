import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { HealthModule } from './health/health.module';
import { GuestsModule } from './guests/guests.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SettingsModule } from './settings/settings.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { BillingModule } from './billing/billing.module';
import { ExportsModule } from './exports/exports.module';
import { AccueilModule } from './accueil/accueil.module';
import { RapportsModule } from './rapports/rapports.module';
import { AdministrationModule } from './administration/administration.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './common/audit/audit.module';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ModuleStatusGuard } from './common/guards/module-status.guard';
import { SecurityTestController } from './security-test/security-test.controller';
import { CryptoService } from './common/security/crypto.service';
import { ServerModuleConfigService } from './common/services/server-module-config.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    RoomsModule,
    GuestsModule,
    ReservationsModule,
    SettingsModule,
    RestaurantModule,
    BillingModule,
    ExportsModule,
    AccueilModule,
    RapportsModule,
    AdministrationModule,
    NotificationsModule,
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
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
