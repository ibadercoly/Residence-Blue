import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsString()
  checkInDate!: string;

  @IsString()
  checkOutDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adultsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  childrenCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nights?: number;

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
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReservationDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  checkInDate?: string;

  @IsOptional()
  @IsString()
  checkOutDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adultsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
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
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
