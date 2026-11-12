import { IsIn, IsOptional } from 'class-validator';
import { RapportsPeriodKey } from '@residence-blue/shared';

export class RapportsQueryDto {
  @IsOptional()
  @IsIn(['30j', '3m', '12m', 'mois'])
  periode?: RapportsPeriodKey;

  @IsOptional()
  @IsIn(['true', 'false', '1', '0'])
  comparer?: string;
}
