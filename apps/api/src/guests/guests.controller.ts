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
import { Acces } from '../common/decorators/acces.decorator';
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
  @Acces('clients', 'LECTURE')
  async findAll(@Query() query: ListGuestsQueryDto) {
    return this.guestsService.findAll(query);
  }

  @Get('search')
  @Acces('clients', 'LECTURE')
  async searchQuick(@Query() query: SearchGuestsQueryDto) {
    return this.guestsService.searchQuick(query);
  }

  @Get('check-duplicate')
  @Acces('clients', 'LECTURE')
  async checkDuplicate(@Query() query: CheckDuplicateQueryDto) {
    return this.guestsService.checkDuplicate(query);
  }

  @Get(':id')
  @Acces('clients', 'LECTURE')
  async findOne(@Param('id') id: string) {
    return this.guestsService.findOne(id);
  }

  @Get(':id/stays')
  @Acces('clients', 'LECTURE')
  async listStays(
    @Param('id') id: string,
    @Query() query: ListGuestStaysQueryDto,
  ) {
    return this.guestsService.listStays(id, query);
  }

  @Post()
  @Acces('clients', 'ECRITURE')
  async create(@Body() dto: CreateGuestDto, @Req() req: Request) {
    const user = (req as any).user as { id?: string; role: string };
    return this.guestsService.create(dto, user.role, user.id, req.ip);
  }

  @Patch(':id')
  @Acces('clients', 'ECRITURE')
  async update(@Param('id') id: string, @Body() dto: UpdateGuestDto, @Req() req: Request) {
    const user = (req as any).user as { id?: string; role: string };
    return this.guestsService.update(id, dto, user.role, user.id, req.ip);
  }

  @Post(':id/reveal-document')
  @Acces('clients', 'ECRITURE')
  @HttpCode(HttpStatus.OK)
  async revealDocument(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user as { id?: string; role: string };
    return this.guestsService.revealDocument(id, user.role, user.id, req.ip);
  }

  @Delete(':id')
  @Acces({ directorOnly: true })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user as { id?: string; role: string };
    return this.guestsService.remove(id, user.role, user.id, req.ip);
  }
}
