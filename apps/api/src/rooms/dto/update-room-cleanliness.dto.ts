import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateRoomCleanlinessDto {
  @IsBoolean({ message: 'La valeur de propreté doit être un booléen.' })
  @IsNotEmpty()
  isClean!: boolean;
}
