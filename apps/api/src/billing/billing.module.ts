import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CashClosureController } from './cash-closure.controller';
import { CashClosureService } from './cash-closure.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController, CashClosureController],
  providers: [BillingService, CashClosureService],
  exports: [BillingService, CashClosureService],
})
export class BillingModule {}
