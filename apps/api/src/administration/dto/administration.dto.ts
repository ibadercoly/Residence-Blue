import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateManagedAccountDto {
  @IsString({ message: 'Le nom complet est requis.' })
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères.' })
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString({ message: 'Le profil de départ est requis.' })
  @MaxLength(60)
  starterProfile!: string;

  @IsObject({ message: 'La matrice des accès par écran est invalide.' })
  screenAccess!: Record<string, unknown>;

  @IsObject({ message: 'Les droits particuliers sont invalides.' })
  specialPermissions!: Record<string, unknown>;
}

export class UpdateManagedAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères.' })
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  starterProfile?: string;

  @IsOptional()
  @IsObject({ message: 'La matrice des accès par écran est invalide.' })
  screenAccess?: Record<string, unknown>;

  @IsOptional()
  @IsObject({ message: 'Les droits particuliers sont invalides.' })
  specialPermissions?: Record<string, unknown>;
}

export class DeleteManagedAccountDto {
  @IsString({ message: 'Saisissez le nom du compte à supprimer.' })
  @IsNotEmpty({ message: 'Saisissez le nom du compte à supprimer.' })
  @MaxLength(120)
  confirmName!: string;

  @IsString({ message: 'Le mot de passe du directeur est requis.' })
  @IsNotEmpty({ message: 'Le mot de passe du directeur est requis.' })
  @MaxLength(200)
  directorPassword!: string;
}

export class UpdateDirectorCredentialsDto {
  @IsString({ message: 'Le mot de passe actuel est requis.' })
  @IsNotEmpty({ message: 'Le mot de passe actuel est requis.' })
  @MaxLength(200)
  currentPassword!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  totpCode?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères.' })
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  @MaxLength(200)
  newPassword?: string;
}
