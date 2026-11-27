import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectRoomInterventionDto {
  @IsOptional()
  @IsString({ message: 'Le motif de refus doit être une chaîne de caractères.' })
  @MaxLength(500, { message: 'Le motif de refus ne peut pas dépasser 500 caractères.' })
  reason?: string;
}
