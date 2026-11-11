import { IsArray, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRestaurantProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
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
  prepTimeMinutes?: number;

  @IsOptional()
  @IsString()
  prepStation?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateRestaurantProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

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
  prepTimeMinutes?: number;

  @IsOptional()
  @IsString()
  prepStation?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateRestaurantOrderLineDto {
  @IsOptional()
  @IsString()
  dishId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPriceFcfa!: number;

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
  notes?: string;

  @IsOptional()
  @IsString()
  prepStation?: string;
}

export class CreateRestaurantOrderDto {
  @IsOptional()
  @IsString()
  ticketNumber?: string;

  @IsOptional()
  @IsString()
  destinationType?: string;

  @IsOptional()
  @IsString()
  tableLabel?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  serverName?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsArray()
  items!: CreateRestaurantOrderLineDto[];
}

export class UpdateRestaurantOrderDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
