import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRestaurantProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryName?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceFcfa!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  halfPortionPriceFcfa?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsArray()
  allergens?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  prepTimeMinutes?: number;

  @IsOptional()
  @IsIn(['CUISINE', 'BAR', 'PATISSERIE'])
  prepStation?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsIn(['AVAILABLE', 'SOLD_OUT', 'ARCHIVED'])
  status?: string;
}

export class UpdateRestaurantProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceFcfa?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsArray()
  allergens?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  prepTimeMinutes?: number;

  @IsOptional()
  @IsIn(['CUISINE', 'BAR', 'PATISSERIE'])
  prepStation?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsIn(['AVAILABLE', 'SOLD_OUT', 'ARCHIVED'])
  status?: string;
}

export class CreateRestaurantOrderLineDto {
  @IsOptional()
  @IsString()
  dishId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPriceFcfa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalPriceFcfa?: number;

  @IsOptional()
  @IsArray()
  selectedOptions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(250)
  notes?: string;

  @IsOptional()
  @IsString()
  prepStation?: string;
}

export class CreateRestaurantOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ticketNumber?: string;

  @IsOptional()
  @IsIn(['ROOM', 'TABLE', 'TAKEAWAY'])
  destinationType?: 'ROOM' | 'TABLE' | 'TAKEAWAY';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tableLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  roomNumber?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serverName?: string;

  @IsOptional()
  @IsIn(['SEND_TO_KITCHEN', 'ROOM_CHARGE', 'PAY'])
  action?: 'SEND_TO_KITCHEN' | 'ROOM_CHARGE' | 'PAY';

  @IsOptional()
  @IsIn(['PENDING', 'SENT_TO_KITCHEN'])
  status?: string;

  @IsOptional()
  @IsIn(['CASH', 'ORANGE_MONEY', 'WAVE', 'CARD', 'BANK_TRANSFER', 'ROOM_CHARGE'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentRef?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRestaurantOrderLineDto)
  items!: CreateRestaurantOrderLineDto[];
}

export class UpdateRestaurantOrderDto {
  @IsOptional()
  @IsIn(['PENDING', 'SENT_TO_KITCHEN', 'IN_PREPARATION', 'READY', 'SERVED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsIn(['CASH', 'ORANGE_MONEY', 'WAVE', 'CARD', 'BANK_TRANSFER', 'ROOM_CHARGE'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  cancellationReason?: string;
}

export class CancelRestaurantOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class PayRestaurantOrderDto {
  @IsIn(['CASH', 'ORANGE_MONEY', 'WAVE', 'CARD', 'BANK_TRANSFER'])
  paymentMethod!: 'CASH' | 'ORANGE_MONEY' | 'WAVE' | 'CARD' | 'BANK_TRANSFER';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  transactionRef?: string;
}

export class RestaurantOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(['ROOM', 'TABLE', 'TAKEAWAY'])
  destinationType?: 'ROOM' | 'TABLE' | 'TAKEAWAY';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
