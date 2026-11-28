import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TariffsModule } from '../tariffs/tariffs.module';

@Module({
  imports: [PrismaModule, TariffsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
