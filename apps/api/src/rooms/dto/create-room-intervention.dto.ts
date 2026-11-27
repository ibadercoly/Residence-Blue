import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRoomInterventionDto {
  @IsString({ message: 'La description du problème doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'La description du problème est obligatoire.' })
  @MaxLength(500, { message: 'La description ne peut pas dépasser 500 caractères.' })
  issueDescription!: string;
}
