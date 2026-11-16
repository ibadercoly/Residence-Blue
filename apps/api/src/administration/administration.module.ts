import { Module } from '@nestjs/common';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../common/security/crypto.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdministrationController],
  providers: [AdministrationService, CryptoService],
  exports: [AdministrationService],
})
export class AdministrationModule {}
