import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { CryptoService } from '../apps/api/src/common/security/crypto.service';
import { AuditService } from '../apps/api/src/common/audit/audit.service';

export interface ExcelImportOptions {
  clientsPath?: string;
  reservationsPath?: string;
  apply: boolean;
  prisma?: PrismaClient;
  cryptoService?: CryptoService;
  auditService?: AuditService;
  silent?: boolean;
}

export interface ImportIssue {
  sheet: 'clients' | 'reservations';
  row: number;
  message: string;
}

export interface ExcelImportReport {
  mode: 'dry-run' | 'apply';
  success: boolean;
  clientsRead: number;
  clientsToCreate: number;
  clientsCreated: number;
  clientsSkippedDuplicates: number;
  reservationsRead: number;
  reservationsToCreate: number;
  reservationsCreated: number;
  reservationsSkippedIdempotent: number;
  warnings: ImportIssue[];
  errors: ImportIssue[];
}

interface ParsedClientRow {
  row: number;
  lastName: string;
  firstName: string;
  phone: string;
  normalizedPhone: string;
  email: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  nationality: string;
}

interface ParsedReservationRow {
  row: number;
  clientPhone: string;
  normalizedClientPhone: string;
  roomNumber: string;
  checkInDate: Date;
  checkOutDate: Date;
  checkInIso: string;
  checkOutIso: string;
  nights: number;
  adultsCount: number;
  childrenCount: number;
}

export function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s().-]+/g, '').trim();
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) {
    const dd = String(value.getUTCDate()).padStart(2, '0');
    const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = value.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value && value.result !== undefined) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
  }
  return String(value).trim();
}

/**
 * Analyse une date au format français JJ/MM/AAAA (ou un objet Date Excel).
 * Retourne un objet Date UTC à minuit + sa chaîne ISO AAAA-MM-JJ, ou null si invalide.
 */
export function parseFrenchDate(
  raw: ExcelJS.CellValue,
): { date: Date; iso: string } | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    const m = raw.getUTCMonth() + 1;
    const d = raw.getUTCDate();
    const date = new Date(Date.UTC(y, m - 1, d));
    const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { date, iso };
  }

  const text = cellToString(raw);
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { date, iso };
}

function parsePositiveInt(raw: ExcelJS.CellValue, minValue: number, defaultValue?: number): number | null {
  const text = cellToString(raw);
  if (!text) {
    return defaultValue !== undefined ? defaultValue : null;
  }
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < minValue) return null;
  return n;
}

function buildColumnMap(headerRow: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const norm = normalizeHeader(cellToString(cell.value));
    if (norm) {
      map.set(norm, colNumber);
    }
  });
  return map;
}

function findColumn(colMap: Map<string, number>, aliases: string[]): number | undefined {
  for (const alias of aliases) {
    const idx = colMap.get(normalizeHeader(alias));
    if (idx !== undefined) return idx;
  }
  return undefined;
}

function isRowEmpty(row: ExcelJS.Row): boolean {
  let empty = true;
  row.eachCell((cell) => {
    if (cellToString(cell.value).length > 0) {
      empty = false;
    }
  });
  return empty;
}

