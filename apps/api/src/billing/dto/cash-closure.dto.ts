import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCashClosureDto {
  @IsInt({ message: 'Le montant compté en espèces doit être un entier en FCFA.' })
  @Min(0, { message: 'Le montant compté en espèces ne peut pas être négatif.' })
  totalCountedCash!: number;

  @IsOptional()
  @IsString({ message: 'Les notes doivent être une chaîne de caractères.' })
  @MaxLength(1000, { message: 'Les notes ne peuvent pas dépasser 1000 caractères.' })
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reopenConfirmed?: boolean;
}
