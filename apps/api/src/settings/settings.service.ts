import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateHotelSettingsDto } from './dto/settings.dto';
import { appendChainedAuditLog } from '../common/audit/audit.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.hotelSetting.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await this.prisma.hotelSetting.create({
        data: { id: 'default' },
      });
    }
    return settings;
  }

  async updateSettings(dto: UpdateHotelSettingsDto) {
    const current = await this.getSettings();
    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.hotelSetting.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          ...(dto.hotelName !== undefined ? { hotelName: dto.hotelName.trim() } : {}),
          ...(dto.legalName !== undefined ? { legalName: dto.legalName.trim() } : {}),
          ...(dto.tagline !== undefined ? { tagline: dto.tagline.trim() } : {}),
          ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
          ...(dto.neighborhood !== undefined ? { neighborhood: dto.neighborhood.trim() } : {}),
          ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
          ...(dto.fullAddress !== undefined ? { fullAddress: dto.fullAddress.trim() } : {}),
          ...(dto.ninea !== undefined ? { ninea: dto.ninea.trim() } : {}),
          ...(dto.rccm !== undefined ? { rccm: dto.rccm.trim() } : {}),
          ...(dto.supportPhone !== undefined ? { supportPhone: dto.supportPhone.trim() } : {}),
          ...(dto.supportEmail !== undefined ? { supportEmail: dto.supportEmail.trim() } : {}),
          ...(dto.roomCount !== undefined ? { roomCount: Math.round(dto.roomCount) } : {}),
          ...(dto.restaurantName !== undefined ? { restaurantName: dto.restaurantName.trim() } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency.trim() } : {}),
          ...(dto.vatRatePercent !== undefined ? { vatRatePercent: Math.round(dto.vatRatePercent) } : {}),
          ...(dto.serviceRatePercent !== undefined ? { serviceRatePercent: Math.round(dto.serviceRatePercent) } : {}),
          ...(dto.tourismTaxPerNightPerPerson !== undefined
            ? { tourismTaxPerNightPerPerson: Math.round(dto.tourismTaxPerNightPerPerson) }
            : {}),
          ...(dto.tourismTaxIncludesChildren !== undefined
            ? { tourismTaxIncludesChildren: dto.tourismTaxIncludesChildren }
            : {}),
          ...(dto.discountThresholdPercent !== undefined
            ? { discountThresholdPercent: Math.round(dto.discountThresholdPercent) }
            : {}),
          ...(dto.invoiceLogoPath !== undefined ? { invoiceLogoPath: dto.invoiceLogoPath.trim() } : {}),
          ...(dto.exchangeRateEurToFcfa !== undefined ? { exchangeRateEurToFcfa: dto.exchangeRateEurToFcfa } : {}),
        },
        update: {
          ...(dto.hotelName !== undefined ? { hotelName: dto.hotelName.trim() } : {}),
          ...(dto.legalName !== undefined ? { legalName: dto.legalName.trim() } : {}),
          ...(dto.tagline !== undefined ? { tagline: dto.tagline.trim() } : {}),
          ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
          ...(dto.neighborhood !== undefined ? { neighborhood: dto.neighborhood.trim() } : {}),
          ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
          ...(dto.fullAddress !== undefined ? { fullAddress: dto.fullAddress.trim() } : {}),
          ...(dto.ninea !== undefined ? { ninea: dto.ninea.trim() } : {}),
          ...(dto.rccm !== undefined ? { rccm: dto.rccm.trim() } : {}),
          ...(dto.supportPhone !== undefined ? { supportPhone: dto.supportPhone.trim() } : {}),
          ...(dto.supportEmail !== undefined ? { supportEmail: dto.supportEmail.trim() } : {}),
          ...(dto.roomCount !== undefined ? { roomCount: Math.round(dto.roomCount) } : {}),
          ...(dto.restaurantName !== undefined ? { restaurantName: dto.restaurantName.trim() } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency.trim() } : {}),
          ...(dto.vatRatePercent !== undefined ? { vatRatePercent: Math.round(dto.vatRatePercent) } : {}),
          ...(dto.serviceRatePercent !== undefined ? { serviceRatePercent: Math.round(dto.serviceRatePercent) } : {}),
          ...(dto.tourismTaxPerNightPerPerson !== undefined
            ? { tourismTaxPerNightPerPerson: Math.round(dto.tourismTaxPerNightPerPerson) }
            : {}),
          ...(dto.tourismTaxIncludesChildren !== undefined
            ? { tourismTaxIncludesChildren: dto.tourismTaxIncludesChildren }
            : {}),
          ...(dto.discountThresholdPercent !== undefined
            ? { discountThresholdPercent: Math.round(dto.discountThresholdPercent) }
            : {}),
          ...(dto.invoiceLogoPath !== undefined ? { invoiceLogoPath: dto.invoiceLogoPath.trim() } : {}),
          ...(dto.exchangeRateEurToFcfa !== undefined ? { exchangeRateEurToFcfa: dto.exchangeRateEurToFcfa } : {}),
        },
      });

      await appendChainedAuditLog(tx, {
        action: 'SETTINGS_UPDATE',
        entity: 'HotelSetting',
        entityId: 'default',
        before: {
          hotelName: current.hotelName,
          vatRatePercent: current.vatRatePercent,
          tourismTaxPerNightPerPerson: current.tourismTaxPerNightPerPerson,
        },
        after: {
          hotelName: s.hotelName,
          vatRatePercent: s.vatRatePercent,
          tourismTaxPerNightPerPerson: s.tourismTaxPerNightPerPerson,
        },
      });

      return s;
    });

    return updated;
  }
}
