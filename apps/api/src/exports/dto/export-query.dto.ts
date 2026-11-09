import { IsOptional, IsString } from 'class-validator';
import { ExportDocumentType } from '@residence-blue/shared';

export class ExportQueryDto {
  @IsString()
  type!: ExportDocumentType;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
