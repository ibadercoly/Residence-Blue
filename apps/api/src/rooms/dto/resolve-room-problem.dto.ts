import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveRoomProblemDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La remarque de réparation ne peut pas dépasser 500 caractères.' })
  resolutionNote?: string;
}
