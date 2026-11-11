import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateHotelSettingsDto } from './dto/settings.dto';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';

@Controller('hotel-settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Public()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @Roles(Role.DIRECTION)
  async updateSettings(@Body() dto: UpdateHotelSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
