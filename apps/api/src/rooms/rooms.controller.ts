import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { RoomsService } from './rooms.service';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { CreateRoomTypeDto, UpdateRoomTypeDto } from './dto/create-room-type.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';

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
