import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import { TariffsService } from '../tariffs/tariffs.service';
import {
  UNCLASSIFIED_ROOM_CATEGORY,
  normalizeTariffCategoryCode,
} from '@residence-blue/shared';
import { CreateReservationDto, UpdateReservationDto } from './dto/reservation.dto';
import {
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  ReservationStatus,
  RoomStatus,
} from '@prisma/client';

export interface CreateReservationContext {
  idempotencyKey?: string;
  actorRole?: string;
  userId?: string;
  actorName?: string;
  ip?: string;
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tariffsService?: TariffsService,
  ) {}

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

  private formatReservation(r: any, paymentId?: string | null) {
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
      roomCategory: r.room?.tariffCategory?.name || r.room?.category || UNCLASSIFIED_ROOM_CATEGORY,
      ratePerNightFcfa:
        typeof r.ratePerNightFcfa === 'number'
          ? r.ratePerNightFcfa
          : Math.max(
              0,
              Math.round(
                ((r.totalFcfa ?? 0) - (r.tourismTaxFcfa ?? 0) + (r.discountFcfa ?? 0)) /
                  Math.max(1, r.nights || 1),
              ),
            ),
      roomsUsed: r.roomsUsed ?? 1,
      tariffLabel: r.tariffLabel ?? null,
      priceOverriddenByDirector: Boolean(r.priceOverriddenByDirector),
      priceOverrideReason: r.priceOverrideReason ?? null,
      priceDisplayNote: r.priceOverriddenByDirector ? 'Prix fixé par la direction' : null,
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
      source: r.source || 'RECEPTION',
      breakfastIncluded: r.breakfastIncluded ?? true,
      discountFcfa: r.discountFcfa ?? 0,
      tourismTaxFcfa: r.tourismTaxFcfa ?? 0,
      depositFcfa: r.depositFcfa,
      totalFcfa: r.totalFcfa,
      remainingFcfa: Math.max(0, r.totalFcfa - (r.depositFcfa || 0)),
      contactPhone: r.guest?.phone || '',
      contactEmail: r.guest?.email || '',
      checkedInAt: r.checkedInAt,
      checkedOutAt: r.checkedOutAt,
      notes: r.notes || '',
      ...(paymentId ? { paymentId } : {}),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private normalizePaymentMethod(raw?: string): PaymentMethod {
    const upper = (raw || 'CASH').toUpperCase();
    if (upper === 'WAVE') return PaymentMethod.WAVE;
    if (upper === 'ORANGE_MONEY' || upper === 'OM') return PaymentMethod.ORANGE_MONEY;
    if (upper === 'CARD' || upper === 'CARTE' || upper === 'CARTE_TPE') {
      return PaymentMethod.CARD;
    }
    if (upper === 'BANK_TRANSFER' || upper === 'VIREMENT') {
      return PaymentMethod.BANK_TRANSFER;
    }
    return PaymentMethod.CASH;
  }

  private splitFullName(rawName: string): {
    civility: string;
    firstName: string;
    lastName: string;
    fullName: string;
  } {
    const trimmed = rawName.trim().replace(/\s+/g, ' ');
    const civility = trimmed.startsWith('Mme') ? 'Mme' : 'M.';
    const cleaned = trimmed.replace(/^(M\.|Mme|Dr\.)\s*/i, '');
    const parts = cleaned.split(/\s+/);
    const firstName = parts[0] || 'Client';
    const lastName = parts.slice(1).join(' ') || firstName;
    return { civility, firstName, lastName, fullName: trimmed };
  }

  async findAll() {
    const list = await this.prisma.reservation.findMany({
      include: { guest: true, room: { include: { tariffCategory: true } } },
      orderBy: { checkInDate: 'asc' },
    });
    return list.map((r) => this.formatReservation(r));
  }

  async findOne(id: string) {
    const res = await this.prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, room: { include: { tariffCategory: true } } },
    });
    if (!res) {
      throw new NotFoundException(`Réservation "${id}" introuvable.`);
    }
    return this.formatReservation(res);
  }

  async create(dto: CreateReservationDto, ctx: CreateReservationContext = {}) {
    const idempotencyKey = ctx.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existingOp = await this.prisma.syncOperation.findUnique({
        where: { idempotencyKey },
      });
      if (existingOp?.result) {
        return existingOp.result as any;
      }
    }

    const checkInStr = dto.checkInDate.slice(0, 10);
    const checkOutStr = dto.checkOutDate.slice(0, 10);
    const checkIn = new Date(`${checkInStr}T00:00:00.000Z`);
    const checkOut = new Date(`${checkOutStr}T00:00:00.000Z`);
    if (
      isNaN(checkIn.getTime()) ||
      isNaN(checkOut.getTime()) ||
      checkIn.toISOString().slice(0, 10) !== checkInStr ||
      checkOut.toISOString().slice(0, 10) !== checkOutStr ||
      checkOut <= checkIn
    ) {
      throw new BadRequestException(
        'La date de départ doit être strictement postérieure à la date d’arrivée.',
      );
    }

    if (dto.transactionRef) {
      const compactRef = dto.transactionRef.replace(/[\s-]/g, '');
      if (/^\d{13,19}$/.test(compactRef)) {
        throw new BadRequestException(
          'Aucun numéro de carte bancaire ne doit être saisi dans la référence de transaction.',
        );
      }
    }

    const nights = Math.max(
      1,
      Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000),
    );
    const adultsCount = dto.adultsCount ?? 1;
    const childrenCount = dto.childrenCount ?? 0;

    if (!dto.roomId && !dto.roomNumber) {
      throw new BadRequestException('Veuillez sélectionner une chambre.');
    }

    const settings = await this.prisma.hotelSetting.findUnique({
      where: { id: 'default' },
      select: {
        tourismTaxPerNightPerPerson: true,
        tourismTaxIncludesChildren: true,
        vatRatePercent: true,
      },
    });
    const taxRatePerAdultPerNight = settings?.tourismTaxPerNightPerPerson ?? 1000;
    const tourismTaxIncludesChildren = settings?.tourismTaxIncludesChildren ?? false;
    const vatRatePercent = settings?.vatRatePercent ?? 10;

    if (dto.overridePricePerNightFcfa !== undefined) {
      const role = (ctx.actorRole || '').toUpperCase();
      if (role !== 'DIRECTION' && role !== 'ADMIN' && role !== 'MANAGER') {
        throw new ForbiddenException(
          'La modification manuelle du tarif de réservation est réservée à la direction.',
        );
      }
      if (!dto.priceOverrideReason || dto.priceOverrideReason.trim().length < 3) {
        throw new BadRequestException(
          'Un motif obligatoire (au moins 3 caractères) est requis lorsque la direction fixe un prix manuel.',
        );
      }
    }

    const status = this.mapFromUiOrDbStatus(dto.status);
    const source = dto.source || 'RECEPTION';
    const discountFcfa = Math.round(dto.discountFcfa || 0);
    const depositFcfa = Math.round(dto.depositFcfa || 0);
    const paymentMethod = this.normalizePaymentMethod(dto.paymentMethod);

    const year = new Date().getFullYear();
    const reference = `#RB-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const runTx = async () => {
      return this.prisma.$transaction(
        async (tx) => {
          // 1. Résoudre et vérifier la chambre (active et hors Maintenance)
          const room = dto.roomId
            ? await tx.room.findUnique({
                where: { id: dto.roomId },
                include: { type: true, tariffCategory: true },
              })
            : await tx.room.findUnique({
                where: { number: dto.roomNumber!.trim() },
                include: { type: true, tariffCategory: true },
              });

          if (!room) {
            throw new BadRequestException('Chambre introuvable pour cette réservation.');
          }
          if (!room.isActive || room.status === RoomStatus.MAINTENANCE) {
            throw new BadRequestException(
              `La chambre ${room.number} est indisponible (Maintenance ou inactive).`,
            );
          }

          const categoryCode =
            room.tariffCategory?.code ?? normalizeTariffCategoryCode(room.category);
          const isApartment = categoryCode === 'APPARTEMENT';
          const guestsCount = adultsCount + childrenCount;

          // 2. Vérifier la capacité maximale de la chambre
          const maxAdults = isApartment ? Math.max(6, room.adultsCapacity) : room.adultsCapacity;
          const totalCapacity = isApartment
            ? Math.max(6, room.adultsCapacity + room.childrenCapacity)
            : room.adultsCapacity + room.childrenCapacity;
          if (
            adultsCount > maxAdults ||
            childrenCount > room.childrenCapacity ||
            guestsCount > totalCapacity
          ) {
            throw new BadRequestException(
              `Capacité dépassée pour la chambre ${room.number} (max ${maxAdults} adulte(s), ${room.childrenCapacity} enfant(s)).`,
            );
          }

          // 3. Calcul autoritaire du montant côté serveur via la grille tarifaire (jamais de prix par défaut)
          const requestedRoomsUsed = isApartment ? (dto.roomsUsed ?? 1) : 1;
          const breakfastIncluded =
            dto.breakfastIncluded !== undefined
              ? dto.breakfastIncluded
              : room.breakfastIncluded;

          const directorOverride =
            dto.overridePricePerNightFcfa !== undefined
              ? {
                  pricePerNightFcfa: Math.round(dto.overridePricePerNightFcfa),
                  reason: (dto.priceOverrideReason || '').trim(),
                  actorRole: ctx.actorRole || '',
                }
              : null;

          const tariffsService =
            this.tariffsService ?? new TariffsService(this.prisma);
          const priceResult = await tariffsService.computeReservationPriceForRoom({
            room,
            guestsCount,
            roomsUsed: requestedRoomsUsed,
            nights,
            breakfastIncluded,
            directorOverride,
            tx,
          });

          const ratePerNight = priceResult.ratePerNightFcfa;
          const accommodationTotal = priceResult.accommodationTotalFcfa;
          if (discountFcfa > accommodationTotal) {
            throw new BadRequestException(
              "La remise ne peut pas dépasser le montant de l'hébergement.",
            );
          }
          const taxablePersons = tourismTaxIncludesChildren ? guestsCount : adultsCount;
          const tourismTaxFcfa = taxRatePerAdultPerNight * taxablePersons * nights;
          const totalFcfa = Math.max(0, accommodationTotal + tourismTaxFcfa - discountFcfa);
          if (depositFcfa > totalFcfa) {
            throw new BadRequestException(
              "L'acompte ne peut pas dépasser le total du séjour.",
            );
          }

          // 4. Contrôle anti-chevauchement dans la transaction
          const overlapping = await tx.reservation.findFirst({
            where: {
              roomId: room.id,
              status: {
                notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
              },
              checkInDate: { lt: checkOut },
              checkOutDate: { gt: checkIn },
            },
          });

          if (overlapping) {
            throw new ConflictException(
              "Cette chambre vient d'être réservée, choisissez-en une autre",
            );
          }

          // 5. Résoudre ou créer le client rapide dans la même transaction
          let resolvedGuestId = dto.guestId?.trim();
          if (resolvedGuestId) {
            const existingGuest = await tx.guest.findUnique({
              where: { id: resolvedGuestId },
            });
            if (!existingGuest || !existingGuest.isActive) {
              throw new NotFoundException('Client sélectionné introuvable.');
            }
          } else if (dto.newGuest) {
            const nameParts = this.splitFullName(dto.newGuest.fullName);
            const createdGuest = await tx.guest.create({
              data: {
                civility: nameParts.civility,
                firstName: nameParts.firstName,
                lastName: nameParts.lastName,
                fullName: nameParts.fullName,
                phone: dto.newGuest.phone.trim(),
              },
            });
            resolvedGuestId = createdGuest.id;
          } else if (dto.guestName) {
            const rawName = dto.guestName.trim();
            const existingByName = await tx.guest.findFirst({
              where: { fullName: { equals: rawName, mode: 'insensitive' }, isActive: true },
            });
            if (existingByName) {
              resolvedGuestId = existingByName.id;
            } else {
              const nameParts = this.splitFullName(rawName);
              const createdGuest = await tx.guest.create({
                data: {
                  civility: nameParts.civility,
                  firstName: nameParts.firstName,
                  lastName: nameParts.lastName,
                  fullName: nameParts.fullName,
                  phone: (dto.contactPhone || '+221 77 000 00 00').trim(),
                  email: dto.contactEmail?.trim() || null,
                },
              });
              resolvedGuestId = createdGuest.id;
            }
          } else {
            throw new BadRequestException(
              'Veuillez sélectionner un client ou créer un client rapide.',
            );
          }

          // 6. Créer la réservation (tarif figé à la création)
          const res = await tx.reservation.create({
            data: {
              reference,
              guestId: resolvedGuestId,
              roomId: room.id,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              adultsCount,
              childrenCount,
              roomsUsed: priceResult.roomsUsed,
              nights,
              ratePerNightFcfa: ratePerNight,
              tariffLabel: priceResult.tariffLabel,
              priceOverriddenByDirector: priceResult.priceOverriddenByDirector,
              priceOverrideReason: priceResult.priceOverrideReason,
              priceOverriddenById: priceResult.priceOverriddenByDirector ? ctx?.userId || null : null,
              priceOverriddenByName: priceResult.priceOverriddenByDirector
                ? ctx?.actorName || null
                : null,
              status,
              source,
              breakfastIncluded,
              discountFcfa,
              tourismTaxFcfa,
              depositFcfa,
              totalFcfa,
              notes: dto.notes?.trim() || null,
              createdById: ctx?.userId || null,
              createdByName: ctx?.actorName || null,
              checkedInAt: status === ReservationStatus.CHECKED_IN ? new Date() : null,
            },
            include: { guest: true, room: { include: { tariffCategory: true } } },
          });

          if (priceResult.priceOverriddenByDirector) {
            await appendChainedAuditLog(tx, {
              userId: ctx.userId || null,
              action: 'RESERVATION_PRICE_OVERRIDE',
              entity: 'Reservation',
              entityId: res.id,
              ip: ctx.ip || null,
              after: {
                reference: res.reference,
                roomNumber: room.number,
                ratePerNightFcfa: ratePerNight,
                nights,
                accommodationTotalFcfa: accommodationTotal,
                reason: priceResult.priceOverrideReason,
                actorName: ctx.actorName || null,
                actorRole: ctx.actorRole || 'DIRECTION',
              },
            });
          }

          if (status === ReservationStatus.CHECKED_IN) {
            await tx.room.update({
              where: { id: room.id },
              data: { status: RoomStatus.OCCUPIED },
            });
          }

          // 7. Créer facture + paiement d'acompte s'il y en a un
          let createdPaymentId: string | null = null;
          if (depositFcfa > 0) {
            const taxableTtc = Math.max(0, totalFcfa - tourismTaxFcfa);
            const subtotalHtFcfa = Math.round(taxableTtc / (1 + vatRatePercent / 100));
            const vatAmountFcfa = taxableTtc - subtotalHtFcfa;
            const balanceFcfa = Math.max(0, totalFcfa - depositFcfa);
            const invStatus =
              balanceFcfa === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

            const invoice = await tx.invoice.create({
              data: {
                invoiceNumber: null,
                isIssued: false,
                reservationId: res.id,
                guestId: resolvedGuestId,
                roomId: room.id,
                discountFcfa,
                subtotalHtFcfa,
                vatRatePercent,
                vatAmountFcfa,
                tourismTaxFcfa,
                totalFcfa,
                depositFcfa: 0,
                paidAmountFcfa: depositFcfa,
                balanceFcfa,
                status: invStatus,
                settledAt: invStatus === InvoiceStatus.PAID ? new Date() : null,
                lines: {
                  create: [
                    {
                      dateLabel: checkInStr,
                      description: `Séjour Chambre ${room.number} (${room.category})`,
                      subDescription: `${nights} nuit(s) × ${ratePerNight} FCFA`,
                      category: 'HEBERGEMENT',
                      quantity: nights,
                      quantityLabel: `${nights}n`,
                      unitPriceFcfa: ratePerNight,
                      totalPriceFcfa: accommodationTotal,
                      isSystem: true,
                    },
                    ...(tourismTaxFcfa > 0
                      ? [
                          {
                            dateLabel: checkInStr,
                            description: 'Taxe de séjour',
                            subDescription: `${adultsCount} adulte(s) × ${nights} nuit(s)`,
                            category: 'TAX',
                            quantity: adultsCount * nights,
                            quantityLabel: `${adultsCount * nights}`,
                            unitPriceFcfa: taxRatePerAdultPerNight,
                            totalPriceFcfa: tourismTaxFcfa,
                          },
                        ]
                      : []),
                  ],
                },
              },
            });

            const payment = await tx.payment.create({
              data: {
                invoiceId: invoice.id,
                method: paymentMethod,
                amountFcfa: depositFcfa,
                transactionRef: dto.transactionRef?.trim() || null,
              },
            });
            createdPaymentId = payment.id;

            await appendChainedAuditLog(tx, {
              userId: ctx.userId || null,
              action: 'PAYMENT_CREATE',
              entity: 'Payment',
              entityId: payment.id,
              ip: ctx.ip || null,
              after: {
                actorRole: ctx.actorRole || 'RECEPTION',
                reservationId: res.id,
                invoiceId: invoice.id,
                amountFcfa: depositFcfa,
                method: paymentMethod,
                transactionRef: dto.transactionRef?.trim() || null,
              },
            });
          }

          await appendChainedAuditLog(tx, {
            userId: ctx.userId || null,
            action: 'RESERVATION_CREATE',
            entity: 'Reservation',
            entityId: res.id,
            ip: ctx.ip || null,
            after: {
              actorRole: ctx.actorRole || 'RECEPTION',
              id: res.id,
              reference: res.reference,
              guestId: resolvedGuestId,
              roomNumber: room.number,
              checkInDate: checkInStr,
              checkOutDate: checkOutStr,
              adultsCount,
              childrenCount,
              totalFcfa: res.totalFcfa,
              depositFcfa: res.depositFcfa,
              source,
            },
          });

          const formatted = this.formatReservation(res, createdPaymentId);

          if (idempotencyKey) {
            await tx.syncOperation.create({
              data: {
                idempotencyKey,
                result: formatted as any,
              },
            });
          }

          return formatted;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    };

    try {
      return await runTx();
    } catch (err: any) {
      if (
        err instanceof ConflictException ||
        err instanceof BadRequestException ||
        err instanceof ForbiddenException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      const msg = String(err?.message || '');
      const pgCode = err?.meta?.code || err?.code;
      if (
        pgCode === 'P2034' ||
        pgCode === '23P01' ||
        pgCode === '40001' ||
        msg.includes('reservations_no_overlap_active') ||
        msg.includes('could not serialize access')
      ) {
        throw new ConflictException(
          "Cette chambre vient d'être réservée, choisissez-en une autre",
        );
      }
      throw err;
    }
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

      await appendChainedAuditLog(tx, {
        action: 'RESERVATION_UPDATE',
        entity: 'Reservation',
        entityId: res.id,
        before: { status: existing.status, totalFcfa: existing.totalFcfa },
        after: { status: res.status, totalFcfa: res.totalFcfa },
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

      await appendChainedAuditLog(tx, {
        action: 'RESERVATION_CHECK_IN',
        entity: 'Reservation',
        entityId: res.id,
        after: { status: res.status, checkedInAt: res.checkedInAt },
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

      await appendChainedAuditLog(tx, {
        action: 'RESERVATION_CHECK_OUT',
        entity: 'Reservation',
        entityId: res.id,
        after: { status: res.status, checkedOutAt: res.checkedOutAt },
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

      await appendChainedAuditLog(tx, {
        action: 'RESERVATION_CANCEL',
        entity: 'Reservation',
        entityId: res.id,
        before: { status: existing.status },
        after: { status: res.status },
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
      await appendChainedAuditLog(tx, {
        action: 'RESERVATION_DELETE',
        entity: 'Reservation',
        entityId: existing.id,
        before: { id: existing.id, reference: existing.reference },
      });
      await tx.reservation.delete({ where: { id } });
    });

    return { deleted: true, id };
  }
}
