import { Module } from '@nestjs/common';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoService } from '../common/security/crypto.service';

@Module({
  imports: [PrismaModule],
  controllers: [GuestsController],
  providers: [GuestsService, CryptoService],
  exports: [GuestsService],
})
export class GuestsModule {}
