import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Role } from '@residence-blue/shared';
import { RequireModule } from '../common/decorators/module.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RapportsQueryDto } from './dto/rapports-query.dto';
import { RapportsExportActor, RapportsExportService } from './rapports-export.service';
import { RapportsService } from './rapports.service';

@Controller('rapports')
@RequireModule('rapports')
export class RapportsController {
  constructor(
    private readonly rapportsService: RapportsService,
    private readonly exportService: RapportsExportService,
  ) {}

  private extractActor(req: Request): RapportsExportActor {
    const user = (req as any)?.user as
      | { id?: string; fullName?: string; role?: string }
      | undefined;
    return {
      userId: user?.id,
      actorRole: user?.role,
      actorName: user?.fullName,
      ip: req?.ip || req?.socket?.remoteAddress || undefined,
    };
  }

  @Get()
  @Roles(Role.DIRECTION, Role.COMPTABLE)
  async getReport(@Query() query: RapportsQueryDto) {
    return this.rapportsService.getReport(query.periode);
  }

  private sendExportResponse(
    req: Request,
    res: Response,
    file: { buffer: Buffer; fileName: string; contentType: string },
  ): void {
    // Lorsque le client SPA utilise fetch() avec Accept: application/octet-stream,
    // éviter Content-Type: application/pdf + attachment qui provoque un 204 par les gestionnaires de téléchargement (IDM).
    const rawStreamMode = req.headers?.accept === 'application/octet-stream';
    res.setHeader(
      'Content-Type',
      rawStreamMode ? 'application/octet-stream' : file.contentType,
    );
    if (rawStreamMode) {
      res.setHeader('X-Export-Filename', file.fileName);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    }
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.send(file.buffer);
  }

  @Get('export/pdf')
  @Roles(Role.DIRECTION, Role.COMPTABLE)
  async exportPdf(
    @Query() query: RapportsQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const compare = query.comparer !== 'false' && query.comparer !== '0';
    const file = await this.exportService.generatePdf(
      query.periode,
      compare,
      this.extractActor(req),
    );
    this.sendExportResponse(req, res, file);
  }

  @Get('export/excel')
  @Roles(Role.DIRECTION, Role.COMPTABLE)
  async exportExcel(
    @Query() query: RapportsQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.exportService.generateExcel(
      query.periode,
      this.extractActor(req),
    );
    this.sendExportResponse(req, res, file);
  }
}
