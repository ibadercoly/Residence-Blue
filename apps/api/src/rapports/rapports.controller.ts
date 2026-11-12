// apps/api/src/rapports/rapports.controller.ts
import { Controller, Get, Query, Res, HttpStatus, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RapportsService } from './rapports.service';
import { RapportsDto } from './rapports.dto';

@UseGuards(RolesGuard)
@Controller('api/rapports')
export class RapportsController {
  constructor(private readonly rapportsService: RapportsService) {}

  @Roles('DIRECTION', 'COMPTABLE')
  @Get()
  async getRapports(@Query('periode') periode: string, @Res() res: Response) {
    const data: RapportsDto = await this.rapportsService.compute(periode);
    return res.status(HttpStatus.OK).json(data);
  }

  @Roles('DIRECTION', 'COMPTABLE')
  @Get('export/pdf')
  async exportPdf(@Query('periode') periode: string, @Res() res: Response) {
    const buffer = await this.rapportsService.exportPdf(periode);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rapport-${new Date().toISOString().split('T')[0]}.pdf"`,
      'Content-Length': buffer.length,
    });
    return res.send(buffer);
  }

  @Roles('DIRECTION', 'COMPTABLE')
  @Get('export/excel')
  async exportExcel(@Query('periode') periode: string, @Res() res: Response) {
    const buffer = await this.rapportsService.exportExcel(periode);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rapport-${new Date().toISOString().split('T')[0]}.xlsx"`,
      'Content-Length': buffer.length,
    });
    return res.send(buffer);
  }
}
