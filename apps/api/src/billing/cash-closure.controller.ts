import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CashClosureService } from './cash-closure.service';
import { CreateCashClosureDto } from './dto/cash-closure.dto';

@Controller('billing/cash-closure')
export class CashClosureController {
  constructor(private readonly cashClosureService: CashClosureService) {}

  @Get('today')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.COMPTABLE)
  async getTodayStatus() {
    return this.cashClosureService.getTodayStatus();
  }

  @Post()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  @HttpCode(HttpStatus.CREATED)
  async createClosure(@Body() dto: CreateCashClosureDto, @Req() req: Request) {
    const user = (req as any)?.user as { id?: string; fullName?: string; role?: string } | undefined;
    const ip = req?.ip || req?.socket?.remoteAddress || undefined;

    return this.cashClosureService.createCashClosure(dto, {
      id: user?.id || '',
      fullName: user?.fullName || `Opérateur (${user?.role || 'Inconnu'})`,
      role: user?.role || 'RECEPTION',
      ip,
    });
  }

  @Get('history')
  @Roles(Role.DIRECTION, Role.COMPTABLE)
  async getHistory(@Query('limit') limitRaw?: string) {
    const parsed = limitRaw ? Number(limitRaw) : 50;
    const limit = Number.isFinite(parsed) ? parsed : 50;
    return this.cashClosureService.getHistory(limit);
  }
}
