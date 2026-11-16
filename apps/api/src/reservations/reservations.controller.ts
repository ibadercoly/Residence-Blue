import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, UpdateReservationDto } from './dto/reservation.dto';
import { Acces } from '../common/decorators/acces.decorator';
import { Role, hasSpecialPermission } from '@residence-blue/shared';
import { maskAmountsInPayload } from '../common/utils/mask-amounts.util';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @Acces('planning', 'LECTURE')
  async findAll(@Req() req: Request) {
    const list = await this.reservationsService.findAll();
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? list : maskAmountsInPayload(list);
  }

  @Get(':id')
  @Acces('planning', 'LECTURE')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const res = await this.reservationsService.findOne(id);
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? res : maskAmountsInPayload(res);
  }

  @Post()
  @Acces('planning', 'ECRITURE')
  async create(
    @Body() dto: CreateReservationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ) {
    const user = (req as any)?.user as { id?: string; role?: string; fullName?: string } | undefined;
    const ip = req?.ip || req?.socket?.remoteAddress || undefined;
    return this.reservationsService.create(dto, {
      idempotencyKey,
      actorRole: user?.role || Role.RECEPTION,
      userId: user?.id,
      actorName: user?.fullName,
      ip,
    });
  }

  @Patch(':id')
  @Acces('planning', 'ECRITURE')
  async update(@Param('id') id: string, @Body() dto: UpdateReservationDto) {
    return this.reservationsService.update(id, dto);
  }

  @Post(':id/check-in')
  @Acces('planning', 'ECRITURE')
  @HttpCode(HttpStatus.OK)
  async checkIn(@Param('id') id: string) {
    return this.reservationsService.checkIn(id);
  }

  @Post(':id/check-out')
  @Acces('planning', 'ECRITURE')
  @HttpCode(HttpStatus.OK)
  async checkOut(@Param('id') id: string) {
    return this.reservationsService.checkOut(id);
  }

  @Post(':id/cancel')
  @Acces({ screen: 'planning', level: 'ECRITURE', specialPermission: 'annuler_commande_ou_reservation' })
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string) {
    return this.reservationsService.cancel(id);
  }

  @Delete(':id')
  @Acces({ directorOnly: true })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.reservationsService.remove(id);
  }
}
