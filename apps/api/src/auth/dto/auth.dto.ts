import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "L'identifiant est requis." })
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  login!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsBoolean()
  stayConnected8h?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;
}

export class VerifyTotpLoginDto {
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le code de vérification est requis.' })
  @MaxLength(24)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;
}

export class VerifyTotpCodeDto {
  @IsString()
  @IsNotEmpty({ message: 'Le code de vérification à 6 chiffres est requis.' })
  @MaxLength(16)
  code!: string;
}

export class DisableTotpDto {
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est requis.' })
  @MaxLength(200)
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le code TOTP actuel est requis.' })
  @MaxLength(24)
  code!: string;
}

export class ChangeInitialPasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;

  @IsString()
  @MinLength(10, { message: 'Le nouveau mot de passe doit contenir au moins 10 caractères.' })
  @MaxLength(200)
  newPassword!: string;
}
