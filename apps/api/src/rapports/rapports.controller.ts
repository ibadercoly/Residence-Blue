import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@residence-blue/shared';
import { RequireModule } from '../common/decorators/module.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RapportsQueryDto } from './dto/rapports-query.dto';
import { RapportsService } from './rapports.service';

@Controller('rapports')
@RequireModule('rapports')
export class RapportsController {
  constructor(private readonly rapportsService: RapportsService) {}

  @Get()
  @Roles(Role.DIRECTION, Role.COMPTABLE)
  async getReport(@Query() query: RapportsQueryDto) {
    return this.rapportsService.getReport(query.periode);
  }
}