async function readClientsSheet(
  filePath: string,
  errors: ImportIssue[],
): Promise<{ rows: ParsedClientRow[]; totalRead: number }> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    errors.push({ sheet: 'clients', row: 0, message: `Fichier clients introuvable : ${resolved}` });
    return { rows: [], totalRead: 0 };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolved);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    errors.push({ sheet: 'clients', row: 0, message: 'Aucune feuille trouvée dans le fichier clients.' });
    return { rows: [], totalRead: 0 };
  }

  const colMap = buildColumnMap(sheet.getRow(1));
  const colNom = findColumn(colMap, ['Nom']);
  const colPrenom = findColumn(colMap, ['Prénom', 'Prenom']);
  const colTel = findColumn(colMap, ['Téléphone', 'Telephone']);
  const colEmail = findColumn(colMap, ['Email', 'E-mail', 'Courriel']);
  const colTypePiece = findColumn(colMap, ['Type de pièce', 'Type de piece']);
  const colNumPiece = findColumn(colMap, ['Numéro de pièce', 'Numero de piece']);
  const colNat = findColumn(colMap, ['Nationalité', 'Nationalite']);

  const missingCols: string[] = [];
  if (!colNom) missingCols.push('Nom');
  if (!colPrenom) missingCols.push('Prénom');
  if (!colTel) missingCols.push('Téléphone');
  if (missingCols.length > 0) {
    errors.push({
      sheet: 'clients',
      row: 1,
      message: `Colonnes obligatoires manquantes : ${missingCols.join(', ')}.`,
    });
    return { rows: [], totalRead: 0 };
  }

  const rows: ParsedClientRow[] = [];
  let totalRead = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    if (isRowEmpty(excelRow)) continue;
    totalRead++;

    const lastName = cellToString(excelRow.getCell(colNom!).value);
    const firstName = cellToString(excelRow.getCell(colPrenom!).value);
    const phone = cellToString(excelRow.getCell(colTel!).value);
    const normalizedPhone = normalizePhone(phone);
    const emailRaw = colEmail ? cellToString(excelRow.getCell(colEmail).value) : '';
    const idDocumentType = colTypePiece ? cellToString(excelRow.getCell(colTypePiece).value) || null : null;
    const idDocumentNumber = colNumPiece ? cellToString(excelRow.getCell(colNumPiece).value) || null : null;
    const nationality = (colNat ? cellToString(excelRow.getCell(colNat).value) : '') || 'Sénégalaise';

    const rowErrors: string[] = [];
    if (!lastName) rowErrors.push('Nom manquant');
    if (!firstName) rowErrors.push('Prénom manquant');
    if (!normalizedPhone || normalizedPhone.length < 6) {
      rowErrors.push('Téléphone manquant ou invalide');
    }
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      rowErrors.push(`Email invalide (${emailRaw})`);
    }

    if (rowErrors.length > 0) {
      errors.push({ sheet: 'clients', row: r, message: rowErrors.join(' ; ') });
      continue;
    }

    rows.push({
      row: r,
      lastName,
      firstName,
      phone,
      normalizedPhone,
      email: emailRaw || null,
      idDocumentType,
      idDocumentNumber,
      nationality,
    });
  }

  return { rows, totalRead };
}

