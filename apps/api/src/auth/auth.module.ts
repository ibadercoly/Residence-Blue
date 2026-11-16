import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionRevocationService } from './session-revocation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoService } from '../common/security/crypto.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, CryptoService, SessionRevocationService],
  exports: [AuthService, SessionRevocationService],
})
export class AuthModule {}
