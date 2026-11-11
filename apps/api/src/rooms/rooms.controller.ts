import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { RoomsService } from './rooms.service';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateRoomTypeDto, UpdateRoomTypeDto } from './dto/create-room-type.dto';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';
import { getUploadsDir, UploadedImageFile } from './rooms-image.util';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Consultation du catalogue et des statuts des chambres.
   * Accessible à tous les rôles autorisés de l'hôtel.
   */
  @Roles(
    Role.DIRECTION,
    Role.RECEPTION,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
    Role.RESTAURANT,
    Role.COMPTABLE,
  )
  @Get()
  async findAll() {
    return this.roomsService.findAll();
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
   * Détail d'une chambre par identifiant.
   */
  @Roles(
    Role.DIRECTION,
    Role.RECEPTION,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
    Role.RESTAURANT,
    Role.COMPTABLE,
  )
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  /**
   * Création d'une nouvelle chambre avec image optionnelle (Réservé DIRECTION).
   */
  @Roles(Role.DIRECTION)
  @Post()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async create(
    @Body() dto: CreateRoomDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ) {
    const userId =
      (req as any).user?.id ||
      (req.headers['x-user-id'] as string) ||
      undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.createRoom(dto, file, userId, ip);
  }

  /**
   * Modification d'une chambre via PATCH (Réservé DIRECTION).
   */
  @Roles(Role.DIRECTION)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async updatePatch(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ) {
    const userId =
      (req as any).user?.id ||
      (req.headers['x-user-id'] as string) ||
      undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateRoom(id, dto, file, userId, ip);
  }

  /**
   * Modification d'une chambre via PUT (Réservé DIRECTION).
   */
  @Roles(Role.DIRECTION)
  @Put(':id')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async updatePut(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ) {
    const userId =
      (req as any).user?.id ||
      (req.headers['x-user-id'] as string) ||
      undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateRoom(id, dto, file, userId, ip);
  }

  /**
   * Suppression définitive d'une chambre (Réservé DIRECTION).
   * Refus 409 si historique présent (réservations / factures).
   */
  @Roles(Role.DIRECTION)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const userId =
      (req as any).user?.id ||
      (req.headers['x-user-id'] as string) ||
      undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.deleteRoom(id, userId, ip);
  }

  /**
   * Retrait de la photo d'une chambre (Réservé DIRECTION).
   */
  @Roles(Role.DIRECTION)
  @Delete(':id/image')
  async removeImage(@Param('id') id: string, @Req() req: Request) {
    const userId =
      (req as any).user?.id ||
      (req.headers['x-user-id'] as string) ||
      undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateRoom(id, { removeImage: true }, undefined, userId, ip);
  }

  /**
   * Modification du statut d'une chambre selon la matrice des rôles et la machine à états.
   * Habilité pour DIRECTION, RECEPTION, HOUSEKEEPING et MAINTENANCE.
   */
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.HOUSEKEEPING, Role.MAINTENANCE)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
    @Req() req: Request,
  ) {
    const userRole =
      (req as any).user?.role ||
      (req.headers['x-user-role'] as string) ||
      '';
    const userId =
      (req as any).user?.id ||
      (req.headers['x-user-id'] as string) ||
      undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateStatus(id, dto, userRole, userId, ip);
  }
}

@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Création d'une catégorie et définition de son tarif.
   * Réservé exclusivement à la DIRECTION.
   */
  @Roles(Role.DIRECTION)
  @Post()
  async create(@Body() dto: CreateRoomTypeDto, @Req() req: Request) {
    const userId =
      (req as any).user?.id ||
      (req.headers['x-user-id'] as string) ||
      undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.createRoomType(dto, userId, ip);
  }

  /**
   * Mise à jour du tarif d'une catégorie de chambre.
   * Réservé exclusivement à la DIRECTION.
   */
  @Roles(Role.DIRECTION)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomTypeDto,
    @Req() req: Request,
  ) {
    const userId =
      (req as any).user?.id ||
      (req.headers['x-user-id'] as string) ||
      undefined;
    const ip = req.ip || req.socket.remoteAddress || undefined;

    return this.roomsService.updateRoomType(id, dto, userId, ip);
  }
}
