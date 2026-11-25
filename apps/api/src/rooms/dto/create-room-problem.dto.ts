import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RoomProblemType } from '@residence-blue/shared';

export class CreateRoomProblemDto {
  @IsEnum(['CLIMATISATION', 'FUITE_EAU', 'ELECTRICITE', 'AMPOULE', 'AUTRE'], {
    message: 'Type de problème invalide (CLIMATISATION, FUITE_EAU, ELECTRICITE, AMPOULE, AUTRE).',
  })
  @IsNotEmpty({ message: 'Le type de problème est obligatoire.' })
  type!: RoomProblemType;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La remarque ne peut pas dépasser 500 caractères.' })
  description?: string;

  @IsOptional()
  @IsBoolean()
  blocksRental?: boolean;
}
