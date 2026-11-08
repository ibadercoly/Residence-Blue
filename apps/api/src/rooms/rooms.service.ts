import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isRoomStatusTransitionAllowed,
  RoomStatus as SharedRoomStatus,
} from '@residence-blue/shared';
import { Prisma, RoomStatus } from '@prisma/client';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { CreateRoomTypeDto, UpdateRoomTypeDto } from './dto/create-room-type.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne la liste complète des chambres avec leur catégorie et tarif,
   * triées par étage puis par numéro de chambre.
   */
  async findAll() {
    return this.prisma.room.findMany({
      include: {
        type: true,
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
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
      },
    });

    if (!room) {
      throw new NotFoundException(`Chambre avec l’identifiant "${id}" introuvable.`);
    }

    return room;
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
      throw new BadRequestException(
        transitionCheck.reason ||
          `Transition non autorisée de ${currentStatus} vers ${targetStatus} pour le rôle ${userRole}.`,
      );
    }

    // Si le statut est identique, aucun changement nécessaire
    if (currentStatus === targetStatus) {
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
        },
        include: {
          type: true,
        },
      });

      // Journalisation obligatoire dans audit_log (ajout seul)
      await tx.auditLog.create({
        data: {
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
        },
      });

      return updated;
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

      await tx.auditLog.create({
        data: {
          userId: resolvedUserId,
          action: 'ROOM_TYPE_CREATE',
          entity: 'RoomType',
          entityId: type.id,
          before: Prisma.JsonNull,
          after: { name: type.name, pricePerNight: type.pricePerNight },
          ip: ip || null,
        },
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

      await tx.auditLog.create({
        data: {
          userId: resolvedUserId,
          action: 'ROOM_TYPE_UPDATE',
          entity: 'RoomType',
          entityId: type.id,
          before: { name: current.name, pricePerNight: current.pricePerNight },
          after: { name: type.name, pricePerNight: type.pricePerNight },
          ip: ip || null,
        },
      });

      return type;
    });

    return updated;
  }
}
