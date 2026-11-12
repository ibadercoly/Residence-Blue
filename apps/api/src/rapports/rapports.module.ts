import { Module } from '@nestjs/common';
import { RapportsController } from './rapports.controller';
import { RapportsExportService } from './rapports-export.service';
import { RapportsService } from './rapports.service';

@Module({
  controllers: [RapportsController],
  providers: [RapportsService, RapportsExportService],
  exports: [RapportsService, RapportsExportService],
})
export class RapportsModule {}
