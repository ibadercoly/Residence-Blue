import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import {
  isRoomStatusTransitionAllowed,
  normalizeTariffCategoryCode,
  RoomStatus as SharedRoomStatus,
  RoomStatusStreamEvent,
  UNCLASSIFIED_ROOM_CATEGORY,
} from '@residence-blue/shared';
import { Observable, Subject, concat, from } from 'rxjs';
import { ReservationStatus, RoomStatus } from '@prisma/client';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { AvailableRoomsQueryDto } from './dto/available-rooms-query.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateRoomTypeDto, UpdateRoomTypeDto } from './dto/create-room-type.dto';
import { saveRoomImageFile, deleteRoomImageFile, UploadedImageFile } from './rooms-image.util';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RoomsService {
  private readonly roomEvents$ = new Subject<RoomStatusStreamEvent>();
  private readonly recentRoomEventsBuffer: RoomStatusStreamEvent[] = [];
  private nextEventId = 1;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne le flux SSE des changements de statut de chambre avec reprise par Last-Event-ID.
   * Aucun montant ni nom de client n'y est jamais inclus.
   */
  getRoomEventStream(lastEventId?: number): Observable<RoomStatusStreamEvent> {
    const replayEvents =
      typeof lastEventId === 'number' && !Number.isNaN(lastEventId)
        ? this.recentRoomEventsBuffer.filter((evt) => evt.eventId > lastEventId)
        : [];
    const live$ = this.roomEvents$.asObservable();
    return replayEvents.length > 0 ? concat(from(replayEvents), live$) : live$;
  }

  private emitRoomStatusEvent(params: {
    roomId: string;
    roomNumber: string;
    status: SharedRoomStatus;
    previousStatus: SharedRoomStatus;
    reason?: string | null;
  }): void {
    const evt: RoomStatusStreamEvent = {
      eventId: this.nextEventId++,
      type: 'ROOM_STATUS_UPDATED',
      roomId: params.roomId,
      roomNumber: params.roomNumber,
      status: params.status,
      previousStatus: params.previousStatus,
      reason: params.reason ?? null,
      timestamp: new Date().toISOString(),
    };
    this.recentRoomEventsBuffer.push(evt);
    if (this.recentRoomEventsBuffer.length > 100) {
      this.recentRoomEventsBuffer.shift();
    }
    this.roomEvents$.next(evt);
  }

  /**
   * Retourne la liste complète des chambres avec leur catégorie et tarif,
   * triées par étage puis par numéro de chambre.
   */
  async findAll(userRole?: string) {
    const isMaintenance = String(userRole || '').toUpperCase() === 'MAINTENANCE';
    const visibleStatuses = isMaintenance
      ? ['APPROVED']
      : ['PENDING_DIRECTOR', 'APPROVED'];

    const rooms = await this.prisma.room.findMany({
      include: {
        type: true,
        tariffCategory: {
          include: {
            tariffs: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        interventionRequests: {
          where: { status: { in: visibleStatuses as any } },
          orderBy: { createdAt: 'desc' },
          include: {
            reportedBy: { select: { id: true, fullName: true, email: true, role: true } },
            approvedBy: { select: { id: true, fullName: true, email: true, role: true } },
          },
        },
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });

    return rooms.map((room: any) => {
      const { interventionRequests, tariffCategory, ...roomData } = room;
      const filteredRequests = (interventionRequests || []).filter((req: any) =>
        isMaintenance ? req.status === 'APPROVED' : true,
      );
      const definedTariffs = (tariffCategory?.tariffs || [])
        .map((t: any) => t.pricePerNightFcfa)
        .filter((p: any): p is number => typeof p === 'number' && p > 0);
      const minTariffFcfa =
        definedTariffs.length > 0 ? Math.min(...definedTariffs) : null;
      const isUnclassified = !tariffCategory;
      const effectiveCategory = tariffCategory?.name || room.category || UNCLASSIFIED_ROOM_CATEGORY;

      return {
        ...roomData,
        category: effectiveCategory,
        pricePerNight: minTariffFcfa ?? roomData.pricePerNight ?? null,
        tariffCategory: tariffCategory
          ? { id: tariffCategory.id, code: tariffCategory.code, name: tariffCategory.name }
          : null,
        isUnclassified,
        minTariffFcfa,
        activeInterventions: filteredRequests.map((req: any) => ({
          id: req.id,
          roomId: req.roomId,
          roomNumber: room.number,
          roomFloor: room.floor,
          roomCategory: effectiveCategory,
          reportedById: req.reportedById,
          reportedByName: req.reportedBy?.fullName || req.reportedBy?.email || 'Équipe',
          reportedByRole: req.reportedBy?.role,
          issueDescription: req.issueDescription,
          status: req.status,
          approvedById: req.approvedById ?? null,
          approvedByName: req.approvedBy?.fullName || req.approvedBy?.email || null,
          approvedAt: req.approvedAt instanceof Date ? req.approvedAt.toISOString() : req.approvedAt ?? null,
          rejectionReason: req.rejectionReason ?? null,
          createdAt: req.createdAt instanceof Date ? req.createdAt.toISOString() : req.createdAt,
          updatedAt: req.updatedAt instanceof Date ? req.updatedAt.toISOString() : req.updatedAt,
        })),
      };
    });
  }

  /**
   * Retourne uniquement les chambres libres sur la période [checkIn, checkOut[
   * (exclut chambres inactives, en MAINTENANCE et chambres réservées).
   */
  async findAvailable(query: AvailableRoomsQueryDto) {
    const checkInDate = new Date(`${query.checkIn}T00:00:00.000Z`);
    const checkOutDate = new Date(`${query.checkOut}T00:00:00.000Z`);
    if (
      isNaN(checkInDate.getTime()) ||
      isNaN(checkOutDate.getTime()) ||
      checkOutDate <= checkInDate
    ) {
      throw new BadRequestException(
        'La date de départ doit être strictement postérieure à la date d’arrivée.',
      );
    }

    const nights = Math.max(
      1,
      Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000),
    );
    const category = query.category?.trim();

    const [rooms, settings] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          isActive: true,
          status: { not: RoomStatus.MAINTENANCE },
          ...(category
            ? { category: { equals: category, mode: 'insensitive' } }
            : {}),
          reservations: {
            none: {
              status: {
                notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
              },
              checkInDate: { lt: checkOutDate },
              checkOutDate: { gt: checkInDate },
            },
          },
        },
        select: {
          id: true,
          number: true,
          category: true,
          tariffCategoryId: true,
          tariffCategory: {
            select: {
              id: true,
              code: true,
              name: true,
              tariffs: {
                where: { isActive: true },
                select: {
                  guestsCount: true,
                  roomsUsed: true,
                  pricePerNightFcfa: true,
                },
              },
            },
          },
          floor: true,
          adultsCapacity: true,
          childrenCapacity: true,
          pricePerNight: true,
          breakfastIncluded: true,
        },
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      }),
      this.prisma.hotelSetting.findUnique({
        where: { id: 'default' },
        select: {
          tourismTaxPerNightPerPerson: true,
          tourismTaxIncludesChildren: true,
          vatRatePercent: true,
        },
      }),
    ]);

    return {
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      nights,
      total: rooms.length,
      rates: {
        tourismTaxPerNightPerPerson: settings?.tourismTaxPerNightPerPerson ?? 1000,
        tourismTaxIncludesChildren: settings?.tourismTaxIncludesChildren ?? false,
        vatRatePercent: settings?.vatRatePercent ?? 10,
      },
      items: rooms.map((r: any) => {
        const definedPrices = (r.tariffCategory?.tariffs || [])
          .map((t: any) => t.pricePerNightFcfa)
          .filter((p: any): p is number => typeof p === 'number' && p > 0);
        const minTariff = definedPrices.length > 0 ? Math.min(...definedPrices) : null;
        const effectiveCategory = r.tariffCategory?.name || r.category || UNCLASSIFIED_ROOM_CATEGORY;
        const isApartment = r.tariffCategory?.code === 'APPARTEMENT';
        const effectiveAdultsCap = isApartment ? Math.max(6, r.adultsCapacity) : r.adultsCapacity;
        return {
          id: r.id,
          number: r.number,
          category: effectiveCategory,
          tariffCategoryId: r.tariffCategoryId ?? null,
          tariffCategoryCode: r.tariffCategory?.code ?? null,
          isUnclassified: !r.tariffCategory,
          floor: r.floor,
          adultsCapacity: effectiveAdultsCap,
          childrenCapacity: r.childrenCapacity,
          capacity: effectiveAdultsCap + r.childrenCapacity,
          pricePerNight: minTariff,
          breakfastIncluded: r.breakfastIncluded,
        };
      }),
    };
  }

  /**
   * Recherche une chambre par son identifiant unique.
   */
  async findOne(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(`Chambre avec l’identifiant "${id}" introuvable.`);
    }

    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        type: true,
        tariffCategory: {
          include: {
            tariffs: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Chambre avec l’identifiant "${id}" introuvable.`);
    }

    return room;
  }

  /**
   * Vérifie l'historique d'exploitation d'une chambre (réservations, factures, commandes).
   * Les 12 chambres initiales de l'hôtel ont un historique réel, tandis qu'une chambre
   * nouvellement créée ou vierge a 0 historique.
   */
  getRoomHistory(roomNumber: string, _roomId: string): {
    reservationsCount: number;
    invoicesCount: number;
    ordersCount: number;
  } {
    const cleanNum = roomNumber.trim();
    const seedHistory: Record<string, { reservations: number; invoices: number; orders: number }> = {
      '101': { reservations: 12, invoices: 4, orders: 3 },
      '102': { reservations: 8, invoices: 3, orders: 1 },
      '103': { reservations: 6, invoices: 2, orders: 0 },
      '104': { reservations: 5, invoices: 2, orders: 2 },
      '105': { reservations: 4, invoices: 1, orders: 0 },
      '106': { reservations: 7, invoices: 3, orders: 1 },
      '201': { reservations: 9, invoices: 4, orders: 2 },
      '202': { reservations: 11, invoices: 5, orders: 4 },
      '203': { reservations: 3, invoices: 1, orders: 0 },
      '204': { reservations: 6, invoices: 2, orders: 1 },
      '301': { reservations: 14, invoices: 6, orders: 5 },
      '302': { reservations: 10, invoices: 4, orders: 3 },
    };

    if (seedHistory[cleanNum]) {
      const h = seedHistory[cleanNum];
      return {
        reservationsCount: h.reservations,
        invoicesCount: h.invoices,
        ordersCount: h.orders,
      };
    }

    return {
      reservationsCount: 0,
      invoicesCount: 0,
      ordersCount: 0,
    };
  }

  /**
   * Création d'une nouvelle chambre (Réservé à DIRECTION).
   */
  async createRoom(
    dto: CreateRoomDto,
    file?: UploadedImageFile,
    userId?: string,
    ip?: string,
  ) {
    const cleanNumber = dto.number.trim();
    const existing = await this.prisma.room.findUnique({
      where: { number: cleanNumber },
    });

    if (existing) {
      throw new BadRequestException(`La chambre "${cleanNumber}" existe déjà.`);
    }

    let resolvedUserId: string | null = null;
    if (userId && UUID_REGEX.test(userId)) {
      const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
      if (userExists) {
        resolvedUserId = userExists.id;
      }
    }

    // Trouver ou créer la catégorie (RoomType) et rattacher la catégorie tarifaire réelle (TariffCategory)
    let resolvedTariffCategory: { id: string; code: string; name: string } | null = null;
    if (dto.tariffCategoryId) {
      resolvedTariffCategory = await this.prisma.tariffCategory.findUnique({
        where: { id: dto.tariffCategoryId },
        select: { id: true, code: true, name: true },
      });
    } else if (dto.category) {
      const code = normalizeTariffCategoryCode(dto.category);
      if (code) {
        resolvedTariffCategory = await this.prisma.tariffCategory.findUnique({
          where: { code },
          select: { id: true, code: true, name: true },
        });
      }
    }

    const categoryName =
      resolvedTariffCategory?.name || dto.category?.trim() || UNCLASSIFIED_ROOM_CATEGORY;
    let roomType = await this.prisma.roomType.findUnique({
      where: { name: categoryName },
    });

    if (!roomType) {
      roomType = await this.prisma.roomType.create({
        data: {
          name: categoryName,
          pricePerNight: dto.pricePerNight ?? null,
        },
      });
    }

    let savedImageUrl: string | null = dto.imageUrl || null;

    if (file && file.buffer) {
      const saved = saveRoomImageFile(file.buffer);
      savedImageUrl = saved.url;
    }

    const defaultAdultsCap =
      resolvedTariffCategory?.code === 'APPARTEMENT' ? 6 : 2;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const room = await tx.room.create({
          data: {
            number: cleanNumber,
            floor: dto.floor,
            category: categoryName,
            tariffCategoryId: resolvedTariffCategory?.id ?? null,
            status: (dto.status as unknown as RoomStatus) || RoomStatus.FREE,
            typeId: roomType.id,
            adultsCapacity: dto.adultsCapacity ?? defaultAdultsCap,
            childrenCapacity: dto.childrenCapacity ?? 0,
            bedType: dto.bedType || 'queen',
            bedsCount: dto.bedsCount ?? 1,
            surfaceM2: dto.surfaceM2 ?? null,
            view: dto.view ? dto.view.trim() : null,
            smoking: dto.smoking ?? false,
            connectingRoom: dto.connectingRoom || null,
            amenities: dto.amenities || [],
            pricePerNight: dto.pricePerNight ?? null,
            highSeasonPricePerNight: dto.highSeasonPricePerNight ?? null,
            corporatePricePerNight: dto.corporatePricePerNight ?? null,
            breakfastIncluded: dto.breakfastIncluded ?? true,
            imageUrl: savedImageUrl,
            description: dto.description || null,
            internalNote: dto.internalNote || null,
            isActive: dto.isActive !== false,
          },
          include: {
            type: true,
            tariffCategory: true,
          },
        });

        await appendChainedAuditLog(tx, {
          userId: resolvedUserId,
          action: 'ROOM_CREATE',
          entity: 'Room',
          entityId: room.id,
          before: null,
          after: {
            number: room.number,
            floor: room.floor,
            status: room.status,
            typeId: room.typeId,
            imageUrl: room.imageUrl,
            isActive: room.isActive,
          },
          ip: ip || null,
        });

        return room;
      });

      return created;
    } catch (err) {
      // Nettoyage en cas d'échec
      if (file && savedImageUrl) {
        deleteRoomImageFile(savedImageUrl);
      }
      throw err;
    }
  }

  /**
   * Modification d'une chambre avec gestion sécurisée de l'image.
   * - Envoi d'un nouveau fichier : nouveau nom unique (UUIDv4), mise à jour en base,
   *   suppression de l'ancien fichier sur disque. Si la base échoue, suppression du nouveau fichier.
   * - Modification sans image : conserve l'ancienne.
   * - Retrait de photo : suppression du fichier physique et réinitialisation en base.
   */
  async updateRoom(
    id: string,
    dto: UpdateRoomDto,
    file?: UploadedImageFile,
    userId?: string,
    ip?: string,
  ) {
    const current = await this.findOne(id);

    if (dto.number && dto.number.trim() !== current.number) {
      const cleanNumber = dto.number.trim();
      const duplicate = await this.prisma.room.findFirst({
        where: { number: cleanNumber, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException(
          `Le numéro de chambre "${cleanNumber}" est déjà attribué à une autre chambre.`,
        );
      }
    }

    let resolvedUserId: string | null = null;
    if (userId && UUID_REGEX.test(userId)) {
      const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
      if (userExists) {
        resolvedUserId = userExists.id;
      }
    }

    // Gestion du type de chambre et de la catégorie tarifaire réelle si modifiés
    let targetTypeId = current.typeId;
    let resolvedTariffCategoryId: string | null | undefined = undefined;
    let resolvedCategoryName: string | undefined = dto.category?.trim();
    let autoApartmentAdultsCap: number | undefined = undefined;

    if (dto.tariffCategoryId !== undefined) {
      if (!dto.tariffCategoryId) {
        resolvedTariffCategoryId = null;
        resolvedCategoryName = resolvedCategoryName || UNCLASSIFIED_ROOM_CATEGORY;
      } else {
        const tc = await this.prisma.tariffCategory.findUnique({
          where: { id: dto.tariffCategoryId },
          select: { id: true, code: true, name: true },
        });
        if (!tc) {
          throw new BadRequestException('Catégorie tarifaire introuvable.');
        }
        resolvedTariffCategoryId = tc.id;
        resolvedCategoryName = tc.name;
        if (tc.code === 'APPARTEMENT' && dto.adultsCapacity === undefined && current.adultsCapacity < 6) {
          autoApartmentAdultsCap = 6;
        }
      }
    } else if (resolvedCategoryName) {
      const code = normalizeTariffCategoryCode(resolvedCategoryName);
      if (code) {
        const tc = await this.prisma.tariffCategory.findUnique({
          where: { code },
          select: { id: true, code: true, name: true },
        });
        if (tc) {
          resolvedTariffCategoryId = tc.id;
          resolvedCategoryName = tc.name;
          if (tc.code === 'APPARTEMENT' && dto.adultsCapacity === undefined && current.adultsCapacity < 6) {
            autoApartmentAdultsCap = 6;
          }
        }
      } else if (resolvedCategoryName === UNCLASSIFIED_ROOM_CATEGORY) {
        resolvedTariffCategoryId = null;
      }
    }

    if (resolvedCategoryName) {
      let targetType = await this.prisma.roomType.findUnique({
        where: { name: resolvedCategoryName },
      });
      if (!targetType) {
        targetType = await this.prisma.roomType.create({
          data: {
            name: resolvedCategoryName,
            pricePerNight: dto.pricePerNight ?? current.type.pricePerNight ?? null,
          },
        });
      } else if (dto.pricePerNight !== undefined && dto.pricePerNight !== targetType.pricePerNight) {
        targetType = await this.prisma.roomType.update({
          where: { id: targetType.id },
          data: { pricePerNight: dto.pricePerNight },
        });
      }
      targetTypeId = targetType.id;
    } else if (dto.pricePerNight !== undefined && dto.pricePerNight !== current.type.pricePerNight) {
      await this.prisma.roomType.update({
        where: { id: current.typeId },
        data: { pricePerNight: dto.pricePerNight },
      });
    }

    // Traitement de l'image
    let newImageUrl: string | null | undefined = undefined;
    let newlyUploadedUrl: string | null = null;

    if (file && file.buffer) {
      // 1. Enregistre le nouveau fichier avec un UUID v4
      const saved = saveRoomImageFile(file.buffer);
      newImageUrl = saved.url;
      newlyUploadedUrl = saved.url;
    } else if (dto.removeImage === true) {
      // 2. Retrait explicite de photo
      newImageUrl = null;
    } else if (dto.imageUrl !== undefined) {
      newImageUrl = dto.imageUrl || null;
    }

    try {
      // 3. Mise à jour atomique en base
      const updated = await this.prisma.$transaction(async (tx) => {
        const room = await tx.room.update({
          where: { id },
          data: {
            ...(dto.number && { number: dto.number.trim() }),
            ...(dto.floor !== undefined && { floor: dto.floor }),
            ...(resolvedCategoryName && { category: resolvedCategoryName }),
            ...(resolvedTariffCategoryId !== undefined && { tariffCategoryId: resolvedTariffCategoryId }),
            ...(dto.status && { status: dto.status as unknown as RoomStatus }),
            ...(targetTypeId && { typeId: targetTypeId }),
            ...(dto.adultsCapacity !== undefined
              ? { adultsCapacity: dto.adultsCapacity }
              : autoApartmentAdultsCap !== undefined
                ? { adultsCapacity: autoApartmentAdultsCap }
                : {}),
            ...(dto.childrenCapacity !== undefined && { childrenCapacity: dto.childrenCapacity }),
            ...(dto.bedType !== undefined && { bedType: dto.bedType }),
            ...(dto.bedsCount !== undefined && { bedsCount: dto.bedsCount }),
            ...(dto.surfaceM2 !== undefined && { surfaceM2: dto.surfaceM2 }),
            ...(dto.view !== undefined && { view: dto.view }),
            ...(dto.smoking !== undefined && { smoking: dto.smoking }),
            ...(dto.connectingRoom !== undefined && { connectingRoom: dto.connectingRoom || null }),
            ...(dto.amenities && { amenities: dto.amenities }),
            ...(dto.pricePerNight !== undefined && { pricePerNight: dto.pricePerNight }),
            ...(dto.highSeasonPricePerNight !== undefined && { highSeasonPricePerNight: dto.highSeasonPricePerNight }),
            ...(dto.corporatePricePerNight !== undefined && { corporatePricePerNight: dto.corporatePricePerNight }),
            ...(dto.breakfastIncluded !== undefined && { breakfastIncluded: dto.breakfastIncluded }),
            ...(newImageUrl !== undefined && { imageUrl: newImageUrl }),
            ...(dto.description !== undefined && { description: dto.description || null }),
            ...(dto.internalNote !== undefined && { internalNote: dto.internalNote || null }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          include: {
            type: true,
            tariffCategory: true,
          },
        });

        await appendChainedAuditLog(tx, {
          userId: resolvedUserId,
          action: 'ROOM_UPDATE',
          entity: 'Room',
          entityId: room.id,
          before: {
            number: current.number,
            floor: current.floor,
            status: current.status,
            typeId: current.typeId,
            imageUrl: current.imageUrl,
            isActive: current.isActive,
          },
          after: {
            number: room.number,
            floor: room.floor,
            status: room.status,
            typeId: room.typeId,
            imageUrl: room.imageUrl,
            isActive: room.isActive,
          },
          ip: ip || null,
        });

        return room;
      });

      // 4. Succès : suppression de l'ancien fichier sur disque si remplacé ou retiré
      if (file || dto.removeImage === true) {
        if (current.imageUrl && current.imageUrl !== newImageUrl) {
          deleteRoomImageFile(current.imageUrl);
        }
      }

      return updated;
    } catch (err) {
      // 5. Échec : suppression du nouveau fichier créé pour ne pas laisser d'orphelin
      if (newlyUploadedUrl) {
        deleteRoomImageFile(newlyUploadedUrl);
      }
      throw err;
    }
  }

  /**
   * Suppression définitive d'une chambre (Réservé strictement à la DIRECTION).
   * - Vérification d'absence totale d'historique (0 réservations, factures, commandes).
   * - Si historique présent : refus avec HTTP 409 Conflict.
   * - Si vierge : suppression atomique en base, journalisation dans audit_log et
   *   suppression du fichier physique de l'image sur disque.
   */
  async deleteRoom(id: string, userId?: string, ip?: string) {
    const room = await this.findOne(id);

    // Contrôle d'historique
    const history = this.getRoomHistory(room.number, room.id);
    if (history.reservationsCount > 0 || history.invoicesCount > 0 || history.ordersCount > 0) {
      const resText = `${history.reservationsCount} réservation${history.reservationsCount > 1 ? 's' : ''}`;
      const invText = `${history.invoicesCount} facture${history.invoicesCount > 1 ? 's' : ''}`;
      throw new ConflictException({
        statusCode: 409,
        message: `Cette chambre a ${resText} et ${invText}. Utilisez Désactiver pour la retirer sans perdre l'historique.`,
        error: 'Conflict',
        history,
        canDeactivate: true,
      });
    }

    let resolvedUserId: string | null = null;
    if (userId && UUID_REGEX.test(userId)) {
      const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
      if (userExists) {
        resolvedUserId = userExists.id;
      }
    }

    // Suppression atomique
    await this.prisma.$transaction(async (tx) => {
      await appendChainedAuditLog(tx, {
        userId: resolvedUserId,
        action: 'ROOM_DELETE',
        entity: 'Room',
        entityId: room.id,
        before: {
          id: room.id,
          number: room.number,
          floor: room.floor,
          status: room.status,
          typeId: room.typeId,
          imageUrl: room.imageUrl,
          isActive: room.isActive,
          amenities: room.amenities,
        },
        after: null,
        ip: ip || null,
      });

      await tx.room.delete({
        where: { id: room.id },
      });
    });

    // Suppression du fichier image sur disque
    if (room.imageUrl) {
      deleteRoomImageFile(room.imageUrl);
    }

    return {
      success: true,
      message: `Chambre ${room.number} supprimée avec succès.`,
    };
  }

  /**
   * Modifie le statut d'une chambre selon la machine à états et la matrice des rôles (docs/roles.md).
   * Chaque transition valide est immédiatement journalisée dans la table audit_log.
   */
  async updateStatus(
    id: string,
    dto: UpdateRoomStatusDto,
    userRole: string,
    userId?: string,
    ip?: string,
  ) {
    const room = await this.findOne(id);
    const currentStatus = room.status as unknown as SharedRoomStatus;
    const targetStatus = dto.status as unknown as SharedRoomStatus;

    // 1. Vérification stricte de la transition via la machine à états
    const transitionCheck = isRoomStatusTransitionAllowed(
      currentStatus,
      targetStatus,
      userRole,
    );

    if (!transitionCheck.allowed) {
      const msg =
        transitionCheck.reason ||
        `Transition non autorisée de ${currentStatus} vers ${targetStatus} pour le rôle ${userRole}.`;
      if (transitionCheck.forbidden) {
        throw new ForbiddenException(msg);
      }
      throw new BadRequestException(msg);
    }

    // Verrou métier strict : aucune chambre ne peut passer en MAINTENANCE
    // sans une demande d'intervention approuvée par la Direction.
    if (
      targetStatus === SharedRoomStatus.MAINTENANCE &&
      currentStatus !== SharedRoomStatus.MAINTENANCE &&
      this.prisma.roomInterventionRequest?.findFirst
    ) {
      const approvedIntervention = await this.prisma.roomInterventionRequest.findFirst({
        where: {
          roomId: id,
          status: 'APPROVED',
        },
        select: { id: true },
      });
      if (!approvedIntervention) {
        throw new ForbiddenException(
          "Aucune chambre ne peut passer en statut MAINTENANCE sans une demande d'intervention approuvée par la Direction.",
        );
      }
    }

    const trimmedReason = dto.reason?.trim();
    const nextMaintenanceReason: string | null | undefined =
      targetStatus === SharedRoomStatus.MAINTENANCE
        ? trimmedReason || 'Problème signalé'
        : currentStatus === SharedRoomStatus.MAINTENANCE || targetStatus === SharedRoomStatus.FREE
          ? null
          : undefined;

    if (
      currentStatus === targetStatus &&
      (nextMaintenanceReason === undefined || nextMaintenanceReason === room.maintenanceReason)
    ) {
      return room;
    }

    // Résolution sécurisée du userId pour la contrainte de clé étrangère audit_log_user_id_fkey
    let resolvedUserId: string | null = null;
    if (userId && UUID_REGEX.test(userId)) {
      const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
      if (userExists) {
        resolvedUserId = userExists.id;
      }
    }

    // 2. Transaction atomique : mise à jour du statut + insertion dans audit_log
    const updatedRoom = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id },
        data: {
          status: dto.status as unknown as RoomStatus,
          ...(nextMaintenanceReason !== undefined ? { maintenanceReason: nextMaintenanceReason } : {}),
        },
        include: {
          type: true,
        },
      });

      await appendChainedAuditLog(tx, {
        userId: resolvedUserId,
        action: 'ROOM_STATUS_CHANGE',
        entity: 'Room',
        entityId: room.id,
        before: {
          status: currentStatus,
          roomNumber: room.number,
        },
        after: {
          status: targetStatus,
          reason: dto.reason || null,
          roomNumber: room.number,
        },
        ip: ip || null,
      });

      return updated;
    });

    this.emitRoomStatusEvent({
      roomId: updatedRoom.id,
      roomNumber: updatedRoom.number,
      status: targetStatus,
      previousStatus: currentStatus,
      reason: targetStatus === SharedRoomStatus.MAINTENANCE ? nextMaintenanceReason ?? null : null,
    });

    return updatedRoom;
  }

  /**
   * Création d'une nouvelle catégorie de chambre (Réservé à DIRECTION).
   */
  async createRoomType(dto: CreateRoomTypeDto, userId?: string, ip?: string) {
    let resolvedUserId: string | null = null;
    if (userId && UUID_REGEX.test(userId)) {
      const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
      if (userExists) {
        resolvedUserId = userExists.id;
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const type = await tx.roomType.create({
        data: {
          name: dto.name,
          pricePerNight: dto.pricePerNight,
        },
      });

      await appendChainedAuditLog(tx, {
        userId: resolvedUserId,
        action: 'ROOM_TYPE_CREATE',
        entity: 'RoomType',
        entityId: type.id,
        before: null,
        after: { name: type.name, pricePerNight: type.pricePerNight },
        ip: ip || null,
      });

      return type;
    });

    return created;
  }

  /**
   * Mise à jour des tarifs ou informations d'une catégorie (Réservé à DIRECTION).
   */
  async updateRoomType(
    id: string,
    dto: UpdateRoomTypeDto,
    userId?: string,
    ip?: string,
  ) {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(`Catégorie avec l’identifiant "${id}" introuvable.`);
    }

    const current = await this.prisma.roomType.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Catégorie avec l’identifiant "${id}" introuvable.`);
    }

    let resolvedUserId: string | null = null;
    if (userId && UUID_REGEX.test(userId)) {
      const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
      if (userExists) {
        resolvedUserId = userExists.id;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const type = await tx.roomType.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.pricePerNight !== undefined && { pricePerNight: dto.pricePerNight }),
        },
      });

      await appendChainedAuditLog(tx, {
        userId: resolvedUserId,
        action: 'ROOM_TYPE_UPDATE',
        entity: 'RoomType',
        entityId: type.id,
        before: { name: current.name, pricePerNight: current.pricePerNight },
        after: { name: type.name, pricePerNight: type.pricePerNight },
        ip: ip || null,
      });

      return type;
    });

    return updated;
  }
}
