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
import { GuestsService } from './guests.service';
import { AddGuestNoteDto, CreateGuestDto, UpdateGuestDto } from './dto/guest.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';

@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findAll() {
    return this.guestsService.findAll();
  }

  @Get(':id')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findOne(@Param('id') id: string) {
    return this.guestsService.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async create(@Body() dto: CreateGuestDto) {
    return this.guestsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async update(@Param('id') id: string, @Body() dto: UpdateGuestDto) {
    return this.guestsService.update(id, dto);
  }

  @Post(':id/notes')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async addNote(@Param('id') id: string, @Body() dto: AddGuestNoteDto) {
    return this.guestsService.addNote(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.guestsService.deleteOrDeactivate(id);
  }
}
