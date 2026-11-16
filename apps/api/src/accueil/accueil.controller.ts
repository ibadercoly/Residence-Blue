import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { hasSpecialPermission } from '@residence-blue/shared';
import { Acces } from '../common/decorators/acces.decorator';
import { AllowDeferredRoles } from '../common/decorators/roles.decorator';
import { AccueilService } from './accueil.service';

@Controller('accueil')
export class AccueilController {
  constructor(private readonly accueilService: AccueilService) {}

  @Get('jour')
  @AllowDeferredRoles()
  @Acces('accueil', 'LECTURE')
  async getDailyStats(@Req() req: Request) {
    const user = (req as any)?.user;
    return this.accueilService.getDailyStats(
      user?.role,
      new Date(),
      hasSpecialPermission(user, 'voir_montants'),
      Boolean(user?.hasExplicitAccess),
    );
  }
}
