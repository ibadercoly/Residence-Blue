import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomInterventionStatus as PrismaInterventionStatus, RoomStatus } from '@prisma/client';
import {
  Role,
  RoomInterventionRequestDto,
  RoomInterventionStatus,
} from '@residence-blue/shared';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRoomInterventionDto } from './dto/create-room-intervention.dto';
import { RejectRoomInterventionDto } from './dto/reject-room-intervention.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RoomInterventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  public formatIntervention(record: any): RoomInterventionRequestDto {
    return {
      id: record.id,
      roomId: record.roomId,
      roomNumber: record.room?.number,
      roomFloor: record.room?.floor,
      roomCategory: record.room?.category,
      reportedById: record.reportedById,
      reportedByName:
        record.reportedBy?.fullName || record.reportedBy?.email || 'Équipe',
      reportedByRole: record.reportedBy?.role,
      issueDescription: record.issueDescription,
      status: record.status as RoomInterventionStatus,
      approvedById: record.approvedById ?? null,
      approvedByName:
        record.approvedBy?.fullName || record.approvedBy?.email || null,
      approvedAt:
        record.approvedAt instanceof Date
          ? record.approvedAt.toISOString()
          : record.approvedAt ?? null,
      rejectionReason: record.rejectionReason ?? null,
      completedById: record.completedById ?? null,
      completedByName:
        record.completedBy?.fullName || record.completedBy?.email || null,
      completedAt:
        record.completedAt instanceof Date
          ? record.completedAt.toISOString()
          : record.completedAt ?? null,
      createdAt:
        record.createdAt instanceof Date
          ? record.createdAt.toISOString()
          : record.createdAt,
      updatedAt:
        record.updatedAt instanceof Date
          ? record.updatedAt.toISOString()
          : record.updatedAt,
    };
  }

  private get includeRelations() {
    return {
      room: {
        select: {
          id: true,
          number: true,
          floor: true,
          category: true,
          status: true,
        },
      },
      reportedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      completedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    };
  }

  /**
   * 1. Constat d'un problème par le Ménage ou l'Assistant de Réception.
   * Crée une demande PENDING_DIRECTOR et notifie uniquement la DIRECTION.
   */
  async createRequest(
    roomId: string,
    dto: CreateRoomInterventionDto,
    user: any,
    ip?: string,
  ): Promise<RoomInterventionRequestDto> {
    if (!UUID_REGEX.test(roomId)) {
      throw new NotFoundException(`Chambre "${roomId}" introuvable.`);
    }

    const description = (dto?.issueDescription || '').trim();
    if (!description) {
      throw new BadRequestException('La description du problème est obligatoire.');
    }

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException(`Chambre "${roomId}" introuvable.`);
    }

    const reporterId = user?.id;
    if (!reporterId || !UUID_REGEX.test(reporterId)) {
      throw new BadRequestException("Identifiant de l'auteur du constat invalide.");
    }

    const reporterRole = String(user?.role || '').toUpperCase();
    const reporterRoleLabel =
      reporterRole === Role.HOUSEKEEPING ? 'le Ménage' : 'la Réception';

    const created = await this.prisma.$transaction(async (tx) => {
      const req = await tx.roomInterventionRequest.create({
        data: {
          roomId: room.id,
          reportedById: reporterId,
          issueDescription: description,
          status: PrismaInterventionStatus.PENDING_DIRECTOR,
        },
        include: this.includeRelations,
      });

      await appendChainedAuditLog(tx, {
        userId: reporterId,
        action: 'ROOM_INTERVENTION_REQUESTED',
        entity: 'RoomInterventionRequest',
        entityId: req.id,
        before: null,
        after: {
          roomId: room.id,
          roomNumber: room.number,
          reportedById: reporterId,
          reportedByRole: reporterRole,
          issueDescription: description,
          status: PrismaInterventionStatus.PENDING_DIRECTOR,
        },
        ip: ip || null,
      });

      return req;
    });

    // Notifier la DIRECTION pour validation (jamais l'équipe Technique à ce stade)
    await this.notificationsService.createInterventionNotification({
      targetRoles: [Role.DIRECTION],
      type: 'INTERVENTION_DEMANDEE',
      severity: 'WARNING',
      roomNumber: room.number,
      title: `Chambre ${room.number} : demande d'intervention technique signalée par ${reporterRoleLabel}`,
      detail: `Chambre ${room.number} (Étage ${room.floor}) — ${description}`,
      link: '/chambres',
      importantAlert: true,
    });

    return this.formatIntervention(created);
  }

  /**
   * Consultation des demandes d'intervention selon le rôle :
   * - MAINTENANCE ne voit jamais les demandes en attente ni refusées (uniquement APPROVED / COMPLETED).
   */
  async listRequests(
    user: any,
    statusFilter?: string,
  ): Promise<RoomInterventionRequestDto[]> {
    const role = String(user?.role || '').toUpperCase();
    const where: any = {};

    if (role === Role.MAINTENANCE) {
      where.status =
        statusFilter === RoomInterventionStatus.COMPLETED
          ? PrismaInterventionStatus.COMPLETED
          : statusFilter === RoomInterventionStatus.APPROVED
            ? PrismaInterventionStatus.APPROVED
            : {
                in: [
                  PrismaInterventionStatus.APPROVED,
                  PrismaInterventionStatus.COMPLETED,
                ],
              };
    } else if (
      statusFilter &&
      Object.values(PrismaInterventionStatus).includes(
        statusFilter as PrismaInterventionStatus,
      )
    ) {
      where.status = statusFilter as PrismaInterventionStatus;
    }

    const rows = await this.prisma.roomInterventionRequest.findMany({
      where,
      include: this.includeRelations,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.formatIntervention(row));
  }

  async listNotificationsForUser(user: any) {
    const role = String(user?.role || '').toUpperCase();
    return this.notificationsService.listInterventionNotificationsForRole(role);
  }

  /**
   * 2. Approbation par la Direction :
   * Passe la demande en APPROVED, passe la chambre en MAINTENANCE et notifie MAINTENANCE
   * avec toutes les informations (numéro de chambre, description du problème).
   */
  async approveRequest(
    id: string,
    user: any,
    ip?: string,
  ): Promise<RoomInterventionRequestDto> {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(`Demande d'intervention "${id}" introuvable.`);
    }

    const existing = await this.prisma.roomInterventionRequest.findUnique({
      where: { id },
      include: this.includeRelations,
    });
    if (!existing) {
      throw new NotFoundException(`Demande d'intervention "${id}" introuvable.`);
    }

    if (existing.status !== PrismaInterventionStatus.PENDING_DIRECTOR) {
      throw new ConflictException(
        `Seule une demande en attente de validation peut être approuvée (statut actuel : ${existing.status}).`,
      );
    }

    const directorId =
      user?.id && UUID_REGEX.test(user.id) ? (user.id as string) : null;
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const req = await tx.roomInterventionRequest.update({
        where: { id },
        data: {
          status: PrismaInterventionStatus.APPROVED,
          approvedById: directorId,
          approvedAt: now,
        },
        include: this.includeRelations,
      });

      await tx.room.update({
        where: { id: existing.roomId },
        data: {
          status: RoomStatus.MAINTENANCE,
          maintenanceReason: existing.issueDescription,
        },
      });

      await appendChainedAuditLog(tx, {
        userId: directorId,
        action: 'ROOM_INTERVENTION_APPROVED',
        entity: 'RoomInterventionRequest',
        entityId: req.id,
        before: { status: existing.status },
        after: {
          status: PrismaInterventionStatus.APPROVED,
          roomId: existing.roomId,
          roomNumber: existing.room.number,
          approvedById: directorId,
          approvedAt: now.toISOString(),
        },
        ip: ip || null,
      });

      return req;
    });

    // Notifier le rôle MAINTENANCE avec toutes les infos de la chambre et le problème
    await this.notificationsService.createInterventionNotification({
      targetRoles: [Role.MAINTENANCE],
      type: 'INTERVENTION_APPROUVEE',
      severity: 'CRITICAL',
      roomNumber: existing.room.number,
      title: `Ordre de mission approuvé — Chambre ${existing.room.number} : ${existing.issueDescription}`,
      detail: `Chambre ${existing.room.number} (${existing.room.category}, Étage ${existing.room.floor}) — ${existing.issueDescription}`,
      link: '/chambres',
      importantAlert: true,
    });

    return this.formatIntervention(updated);
  }

  /**
   * 3. Refus par la Direction :
   * Passe la demande en REJECTED, n'envoie jamais rien à MAINTENANCE,
   * et notifie RECEPTION et HOUSEKEEPING avec le motif.
   */
  async rejectRequest(
    id: string,
    dto: RejectRoomInterventionDto,
    user: any,
    ip?: string,
  ): Promise<RoomInterventionRequestDto> {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(`Demande d'intervention "${id}" introuvable.`);
    }

    const existing = await this.prisma.roomInterventionRequest.findUnique({
      where: { id },
      include: this.includeRelations,
    });
    if (!existing) {
      throw new NotFoundException(`Demande d'intervention "${id}" introuvable.`);
    }

    if (existing.status !== PrismaInterventionStatus.PENDING_DIRECTOR) {
      throw new ConflictException(
        `Seule une demande en attente de validation peut être refusée (statut actuel : ${existing.status}).`,
      );
    }

    const directorId =
      user?.id && UUID_REGEX.test(user.id) ? (user.id as string) : null;
    const reason = (dto?.reason || '').trim() || 'Refusé par la Direction';
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const req = await tx.roomInterventionRequest.update({
        where: { id },
        data: {
          status: PrismaInterventionStatus.REJECTED,
          approvedById: directorId,
          approvedAt: now,
          rejectionReason: reason,
        },
        include: this.includeRelations,
      });

      await appendChainedAuditLog(tx, {
        userId: directorId,
        action: 'ROOM_INTERVENTION_REJECTED',
        entity: 'RoomInterventionRequest',
        entityId: req.id,
        before: { status: existing.status },
        after: {
          status: PrismaInterventionStatus.REJECTED,
          roomId: existing.roomId,
          roomNumber: existing.room.number,
          approvedById: directorId,
          rejectionReason: reason,
        },
        ip: ip || null,
      });

      return req;
    });

    // Notifier RECEPTION et HOUSEKEEPING avec le motif du refus (jamais MAINTENANCE)
    await this.notificationsService.createInterventionNotification({
      targetRoles: [Role.RECEPTION, Role.HOUSEKEEPING],
      type: 'INTERVENTION_REFUSEE',
      severity: 'INFO',
      roomNumber: existing.room.number,
      title: `Demande d'intervention refusée — Chambre ${existing.room.number}. Motif : ${reason}`,
      detail: `Chambre ${existing.room.number} — Problème signalé : ${existing.issueDescription} | Motif : ${reason}`,
      link: '/chambres',
      importantAlert: false,
    });

    return this.formatIntervention(updated);
  }

  /**
   * 4. Fin de réparation par l'équipe Technique (MAINTENANCE uniquement) :
   * Passe la demande APPROVED -> COMPLETED et remet la chambre en CLEANING (puis FREE après ménage).
   */
  async completeRequest(
    id: string,
    user: any,
    ip?: string,
  ): Promise<RoomInterventionRequestDto> {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException(`Demande d'intervention "${id}" introuvable.`);
    }

    const existing = await this.prisma.roomInterventionRequest.findUnique({
      where: { id },
      include: this.includeRelations,
    });
    if (!existing) {
      throw new NotFoundException(`Demande d'intervention "${id}" introuvable.`);
    }

    if (existing.status !== PrismaInterventionStatus.APPROVED) {
      throw new ConflictException(
        `Seule une intervention approuvée par la Direction peut être marquée comme réparée (statut actuel : ${existing.status}).`,
      );
    }

    const techId =
      user?.id && UUID_REGEX.test(user.id) ? (user.id as string) : null;
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const req = await tx.roomInterventionRequest.update({
        where: { id },
        data: {
          status: PrismaInterventionStatus.COMPLETED,
          completedById: techId,
          completedAt: now,
        },
        include: this.includeRelations,
      });

      // Vérifier s'il reste une autre intervention APPROVED sur la même chambre
      const remainingApproved = await tx.roomInterventionRequest.count({
        where: {
          roomId: existing.roomId,
          id: { not: existing.id },
          status: PrismaInterventionStatus.APPROVED,
        },
      });

      if (remainingApproved === 0) {
        await tx.room.update({
          where: { id: existing.roomId },
          data: {
            status: RoomStatus.CLEANING,
            maintenanceReason: null,
          },
        });
      }

      await appendChainedAuditLog(tx, {
        userId: techId,
        action: 'ROOM_INTERVENTION_COMPLETED',
        entity: 'RoomInterventionRequest',
        entityId: req.id,
        before: { status: existing.status },
        after: {
          status: PrismaInterventionStatus.COMPLETED,
          roomId: existing.roomId,
          roomNumber: existing.room.number,
          nextRoomStatus: remainingApproved === 0 ? RoomStatus.CLEANING : RoomStatus.MAINTENANCE,
          completedById: techId,
          completedAt: now.toISOString(),
        },
        ip: ip || null,
      });

      return req;
    });

    return this.formatIntervention(updated);
  }
}
