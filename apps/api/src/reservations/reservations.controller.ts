import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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
  async create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
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
