import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateHotelSettingsDto } from './dto/settings.dto';
import { Acces } from '../common/decorators/acces.decorator';
import { Public } from '../common/decorators/roles.decorator';

@Controller('hotel-settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Public()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @Acces({ directorOnly: true })
  async updateSettings(@Body() dto: UpdateHotelSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
