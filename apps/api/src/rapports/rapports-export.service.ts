import { BadRequestException, Injectable } from '@nestjs/common';
import { RapportsPeriodKey } from '@residence-blue/shared';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import { toDakarIsoDate } from './rapports-date.util';
import { generateRapportsExcelBuffer } from './rapports-excel.helper';
import { generateRapportsPdfBuffer } from './rapports-pdf.helper';
import { RapportsService } from './rapports.service';

export interface RapportsExportActor {
  userId?: string;
  actorRole?: string;
  actorName?: string;
  ip?: string;
}

export interface RapportsBinaryExport {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}

@Injectable()
export class RapportsExportService {
  constructor(
    private readonly rapportsService: RapportsService,
    private readonly prisma: PrismaService,
  ) {}

  async generatePdf(
    periodInput: RapportsPeriodKey | undefined,
    comparePrevious: boolean,
    actor: RapportsExportActor,
    referenceDate: Date = new Date(),
  ): Promise<RapportsBinaryExport> {
    const report = await this.rapportsService.getReport(periodInput, referenceDate);
    if (!report.hasData) {
      throw new BadRequestException(
        'Aucune donnée sur cette période : export PDF impossible.',
      );
    }

    const todayDakarIso = toDakarIsoDate(referenceDate);
    const fileName = `rapport-${todayDakarIso}.pdf`;
    const buffer = await generateRapportsPdfBuffer({
      report,
      generatedDateLabel: `${todayDakarIso} (Dakar)`,
      comparePrevious,
    });

    await appendChainedAuditLog(this.prisma, {
      userId: actor.userId || null,
      action: 'RAPPORT_EXPORT_PDF',
      entity: 'Rapport',
      entityId: report.period,
      ip: actor.ip || null,
      after: {
        period: report.period,
        startDateIso: report.startDateIso,
        endDateIso: report.endDateIso,
        fileName,
        byteLength: buffer.length,
        actorRole: actor.actorRole || null,
      },
    });

    return {
      buffer,
      fileName,
      contentType: 'application/pdf',
    };
  }

  async generateExcel(
    periodInput: RapportsPeriodKey | undefined,
    actor: RapportsExportActor,
    referenceDate: Date = new Date(),
  ): Promise<RapportsBinaryExport> {
    const report = await this.rapportsService.getReport(periodInput, referenceDate);
    if (!report.hasData) {
      throw new BadRequestException(
        'Aucune donnée sur cette période : export Excel impossible.',
      );
    }

    const todayDakarIso = toDakarIsoDate(referenceDate);
    const fileName = `rapport-${todayDakarIso}.xlsx`;
    const buffer = await generateRapportsExcelBuffer({
      report,
      generatedDateLabel: `${todayDakarIso} (Dakar)`,
    });

    await appendChainedAuditLog(this.prisma, {
      userId: actor.userId || null,
      action: 'RAPPORT_EXPORT_EXCEL',
      entity: 'Rapport',
      entityId: report.period,
      ip: actor.ip || null,
      after: {
        period: report.period,
        startDateIso: report.startDateIso,
        endDateIso: report.endDateIso,
        fileName,
        byteLength: buffer.length,
        actorRole: actor.actorRole || null,
      },
    });

    return {
      buffer,
      fileName,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
