import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceLineDto {
  @IsOptional()
  @IsString()
  dateLabel?: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  subDescription?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  quantityLabel?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPriceFcfa!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalPriceFcfa?: number;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

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
  @IsInt()
  @Min(0)
  depositFcfa?: number;

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
  lines?: CreateInvoiceLineDto[];
}

export class CreatePaymentDto {
  @IsString()
  method!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountFcfa!: number;

  @IsOptional()
  @IsString()
  transactionRef?: string;
}
