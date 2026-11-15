import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@residence-blue/shared';
import { Roles } from '../decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(Role.DIRECTION, Role.COMPTABLE)
  async getLogs(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 100;
    return this.auditService.listLogs(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('verify')
  @Roles(Role.DIRECTION, Role.COMPTABLE)
  async verifyChain() {
    return this.auditService.verifyChain();
  }
}