async function readReservationsSheet(
  filePath: string,
  errors: ImportIssue[],
): Promise<{ rows: ParsedReservationRow[]; totalRead: number }> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    errors.push({
      sheet: 'reservations',
      row: 0,
      message: `Fichier réservations introuvable : ${resolved}`,
    });
    return { rows: [], totalRead: 0 };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolved);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    errors.push({
      sheet: 'reservations',
      row: 0,
      message: 'Aucune feuille trouvée dans le fichier réservations.',
    });
    return { rows: [], totalRead: 0 };
  }

  const colMap = buildColumnMap(sheet.getRow(1));
  const colTel = findColumn(colMap, ['Téléphone client', 'Telephone client']);
  const colRoom = findColumn(colMap, ['Numéro de chambre', 'Numero de chambre']);
  const colCheckIn = findColumn(colMap, ["Date d'arrivée", "Date d'arrivee", 'Date arrivee']);
  const colCheckOut = findColumn(colMap, ['Date de départ', 'Date de depart']);
  const colAdults = findColumn(colMap, ['Adultes']);
  const colChildren = findColumn(colMap, ['Enfants']);

  const missingCols: string[] = [];
  if (!colTel) missingCols.push('Téléphone client');
  if (!colRoom) missingCols.push('Numéro de chambre');
  if (!colCheckIn) missingCols.push("Date d'arrivée");
  if (!colCheckOut) missingCols.push('Date de départ');
  if (!colAdults) missingCols.push('Adultes');
  if (missingCols.length > 0) {
    errors.push({
      sheet: 'reservations',
      row: 1,
      message: `Colonnes obligatoires manquantes : ${missingCols.join(', ')}.`,
    });
    return { rows: [], totalRead: 0 };
  }

  const rows: ParsedReservationRow[] = [];
  let totalRead = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    if (isRowEmpty(excelRow)) continue;
    totalRead++;

    const clientPhone = cellToString(excelRow.getCell(colTel!).value);
    const normalizedClientPhone = normalizePhone(clientPhone);
    const roomNumber = cellToString(excelRow.getCell(colRoom!).value);
    const parsedIn = parseFrenchDate(excelRow.getCell(colCheckIn!).value);
    const parsedOut = parseFrenchDate(excelRow.getCell(colCheckOut!).value);
    const adultsCount = parsePositiveInt(excelRow.getCell(colAdults!).value, 1);
    const childrenCount = colChildren
      ? parsePositiveInt(excelRow.getCell(colChildren).value, 0, 0)
      : 0;

    const rowErrors: string[] = [];
    if (!normalizedClientPhone || normalizedClientPhone.length < 6) {
      rowErrors.push('Téléphone client manquant ou invalide');
    }
    if (!roomNumber) rowErrors.push('Numéro de chambre manquant');
    if (!parsedIn) rowErrors.push("Date d'arrivée invalide (attendu JJ/MM/AAAA)");
    if (!parsedOut) rowErrors.push('Date de départ invalide (attendu JJ/MM/AAAA)');
    if (parsedIn && parsedOut && parsedOut.date <= parsedIn.date) {
      rowErrors.push("La date de départ doit être postérieure à la date d'arrivée");
    }
    if (adultsCount === null) rowErrors.push('Nombre d’adultes invalide (entier >= 1)');
    if (childrenCount === null) rowErrors.push('Nombre d’enfants invalide (entier >= 0)');

    if (rowErrors.length > 0) {
      errors.push({ sheet: 'reservations', row: r, message: rowErrors.join(' ; ') });
      continue;
    }

    const nights = Math.round(
      (parsedOut!.date.getTime() - parsedIn!.date.getTime()) / (24 * 60 * 60 * 1000),
    );

    rows.push({
      row: r,
      clientPhone,
      normalizedClientPhone,
      roomNumber,
      checkInDate: parsedIn!.date,
      checkOutDate: parsedOut!.date,
      checkInIso: parsedIn!.iso,
      checkOutIso: parsedOut!.iso,
      nights,
      adultsCount: adultsCount!,
      childrenCount: childrenCount!,
    });
  }

  return { rows, totalRead };
}

function isOverlapConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('reservations_no_overlap_active') ||
    msg.includes('23P01') ||
    msg.toLowerCase().includes('exclusion constraint') ||
    msg.toLowerCase().includes('chevauch')
  );
}

class ImportRollbackError extends Error {
  constructor(
    public readonly issue: ImportIssue,
  ) {
    super(issue.message);
    this.name = 'ImportRollbackError';
  }
}

