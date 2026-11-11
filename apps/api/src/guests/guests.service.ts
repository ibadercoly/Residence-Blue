import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/security/crypto.service';
import { AddGuestNoteDto, CreateGuestDto, UpdateGuestDto } from './dto/guest.dto';

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  private decryptPassport(encrypted: string | null | undefined): string {
    if (!encrypted) return '';
    try {
      return this.cryptoService.decrypt(encrypted);
    } catch {
      return '';
    }
  }

  private formatGuestProfile(guest: any) {
    const reservations = guest.reservations || [];
    const invoices = guest.invoices || [];

    const totalNights = reservations.reduce((acc: number, r: any) => acc + (r.nights || 1), 0);
    const totalSpentFcfa = reservations.reduce((acc: number, r: any) => acc + (r.totalFcfa || 0), 0);
    const stayCount = reservations.length;

    const stays = reservations.map((r: any, idx: number) => ({
      id: r.id,
      order: idx + 1,
      periodTitle: `${idx + 1}. ${new Date(r.checkInDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      status: r.status === 'CHECKED_IN' ? 'ACTIVE' : r.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
      statusBadge: `${r.status === 'CHECKED_IN' ? 'Actif' : 'Confirmé'} • Ch. ${r.room?.number || ''}`,
      roomNumber: r.room?.number || '',
      roomName: r.room?.category || 'Standard',
      reference: r.reference,
      datesLabel: `Du ${new Date(r.checkInDate).toISOString().slice(0, 10)} au ${new Date(r.checkOutDate).toISOString().slice(0, 10)} (${r.nights} nuits)`,
      nights: r.nights,
      adults: r.adultsCount,
      extrasSummary: r.notes || 'Séjour Résidence Blue Thiès',
      totalFcfa: r.totalFcfa,
      remainingFcfa: Math.max(0, r.totalFcfa - (r.depositFcfa || 0)),
      paymentInfo: r.depositFcfa > 0 ? `Acompte de ${r.depositFcfa} FCFA reçu` : 'En attente de règlement',
      isCurrent: r.status === 'CHECKED_IN',
    }));

    const folios = invoices.map((inv: any) => ({
      id: inv.id,
      reference: inv.invoiceNumber,
      stayDate: new Date(inv.issuedAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      roomLabel: inv.room ? `Ch. ${inv.room.number} - ${inv.room.category}` : 'Chambre',
      totalAmountFcfa: inv.totalFcfa,
      paidAmountFcfa: inv.paidAmountFcfa + inv.depositFcfa,
      balanceFcfa: inv.balanceFcfa,
      paymentMethod: inv.status === 'PAID' ? 'Réglé' : 'Partiel',
      status: inv.status === 'PAID' ? 'PAID' : inv.status === 'PARTIAL' ? 'PARTIAL' : 'PENDING',
    }));

    return {
      id: guest.id,
      civility: guest.civility || 'M.',
      firstName: guest.firstName,
      lastName: guest.lastName,
      fullName: guest.fullName,
      vipTier: guest.vipTier || 'Client Standard',
      avatarUrl: guest.avatarUrl || 'assets/images/clients/avatar-mamadou-diop.jpg',
      loyaltyStayCount: stayCount,
      totalNights,
      totalSpentFcfa,
      averageBasketFcfa: stayCount > 0 ? Math.round(totalSpentFcfa / stayCount) : 0,
      averageStayNights: stayCount > 0 ? Math.round((totalNights / stayCount) * 10) / 10 : 0,
      memberSinceDate: new Date(guest.createdAt).toLocaleDateString('fr-FR'),
      memberSinceDuration: 'Client enregistré',
      lodgingRatioPercent: 80,
      fbRatioPercent: 20,
      nationality: guest.nationality || 'Sénégalaise',
      phone: guest.phone,
      email: guest.email || '',
      affiliationCompany: guest.companyName || '',
      affiliationRole: guest.companyRole || '',
      residenceCity: guest.residenceCity || 'Thiès, Sénégal',
      passportNumber: this.decryptPassport(guest.idDocumentEncrypted),
      passportExpiry: guest.idDocumentExpiry || '',
      isActive: guest.isActive,
      favoriteRoom: {
        name: stays[0] ? `${stays[0].roomName} (${stays[0].roomNumber})` : 'Suite Panoramique (301)',
        number: stays[0]?.roomNumber || '301',
        photoUrl: 'assets/images/clients/room-favorite-suite.jpg',
        reason: 'Chambre préférée à Thiès',
      },
      permanentInstructions: Array.isArray(guest.permanentInstructions) ? guest.permanentInstructions : [],
      dietaryPreferences: (guest.dietaryPreferences as any) || {
        diet: 'Standard',
        allergies: 'Aucune déclarée',
      },
      stays,
      preferences: Array.isArray(guest.preferences) ? guest.preferences : [],
      folios,
      notes: Array.isArray(guest.notes) ? guest.notes : [],
    };
  }

  async findAll() {
    const guests = await this.prisma.guest.findMany({
      where: { isActive: true },
      include: {
        reservations: { include: { room: true }, orderBy: { checkInDate: 'desc' } },
        invoices: { include: { room: true }, orderBy: { issuedAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return guests.map((g) => this.formatGuestProfile(g));
  }

  async findOne(id: string) {
    let guest = await this.prisma.guest.findFirst({
      where: /^[0-9a-f-]{36}$/i.test(id) ? { id } : { isActive: true },
      include: {
        reservations: { include: { room: true }, orderBy: { checkInDate: 'desc' } },
        invoices: { include: { room: true }, orderBy: { issuedAt: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!guest) {
      throw new NotFoundException(`Client "${id}" introuvable.`);
    }

    return this.formatGuestProfile(guest);
  }

  async create(dto: CreateGuestDto) {
    const civility = dto.civility?.trim() || 'M.';
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const fullName = `${civility} ${firstName} ${lastName}`.trim();

    const encryptedDoc = dto.passportNumber
      ? this.cryptoService.encrypt(dto.passportNumber.trim())
      : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const g = await tx.guest.create({
        data: {
          civility,
          firstName,
          lastName,
          fullName,
          phone: dto.phone.trim(),
          email: dto.email?.trim() || null,
          nationality: dto.nationality?.trim() || 'Sénégalaise',
          residenceCity: dto.residenceCity?.trim() || 'Thiès, Sénégal',
          companyName: dto.companyName?.trim() || null,
          companyRole: dto.companyRole?.trim() || null,
          vipTier: dto.vipTier?.trim() || 'Client Fidèle',
          idDocumentEncrypted: encryptedDoc,
          idDocumentExpiry: dto.passportExpiry?.trim() || null,
          notes: [],
          preferences: [],
          permanentInstructions: [],
        },
        include: {
          reservations: { include: { room: true } },
          invoices: { include: { room: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'GUEST_CREATE',
          entity: 'Guest',
          entityId: g.id,
          after: { id: g.id, fullName: g.fullName, phone: g.phone },
        },
      });

      return g;
    });

    return this.formatGuestProfile(created);
  }

  async update(id: string, dto: UpdateGuestDto) {
    const existing = await this.prisma.guest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client "${id}" introuvable.`);
    }

    const civility = dto.civility !== undefined ? dto.civility.trim() : existing.civility;
    const firstName = dto.firstName !== undefined ? dto.firstName.trim() : existing.firstName;
    const lastName = dto.lastName !== undefined ? dto.lastName.trim() : existing.lastName;
    const fullName = `${civility} ${firstName} ${lastName}`.trim();

    const encryptedDoc =
      dto.passportNumber !== undefined
        ? dto.passportNumber
          ? this.cryptoService.encrypt(dto.passportNumber.trim())
          : null
        : existing.idDocumentEncrypted;

    const updated = await this.prisma.$transaction(async (tx) => {
      const g = await tx.guest.update({
        where: { id },
        data: {
          civility,
          firstName,
          lastName,
          fullName,
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
          ...(dto.email !== undefined ? { email: dto.email.trim() || null } : {}),
          ...(dto.nationality !== undefined ? { nationality: dto.nationality.trim() } : {}),
          ...(dto.residenceCity !== undefined ? { residenceCity: dto.residenceCity.trim() } : {}),
          ...(dto.companyName !== undefined ? { companyName: dto.companyName.trim() || null } : {}),
          ...(dto.companyRole !== undefined ? { companyRole: dto.companyRole.trim() || null } : {}),
          ...(dto.vipTier !== undefined ? { vipTier: dto.vipTier.trim() } : {}),
          idDocumentEncrypted: encryptedDoc,
          ...(dto.passportExpiry !== undefined ? { idDocumentExpiry: dto.passportExpiry.trim() || null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          reservations: { include: { room: true } },
          invoices: { include: { room: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'GUEST_UPDATE',
          entity: 'Guest',
          entityId: g.id,
          before: { fullName: existing.fullName, phone: existing.phone },
          after: { fullName: g.fullName, phone: g.phone },
        },
      });

      return g;
    });

    return this.formatGuestProfile(updated);
  }

  async addNote(id: string, dto: AddGuestNoteDto) {
    const existing = await this.prisma.guest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client "${id}" introuvable.`);
    }

    const currentNotes = Array.isArray(existing.notes) ? (existing.notes as any[]) : [];
    const newNote = {
      id: `note-${Date.now()}`,
      authorName: dto.authorName || 'Aïssatou Ba',
      department: dto.department || 'Direction',
      timeAgo: "À l'instant",
      content: dto.content.trim(),
    };

    const updated = await this.prisma.guest.update({
      where: { id },
      data: {
        notes: [newNote, ...currentNotes],
      },
      include: {
        reservations: { include: { room: true } },
        invoices: { include: { room: true } },
      },
    });

    return this.formatGuestProfile(updated);
  }

  async deleteOrDeactivate(id: string) {
    const existing = await this.prisma.guest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client "${id}" introuvable.`);
    }

    const resCount = await this.prisma.reservation.count({ where: { guestId: id } });
    const invCount = await this.prisma.invoice.count({ where: { guestId: id } });

    if (resCount > 0 || invCount > 0) {
      const deactivated = await this.prisma.guest.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, id: deactivated.id };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: 'GUEST_DELETE',
          entity: 'Guest',
          entityId: existing.id,
          before: { id: existing.id, fullName: existing.fullName, phone: existing.phone },
        },
      });
      await tx.guest.delete({ where: { id } });
    });

    return { deleted: true, deactivated: false, id };
  }
}
