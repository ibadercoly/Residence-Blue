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
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@residence-blue/shared';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CheckDuplicateQueryDto,
  CreateGuestDto,
  ListGuestsQueryDto,
  ListGuestStaysQueryDto,
  SearchGuestsQueryDto,
  UpdateGuestDto,
} from './dto/guest.dto';
import { GuestsService } from './guests.service';

@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findAll(@Query() query: ListGuestsQueryDto) {
    return this.guestsService.findAll(query);
  }

  @Get('search')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async searchQuick(@Query() query: SearchGuestsQueryDto) {
    return this.guestsService.searchQuick(query);
  }

  @Get('check-duplicate')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async checkDuplicate(@Query() query: CheckDuplicateQueryDto) {
    return this.guestsService.checkDuplicate(query);
  }

  @Get(':id')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findOne(@Param('id') id: string) {
    return this.guestsService.findOne(id);
  }

  @Get(':id/stays')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async listStays(
    @Param('id') id: string,
    @Query() query: ListGuestStaysQueryDto,
  ) {
    return this.guestsService.listStays(id, query);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async create(@Body() dto: CreateGuestDto, @Req() req: Request) {
    const user = (req as any).user as { id?: string; role: string };
    return this.guestsService.create(dto, user.role, user.id, req.ip);
  }

  @Patch(':id')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async update(@Param('id') id: string, @Body() dto: UpdateGuestDto, @Req() req: Request) {
    const user = (req as any).user as { id?: string; role: string };
    return this.guestsService.update(id, dto, user.role, user.id, req.ip);
  }

  @Post(':id/reveal-document')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  @HttpCode(HttpStatus.OK)
  async revealDocument(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user as { id?: string; role: string };
    return this.guestsService.revealDocument(id, user.role, user.id, req.ip);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user as { id?: string; role: string };
    return this.guestsService.remove(id, user.role, user.id, req.ip);
  }
}
