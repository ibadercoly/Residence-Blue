import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { RoomStatus } from '@residence-blue/shared';

export class UpdateRoomDto {
  @IsOptional()
  @IsString({ message: 'Le numéro de chambre doit être une chaîne de caractères.' })
  number?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt({ message: "L'étage doit être un nombre entier." })
  floor?: number;

  @IsOptional()
  @IsString({ message: 'La catégorie doit être une chaîne de caractères.' })
  category?: string;

  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Le statut doit être valide (FREE, OCCUPIED, CLEANING, MAINTENANCE).' })
  status?: RoomStatus;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt({ message: 'Le tarif par nuitée doit être un nombre entier strict en FCFA.' })
  @Min(0, { message: 'Le tarif ne peut pas être négatif.' })
  pricePerNight?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return value;
  })
  @IsArray({ message: 'Les équipements doivent être une liste.' })
  @IsString({ each: true, message: 'Chaque équipement doit être une chaîne de caractères.' })
  amenities?: string[];

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageAlt?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  removeImage?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt()
  adultsCapacity?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt()
  childrenCapacity?: number;

  @IsOptional()
  @IsString()
  bedType?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt()
  bedsCount?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt()
  surfaceM2?: number;

  @IsOptional()
  @IsString()
  view?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  smoking?: boolean;

  @IsOptional()
  @IsString()
  connectingRoom?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt()
  highSeasonPricePerNight?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt()
  corporatePricePerNight?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  breakfastIncluded?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  internalNote?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  isActive?: boolean;
}
