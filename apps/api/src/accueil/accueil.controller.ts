import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@residence-blue/shared';
import { AllowDeferredRoles, Roles } from '../common/decorators/roles.decorator';
import { AccueilService } from './accueil.service';

@Controller('accueil')
export class AccueilController {
  constructor(private readonly accueilService: AccueilService) {}

  @Get('jour')
  @AllowDeferredRoles()
  @Roles(
    Role.DIRECTION,
    Role.COMPTABLE,
    Role.RECEPTION,
    Role.RESTAURANT,
    Role.SERVEUR,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
  )
  async getDailyStats(@Req() req: Request) {
    const role = (req as any)?.user?.role as string | undefined;
    return this.accueilService.getDailyStats(role);
  }
}
