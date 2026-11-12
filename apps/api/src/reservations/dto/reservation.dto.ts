import {
  IsBoolean,
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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const SENEGAL_PHONE_REGEX =
  /^(?:\+?221[\s.-]?)?(?:77|78|76|70|75|33)(?:[\s.-]?\d){7}$|^\+\d{8,15}$/;

export const RESERVATION_SOURCES = [
  'RECEPTION',
  'TELEPHONE',
  'WHATSAPP',
  'EN_LIGNE',
  'ENTREPRISE',
] as const;

export const RESERVATION_PAYMENT_METHODS = [
  'CASH',
  'ESPECES',
  'WAVE',
  'ORANGE_MONEY',
  'CARD',
  'CARTE',
  'CARTE_TPE',
  'BANK_TRANSFER',
  'VIREMENT',
] as const;

export class QuickGuestDto {
  @IsString({ message: 'Le nom complet du client est requis.' })
  @MinLength(2, { message: 'Le nom complet doit contenir au moins 2 caractères.' })
  @MaxLength(160)
  fullName!: string;

  @IsString({ message: 'Le téléphone du client est requis.' })
  @Matches(SENEGAL_PHONE_REGEX, {
    message:
      'Numéro de téléphone sénégalais invalide (+221 77/78/76/70/75 ou format local à 9 chiffres).',
  })
  phone!: string;
}

export class CreateReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roomId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  roomNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  guestId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuickGuestDto)
  newGuest?: QuickGuestDto;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  guestName?: string;

  @IsOptional()
  @IsString()
  @Matches(SENEGAL_PHONE_REGEX, {
    message:
      'Numéro de téléphone sénégalais invalide (+221 77/78/76/70/75 ou format local à 9 chiffres).',
  })
  contactPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(160)
  contactEmail?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "La date d'arrivée doit être au format YYYY-MM-DD.",
  })
  checkInDate!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La date de départ doit être au format YYYY-MM-DD.',
  })
  checkOutDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  adultsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  childrenCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nights?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "L'acompte doit être un montant entier en FCFA." })
  @Min(0)
  depositFcfa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La remise doit être un montant entier en FCFA.' })
  @Min(0)
  discountFcfa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalFcfa?: number;

  @IsOptional()
  @IsIn(RESERVATION_PAYMENT_METHODS, {
    message: 'Mode de paiement invalide.',
  })
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  transactionRef?: string;

  @IsOptional()
  @IsBoolean()
  breakfastIncluded?: boolean;

  @IsOptional()
  @IsIn(RESERVATION_SOURCES, {
    message: 'Source de réservation invalide.',
  })
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roomId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  roomNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkInDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOutDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  adultsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  childrenCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  depositFcfa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalFcfa?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