export async function runExcelImport(options: ExcelImportOptions): Promise<ExcelImportReport> {
  const mode: 'dry-run' | 'apply' = options.apply ? 'apply' : 'dry-run';
  const warnings: ImportIssue[] = [];
  const errors: ImportIssue[] = [];

  if (!options.clientsPath && !options.reservationsPath) {
    errors.push({
      sheet: 'clients',
      row: 0,
      message: 'Veuillez fournir au moins --clients=<fichier.xlsx> ou --reservations=<fichier.xlsx>.',
    });
  }

  const ownsPrisma = !options.prisma;
  const prisma = options.prisma ?? new PrismaClient();
  const cryptoService = options.cryptoService ?? new CryptoService();
  const auditService = options.auditService ?? new AuditService(prisma as any);

  const report: ExcelImportReport = {
    mode,
    success: false,
    clientsRead: 0,
    clientsToCreate: 0,
    clientsCreated: 0,
    clientsSkippedDuplicates: 0,
    reservationsRead: 0,
    reservationsToCreate: 0,
    reservationsCreated: 0,
    reservationsSkippedIdempotent: 0,
    warnings,
    errors,
  };

  try {
    let parsedClients: ParsedClientRow[] = [];
    let parsedReservations: ParsedReservationRow[] = [];

    if (options.clientsPath) {
      const res = await readClientsSheet(options.clientsPath, errors);
      parsedClients = res.rows;
      report.clientsRead = res.totalRead;
    }

    if (options.reservationsPath) {
      const res = await readReservationsSheet(options.reservationsPath, errors);
      parsedReservations = res.rows;
      report.reservationsRead = res.totalRead;
    }

    // Charger l'état existant (clients par téléphone normalisé, chambres par numéro, réservations actives)
    const [existingGuests, existingRooms, existingReservations] = await Promise.all([
      prisma.guest.findMany({ select: { id: true, phone: true, fullName: true } }),
      prisma.room.findMany({ select: { id: true, number: true, pricePerNight: true, isActive: true } }),
      prisma.reservation.findMany({
        where: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        select: { id: true, guestId: true, roomId: true, checkInDate: true, checkOutDate: true, reference: true },
      }),
    ]);

    const guestByPhone = new Map<string, { id: string; fullName: string }>();
    for (const g of existingGuests) {
      const key = normalizePhone(g.phone);
      if (key && !guestByPhone.has(key)) {
        guestByPhone.set(key, { id: g.id, fullName: g.fullName });
      }
    }

    const roomByNumber = new Map<string, { id: string; number: string; pricePerNight: number }>();
    for (const rm of existingRooms) {
      if (rm.isActive) {
        roomByNumber.set(rm.number.trim().toLowerCase(), rm);
      }
    }

    // Détection des doublons de clients (base + fichier)
    const clientsToInsert: ParsedClientRow[] = [];
    const plannedPhones = new Set<string>();

    for (const client of parsedClients) {
      if (guestByPhone.has(client.normalizedPhone)) {
        report.clientsSkippedDuplicates++;
        warnings.push({
          sheet: 'clients',
          row: client.row,
          message: `Doublon de téléphone (${client.phone}) déjà présent en base : client ignoré.`,
        });
        continue;
      }
      if (plannedPhones.has(client.normalizedPhone)) {
        report.clientsSkippedDuplicates++;
        warnings.push({
          sheet: 'clients',
          row: client.row,
          message: `Doublon de téléphone (${client.phone}) dans le fichier Excel : ligne ignorée.`,
        });
        continue;
      }
      plannedPhones.add(client.normalizedPhone);
      clientsToInsert.push(client);
    }
    report.clientsToCreate = clientsToInsert.length;

    // Validation des réservations (client connu ou prévu, chambre existante, idempotence, chevauchement en dry-run)
    const reservationsToInsert: Array<ParsedReservationRow & { roomId: string; pricePerNight: number }> = [];
    const activeIntervalsByRoom = new Map<
      string,
      Array<{ checkInIso: string; checkOutIso: string; label: string }>
    >();

    for (const ex of existingReservations) {
      const list = activeIntervalsByRoom.get(ex.roomId) ?? [];
      list.push({
        checkInIso: ex.checkInDate.toISOString().slice(0, 10),
        checkOutIso: ex.checkOutDate.toISOString().slice(0, 10),
        label: ex.reference,
      });
      activeIntervalsByRoom.set(ex.roomId, list);
    }

    for (const resRow of parsedReservations) {
      const existingGuest = guestByPhone.get(resRow.normalizedClientPhone);
      const willExistInBatch = plannedPhones.has(resRow.normalizedClientPhone);
      if (!existingGuest && !willExistInBatch) {
        errors.push({
          sheet: 'reservations',
          row: resRow.row,
          message: `Client introuvable pour le téléphone ${resRow.clientPhone}.`,
        });
        continue;
      }

      const room = roomByNumber.get(resRow.roomNumber.trim().toLowerCase());
      if (!room) {
        errors.push({
          sheet: 'reservations',
          row: resRow.row,
          message: `Chambre introuvable ou inactive : ${resRow.roomNumber}.`,
        });
        continue;
      }

      // Idempotence : réservation exactement identique déjà en base (même client, chambre et dates)
      if (existingGuest) {
        const alreadyExists = existingReservations.some(
          (ex) =>
            ex.guestId === existingGuest.id &&
            ex.roomId === room.id &&
            ex.checkInDate.toISOString().slice(0, 10) === resRow.checkInIso &&
            ex.checkOutDate.toISOString().slice(0, 10) === resRow.checkOutIso,
        );
        if (alreadyExists) {
          report.reservationsSkippedIdempotent++;
          warnings.push({
            sheet: 'reservations',
            row: resRow.row,
            message: `Réservation déjà présente en base (chambre ${room.number}, ${resRow.checkInIso} → ${resRow.checkOutIso}) : ignorée (idempotent).`,
          });
          continue;
        }
      }

      // En mode --dry-run, on signale aussi les chevauchements prévisibles sans écrire en base.
      // En mode --apply, on laisse PostgreSQL (contrainte reservations_no_overlap_active) arbitrer.
      if (mode === 'dry-run') {
        const intervals = activeIntervalsByRoom.get(room.id) ?? [];
        const conflict = intervals.find(
          (iv) => resRow.checkInIso < iv.checkOutIso && iv.checkInIso < resRow.checkOutIso,
        );
        if (conflict) {
          errors.push({
            sheet: 'reservations',
            row: resRow.row,
            message: `Chevauchement détecté sur la chambre ${room.number} (${resRow.checkInIso} → ${resRow.checkOutIso}) avec ${conflict.label}.`,
          });
          continue;
        }
        intervals.push({
          checkInIso: resRow.checkInIso,
          checkOutIso: resRow.checkOutIso,
          label: `ligne ${resRow.row}`,
        });
        activeIntervalsByRoom.set(room.id, intervals);
      }

      reservationsToInsert.push({
        ...resRow,
        roomId: room.id,
        pricePerNight: room.pricePerNight,
      });
    }
    report.reservationsToCreate = reservationsToInsert.length;

    if (mode === 'dry-run') {
      report.success = errors.length === 0;
      if (!options.silent) printReport(report);
      return report;
    }

    // Mode --apply : si des erreurs de validation existent déjà, on n'écrit rien
    if (errors.length > 0) {
      report.success = false;
      if (!options.silent) printReport(report);
      return report;
    }

    // Import transactionnel atomique (tout ou rien)
    try {
      await prisma.$transaction(async (tx) => {
        const createdGuestByPhone = new Map<string, string>();
        for (const [phoneKey, g] of guestByPhone.entries()) {
          createdGuestByPhone.set(phoneKey, g.id);
        }

        for (const client of clientsToInsert) {
          const fullName = `${client.firstName} ${client.lastName}`.trim();
          const encryptedDoc = client.idDocumentNumber
            ? cryptoService.encrypt(client.idDocumentNumber)
            : null;

          const created = await tx.guest.create({
            data: {
              id: crypto.randomUUID(),
              firstName: client.firstName,
              lastName: client.lastName,
              fullName,
              phone: client.phone,
              email: client.email,
              nationality: client.nationality,
              idDocumentType: client.idDocumentType,
              idDocumentEncrypted: encryptedDoc,
            },
          });

          createdGuestByPhone.set(client.normalizedPhone, created.id);
          report.clientsCreated++;

          await auditService.log(
            {
              action: 'EXCEL_IMPORT_GUEST',
              entity: 'Guest',
              entityId: created.id,
              after: {
                fullName: created.fullName,
                phone: created.phone,
                nationality: created.nationality,
                hasIdDocument: Boolean(encryptedDoc),
                source: 'EXCEL_IMPORT',
              },
            },
            tx,
          );
        }

        for (const resRow of reservationsToInsert) {
          const guestId = createdGuestByPhone.get(resRow.normalizedClientPhone);
          if (!guestId) {
            throw new ImportRollbackError({
              sheet: 'reservations',
              row: resRow.row,
              message: `Client introuvable lors de l'écriture pour ${resRow.clientPhone}.`,
            });
          }

          const refSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
          const reference = `IMP-${resRow.checkInDate.getUTCFullYear()}-${refSuffix}`;
          const totalFcfa = Math.max(0, Math.round(resRow.pricePerNight * resRow.nights));

          try {
            const created = await tx.reservation.create({
              data: {
                id: crypto.randomUUID(),
                reference,
                guestId,
                roomId: resRow.roomId,
                checkInDate: resRow.checkInDate,
                checkOutDate: resRow.checkOutDate,
                adultsCount: resRow.adultsCount,
                childrenCount: resRow.childrenCount,
                nights: resRow.nights,
                status: 'CONFIRMED',
                source: 'EXCEL_IMPORT',
                totalFcfa,
              },
            });

            report.reservationsCreated++;

            await auditService.log(
              {
                action: 'EXCEL_IMPORT_RESERVATION',
                entity: 'Reservation',
                entityId: created.id,
                after: {
                  reference: created.reference,
                  roomNumber: resRow.roomNumber,
                  checkInDate: resRow.checkInIso,
                  checkOutDate: resRow.checkOutIso,
                  nights: created.nights,
                  totalFcfa: created.totalFcfa,
                  source: 'EXCEL_IMPORT',
                },
              },
              tx,
            );
          } catch (err) {
            if (isOverlapConstraintError(err)) {
              throw new ImportRollbackError({
                sheet: 'reservations',
                row: resRow.row,
                message: `Chevauchement refusé par la base de données (reservations_no_overlap_active) sur la chambre ${resRow.roomNumber} (${resRow.checkInIso} → ${resRow.checkOutIso}).`,
              });
            }
            const msg = err instanceof Error ? err.message : String(err);
            throw new ImportRollbackError({
              sheet: 'reservations',
              row: resRow.row,
              message: `Erreur lors de la création de la réservation : ${msg}`,
            });
          }
        }
      });

      report.success = true;
    } catch (err) {
      report.clientsCreated = 0;
      report.reservationsCreated = 0;
      report.success = false;
      if (err instanceof ImportRollbackError) {
        errors.push(err.issue);
      } else {
        errors.push({
          sheet: 'reservations',
          row: 0,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!options.silent) printReport(report);
    return report;
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}

export function printReport(report: ExcelImportReport): void {
  console.log('================================================================');
  console.log(`IMPORT EXCEL RÉSIDENCE BLUE — MODE : ${report.mode.toUpperCase()}`);
  console.log('================================================================');
  console.log(
    `Clients       : ${report.clientsRead} lu(s), ${
      report.mode === 'apply' ? `${report.clientsCreated} créé(s)` : `${report.clientsToCreate} à créer`
    }, ${report.clientsSkippedDuplicates} doublon(s) ignoré(s)`,
  );
  console.log(
    `Réservations  : ${report.reservationsRead} lue(s), ${
      report.mode === 'apply'
        ? `${report.reservationsCreated} créée(s)`
        : `${report.reservationsToCreate} à créer`
    }, ${report.reservationsSkippedIdempotent} déjà présente(s) ignorée(s)`,
  );

  if (report.warnings.length > 0) {
    console.log(`\nAvertissements (${report.warnings.length}) :`);
    for (const w of report.warnings) {
      console.log(`  - [${w.sheet} ligne ${w.row}] ${w.message}`);
    }
  }

  if (report.errors.length > 0) {
    console.error(`\nErreurs bloquantes (${report.errors.length}) :`);
    for (const e of report.errors) {
      console.error(`  - [${e.sheet} ligne ${e.row}] ${e.message}`);
    }
    if (report.mode === 'apply') {
      console.error('\nTransaction annulée (rollback) : aucune donnée n’a été écrite en base.');
    }
  } else {
    console.log(
      report.mode === 'apply'
        ? '\nOK — Importation terminée et journalisée avec succès.'
        : '\nOK — Validation réussie en mode dry-run (aucune écriture en base).',
    );
  }
}

function parseCliArgs(argv: string[]): ExcelImportOptions {
  let clientsPath: string | undefined;
  let reservationsPath: string | undefined;
  let apply = false;

  for (const arg of argv) {
    if (arg.startsWith('--clients=')) {
      clientsPath = arg.slice('--clients='.length).trim();
    } else if (arg.startsWith('--reservations=')) {
      reservationsPath = arg.slice('--reservations='.length).trim();
    } else if (arg === '--apply') {
      apply = true;
    } else if (arg === '--dry-run') {
      apply = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node --env-file=.env ./node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.json scripts/importer-excel.ts [--clients=chemin.xlsx] [--reservations=chemin.xlsx] [--dry-run|--apply]',
      );
      process.exit(0);
    } else {
      console.error(`Argument inconnu : ${arg}`);
      process.exit(1);
    }
  }

  return { clientsPath, reservationsPath, apply };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const report = await runExcelImport(options);
  process.exit(report.success ? 0 : 1);
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('importer-excel.ts') || process.argv[1].endsWith('importer-excel'))
) {
  main();
}
