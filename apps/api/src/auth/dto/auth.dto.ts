import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@residence-blue/shared';

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

export class CreateUserDto {
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(2, { message: 'Le nom complet doit contenir au moins 2 caractères.' })
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  @MaxLength(200)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
