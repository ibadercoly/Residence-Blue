import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RoomStatus } from '@residence-blue/shared';

export class UpdateRoomStatusDto {
  @IsNotEmpty({ message: 'Le statut de la chambre est obligatoire.' })
  @IsEnum(RoomStatus, {
    message: 'Le statut doit être une valeur valide : FREE, OCCUPIED, CLEANING ou MAINTENANCE.',
  })
  status!: RoomStatus;

  @IsOptional()
  @IsString({ message: 'Le motif doit être une chaîne de caractères.' })
  @MaxLength(255, { message: 'Le motif ne peut pas dépasser 255 caractères.' })
  reason?: string;
}
