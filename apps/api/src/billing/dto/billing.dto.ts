import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ALLOWED_LINE_CATEGORIES = [
  'HEBERGEMENT',
  'RESTAURANT',
  'PISCINE',
  'BLANCHISSERIE',
  'AUTRES',
  'ROOM',
  'CONCIERGE',
  'HOUSEKEEPING',
  'TAX',
] as const;

export const ALLOWED_PAYMENT_METHODS = [
  'CASH',
  'ORANGE_MONEY',
  'OM',
  'WAVE',
  'CARD',
  'CARTE',
  'CARTE_TPE',
  'BANK_TRANSFER',
  'VIREMENT',
] as const;

export class CreateInvoiceLineDto {
  @IsOptional()
  @IsString()
  dateLabel?: string;

  @IsString()
  @MinLength(1, { message: 'Le libellé de la ligne est obligatoire.' })
  description!: string;

  @IsOptional()
  @IsString()
  subDescription?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_LINE_CATEGORIES, { message: 'Catégorie de ligne invalide.' })
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La quantité doit être un entier.' })
  @Min(1)
  @Max(500)
  quantity?: number;

  @IsOptional()
  @IsString()
  quantityLabel?: string;

  @Type(() => Number)
  @IsInt({ message: 'Le prix unitaire en FCFA doit être un entier.' })
  @Min(0)
  @Max(100_000_000)
  unitPriceFcfa!: number;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "L'acompte en FCFA doit être un entier." })
  @Min(0)
  depositFcfa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La remise en FCFA doit être un entier.' })
  @Min(0)
  discountFcfa?: number;

  @IsOptional()
  @IsString()
  billingCompanyName?: string;

  @IsOptional()
  @IsString()
  billingNinea?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines?: CreateInvoiceLineDto[];
}

export class UpdateDiscountDto {
  @Type(() => Number)
  @IsInt({ message: 'La remise en FCFA doit être un entier.' })
  @Min(0)
  @Max(100_000_000)
  discountFcfa!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePaymentDto {
  @IsString()
  @IsIn(ALLOWED_PAYMENT_METHODS, { message: 'Mode de paiement non reconnu.' })
  method!: string;

  @Type(() => Number)
  @IsInt({ message: 'Le montant encaissé en FCFA doit être un entier strict.' })
  @Min(1, { message: 'Le montant encaissé doit être supérieur à 0 FCFA.' })
  @Max(100_000_000)
  amountFcfa!: number;

  @IsOptional()
  @IsString()
  transactionRef?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ReversePaymentDto {
  @IsString()
  @MinLength(5, { message: "Le motif d'annulation doit comporter au moins 5 caractères." })
  reason!: string;
}

export class CheckoutInvoiceDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateCreditNoteDto {
  @IsString()
  @MinLength(5, { message: "Le motif de l'avoir doit comporter au moins 5 caractères." })
  reason!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Le montant de l'avoir en FCFA doit être un entier positif." })
  @Min(1)
  amountFcfa?: number;
}

export class CounterQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  openOffset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  partialOffset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paidOffset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class RoomRestaurantChargeDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  quantity?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  unitPriceFcfa!: number;

  @IsOptional()
  @IsString()
  dateLabel?: string;
}
