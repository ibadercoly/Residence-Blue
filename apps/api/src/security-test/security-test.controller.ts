import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@residence-blue/shared';
import { CryptoService } from '../common/security/crypto.service';

export class CreatePaymentTestDto {
  @IsNotEmpty()
  @IsString()
  idempotencyKey!: string;

  @IsInt()
  @Min(0)
  amountFcfa!: number;

  @IsNotEmpty()
  @IsString()
  guestPassportNumber!: string;
}

@Controller('security-test')
export class SecurityTestController {
  constructor(private readonly cryptoService: CryptoService) {}

  // Route SANS décorateur : doit être bloquée par défaut (403 Forbidden)
  @Get('undecorated-route')
  getUndecorated() {
    return { message: 'Cette route ne devrait jamais être accessible sans déclarer de rôles.' };
  }

  // Route réservée exclusivement aux administrateurs
  @Roles(UserRole.ADMIN)
  @Get('admin-only')
  getAdminOnly() {
    return { message: 'Accès autorisé pour ADMIN.' };
  }

  // Route de test pour la validation stricte (ValidationPipe whitelist + forbidNonWhitelisted)
  // et le chiffrement AES-256-GCM des pièces d'identité
  @Public()
  @Post('strict-validation')
  testValidation(@Body() dto: CreatePaymentTestDto) {
    const encryptedPassport = this.cryptoService.encrypt(dto.guestPassportNumber);
    const decryptedPassport = this.cryptoService.decrypt(encryptedPassport);

    return {
      success: true,
      idempotencyKey: dto.idempotencyKey,
      amountFcfa: dto.amountFcfa,
      encryptedPassport,
      decryptedPassportMatch: decryptedPassport === dto.guestPassportNumber,
    };
  }
}
