import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateRoomTypeDto {
  @IsNotEmpty({ message: 'Le nom de la catégorie de chambre est obligatoire.' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères.' })
  name!: string;

  @IsInt({ message: 'Le tarif par nuitée doit être un nombre entier strict en FCFA (sans décimale).' })
  @Min(0, { message: 'Le tarif ne peut pas être négatif.' })
  pricePerNight!: number;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString({ message: 'Le nom doit être une chaîne de caractères.' })
  name?: string;

  @IsOptional()
  @IsInt({ message: 'Le tarif par nuitée doit être un nombre entier strict en FCFA (sans décimale).' })
  @Min(0, { message: 'Le tarif ne peut pas être négatif.' })
  pricePerNight?: number;
}
