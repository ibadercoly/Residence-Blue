import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AvailableRoomsQueryDto {
  @IsString({ message: "La date d'arrivée est obligatoire." })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "La date d'arrivée doit être au format YYYY-MM-DD.",
  })
  checkIn!: string;

  @IsString({ message: 'La date de départ est obligatoire.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La date de départ doit être au format YYYY-MM-DD.',
  })
  checkOut!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  adults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  children?: number;
}
