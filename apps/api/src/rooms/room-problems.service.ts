import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateRoomProblemDto,
  isProblemAwaitingDirectorApproval,
  isProblemTypeBlockingByDefault,
  Role,
  ROOM_PROBLEM_TYPE_META,
  RoomProblemDto,
  RoomProblemStatus,
  RoomProblemType,
} from '@residence-blue/shared';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RoomStatus } from '@prisma/client';
import { ResolveRoomProblemDto } from './dto/resolve-room-problem.dto';
import { CancelRoomProblemDto } from './dto/cancel-room-problem.dto';
import { UpdateRoomCleanlinessDto } from './dto/update-room-cleanliness.dto';

@Injectable()
export class RoomProblemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  public formatProblem(p: any, isCurrentlyOccupied?: boolean): RoomProblemDto {
    return {
      id: p.id,
      roomId: p.roomId,
      roomNumber: p.room?.number || '',
      roomFloor: p.room?.floor,
      roomCategory: p.room?.category,
      type: p.type as RoomProblemType,
      description: p.description,
      reportedByRole: p.reportedByRole,
      reportedByName: p.reportedByName,
      reportedAt: p.reportedAt instanceof Date ? p.reportedAt.toISOString() : p.reportedAt,
      wasOccupied: p.wasOccupied,
      blocksRental: p.blocksRental,
      status: p.status as RoomProblemStatus,
      assignedToName: p.assignedToName,
      acknowledgedAt: p.acknowledgedAt instanceof Date ? p.acknowledgedAt.toISOString() : p.acknowledgedAt,
      resolvedByName: p.resolvedByName,
      resolvedAt: p.resolvedAt instanceof Date ? p.resolvedAt.toISOString() : p.resolvedAt,
      resolutionNote: p.resolutionNote,
      cancelledByName: p.cancelledByName,
      cancelledAt: p.cancelledAt instanceof Date ? p.cancelledAt.toISOString() : p.cancelledAt,
      cancellationReason: p.cancellationReason,
      isCurrentlyOccupied: isCurrentlyOccupied !== undefined ? isCurrentlyOccupied : (p.room?.status === RoomStatus.OCCUPIED),
      directorApproved: Boolean(p.directorApproved),
      approvedByDirectorName: p.approvedByDirectorName || null,
      approvedByDirectorAt: p.approvedByDirectorAt instanceof Date ? p.approvedByDirectorAt.toISOString() : p.approvedByDirectorAt || null,
    };
  }

  async reportProblem(
    roomId: string,
    dto: CreateRoomProblemDto,
    user: any,
    ip?: string,
  ): Promise<RoomProblemDto> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        reservations: {
          where: { status: 'CHECKED_IN' },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Chambre "${roomId}" introuvable.`);
    }

    const userRole = String(user?.role || '').toUpperCase();
    const isHousekeeping = userRole === Role.HOUSEKEEPING;

    // Règle 4 : Le ménage n'a pas le choix du blocage. Le serveur applique le blocage par défaut.
    // Directeur, réception et technicien peuvent spécifier ou surcharger le blocage.
    let blocksRental = isProblemTypeBlockingByDefault(dto.type);
    if (!isHousekeeping && dto.blocksRental !== undefined) {
      blocksRental = dto.blocksRental;
    }

    const isCurrentlyOccupied = room.status === RoomStatus.OCCUPIED || room.reservations.length > 0;
    const reportedByName = user?.fullName || user?.email || 'Équipe';
    const isDirector = userRole === Role.DIRECTION;

    // Règle d'accord préalable de la direction :
    // Même si un membre du personnel (cuisinier, assistant/réceptionniste, gouvernante, technicien) signale
    // une panne majeure dans une chambre, l'équipe technique ne peut pas venir ni réparer la chambre sans
    // l'autorisation préalable expresse du directeur. Le caractère majeur dépend de la nature de la panne :
    // retirer le blocage de la location (« chambre louable malgré ce problème ») ne l'autorise pas.
    // Si la panne est signalée par le directeur lui-même, elle est directement autorisée.
    // Une panne mineure (simple ampoule) n'exige pas l'accord du directeur.
    const isMajor = isProblemTypeBlockingByDefault(dto.type);
    const directorApproved = isDirector || !isMajor;
    const approvedByDirectorId = isDirector ? (user?.id || null) : null;
    const approvedByDirectorName = isDirector ? reportedByName : null;
    const approvedByDirectorAt = isDirector ? new Date() : null;

    const reporterRoleLabel =
      userRole === Role.HOUSEKEEPING
        ? 'le ménage'
        : userRole === Role.RECEPTION
          ? 'la réception'
          : userRole === Role.DIRECTION
            ? 'la direction'
            : userRole === Role.RESTAURANT
              ? 'la cuisine/restaurant'
              : 'l’équipe technique';

    const result = await this.prisma.$transaction(async (tx) => {
      const problem = await tx.roomProblem.create({
        data: {
          roomId: room.id,
          type: dto.type,
          description: dto.description?.trim() || null,
          reportedByUserId: user?.id || null,
          reportedByRole: userRole || Role.HOUSEKEEPING,
          reportedByName,
          wasOccupied: isCurrentlyOccupied,
          blocksRental,
          status: 'REPORTED',
          directorApproved,
          approvedByDirectorId,
          approvedByDirectorName,
          approvedByDirectorAt,
        },
        include: { room: true },
      });

      // Règle 1 & 2 :
      // - Si chambre libre : un problème qui empêche la location la met « Hors service » (MAINTENANCE).
      // - Si chambre occupée : elle reste OCCUPÉE, le client reste logé.
      if (blocksRental && !isCurrentlyOccupied) {
        await tx.room.update({
          where: { id: room.id },
          data: {
            status: RoomStatus.MAINTENANCE,
            maintenanceReason: dto.description?.trim() || ROOM_PROBLEM_TYPE_META[dto.type]?.label || 'Problème technique',
          },
        });
      }

      await appendChainedAuditLog(tx, {
        action: 'ROOM_PROBLEM_REPORTED',
        entity: 'RoomProblem',
        entityId: problem.id,
        userId: user?.id,
        ip,
        after: {
          roomId: room.id,
          roomNumber: room.number,
          type: problem.type,
          blocksRental: problem.blocksRental,
          wasOccupied: problem.wasOccupied,
        },
      });

      return problem;
    });

    const typeLabel = ROOM_PROBLEM_TYPE_META[dto.type]?.label || dto.type;
    if (isMajor && !directorApproved) {
      // Alerte spéciale : accord préalable de la direction requis avant toute intervention technique
      await this.notificationsService.createNotification({
        category: 'MAINTENANCE',
        type: 'ACCORD_DIRECTEUR_REQUIS',
        severity: 'CRITICAL',
        title: `Chambre ${room.number} : accord directeur requis pour panne majeure (${typeLabel.toLowerCase()})`,
        detail: `Panne majeure signalée par ${reporterRoleLabel}. L'intervention technique est bloquée jusqu'à votre autorisation préalable.`,
        roomNumber: room.number,
        link: '/technique',
        importantAlert: true,
      });
    } else {
      const notifTitle = `Chambre ${room.number} : ${typeLabel.toLowerCase()} en panne, signalée par ${reporterRoleLabel}`;
      await this.notificationsService.createNotification({
        category: 'MAINTENANCE',
        type: 'PANNE_SIGNALEE',
        severity: blocksRental ? 'CRITICAL' : 'WARNING',
        title: notifTitle,
        detail: isCurrentlyOccupied ? 'Client présent : prévenir avant d’entrer' : 'Chambre vide : vous pouvez entrer',
        roomNumber: room.number,
        link: '/chambres',
        importantAlert: blocksRental,
      });
    }

    return this.formatProblem(result, isCurrentlyOccupied);
  }

  async getProblemsForRoom(roomId: string): Promise<RoomProblemDto[]> {
    const problems = await this.prisma.roomProblem.findMany({
      where: { roomId },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });
    return problems.map((p) => this.formatProblem(p));
  }

  async getAllOpenProblems(): Promise<RoomProblemDto[]> {
    const problems = await this.prisma.roomProblem.findMany({
      where: { status: { in: ['REPORTED', 'IN_PROGRESS'] } },
      include: { room: true },
      orderBy: { createdAt: 'asc' },
    });
    return problems.map((p) => this.formatProblem(p));
  }

  async acknowledgeProblem(problemId: string, user: any, ip?: string): Promise<RoomProblemDto> {
    const problem = await this.prisma.roomProblem.findUnique({
      where: { id: problemId },
      include: { room: true },
    });

    if (!problem) {
      throw new NotFoundException(`Problème "${problemId}" introuvable.`);
    }

    if (problem.status !== 'REPORTED') {
      throw new ConflictException(
        `Seul un problème au statut « Signalé » peut être pris en charge (actuellement : ${problem.status}).`,
      );
    }

    // Règle d'accord préalable de la direction : même si le cuisinier, l'assistant, le ménage ou la
    // réception a signalé la panne, le technicien ne vient pas sans l'accord exprès du directeur.
    if (isProblemAwaitingDirectorApproval(problem)) {
      throw new ConflictException(
        `Intervention non autorisée : l'accord préalable du directeur est requis pour intervenir sur cette panne majeure en chambre ${problem.room.number}.`,
      );
    }

    const assignedToName = user?.fullName || user?.email || 'Technicien';
    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.roomProblem.update({
        where: { id: problemId },
        data: {
          status: 'IN_PROGRESS',
          assignedToUserId: user?.id || null,
          assignedToName,
          acknowledgedAt: new Date(),
        },
        include: { room: true },
      });

      await appendChainedAuditLog(tx, {
        action: 'ROOM_PROBLEM_ACKNOWLEDGED',
        entity: 'RoomProblem',
        entityId: p.id,
        userId: user?.id,
        ip,
        before: { status: problem.status },
        after: { status: p.status, assignedToName },
      });

      return p;
    });

    await this.notificationsService.createNotification({
      category: 'MAINTENANCE',
      type: 'PANNE_PRISE_EN_CHARGE',
      severity: 'INFO',
      title: `Chambre ${problem.room.number} : le technicien s'en occupe`,
      detail: `Pris en charge par ${assignedToName}`,
      roomNumber: problem.room.number,
      link: '/chambres',
      importantAlert: false,
    });

    return this.formatProblem(updated);
  }

  async resolveProblem(
    problemId: string,
    dto: ResolveRoomProblemDto,
    user: any,
    ip?: string,
  ): Promise<RoomProblemDto> {
    const problem = await this.prisma.roomProblem.findUnique({
      where: { id: problemId },
      include: { room: true },
    });

    if (!problem) {
      throw new NotFoundException(`Problème "${problemId}" introuvable.`);
    }

    if (problem.status === 'RESOLVED' || problem.status === 'CANCELLED') {
      throw new ConflictException(
        `Ce problème a déjà été clos au statut « ${problem.status} » et ne peut plus être modifié.`,
      );
    }

    if (isProblemAwaitingDirectorApproval(problem)) {
      throw new ConflictException(
        `Impossible de clore cette panne majeure sans l'autorisation préalable du directeur.`,
      );
    }

    const resolvedByName = user?.fullName || user?.email || 'Technicien';
    const isCurrentlyOccupied = problem.room.status === RoomStatus.OCCUPIED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.roomProblem.update({
        where: { id: problemId },
        data: {
          status: 'RESOLVED',
          resolvedByUserId: user?.id || null,
          resolvedByName,
          resolvedAt: new Date(),
          resolutionNote: dto.resolutionNote?.trim() || null,
        },
        include: { room: true },
      });

      // Règle 88 : une chambre redevient louable automatiquement quand son dernier problème bloquant est réparé
      const remainingBlocking = await tx.roomProblem.count({
        where: {
          roomId: problem.roomId,
          id: { not: problem.id },
          status: { in: ['REPORTED', 'IN_PROGRESS'] },
          blocksRental: true,
        },
      });

      if (remainingBlocking === 0) {
        if (!isCurrentlyOccupied) {
          // Si chambre propre -> FREE, si chambre sale -> CLEANING
          const nextStatus = problem.room.isClean ? RoomStatus.FREE : RoomStatus.CLEANING;
          await tx.room.update({
            where: { id: problem.roomId },
            data: {
              status: nextStatus,
              maintenanceReason: null,
            },
          });
        }
      }

      await appendChainedAuditLog(tx, {
        action: 'ROOM_PROBLEM_RESOLVED',
        entity: 'RoomProblem',
        entityId: p.id,
        userId: user?.id,
        ip,
        before: { status: problem.status },
        after: {
          status: p.status,
          resolvedByName,
          resolutionNote: p.resolutionNote,
          remainingBlockingProblems: remainingBlocking,
        },
      });

      return p;
    });

    const typeLabel = ROOM_PROBLEM_TYPE_META[problem.type]?.label || problem.type;
    const notifTitle = isCurrentlyOccupied
      ? `Chambre ${problem.room.number} : ${typeLabel.toLowerCase()} réparée (client toujours présent)`
      : `Chambre ${problem.room.number} : ${typeLabel.toLowerCase()} réparée, chambre de nouveau louable`;

    await this.notificationsService.createNotification({
      category: 'MAINTENANCE',
      type: 'PANNE_REPAREE',
      severity: 'SUCCESS',
      title: notifTitle,
      detail: dto.resolutionNote?.trim() || 'Intervention terminée.',
      roomNumber: problem.room.number,
      link: '/chambres',
      importantAlert: false,
    });

    return this.formatProblem(updated, isCurrentlyOccupied);
  }

  async cancelProblem(
    problemId: string,
    dto: CancelRoomProblemDto,
    user: any,
    ip?: string,
  ): Promise<RoomProblemDto> {
    const reason = (dto?.cancellationReason || '').trim();
    if (!reason) {
      throw new BadRequestException("Le motif d'annulation est obligatoire.");
    }
    const problem = await this.prisma.roomProblem.findUnique({
      where: { id: problemId },
      include: { room: true },
    });

    if (!problem) {
      throw new NotFoundException(`Problème "${problemId}" introuvable.`);
    }

    if (problem.status === 'RESOLVED' || problem.status === 'CANCELLED') {
      throw new ConflictException(
        `Ce problème a déjà été clos au statut « ${problem.status} » et ne peut plus être annulé.`,
      );
    }

    const cancelledByName = user?.fullName || user?.email || 'Direction';
    const isCurrentlyOccupied = problem.room.status === RoomStatus.OCCUPIED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.roomProblem.update({
        where: { id: problemId },
        data: {
          status: 'CANCELLED',
          cancelledByUserId: user?.id || null,
          cancelledByName,
          cancelledAt: new Date(),
          cancellationReason: dto.cancellationReason.trim(),
        },
        include: { room: true },
      });

      // Si ce problème était bloquant, vérifier si d'autres problèmes bloquants subsistent
      if (problem.blocksRental) {
        const remainingBlocking = await tx.roomProblem.count({
          where: {
            roomId: problem.roomId,
            id: { not: problem.id },
            status: { in: ['REPORTED', 'IN_PROGRESS'] },
            blocksRental: true,
          },
        });

        if (remainingBlocking === 0 && !isCurrentlyOccupied) {
          const nextStatus = problem.room.isClean ? RoomStatus.FREE : RoomStatus.CLEANING;
          await tx.room.update({
            where: { id: problem.roomId },
            data: {
              status: nextStatus,
              maintenanceReason: null,
            },
          });
        }
      }

      await appendChainedAuditLog(tx, {
        action: 'ROOM_PROBLEM_CANCELLED',
        entity: 'RoomProblem',
        entityId: p.id,
        userId: user?.id,
        ip,
        before: { status: problem.status },
        after: {
          status: p.status,
          cancelledByName,
          cancellationReason: p.cancellationReason,
        },
      });

      return p;
    });

    return this.formatProblem(updated, isCurrentlyOccupied);
  }

  async toggleBlocking(problemId: string, user: any, ip?: string): Promise<RoomProblemDto> {
    const problem = await this.prisma.roomProblem.findUnique({
      where: { id: problemId },
      include: { room: true },
    });

    if (!problem) {
      throw new NotFoundException(`Problème "${problemId}" introuvable.`);
    }

    if (problem.status === 'RESOLVED' || problem.status === 'CANCELLED') {
      throw new ConflictException(
        `Impossible de modifier le blocage d’un problème clos (${problem.status}).`,
      );
    }

    const nextBlocksRental = !problem.blocksRental;
    const isCurrentlyOccupied = problem.room.status === RoomStatus.OCCUPIED;

    // « Chambre louable malgré ce problème » ne vaut PAS accord de réparation :
    // l'autorisation du directeur reste requise pour toute panne majeure, même non bloquante.
    // Ce basculement ne modifie donc jamais directorApproved ni ses métadonnées.
    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.roomProblem.update({
        where: { id: problemId },
        data: { blocksRental: nextBlocksRental },
        include: { room: true },
      });

      if (!isCurrentlyOccupied) {
        if (nextBlocksRental) {
          // Devient bloquant -> passe en MAINTENANCE
          await tx.room.update({
            where: { id: problem.roomId },
            data: { status: RoomStatus.MAINTENANCE },
          });
        } else {
          // N'est plus bloquant -> vérifier s'il reste d'autres problèmes bloquants
          const remainingBlocking = await tx.roomProblem.count({
            where: {
              roomId: problem.roomId,
              id: { not: problem.id },
              status: { in: ['REPORTED', 'IN_PROGRESS'] },
              blocksRental: true,
            },
          });

          if (remainingBlocking === 0) {
            const nextStatus = problem.room.isClean ? RoomStatus.FREE : RoomStatus.CLEANING;
            await tx.room.update({
              where: { id: problem.roomId },
              data: {
                status: nextStatus,
                maintenanceReason: null,
              },
            });
          }
        }
      }

      await appendChainedAuditLog(tx, {
        action: 'ROOM_PROBLEM_BLOCKING_TOGGLED',
        entity: 'RoomProblem',
        entityId: p.id,
        userId: user?.id,
        ip,
        before: { blocksRental: problem.blocksRental },
        after: { blocksRental: nextBlocksRental },
      });

      return p;
    });

    return this.formatProblem(updated, isCurrentlyOccupied);
  }

  /**
   * Validation / autorisation explicite par le directeur pour l'intervention technique sur une panne majeure.
   */
  async approveProblem(problemId: string, user: any, ip?: string): Promise<RoomProblemDto> {
    const problem = await this.prisma.roomProblem.findUnique({
      where: { id: problemId },
      include: { room: true },
    });

    if (!problem) {
      throw new NotFoundException(`Problème "${problemId}" introuvable.`);
    }

    if (problem.status === 'RESOLVED' || problem.status === 'CANCELLED') {
      throw new ConflictException(
        `Ce problème a déjà été clos au statut « ${problem.status} » et ne peut plus être autorisé.`,
      );
    }

    const isCurrentlyOccupied = problem.room.status === RoomStatus.OCCUPIED;
    if (problem.directorApproved) {
      return this.formatProblem(problem, isCurrentlyOccupied);
    }

    const approvedByDirectorName = user?.fullName || user?.email || 'Directeur';
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.roomProblem.update({
        where: { id: problemId },
        data: {
          directorApproved: true,
          approvedByDirectorId: user?.id || null,
          approvedByDirectorName,
          approvedByDirectorAt: now,
        },
        include: { room: true },
      });

      await appendChainedAuditLog(tx, {
        action: 'ROOM_PROBLEM_DIRECTOR_APPROVED',
        entity: 'RoomProblem',
        entityId: p.id,
        userId: user?.id,
        ip,
        before: { directorApproved: false },
        after: {
          directorApproved: true,
          approvedByDirectorName,
          approvedByDirectorAt: now.toISOString(),
        },
      });

      return p;
    });

    const typeLabel = ROOM_PROBLEM_TYPE_META[problem.type]?.label || problem.type;
    await this.notificationsService.createNotification({
      category: 'MAINTENANCE',
      type: 'PANNE_AUTORISEE',
      severity: 'INFO',
      title: `Chambre ${problem.room.number} : intervention autorisée par la direction`,
      detail: `Le directeur a validé la réparation (${typeLabel.toLowerCase()}). L'équipe technique peut intervenir.`,
      roomNumber: problem.room.number,
      link: '/technique',
      importantAlert: false,
    });

    return this.formatProblem(updated, isCurrentlyOccupied);
  }

  async updateCleanliness(
    roomId: string,
    dto: UpdateRoomCleanlinessDto,
    user: any,
    ip?: string,
  ) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException(`Chambre "${roomId}" introuvable.`);
    }

    const isCurrentlyOccupied = room.status === RoomStatus.OCCUPIED;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Vérifier les problèmes bloquants actifs
      const blockingCount = await tx.roomProblem.count({
        where: {
          roomId: room.id,
          status: { in: ['REPORTED', 'IN_PROGRESS'] },
          blocksRental: true,
        },
      });

      let nextStatus = room.status;
      if (!isCurrentlyOccupied) {
        if (blockingCount > 0) {
          nextStatus = RoomStatus.MAINTENANCE;
        } else if (dto.isClean) {
          nextStatus = RoomStatus.FREE;
        } else {
          nextStatus = RoomStatus.CLEANING;
        }
      }

      const r = await tx.room.update({
        where: { id: roomId },
        data: {
          isClean: dto.isClean,
          status: nextStatus,
        },
        include: {
          type: true,
          problems: {
            where: { status: { in: ['REPORTED', 'IN_PROGRESS'] } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      await appendChainedAuditLog(tx, {
        action: 'ROOM_CLEANLINESS_UPDATED',
        entity: 'Room',
        entityId: r.id,
        userId: user?.id,
        ip,
        before: { isClean: room.isClean, status: room.status },
        after: { isClean: r.isClean, status: r.status },
      });

      return r;
    });

    return updated;
  }
}
