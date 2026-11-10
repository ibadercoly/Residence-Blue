import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';
import { ExportsService } from './exports.service';
import { ExportQueryDto } from './dto/export-query.dto';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('audit')
  @Roles(Role.DIRECTION)
  getAuditLogs() {
    return this.exportsService.getAuditLogs();
  }

  @Get('download')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async downloadExport(
    @Query() query: ExportQueryDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const userRole = ((req.headers['x-user-role'] as string) || (req as any).user?.role || Role.RECEPTION) as Role;
    const userFullName = (req.headers['x-user-name'] as string) || (req as any).user?.fullName || 'Personnel Résidence Blue';

    await this.exportsService.streamExport(
      query,
      { fullName: userFullName, role: userRole },
      res
    );
  }
}
