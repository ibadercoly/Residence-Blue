import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Accepte les numéros sénégalais (+221 77/78/76/70/75 ou format local à 9 chiffres)
 * ainsi que les espaces, tirets et points usuels.
 */
export const SENEGAL_PHONE_REGEX =
  /^(?:\+?221[\s.-]?)?(?:77|78|76|70|75|33)(?:[\s.-]?\d){7}$|^\+\d{8,15}$/;

export class ListGuestsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'IN_STAY', 'UPCOMING'])
  filter?: 'ALL' | 'IN_STAY' | 'UPCOMING';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SearchGuestsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  limit?: number;
}

export class ListGuestStaysQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class CheckDuplicateQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idDocumentNumber?: string;

  @IsOptional()
  @IsString()
  excludeId?: string;
}

export class CreateGuestDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  civility?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsString()
  @Matches(SENEGAL_PHONE_REGEX, {
    message:
      'Numéro de téléphone sénégalais invalide (ex. +221 77 123 45 67 ou 77 123 45 67).',
  })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsIn(['CNI', 'PASSPORT', 'PERMIS', 'AUTRE'])
  idDocumentType?: 'CNI' | 'PASSPORT' | 'PERMIS' | 'AUTRE';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idDocumentNumber?: string;

  /** Rétrocompatibilité tests existants */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  passportNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;
}

export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Le nom complet ne peut pas être vide.' })
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(SENEGAL_PHONE_REGEX, {
    message:
      'Numéro de téléphone sénégalais invalide (ex. +221 77 123 45 67 ou 77 123 45 67).',
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsIn(['CNI', 'PASSPORT', 'PERMIS', 'AUTRE'])
  idDocumentType?: 'CNI' | 'PASSPORT' | 'PERMIS' | 'AUTRE';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idDocumentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
