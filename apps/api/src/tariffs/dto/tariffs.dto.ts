import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class TariffQuoteQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Identifiant de chambre invalide.' })
  roomId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  categoryCode?: string;

  @Type(() => Number)
  @IsInt({ message: 'Le nombre de personnes doit être un entier.' })
  @Min(1)
  @Max(10)
  guestsCount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le nombre de chambres utilisées doit être un entier.' })
  @Min(1)
  @Max(3)
  roomsUsed?: number;

  @Type(() => Number)
  @IsInt({ message: 'Le nombre de nuits doit être un entier.' })
  @Min(1)
  @Max(365)
  nights!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  adultsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  childrenCount?: number;

  @IsOptional()
  @IsString()
  breakfastIncluded?: string;
}

export class UpdateTariffCellDto {
  @IsUUID('4', { message: 'Identifiant de tarif invalide.' })
  id!: string;

  @ValidateIf((o) => o.pricePerNightFcfa !== null && o.pricePerNightFcfa !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'Le prix par nuit doit être un montant entier strict en FCFA.' })
  @Min(1, { message: 'Le prix par nuit doit être strictement supérieur à 0 FCFA.' })
  @Max(50_000_000)
  pricePerNightFcfa!: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTariffGridDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une case tarifaire doit être transmise.' })
  @ValidateNested({ each: true })
  @Type(() => UpdateTariffCellDto)
  items!: UpdateTariffCellDto[];
}

export class UpdateExtraServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsIn(['DAY', 'PERSON'], { message: "L'unité doit être DAY ou PERSON." })
  unit?: 'DAY' | 'PERSON';

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  unitLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le prix doit être un entier strict en FCFA.' })
  @Min(1, { message: 'Le prix doit être supérieur à 0 FCFA.' })
  @Max(50_000_000)
  priceFcfa?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExtraServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name!: string;

  @IsIn(['DAY', 'PERSON'], { message: "L'unité doit être DAY ou PERSON." })
  unit!: 'DAY' | 'PERSON';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unitLabel?: string;

  @Type(() => Number)
  @IsInt({ message: 'Le prix doit être un entier strict en FCFA.' })
  @Min(1, { message: 'Le prix doit être supérieur à 0 FCFA.' })
  @Max(50_000_000)
  priceFcfa!: number;
}
