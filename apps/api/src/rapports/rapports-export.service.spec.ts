import * as ExcelJS from 'exceljs';
import { RapportsResponse } from '@residence-blue/shared';
import { RapportsExportService } from './rapports-export.service';

function extractPdfReadableText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const hexSegments = Array.from(raw.matchAll(/<([0-9a-fA-F]{2,})>/g))
    .filter((m) => m[1].length % 2 === 0 && !/trailer|ID/i.test(raw.slice(Math.max(0, (m.index ?? 0) - 10), m.index)))
    .map((m) => Buffer.from(m[1], 'hex').toString('latin1'));
  return `${raw}\n${hexSegments.join('')}`;
}

describe('RapportsExportService (unit)', () => {
  const sampleReport: RapportsResponse = {
    period: '30j',
    periodLabel: '30 derniers jours',
    startDateIso: '2026-10-14',
    endDateIso: '2026-11-12',
    timezone: 'Africa/Dakar',
    generatedAt: '2026-11-12T12:00:00.000Z',
    hotelName: 'Résidence Blue',
    activeRoomsCount: 12,
    hasData: true,
    previousPeriodHasData: true,
    tiles: {
      revenue: { amountFcfa: 150000, deltaPercent: 12 },
      accommodation: { amountFcfa: 100000, sharePercent: 67 },
      restaurant: { amountFcfa: 50000, sharePercent: 33 },
      occupancy: {
        averagePercent: 50,
        occupiedRoomNights: 180,
        capacityRoomNights: 360,
        deltaPercent: 5,
      },
      collected: { amountFcfa: 120000, deltaPercent: 10 },
      remaining: { amountFcfa: 30000 },
    },
    revenueEvolution: {
      granularity: 'day',
      points: [
        { key: '2026-11-10', label: '10 nov.', amountFcfa: 60000 },
        { key: '2026-11-11', label: '11 nov.', amountFcfa: 90000 },
      ],
      topPoints: [
        { key: '2026-11-11', label: '11 nov.', amountFcfa: 90000, rank: 1 },
        { key: '2026-11-10', label: '10 nov.', amountFcfa: 60000, rank: 2 },
      ],
      lowestPoint: { key: '2026-11-10', label: '10 nov.', amountFcfa: 60000 },
      bestPoint: { key: '2026-11-11', label: '11 nov.', amountFcfa: 90000 },
    },
    salesByTypeByWeek: [
      {
        weekKey: '2026-11-09',
        label: '09 nov. - 15 nov.',
        accommodationFcfa: 100000,
        restaurantFcfa: 50000,
        otherFcfa: 0,
        totalFcfa: 150000,
      },
    ],
    paymentsByMethod: {
      totalFcfa: 120000,
      items: [
        { method: 'CASH', label: 'Espèces', amountFcfa: 70000, percent: 58 },
        { method: 'WAVE', label: 'Wave', amountFcfa: 50000, percent: 42 },
      ],
    },
    topDishes: [
      { name: 'Thiéboudienne', quantity: 5, amountFcfa: 50000 },
    ],
    dailyTable: {
      activeRoomsCount: 12,
      rows: [
        {
          dateIso: '2026-11-11',
          label: '11 nov. 2026',
          occupiedRooms: 6,
          activeRooms: 12,
          accommodationFcfa: 60000,
          restaurantFcfa: 30000,
          otherFcfa: 0,
          totalFcfa: 90000,
        },
        {
          dateIso: '2026-11-10',
          label: '10 nov. 2026',
          occupiedRooms: 4,
          activeRooms: 12,
          accommodationFcfa: 40000,
          restaurantFcfa: 20000,
          otherFcfa: 0,
          totalFcfa: 60000,
        },
      ],
      totals: {
        occupiedRoomNights: 10,
        capacityRoomNights: 24,
        accommodationFcfa: 100000,
        restaurantFcfa: 50000,
        otherFcfa: 0,
        totalFcfa: 150000,
      },
    },
  };

  it('génère un PDF A4 vectoriel commençant par %PDF- et finissant par %%EOF avec le texte attendu', async () => {
    const auditLogs: any[] = [];
    const mockService: any = {
      getReport: async () => sampleReport,
    };
    const mockPrisma: any = {
      auditLog: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          auditLogs.push(data);
          return data;
        },
      },
    };

    const exporter = new RapportsExportService(mockService, mockPrisma);
    const out = await exporter.generatePdf(
      '30j',
      true,
      { userId: 'u-1', actorRole: 'DIRECTION' },
      new Date('2026-11-12T10:00:00.000Z'),
    );

    expect(out.fileName).toBe('rapport-2026-11-12.pdf');
    expect(out.contentType).toBe('application/pdf');
    const raw = out.buffer.toString('latin1');
    const decoded = extractPdfReadableText(out.buffer);
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(decoded).toContain('Résidence Blue');
    expect(decoded).toContain('Page 1 /');
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('RAPPORT_EXPORT_PDF');
  });

  it('génère un classeur Excel valide avec les 4 feuilles, cellules numériques FCFA et formules SUM', async () => {
    const mockService: any = {
      getReport: async () => sampleReport,
    };
    const mockPrisma: any = {};

    const exporter = new RapportsExportService(mockService, mockPrisma);
    const out = await exporter.generateExcel(
      '30j',
      { actorRole: 'COMPTABLE' },
      new Date('2026-11-12T10:00:00.000Z'),
    );

    expect(out.fileName).toBe('rapport-2026-11-12.xlsx');

    const ExcelJSClass: any = (ExcelJS as any).default || ExcelJS;
    const wb = new ExcelJSClass.Workbook();
    await wb.xlsx.load(out.buffer);

    expect(wb.worksheets.map((w: any) => w.name)).toEqual([
      'Résumé',
      'Jour par jour',
      'Par type et paiement',
      'Restaurant',
    ]);

    const wsDaily = wb.getWorksheet('Jour par jour');
    expect(wsDaily.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    // Ligne 2, colonne D (Hébergement) = nombre 60000
    expect(typeof wsDaily.getCell('D2').value).toBe('number');
    expect(wsDaily.getCell('D2').value).toBe(60000);
    // Ligne Total (ligne 4), formule SUM
    const totalCellVal = wsDaily.getCell('D4').value as any;
    expect(totalCellVal.formula).toBe('SUM(D2:D3)');

    const wsResto = wb.getWorksheet('Restaurant');
    expect(wsResto.getCell('D2').value).toBe(50000);
    expect((wsResto.getCell('D3').value as any).formula).toBe('SUM(D2:D2)');
  });

  it('refuse tout export (400) si la période est vide', async () => {
    const emptyReport: RapportsResponse = {
      ...sampleReport,
      hasData: false,
      tiles: undefined,
    };
    const exporter = new RapportsExportService({ getReport: async () => emptyReport } as any, {} as any);

    await expect(exporter.generatePdf('30j', true, {})).rejects.toThrow('export PDF impossible');
    await expect(exporter.generateExcel('30j', {})).rejects.toThrow('export Excel impossible');
  });
});
