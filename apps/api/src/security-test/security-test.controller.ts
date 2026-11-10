import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@residence-blue/shared';
import { CryptoService } from '../common/security/crypto.service';
import { RequireModule } from '../common/decorators/module.decorator';

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

  // Route publique autorisée
  @Public()
  @Get('public-ping')
  getPublic() {
    return { status: 'ok', public: true };
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

  // Route rattachée à un module désactivé (Housekeeping V2) : doit retourner 404 Not Found
  @RequireModule('housekeeping')
  @Roles(UserRole.ADMIN, 'HOUSEKEEPING')
  @Get('deferred-housekeeping')
  getDeferredHousekeeping() {
    return { message: 'Données de gouvernance V2' };
  }

  // Route rattachée à un module actif (Rooms V1) : doit autoriser l'accès
  @RequireModule('rooms')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get('active-rooms-module')
  getActiveRooms() {
    return { message: 'Module chambres actif V1' };
  }

  // Route sur un module actif autorisant le rôle HOUSEKEEPING : pour tester le blocage du rôle désactivé en V1
  @RequireModule('rooms')
  @Roles(UserRole.ADMIN, 'HOUSEKEEPING')
  @Get('test-staff-role')
  testStaffRole() {
    return { message: 'Rôle autorisé' };
  }
}
