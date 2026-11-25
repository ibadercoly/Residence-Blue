import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomProblemsService } from '../rooms/room-problems.service';
import { ResolveRoomProblemDto } from '../rooms/dto/resolve-room-problem.dto';
import { RoomProblemDto, RoomProblemType, ROOM_PROBLEM_TYPE_META } from '@residence-blue/shared';
import { Observable, Subject } from 'rxjs';
import { RoomStatus } from '@prisma/client';

export interface TechniqueCardItem {
  id: string;
  roomId: string;
  roomNumber: string;
  roomFloor: number;
  roomCategory: string;
  type: RoomProblemType;
  typeLabel: string;
  icon: string;
  description: string | null;
  reportedAt: string;
  reportedByRole: string;
  reportedByName: string;
  wasOccupied: boolean;
  isCurrentlyOccupied: boolean;
  status: 'REPORTED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
  assignedToName: string | null;
  acknowledgedAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface TechniqueDashboardResponse {
  toTreat: TechniqueCardItem[];
  inProgress: TechniqueCardItem[];
  resolvedToday: TechniqueCardItem[];
  totalToTreat: number;
}

export interface TechniqueStreamEvent {
  eventId: number;
  type: 'TECHNIQUE_PROBLEM_CREATED' | 'TECHNIQUE_PROBLEM_UPDATED' | 'HEARTBEAT';
  problem?: TechniqueCardItem;
  hasNewProblem?: boolean;
  timestamp: string;
}

@Injectable()
export class TechniqueService {
  private readonly events$ = new Subject<TechniqueStreamEvent>();
  private nextEventId = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly roomProblemsService: RoomProblemsService,
  ) {}

  private mapToTechniqueCard(p: any): TechniqueCardItem {
    const isCurrentlyOccupied = p.room?.status === RoomStatus.OCCUPIED;
    const type = p.type as RoomProblemType;
    return {
      id: p.id,
      roomId: p.roomId,
      roomNumber: p.room?.number || '',
      roomFloor: p.room?.floor ?? 1,
      roomCategory: p.room?.category || 'Standard',
      type,
      typeLabel: ROOM_PROBLEM_TYPE_META[type]?.label || type,
      icon: ROOM_PROBLEM_TYPE_META[type]?.icon || 'build',
      description: p.description,
      reportedAt: p.reportedAt instanceof Date ? p.reportedAt.toISOString() : p.reportedAt,
      reportedByRole: p.reportedByRole,
      reportedByName: p.reportedByName,
      wasOccupied: p.wasOccupied,
      isCurrentlyOccupied,
      status: p.status,
      assignedToName: p.assignedToName,
      acknowledgedAt: p.acknowledgedAt instanceof Date ? p.acknowledgedAt.toISOString() : p.acknowledgedAt,
      resolvedByName: p.resolvedByName,
      resolvedAt: p.resolvedAt instanceof Date ? p.resolvedAt.toISOString() : p.resolvedAt,
      resolutionNote: p.resolutionNote,
    };
  }

  async getDashboard(): Promise<TechniqueDashboardResponse> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [reported, inProgress, resolved] = await Promise.all([
      // À traiter : chambres vides en premier, puis les plus anciens
      this.prisma.roomProblem.findMany({
        where: { status: 'REPORTED' },
        include: { room: true },
        orderBy: [{ createdAt: 'asc' }],
      }),
      // En cours
      this.prisma.roomProblem.findMany({
        where: { status: 'IN_PROGRESS' },
        include: { room: true },
        orderBy: { acknowledgedAt: 'desc' },
      }),
      // Réparés aujourd'hui
      this.prisma.roomProblem.findMany({
        where: {
          status: 'RESOLVED',
          resolvedAt: { gte: startOfToday },
        },
        include: { room: true },
        orderBy: { resolvedAt: 'desc' },
      }),
    ]);

    // Trier les "À traiter" : chambres inoccupées (vides) en premier, puis date croissante
    const toTreatCards = reported.map((p) => this.mapToTechniqueCard(p)).sort((a, b) => {
      if (a.isCurrentlyOccupied !== b.isCurrentlyOccupied) {
        return a.isCurrentlyOccupied ? 1 : -1; // vide (false) en premier
      }
      return new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime();
    });

    const inProgressCards = inProgress.map((p) => this.mapToTechniqueCard(p));
    const resolvedCards = resolved.map((p) => this.mapToTechniqueCard(p));

    return {
      toTreat: toTreatCards,
      inProgress: inProgressCards,
      resolvedToday: resolvedCards,
      totalToTreat: toTreatCards.length,
    };
  }

  async takeProblem(problemId: string, user: any, ip?: string): Promise<RoomProblemDto> {
    const result = await this.roomProblemsService.acknowledgeProblem(problemId, user, ip);
    this.emitEvent('TECHNIQUE_PROBLEM_UPDATED', result, false);
    return result;
  }

  async resolveProblem(
    problemId: string,
    dto: ResolveRoomProblemDto,
    user: any,
    ip?: string,
  ): Promise<RoomProblemDto> {
    const result = await this.roomProblemsService.resolveProblem(problemId, dto, user, ip);
    this.emitEvent('TECHNIQUE_PROBLEM_UPDATED', result, false);
    return result;
  }

  emitEvent(
    type: 'TECHNIQUE_PROBLEM_CREATED' | 'TECHNIQUE_PROBLEM_UPDATED',
    problem: any,
    hasNewProblem = false,
  ) {
    this.events$.next({
      eventId: this.nextEventId++,
      type,
      problem: problem ? this.mapToTechniqueCard(problem) : undefined,
      hasNewProblem,
      timestamp: new Date().toISOString(),
    });
  }

  getStream(): Observable<TechniqueStreamEvent> {
    return this.events$.asObservable();
  }
}
