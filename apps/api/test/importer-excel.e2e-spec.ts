import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { CryptoService } from '../src/common/security/crypto.service';
import { AuditService } from '../src/common/audit/audit.service';
import { runExcelImport } from '../../../scripts/importer-excel';

describe('Script scripts/importer-excel.ts (base de test residence_blue_e2e)', () => {
  const prisma = new PrismaClient();
  const cryptoService = new CryptoService();
  const auditService = new AuditService(prisma as any);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-excel-import-'));
  const suffix = crypto.randomUUID().slice(0, 6);
  const testRoomNumber = `IMP${suffix.slice(0, 4).toUpperCase()}`;
  const validPhone = `+22177${Math.floor(1000000 + Math.random() * 8999999)}`;
  const overlapPhone = `+22176${Math.floor(1000000 + Math.random() * 8999999)}`;
  const validIdNumber = `CNI-EXCEL-${suffix}`;

  let roomTypeId: string;
  let roomId: string;
  let existingGuestId: string;

  async function writeWorkbook(
    fileName: string,
    headers: string[],
    rows: Array<Array<string | number>>,
  ): Promise<string> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Feuille1');
    ws.addRow(headers);
    for (const r of rows) {
      ws.addRow(r);
    }
    const fullPath = path.join(tmpDir, fileName);
    await wb.xlsx.writeFile(fullPath);
    return fullPath;
  }

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || new URL(dbUrl).pathname !== '/residence_blue_e2e') {
      throw new Error('Ce test exige exclusivement la base residence_blue_e2e.');
    }

    const rt = await prisma.roomType.create({
      data: {
        id: crypto.randomUUID(),
        name: `TypeImportExcel-${suffix}`,
        pricePerNight: 45000,
      },
    });
    roomTypeId = rt.id;

    const rm = await prisma.room.create({
      data: {
        id: crypto.randomUUID(),
        number: testRoomNumber,
        typeId: roomTypeId,
        floor: 1,
        category: 'Standard',
        pricePerNight: 45000,
        isActive: true,
      },
    });
    roomId = rm.id;

    const existingGuest = await prisma.guest.create({
      data: {
        id: crypto.randomUUID(),
        firstName: 'Existant',
        lastName: `Client-${suffix}`,
        fullName: `Existant Client-${suffix}`,
        phone: `+22170${Math.floor(1000000 + Math.random() * 8999999)}`,
      },
    });
    existingGuestId = existingGuest.id;

    // Réservation existante du 10/12/2027 au 14/12/2027 pour tester le chevauchement
    await prisma.reservation.create({
      data: {
        id: crypto.randomUUID(),
        reference: `EX-${suffix}`,
        guestId: existingGuestId,
        roomId,
        checkInDate: new Date(Date.UTC(2027, 11, 10)),
        checkOutDate: new Date(Date.UTC(2027, 11, 14)),
        adultsCount: 1,
        childrenCount: 0,
        nights: 4,
        status: 'CONFIRMED',
        source: 'RECEPTION',
        totalFcfa: 180000,
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { roomId } });
    await prisma.guest.deleteMany({
      where: {
        OR: [{ id: existingGuestId }, { phone: validPhone }, { phone: overlapPhone }],
      },
    });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await prisma.$disconnect();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('en --dry-run liste erreurs (date invalide, chevauchement), avertissements (doublon) et succès sans rien écrire en base', async () => {
    const clientsFile = await writeWorkbook(
      'clients-mixed.xlsx',
      ['Nom', 'Prénom', 'Téléphone', 'Email', 'Type de pièce', 'Numéro de pièce', 'Nationalité'],
      [
        ['Ndiaye', 'Aminata', validPhone, 'aminata@exemple.sn', 'CNI', validIdNumber, 'Sénégalaise'],
        ['Ndiaye', 'Doublon', validPhone, '', 'CNI', 'DOUBLON-001', 'Sénégalaise'],
      ],
    );

    const reservationsFile = await writeWorkbook(
      'reservations-mixed.xlsx',
      ['Téléphone client', 'Numéro de chambre', "Date d'arrivée", 'Date de départ', 'Adultes', 'Enfants'],
      [
        [validPhone, testRoomNumber, '20/12/2027', '22/12/2027', 2, 0], // valide
        [validPhone, testRoomNumber, '12/12/2027', '15/12/2027', 1, 0], // chevauche 10-14/12/2027
        [validPhone, testRoomNumber, '31/02/2027', '02/03/2027', 1, 0], // date invalide
      ],
    );

    const report = await runExcelImport({
      clientsPath: clientsFile,
      reservationsPath: reservationsFile,
      apply: false,
      prisma,
      cryptoService,
      auditService,
      silent: true,
    });

    expect(report.mode).toBe('dry-run');
    expect(report.success).toBe(false);
    expect(report.clientsRead).toBe(2);
    expect(report.clientsToCreate).toBe(1);
    expect(report.clientsSkippedDuplicates).toBe(1);
    expect(report.reservationsRead).toBe(3);
    expect(report.reservationsToCreate).toBe(1);
    expect(report.warnings.some((w) => w.message.toLowerCase().includes('doublon'))).toBe(true);
    expect(report.errors.some((e) => e.message.toLowerCase().includes('chevauchement'))).toBe(true);
    expect(report.errors.some((e) => e.message.toLowerCase().includes("date d'arrivée invalide"))).toBe(true);

    // Rien n'a été écrit en base
    const guestInDb = await prisma.guest.findFirst({ where: { phone: validPhone } });
    expect(guestInDb).toBeNull();
  });

  it('en --apply échoue proprement avec rollback total s’il y a une erreur bloquante', async () => {
    const clientsFile = await writeWorkbook(
      'clients-rollback.xlsx',
      ['Nom', 'Prénom', 'Téléphone', 'Email', 'Type de pièce', 'Numéro de pièce', 'Nationalité'],
      [['Ndiaye', 'Aminata', validPhone, 'aminata@exemple.sn', 'CNI', validIdNumber, 'Sénégalaise']],
    );

    const reservationsFile = await writeWorkbook(
      'reservations-rollback.xlsx',
      ['Téléphone client', 'Numéro de chambre', "Date d'arrivée", 'Date de départ', 'Adultes', 'Enfants'],
      [[validPhone, testRoomNumber, '31/02/2027', '02/03/2027', 1, 0]],
    );

    const report = await runExcelImport({
      clientsPath: clientsFile,
      reservationsPath: reservationsFile,
      apply: true,
      prisma,
      cryptoService,
      auditService,
      silent: true,
    });

    expect(report.success).toBe(false);
    expect(report.clientsCreated).toBe(0);
    expect(report.reservationsCreated).toBe(0);
    const guestInDb = await prisma.guest.findFirst({ where: { phone: validPhone } });
    expect(guestInDb).toBeNull();
  });

  it('en --apply crée les données valides (pièce chiffrée + audit) et reste idempotent au rejeu', async () => {
    const clientsFile = await writeWorkbook(
      'clients-valid.xlsx',
      ['Nom', 'Prénom', 'Téléphone', 'Email', 'Type de pièce', 'Numéro de pièce', 'Nationalité'],
      [
        ['Ndiaye', 'Aminata', validPhone, 'aminata@exemple.sn', 'CNI', validIdNumber, 'Sénégalaise'],
        ['Ndiaye', 'DoublonFichier', validPhone, '', 'CNI', 'AUTRE-001', 'Sénégalaise'],
      ],
    );

    const reservationsFile = await writeWorkbook(
      'reservations-valid.xlsx',
      ['Téléphone client', 'Numéro de chambre', "Date d'arrivée", 'Date de départ', 'Adultes', 'Enfants'],
      [[validPhone, testRoomNumber, '20/12/2027', '22/12/2027', 2, 1]],
    );

    // 1er import --apply
    const first = await runExcelImport({
      clientsPath: clientsFile,
      reservationsPath: reservationsFile,
      apply: true,
      prisma,
      cryptoService,
      auditService,
      silent: true,
    });

    expect(first.success).toBe(true);
    expect(first.clientsCreated).toBe(1);
    expect(first.clientsSkippedDuplicates).toBe(1);
    expect(first.reservationsCreated).toBe(1);

    const guests = await prisma.guest.findMany({ where: { phone: validPhone } });
    expect(guests).toHaveLength(1);
    expect(guests[0].idDocumentEncrypted).toBeTruthy();
    expect(guests[0].idDocumentEncrypted).not.toBe(validIdNumber);
    expect(cryptoService.decrypt(guests[0].idDocumentEncrypted!)).toBe(validIdNumber);

    const reservations = await prisma.reservation.findMany({
      where: { guestId: guests[0].id, roomId },
    });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].nights).toBe(2);
    expect(reservations[0].totalFcfa).toBe(90000);

    // Vérifier les entrées AuditLog (sans numéro de pièce en clair)
    const auditEntries = await prisma.auditLog.findMany({
      where: { entityId: { in: [guests[0].id, reservations[0].id] } },
    });
    expect(auditEntries.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(auditEntries)).not.toContain(validIdNumber);

    // 2e import identique en --apply : idempotence (aucun doublon)
    const second = await runExcelImport({
      clientsPath: clientsFile,
      reservationsPath: reservationsFile,
      apply: true,
      prisma,
      cryptoService,
      auditService,
      silent: true,
    });

    expect(second.success).toBe(true);
    expect(second.clientsCreated).toBe(0);
    expect(second.reservationsCreated).toBe(0);
    expect(second.clientsSkippedDuplicates).toBe(2);
    expect(second.reservationsSkippedIdempotent).toBe(1);

    expect(await prisma.guest.count({ where: { phone: validPhone } })).toBe(1);
    expect(await prisma.reservation.count({ where: { guestId: guests[0].id, roomId } })).toBe(1);
  });

  it('laisse PostgreSQL refuser un chevauchement en --apply et annule toute la transaction', async () => {
    const clientsFile = await writeWorkbook(
      'clients-overlap.xlsx',
      ['Nom', 'Prénom', 'Téléphone', 'Email', 'Type de pièce', 'Numéro de pièce', 'Nationalité'],
      [['Diop', 'Chevauchement', overlapPhone, '', 'Passeport', 'PASS-OV-01', 'Sénégalaise']],
    );

    const reservationsFile = await writeWorkbook(
      'reservations-overlap.xlsx',
      ['Téléphone client', 'Numéro de chambre', "Date d'arrivée", 'Date de départ', 'Adultes', 'Enfants'],
      [[overlapPhone, testRoomNumber, '11/12/2027', '13/12/2027', 1, 0]], // chevauche existingReservation (10-14/12/2027)
    );

    const report = await runExcelImport({
      clientsPath: clientsFile,
      reservationsPath: reservationsFile,
      apply: true,
      prisma,
      cryptoService,
      auditService,
      silent: true,
    });

    expect(report.success).toBe(false);
    expect(report.clientsCreated).toBe(0);
    expect(report.reservationsCreated).toBe(0);
    expect(
      report.errors.some((e) => e.message.includes('reservations_no_overlap_active')),
    ).toBe(true);

    // Rollback vérifié : même le client créé avant l'erreur n'existe pas en base
    const rolledBackGuest = await prisma.guest.findFirst({ where: { phone: overlapPhone } });
    expect(rolledBackGuest).toBeNull();
  });
});
