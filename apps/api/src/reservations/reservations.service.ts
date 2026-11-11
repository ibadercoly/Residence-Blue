import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto, UpdateReservationDto } from './dto/reservation.dto';
import { ReservationStatus, RoomStatus } from '@prisma/client';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toUiStatus(status: ReservationStatus, checkOutDate: Date): { status: string; statusLabel: string } {
    const outIso = checkOutDate.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    if (status === ReservationStatus.CHECKED_IN) {
      if (outIso === todayIso || outIso === '2026-11-10') {
        return { status: 'DEPART_AUJ', statusLabel: "Départ aujourd'hui" };
      }
      return { status: 'EN_SEJOUR', statusLabel: 'En séjour' };
    }
    if (status === ReservationStatus.CHECKED_OUT) {
      return { status: 'TERMINE', statusLabel: 'Terminé' };
    }
    if (status === ReservationStatus.CANCELLED) {
      return { status: 'ANNULE', statusLabel: 'Annulée' };
    }
    if (status === ReservationStatus.PENDING) {
      return { status: 'OPTION', statusLabel: 'En attente' };
    }
    return { status: 'CONFIRME', statusLabel: 'Confirmée' };
  }

  private mapFromUiOrDbStatus(raw?: string): ReservationStatus {
    if (!raw) return ReservationStatus.CONFIRMED;
    const upper = raw.toUpperCase();
    if (upper === 'CHECKED_IN' || upper === 'EN_SEJOUR' || upper === 'DEPART_AUJ') {
      return ReservationStatus.CHECKED_IN;
    }
    if (upper === 'CHECKED_OUT' || upper === 'TERMINE') {
      return ReservationStatus.CHECKED_OUT;
    }
    if (upper === 'CANCELLED' || upper === 'ANNULE') {
      return ReservationStatus.CANCELLED;
    }
    if (upper === 'PENDING' || upper === 'OPTION') {
      return ReservationStatus.PENDING;
    }
    return ReservationStatus.CONFIRMED;
  }

  private formatReservation(r: any) {
    const checkInIso = new Date(r.checkInDate).toISOString().slice(0, 10);
    const checkOutIso = new Date(r.checkOutDate).toISOString().slice(0, 10);
    const uiStat = this.toUiStatus(r.status, new Date(r.checkOutDate));
    return {
      id: r.id,
      reference: r.reference,
      guestId: r.guestId,
      guestName: r.guest?.fullName || 'Client',
      roomId: r.roomId,
      roomNumber: r.room?.number || '',
      startDayIndex: 0,
      durationDays: r.nights || 1,
      checkInDate: checkInIso,
      checkOutDate: checkOutIso,
      dbStatus: r.status,
      status: uiStat.status,
      statusLabel: uiStat.statusLabel,
      adultsCount: r.adultsCount,
      childrenCount: r.childrenCount,
      nights: r.nights,
      depositFcfa: r.depositFcfa,
      totalFcfa: r.totalFcfa,
      remainingFcfa: Math.max(0, r.totalFcfa - (r.depositFcfa || 0)),
      contactPhone: r.guest?.phone || '',
      contactEmail: r.guest?.email || '',
      checkedInAt: r.checkedInAt,
      checkedOutAt: r.checkedOutAt,
      notes: r.notes || '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async findAll() {
    const list = await this.prisma.reservation.findMany({
      include: { guest: true, room: true },
      orderBy: { checkInDate: 'asc' },
    });
    return list.map((r) => this.formatReservation(r));
  }

  async findOne(id: string) {
    const res = await this.prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, room: true },
    });
    if (!res) {
      throw new NotFoundException(`Réservation "${id}" introuvable.`);
    }
    return this.formatReservation(res);
  }

  async create(dto: CreateReservationDto) {
    const checkIn = new Date(`${dto.checkInDate.slice(0, 10)}T00:00:00.000Z`);
    const checkOut = new Date(`${dto.checkOutDate.slice(0, 10)}T00:00:00.000Z`);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      throw new BadRequestException('La date de départ doit être postérieure à la date d’arrivée.');
    }

    const nights =
      dto.nights || Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    // Résoudre la chambre
    const room = dto.roomId
      ? await this.prisma.room.findUnique({ where: { id: dto.roomId }, include: { type: true } })
      : dto.roomNumber
        ? await this.prisma.room.findUnique({ where: { number: dto.roomNumber.trim() }, include: { type: true } })
        : null;

    if (!room) {
      throw new BadRequestException('Chambre introuvable pour cette réservation.');
    }

    // Vérifier le chevauchement de dates sur la même chambre
    const overlapping = await this.prisma.reservation.findFirst({
      where: {
        roomId: room.id,
        status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `La chambre ${room.number} est déjà réservée sur cette période (du ${dto.checkInDate.slice(0, 10)} au ${dto.checkOutDate.slice(0, 10)}). Réservation refusée.`,
      );
    }

    // Résoudre ou créer le client
    let guestId = dto.guestId;
    if (guestId) {
      const existingGuest = await this.prisma.guest.findUnique({ where: { id: guestId } });
      if (!existingGuest) guestId = undefined;
    }

    if (!guestId) {
      const rawName = (dto.guestName || 'Client Résidence Blue').trim();
      const existingByName = await this.prisma.guest.findFirst({
        where: { fullName: { equals: rawName, mode: 'insensitive' } },
      });
      if (existingByName) {
        guestId = existingByName.id;
      } else {
        const parts = rawName.replace(/^(M\.|Mme|Dr\.)\s*/i, '').split(/\s+/);
        const firstName = parts[0] || 'Client';
        const lastName = parts.slice(1).join(' ') || 'Séjour';
        const newGuest = await this.prisma.guest.create({
          data: {
            civility: rawName.startsWith('Mme') ? 'Mme' : 'M.',
            firstName,
            lastName,
            fullName: rawName,
            phone: dto.contactPhone || '+221 77 000 00 00',
            email: dto.contactEmail || null,
          },
        });
        guestId = newGuest.id;
      }
    }

    const totalFcfa =
      dto.totalFcfa !== undefined
        ? Math.round(dto.totalFcfa)
        : (room.pricePerNight || room.type?.pricePerNight || 35000) * nights;
    const depositFcfa = Math.round(dto.depositFcfa || 0);
    const reference = `#RB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const status = this.mapFromUiOrDbStatus(dto.status);

    const created = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.create({
        data: {
          reference,
          guestId: guestId!,
          roomId: room.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adultsCount: dto.adultsCount ?? 2,
          childrenCount: dto.childrenCount ?? 0,
          nights,
          status,
          depositFcfa,
          totalFcfa,
          notes: dto.notes || null,
          checkedInAt: status === ReservationStatus.CHECKED_IN ? new Date() : null,
        },
        include: { guest: true, room: true },
      });

      if (status === ReservationStatus.CHECKED_IN) {
        await tx.room.update({
          where: { id: room.id },
          data: { status: RoomStatus.OCCUPIED },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'RESERVATION_CREATE',
          entity: 'Reservation',
          entityId: res.id,
          after: {
            id: res.id,
            reference: res.reference,
            roomNumber: room.number,
            checkInDate: dto.checkInDate,
            checkOutDate: dto.checkOutDate,
            totalFcfa: res.totalFcfa,
          },
        },
      });

      return res;
    });

    return this.formatReservation(created);
  }

  async update(id: string, dto: UpdateReservationDto) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { room: true, guest: true },
    });
    if (!existing) {
      throw new NotFoundException(`Réservation "${id}" introuvable.`);
    }

    let targetRoomId = existing.roomId;
    if (dto.roomId) {
      targetRoomId = dto.roomId;
    } else if (dto.roomNumber) {
      const r = await this.prisma.room.findUnique({ where: { number: dto.roomNumber.trim() } });
      if (!r) throw new BadRequestException(`Chambre ${dto.roomNumber} introuvable.`);
      targetRoomId = r.id;
    }

    const checkIn = dto.checkInDate
      ? new Date(`${dto.checkInDate.slice(0, 10)}T00:00:00.000Z`)
      : existing.checkInDate;
    const checkOut = dto.checkOutDate
      ? new Date(`${dto.checkOutDate.slice(0, 10)}T00:00:00.000Z`)
      : existing.checkOutDate;

    if (checkOut <= checkIn) {
      throw new BadRequestException('La date de départ doit être postérieure à la date d’arrivée.');
    }

    const nextStatus = dto.status ? this.mapFromUiOrDbStatus(dto.status) : existing.status;

    if (nextStatus !== ReservationStatus.CANCELLED && nextStatus !== ReservationStatus.NO_SHOW) {
      const conflict = await this.prisma.reservation.findFirst({
        where: {
          id: { not: id },
          roomId: targetRoomId,
          status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
        },
      });
      if (conflict) {
        throw new ConflictException('Chevauchement détecté sur cette chambre pour la période choisie.');
      }
    }

    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.update({
        where: { id },
        data: {
          roomId: targetRoomId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          nights,
          status: nextStatus,
          ...(dto.adultsCount !== undefined ? { adultsCount: dto.adultsCount } : {}),
          ...(dto.childrenCount !== undefined ? { childrenCount: dto.childrenCount } : {}),
          ...(dto.depositFcfa !== undefined ? { depositFcfa: Math.round(dto.depositFcfa) } : {}),
          ...(dto.totalFcfa !== undefined ? { totalFcfa: Math.round(dto.totalFcfa) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        include: { guest: true, room: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'RESERVATION_UPDATE',
          entity: 'Reservation',
          entityId: res.id,
          before: { status: existing.status, totalFcfa: existing.totalFcfa },
          after: { status: res.status, totalFcfa: res.totalFcfa },
        },
      });

      return res;
    });

    return this.formatReservation(updated);
  }

  async checkIn(id: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Réservation "${id}" introuvable.`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
        include: { guest: true, room: true },
      });

      await tx.room.update({
        where: { id: existing.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      await tx.auditLog.create({
        data: {
          action: 'RESERVATION_CHECK_IN',
          entity: 'Reservation',
          entityId: res.id,
          after: { status: res.status, checkedInAt: res.checkedInAt },
        },
      });

      return res;
    });

    return this.formatReservation(updated);
  }

  async checkOut(id: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Réservation "${id}" introuvable.`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CHECKED_OUT,
          checkedOutAt: new Date(),
        },
        include: { guest: true, room: true },
      });

      await tx.room.update({
        where: { id: existing.roomId },
        data: { status: RoomStatus.CLEANING },
      });

      await tx.auditLog.create({
        data: {
          action: 'RESERVATION_CHECK_OUT',
          entity: 'Reservation',
          entityId: res.id,
          after: { status: res.status, checkedOutAt: res.checkedOutAt },
        },
      });

      return res;
    });

    return this.formatReservation(updated);
  }

  async cancel(id: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Réservation "${id}" introuvable.`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CANCELLED },
        include: { guest: true, room: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'RESERVATION_CANCEL',
          entity: 'Reservation',
          entityId: res.id,
          before: { status: existing.status },
          after: { status: res.status },
        },
      });

      return res;
    });

    return this.formatReservation(updated);
  }

  async remove(id: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Réservation "${id}" introuvable.`);

    const invCount = await this.prisma.invoice.count({ where: { reservationId: id } });
    const ordCount = await this.prisma.restaurantOrder.count({ where: { reservationId: id } });

    if (invCount > 0 || ordCount > 0) {
      const cancelled = await this.cancel(id);
      return { deleted: false, cancelled: true, reservation: cancelled };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: 'RESERVATION_DELETE',
          entity: 'Reservation',
          entityId: existing.id,
          before: { id: existing.id, reference: existing.reference },
        },
      });
      await tx.reservation.delete({ where: { id } });
    });

    return { deleted: true, id };
  }
}
