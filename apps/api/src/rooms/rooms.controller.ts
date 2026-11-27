import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { map, merge, Observable, takeUntil, timer } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { RoomsService } from './rooms.service';
import { RoomProblemsService } from './room-problems.service';
import { CreateRoomProblemDto } from './dto/create-room-problem.dto';
import { CancelRoomProblemDto } from './dto/cancel-room-problem.dto';
import { UpdateRoomCleanlinessDto } from './dto/update-room-cleanliness.dto';
import { AvailableRoomsQueryDto } from './dto/available-rooms-query.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateRoomTypeDto, UpdateRoomTypeDto } from './dto/create-room-type.dto';
import { Acces } from '../common/decorators/acces.decorator';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { SessionRevocationService } from '../auth/session-revocation.service';
import { hasSpecialPermission, isHousekeepingAccount, Role } from '@residence-blue/shared';
import { maskAmountsInPayload } from '../common/utils/mask-amounts.util';
import { getUploadsDir, UploadedImageFile } from './rooms-image.util';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomProblemsService: RoomProblemsService,
    @Optional() private readonly sessionRevocation?: SessionRevocationService,
  ) {}

  /**
   * Consultation du catalogue et des statuts des chambres.
   * Accessible à tous les rôles autorisés de l'hôtel.
   */
  @Acces({
    anyScreens: [
      { screen: 'chambres', level: 'LECTURE' },
      { screen: 'planning', level: 'LECTURE' },
      // accueil non inclus : /rooms est dédié Chambres, Planning et Facturation
      { screen: 'facturation', level: 'LECTURE' },
    ],
  })
  @Get()
  async findAll(@Req() req: Request) {
    const rooms = await this.roomsService.findAll();
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? rooms : maskAmountsInPayload(rooms);
  }

  /**
   * Retourne uniquement les chambres disponibles (actives, hors Maintenance, sans chevauchement)
   * sur une période [checkIn, checkOut[.
   */
  @Acces({
    anyScreens: [
      { screen: 'chambres', level: 'LECTURE' },
      { screen: 'planning', level: 'LECTURE' },
    ],
  })
  @Get('available')
  async findAvailable(@Query() query: AvailableRoomsQueryDto, @Req() req: Request) {
    const rooms = await this.roomsService.findAvailable(query);
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? rooms : maskAmountsInPayload(rooms);
  }

  /**
   * Consultation publique des photos des chambres enregistrées sur disque.
   */
  @Public()
  @Get('images/:filename')
  serveImage(@Param('filename') filename: string, @Res() res: Response) {
    if (!/^[0-9a-fA-F-]{36}\.(webp|jpg|jpeg|png)$/.test(filename)) {
      throw new NotFoundException('Image introuvable.');
    }
    const dir = getUploadsDir();
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Image introuvable.');
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.webp': 'image/webp',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  /**
   * Flux temps réel SSE des changements de statut des chambres.
   * Réservé strictement à RECEPTION, DIRECTION et MAINTENANCE (Technique).
   */
  @Get('stream')
  @Sse()
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.MAINTENANCE)
  streamRoomStatus(@Req() req: Request): Observable<MessageEvent> {
    const user = (req as any)?.user;
    const rawLastId =
      (req.headers['last-event-id'] as string | undefined) ||
      (req.query?.lastEventId as string | undefined);
    const lastEventId = rawLastId ? Number(rawLastId) : undefined;

    const updates$ = this.roomsService.getRoomEventStream(lastEventId).pipe(
      map(
        (evt) =>
          ({
            id: String(evt.eventId),
            data: evt,
          }) as MessageEvent,
      ),
    );
    const heartbeat$ = timer(0, 25000).pipe(
      map(
        () =>
          ({
            data: { type: 'HEARTBEAT', timestamp: new Date().toISOString() },
          }) as MessageEvent,
      ),
    );
    const stream$ = merge(updates$, heartbeat$);
    return this.sessionRevocation && user?.id
      ? stream$.pipe(takeUntil(this.sessionRevocation.onUserRevoked(user.id)))
      : stream$;
  }

  /**
   * Détail d'une chambre par identifiant.
   */
  @Acces({
    anyScreens: [
      { screen: 'chambres', level: 'LECTURE' },
      { screen: 'planning', level: 'LECTURE' },
    ],
  })
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const room = await this.roomsService.findOne(id);
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? room : maskAmountsInPayload(room);
  }

  /**
   * Création d'une nouvelle chambre avec image optionnelle (Réservé DIRECTION).
   */
  @Acces({ directorOnly: true })
  @Post()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async create(
    @Body() dto: CreateRoomDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id || undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.createRoom(dto, file, userId, ip);
  }

  /**
   * Modification d'une chambre via PATCH (Réservé DIRECTION).
   */
  @Acces('chambres', 'ECRITURE')
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async updatePatch(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id || undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateRoom(id, dto, file, userId, ip);
  }

  /**
   * Modification d'une chambre via PUT (Réservé DIRECTION).
   */
  @Acces('chambres', 'ECRITURE')
  @Put(':id')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async updatePut(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id || undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateRoom(id, dto, file, userId, ip);
  }

  /**
   * Suppression définitive d'une chambre (Réservé DIRECTION).
   * Refus 409 si historique présent (réservations / factures).
   */
  @Acces({ directorOnly: true })
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.id || undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.deleteRoom(id, userId, ip);
  }

  /**
   * Retrait de la photo d'une chambre (Réservé DIRECTION).
   */
  @Acces({ directorOnly: true })
  @Delete(':id/image')
  async removeImage(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.id || undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateRoom(id, { removeImage: true }, undefined, userId, ip);
  }

  /**
   * Modification du statut d'une chambre selon la matrice des rôles et la machine à états.
   * Habilité pour DIRECTION, RECEPTION, HOUSEKEEPING et MAINTENANCE.
   */
  @Acces({
    anyScreens: [
      { screen: 'chambres', level: 'LECTURE' },
      { screen: 'technique', level: 'ECRITURE' },
    ],
    specialPermission: 'changer_etat_chambre',
  })
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const rawRole = String(user?.role || '').toUpperCase();
    const effectiveRole =
      rawRole === 'ADMIN' || rawRole === 'MANAGER'
        ? 'DIRECTION'
        : rawRole === 'RECEPTIONIST'
          ? 'RECEPTION'
          : ['DIRECTION', 'RECEPTION', 'HOUSEKEEPING', 'MAINTENANCE'].includes(rawRole)
            ? rawRole
            : isHousekeepingAccount(user)
              ? 'HOUSEKEEPING'
              : rawRole;
    const userId = user?.id || undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateStatus(id, dto, effectiveRole, userId, ip);
  }

  /**
   * Signalement d'un problème / panne sur une chambre (Ménage, Réception, Direction, Technique).
   */
  @Acces({
    anyScreens: [
      { screen: 'chambres', level: 'LECTURE' },
      { screen: 'planning', level: 'LECTURE' },
    ],
  })
  @Post(':id/problems')
  async reportProblem(
    @Param('id') id: string,
    @Body() dto: CreateRoomProblemDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || undefined;
    return this.roomProblemsService.reportProblem(id, dto, user, ip);
  }

  /**
   * Consultation des problèmes d'une chambre.
   */
  @Acces({
    anyScreens: [
      { screen: 'chambres', level: 'LECTURE' },
      { screen: 'planning', level: 'LECTURE' },
    ],
  })
  @Get(':id/problems')
  async getProblems(@Param('id') id: string) {
    return this.roomProblemsService.getProblemsForRoom(id);
  }

  /**
   * Mise à jour de l'état de propreté d'une chambre (Ménage, Réception, Direction).
   * Fonctionne sur chambre occupée ou libre, sans modifier l'occupation client.
   */
  @Acces({ screen: 'chambres', level: 'LECTURE', specialPermission: 'changer_etat_chambre' })
  @Patch(':id/cleanliness')
  async updateCleanliness(
    @Param('id') id: string,
    @Body() dto: UpdateRoomCleanlinessDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || undefined;
    return this.roomProblemsService.updateCleanliness(id, dto, user, ip);
  }

  /**
   * Annulation d'un problème signalé par erreur (Direction ou Réception avec motif obligatoire).
   */
  @Roles(Role.DIRECTION, Role.RECEPTION)
  @Patch('problems/:id/cancel')
  async cancelProblem(
    @Param('id') id: string,
    @Body() dto: CancelRoomProblemDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || undefined;
    return this.roomProblemsService.cancelProblem(id, dto, user, ip);
  }

  /**
   * Bascule « Chambre louable malgré ce problème » (Direction, Réception, Technique).
   */
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.MAINTENANCE)
  @Patch('problems/:id/toggle-blocking')
  async toggleBlocking(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || undefined;
    return this.roomProblemsService.toggleBlocking(id, user, ip);
  }

  /**
   * Autorisation d'intervention par le directeur sur une panne majeure.
   */
  @Roles(Role.DIRECTION)
  @Patch('problems/:id/approve')
  async approveProblem(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const ip = req.ip || req.socket.remoteAddress || undefined;
    return this.roomProblemsService.approveProblem(id, user, ip);
  }

}

@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Création d'une catégorie et définition de son tarif.
   * Réservé exclusivement à la DIRECTION.
   */
  @Acces({ directorOnly: true })
  @Post()
  async create(@Body() dto: CreateRoomTypeDto, @Req() req: Request) {
    const userId = (req as any).user?.id || undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.createRoomType(dto, userId, ip);
  }

  /**
   * Mise à jour du tarif d'une catégorie de chambre.
   * Réservé exclusivement à la DIRECTION.
   */
  @Acces({ directorOnly: true })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomTypeDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id || undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateRoomType(id, dto, userId, ip);
  }
}
