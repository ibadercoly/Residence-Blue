import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelRoomProblemDto {
  @IsNotEmpty({ message: 'Le motif d’annulation est obligatoire.' })
  @IsString()
  @MaxLength(500, { message: 'Le motif ne peut pas dépasser 500 caractères.' })
  cancellationReason!: string;
}
