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
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findAll() {
    return this.reservationsService.findAll();
  }

  @Get(':id')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findOne(@Param('id') id: string) {
    return this.reservationsService.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async create(
    @Body() dto: CreateReservationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ) {
    const user = (req as any)?.user as { id?: string; role?: string } | undefined;
    const ip = req?.ip || req?.socket?.remoteAddress || undefined;
    return this.reservationsService.create(dto, {
      idempotencyKey,
      actorRole: user?.role || Role.RECEPTION,
      userId: user?.id,
      ip,
    });
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async update(@Param('id') id: string, @Body() dto: UpdateReservationDto) {
    return this.reservationsService.update(id, dto);
  }

  @Post(':id/check-in')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  @HttpCode(HttpStatus.OK)
  async checkIn(@Param('id') id: string) {
    return this.reservationsService.checkIn(id);
  }

  @Post(':id/check-out')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  @HttpCode(HttpStatus.OK)
  async checkOut(@Param('id') id: string) {
    return this.reservationsService.checkOut(id);
  }

  @Post(':id/cancel')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string) {
    return this.reservationsService.cancel(id);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.reservationsService.remove(id);
  }
}
