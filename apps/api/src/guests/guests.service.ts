import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/security/crypto.service';
import {
  CheckDuplicateQueryDto,
  CreateGuestDto,
  ListGuestsQueryDto,
  ListGuestStaysQueryDto,
  SearchGuestsQueryDto,
  UpdateGuestDto,
} from './dto/guest.dto';

export type GuestStayState = 'IN_STAY' | 'UPCOMING' | 'NONE';

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  private decryptDocument(encrypted: string | null | undefined): string {
    if (!encrypted) return '';
    try {
      return this.cryptoService.decrypt(encrypted);
    } catch {
      return '';
    }
  }

  private maskDocument(encrypted: string | null | undefined): string {
    const plain = this.decryptDocument(encrypted);
    if (!plain) return '';
    if (plain.length <= 4) return '****';
    return `****${plain.slice(-4)}`;
  }

  private normalizePhoneDigits(phone: string | null | undefined): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '').replace(/^221/, '');
  }

  private splitFullName(fullName: string): { firstName: string; lastName: string; fullName: string } {
    const cleaned = fullName.trim().replace(/\s+/g, ' ');
    const parts = cleaned.split(' ');
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: parts[0], fullName: cleaned };
    }
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return { firstName, lastName, fullName: cleaned };
  }

  private computeState(reservations: Array<{ status: string; checkInDate: Date }>): GuestStayState {
    if (reservations.some((r) => r.status === 'CHECKED_IN')) {
      return 'IN_STAY';
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (
      reservations.some(
        (r) => r.status === 'CONFIRMED' && new Date(r.checkInDate) >= todayStart,
      )
    ) {
      return 'UPCOMING';
    }
    return 'NONE';
  }

  private formatDirectoryItem(guest: any) {
    const reservations = guest.reservations || [];
    const state = this.computeState(reservations);
    return {
      id: guest.id,
      civility: guest.civility || 'M.',
      firstName: guest.firstName,
      lastName: guest.lastName,
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email || '',
      birthDate: guest.birthDate || '',
      nationality: guest.nationality || 'Sénégalaise',
      address: guest.address || guest.residenceCity || '',
      idDocumentType: guest.idDocumentType || 'CNI',
      idDocumentMasked: this.maskDocument(guest.idDocumentEncrypted),
      hasIdDocument: Boolean(guest.idDocumentEncrypted),
      internalNote: guest.internalNote || '',
      state,
      version: guest.version ?? 1,
      updatedAt: guest.updatedAt ? new Date(guest.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  private formatStay(r: any) {
    return {
      id: r.id,
      reference: r.reference,
      checkInDate: new Date(r.checkInDate).toISOString().slice(0, 10),
      checkOutDate: new Date(r.checkOutDate).toISOString().slice(0, 10),
      nights: r.nights,
      roomNumber: r.room?.number || '',
      roomCategory: r.room?.category || 'Standard',
      totalFcfa: r.totalFcfa,
      status: r.status,
    };
  }

  private async logAudit(
    actorRole: string,
    action: string,
    targetId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entity: 'GUEST',
          entityId: targetId,
          after: { actorRole: actorRole || 'RECEPTION', ...(details ?? {}) } as any,
        },
      });
    } catch {
      // Ne jamais bloquer une opération métier si le journal échoue,
      // tout en garantissant l'absence de données sensibles dans le payload.
    }
  }

  async searchQuick(query: SearchGuestsQueryDto = {}) {
    const q = (query.q || '').trim();
    const limit = Math.min(Math.max(query.limit ?? 5, 1), 5);
    const where: any = { isActive: true };
    if (q.length > 0) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }
    const items = await this.prisma.guest.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return { items };
  }

  async findAll(query: ListGuestsQueryDto = {}) {
    const limit = Math.min(Math.max(query.limit ?? 40, 1), 100);
    const search = (query.search || '').trim();
    const filter = query.filter || 'ALL';
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const where: any = { isActive: true };

    if (filter === 'IN_STAY') {
      where.reservations = { some: { status: 'CHECKED_IN' } };
    } else if (filter === 'UPCOMING') {
      where.reservations = {
        some: { status: 'CONFIRMED', checkInDate: { gte: todayStart } },
      };
    }

    // Recherche texte + support du numéro de pièce chiffré
    let matchedDocIds: string[] = [];
    if (search.length > 0) {
      if (search.length >= 2) {
        const candidates = await this.prisma.guest.findMany({
          where: { isActive: true, idDocumentEncrypted: { not: null } },
          select: { id: true, idDocumentEncrypted: true },
        });
        const qLower = search.toLowerCase();
        matchedDocIds = candidates
          .filter((c) => this.decryptDocument(c.idDocumentEncrypted).toLowerCase().includes(qLower))
          .map((c) => c.id);
      }

      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        ...(matchedDocIds.length > 0 ? [{ id: { in: matchedDocIds } }] : []),
      ];
    }

    const findArgs: any = {
      where,
      include: {
        reservations: {
          select: { status: true, checkInDate: true },
        },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    };

    if (query.cursor) {
      findArgs.cursor = { id: query.cursor };
      findArgs.skip = 1;
    }

    const [rows, total, inStayCount, expectedTodayCount, newThisMonthCount] =
      await Promise.all([
        this.prisma.guest.findMany(findArgs),
        this.prisma.guest.count({ where }),
        this.prisma.guest.count({
          where: { isActive: true, reservations: { some: { status: 'CHECKED_IN' } } },
        }),
        this.prisma.reservation.count({
          where: {
            status: 'CONFIRMED',
            checkInDate: { gte: todayStart, lte: todayEnd },
          },
        }),
        this.prisma.guest.count({
          where: { isActive: true, createdAt: { gte: monthStart } },
        }),
      ]);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;

    return {
      items: slice.map((g) => this.formatDirectoryItem(g)),
      nextCursor,
      total,
      stats: {
        inStayCount,
        expectedTodayCount,
        newThisMonthCount,
      },
    };
  }

  async checkDuplicate(query: CheckDuplicateQueryDto) {
    const phoneDigits = this.normalizePhoneDigits(query.phone);
    const docNum = (query.idDocumentNumber || '').trim().toLowerCase();

    if (!phoneDigits && !docNum) {
      return { duplicate: null };
    }

    const candidates = await this.prisma.guest.findMany({
      where: {
        isActive: true,
        ...(query.excludeId ? { id: { not: query.excludeId } } : {}),
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        idDocumentEncrypted: true,
      },
    });

    for (const c of candidates) {
      if (phoneDigits && phoneDigits.length >= 6 && this.normalizePhoneDigits(c.phone) === phoneDigits) {
        return { duplicate: { id: c.id, fullName: c.fullName, phone: c.phone } };
      }
      if (docNum && docNum.length >= 3) {
        const plain = this.decryptDocument(c.idDocumentEncrypted).trim().toLowerCase();
        if (plain && plain === docNum) {
          return { duplicate: { id: c.id, fullName: c.fullName, phone: c.phone } };
        }
      }
    }

    return { duplicate: null };
  }

  async findOne(id: string) {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
      include: {
        reservations: {
          include: { room: { select: { number: true, category: true } } },
          orderBy: [{ checkInDate: 'desc' }, { id: 'desc' }],
          take: 11,
        },
        _count: { select: { reservations: true, invoices: true } },
      },
    });

    if (!guest) {
      throw new NotFoundException('Client introuvable.');
    }

    const hasMoreStays = guest.reservations.length > 10;
    const staysSlice = hasMoreStays ? guest.reservations.slice(0, 10) : guest.reservations;
    const staysNextCursor =
      hasMoreStays && staysSlice.length > 0 ? staysSlice[staysSlice.length - 1].id : null;

    return {
      ...this.formatDirectoryItem(guest),
      stays: staysSlice.map((r) => this.formatStay(r)),
      staysNextCursor,
      staysTotal: guest._count.reservations,
      invoicesTotal: guest._count.invoices,
    };
  }

  async listStays(id: string, query: ListGuestStaysQueryDto = {}) {
    const exists = await this.prisma.guest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Client introuvable.');
    }

    const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);
    const args: any = {
      where: { guestId: id },
      include: { room: { select: { number: true, category: true } } },
      orderBy: [{ checkInDate: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    };

    if (query.cursor) {
      args.cursor = { id: query.cursor };
      args.skip = 1;
    }

    const [rows, total] = await Promise.all([
      this.prisma.reservation.findMany(args),
      this.prisma.reservation.count({ where: { guestId: id } }),
    ]);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;

    return {
      items: slice.map((r) => this.formatStay(r)),
      nextCursor,
      total,
    };
  }

  async create(dto: CreateGuestDto, actorRole = 'RECEPTION') {
    let firstName = (dto.firstName || '').trim();
    let lastName = (dto.lastName || '').trim();
    let fullName = (dto.fullName || '').trim();

    if (!fullName && (firstName || lastName)) {
      fullName = `${firstName} ${lastName}`.trim();
    } else if (fullName && (!firstName || !lastName)) {
      const split = this.splitFullName(fullName);
      firstName = firstName || split.firstName;
      lastName = lastName || split.lastName;
      fullName = split.fullName;
    }

    if (!fullName) {
      throw new BadRequestException('Le nom complet est obligatoire.');
    }

    const rawDoc = (dto.idDocumentNumber ?? dto.passportNumber ?? '').trim();
    const idDocumentEncrypted = rawDoc ? this.cryptoService.encrypt(rawDoc) : null;

    const created = await this.prisma.guest.create({
      data: {
        civility: dto.civility || 'M.',
        firstName: firstName || fullName,
        lastName: lastName || fullName,
        fullName,
        phone: dto.phone.trim(),
        email: dto.email?.trim() || null,
        birthDate: dto.birthDate?.trim() || null,
        nationality: dto.nationality?.trim() || 'Sénégalaise',
        address: dto.address?.trim() || null,
        residenceCity: dto.address?.trim() || null,
        idDocumentType: dto.idDocumentType || 'CNI',
        idDocumentEncrypted,
        internalNote: dto.internalNote?.trim() || null,
        version: 1,
      },
      include: { reservations: { select: { status: true, checkInDate: true } } },
    });

    await this.logAudit(actorRole, 'GUEST_CREATE', created.id, {
      hasIdDocument: Boolean(idDocumentEncrypted),
    });

    return {
      ...this.formatDirectoryItem(created),
      stays: [],
      staysNextCursor: null,
      staysTotal: 0,
      invoicesTotal: 0,
    };
  }

  async update(id: string, dto: UpdateGuestDto, actorRole = 'RECEPTION') {
    const existing = await this.prisma.guest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Client introuvable.');
    }

    if (
      dto.expectedVersion !== undefined &&
      dto.expectedVersion !== existing.version
    ) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message:
          'Ce client a été modifié entre-temps par un autre utilisateur. Veuillez recharger la fiche.',
        currentVersion: existing.version,
      });
    }

    const data: Record<string, unknown> = {
      version: { increment: 1 },
    };
    const changedFields: string[] = [];

    if (dto.fullName !== undefined) {
      const split = this.splitFullName(dto.fullName);
      data.fullName = split.fullName;
      data.firstName = dto.firstName !== undefined ? dto.firstName.trim() : split.firstName;
      data.lastName = dto.lastName !== undefined ? dto.lastName.trim() : split.lastName;
      changedFields.push('fullName');
    } else if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const nextFirst = dto.firstName !== undefined ? dto.firstName.trim() : existing.firstName;
      const nextLast = dto.lastName !== undefined ? dto.lastName.trim() : existing.lastName;
      data.firstName = nextFirst;
      data.lastName = nextLast;
      data.fullName = `${nextFirst} ${nextLast}`.trim();
      changedFields.push('name');
    }

    if (dto.phone !== undefined) {
      data.phone = dto.phone.trim();
      changedFields.push('phone');
    }
    if (dto.email !== undefined) {
      data.email = dto.email.trim() || null;
      changedFields.push('email');
    }
    if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate.trim() || null;
      changedFields.push('birthDate');
    }
    if (dto.nationality !== undefined) {
      data.nationality = dto.nationality.trim() || 'Sénégalaise';
      changedFields.push('nationality');
    }
    if (dto.address !== undefined) {
      const addr = dto.address.trim() || null;
      data.address = addr;
      data.residenceCity = addr;
      changedFields.push('address');
    }
    if (dto.idDocumentType !== undefined) {
      data.idDocumentType = dto.idDocumentType;
      changedFields.push('idDocumentType');
    }
    if (dto.idDocumentNumber !== undefined) {
      const raw = dto.idDocumentNumber.trim();
      data.idDocumentEncrypted = raw ? this.cryptoService.encrypt(raw) : null;
      changedFields.push('idDocumentNumber');
    }
    if (dto.internalNote !== undefined) {
      data.internalNote = dto.internalNote.trim() || null;
      changedFields.push('internalNote');
    }

    await this.prisma.guest.update({
      where: { id },
      data,
    });

    await this.logAudit(actorRole, 'GUEST_UPDATE', id, {
      fields: changedFields,
    });

    return this.findOne(id);
  }

  async revealDocument(id: string, actorRole = 'RECEPTION') {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
      select: { id: true, idDocumentEncrypted: true },
    });
    if (!guest) {
      throw new NotFoundException('Client introuvable.');
    }

    await this.logAudit(actorRole, 'GUEST_REVEAL_DOCUMENT', id);

    return {
      idDocumentNumber: this.decryptDocument(guest.idDocumentEncrypted),
    };
  }

  async remove(id: string, actorRole = 'DIRECTION') {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
      include: {
        _count: {
          select: { reservations: true, invoices: true },
        },
      },
    });

    if (!guest) {
      throw new NotFoundException('Client introuvable.');
    }

    const reservationsCount = guest._count.reservations;
    const invoicesCount = guest._count.invoices;

    if (reservationsCount > 0 || invoicesCount > 0) {
      throw new ConflictException(
        `Ce client a ${reservationsCount} séjour${reservationsCount > 1 ? 's' : ''} et ${invoicesCount} facture${invoicesCount > 1 ? 's' : ''} : il ne peut pas être supprimé pour garder l'historique.`,
      );
    }

    await this.prisma.guest.delete({ where: { id } });
    await this.logAudit(actorRole, 'GUEST_DELETE', id, {
      fullName: guest.fullName,
    });

    return { deleted: true, id };
  }
}
