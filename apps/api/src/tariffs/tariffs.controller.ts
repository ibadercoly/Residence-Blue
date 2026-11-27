import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { hasSpecialPermission, isDirectorAccount } from '@residence-blue/shared';
import { Acces } from '../common/decorators/acces.decorator';
import { maskAmountsInPayload } from '../common/utils/mask-amounts.util';
import { TariffsService, TariffActorContext } from './tariffs.service';
import {
  CreateExtraServiceDto,
  TariffQuoteQueryDto,
  UpdateExtraServiceDto,
  UpdateTariffGridDto,
} from './dto/tariffs.dto';

@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  private extractActor(req: Request): TariffActorContext {
    const user = (req as any)?.user as
      | { id?: string; fullName?: string; role?: string }
      | undefined;
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      undefined;
    return {
      userId: user?.id ?? null,
      actorName: user?.fullName ?? null,
      actorRole: user?.role ?? null,
      ip: ip ?? null,
    };
  }

  /**
   * Grille complète des tarifs & prestations.
   * Les montants sont masqués si le compte ne dispose pas de la permission « voir_montants ».
   */
  @Get()
  @Acces({
    anyScreens: [
      { screen: 'chambres', level: 'LECTURE' },
      { screen: 'planning', level: 'LECTURE' },
      { screen: 'facturation', level: 'LECTURE' },
    ],
  })
  async getGrid(@Req() req: Request) {
    const grid = await this.tariffsService.getTariffGrid();
    const user = (req as any)?.user;
    return isDirectorAccount(user) || hasSpecialPermission(user, 'voir_montants')
      ? grid
      : maskAmountsInPayload(grid);
  }

  /**
   * Calcul autoritaire serveur d'un devis de séjour pour le formulaire de réservation.
   */
  @Get('quote')
  @Acces({
    anyScreens: [
      { screen: 'planning', level: 'LECTURE' },
      { screen: 'chambres', level: 'LECTURE' },
    ],
  })
  async quote(@Query() query: TariffQuoteQueryDto, @Req() req: Request) {
    const quote = await this.tariffsService.quoteStay(query);
    const user = (req as any)?.user;
    return isDirectorAccount(user) || hasSpecialPermission(user, 'voir_montants')
      ? quote
      : maskAmountsInPayload(quote);
  }

  /**
   * Catalogue actif des prestations (autres ventes : salle de séminaire, pauses).
   */
  @Get('extra-services')
  @Acces({
    anyScreens: [
      { screen: 'facturation', level: 'LECTURE' },
      { screen: 'planning', level: 'LECTURE' },
      { screen: 'chambres', level: 'LECTURE' },
    ],
  })
  async listExtraServices(@Req() req: Request) {
    const items = await this.tariffsService.listActiveExtraServices();
    const user = (req as any)?.user;
    return isDirectorAccount(user) || hasSpecialPermission(user, 'voir_montants')
      ? items
      : maskAmountsInPayload(items);
  }

  /**
   * Mise à jour de la grille tarifaire (DIRECTION uniquement — 403 pour tous les autres profils).
   */
  @Put('grid')
  @Acces({ directorOnly: true })
  @HttpCode(HttpStatus.OK)
  async updateGrid(@Body() dto: UpdateTariffGridDto, @Req() req: Request) {
    return this.tariffsService.updateTariffGrid(dto, this.extractActor(req));
  }

  /**
   * Modification d'une prestation (DIRECTION uniquement — 403 pour tous les autres profils).
   */
  @Patch('extra-services/:id')
  @Acces({ directorOnly: true })
  async updateExtraService(
    @Param('id') id: string,
    @Body() dto: UpdateExtraServiceDto,
    @Req() req: Request,
  ) {
    return this.tariffsService.updateExtraService(id, dto, this.extractActor(req));
  }

  /**
   * Ajout d'une nouvelle prestation au catalogue (DIRECTION uniquement).
   */
  @Post('extra-services')
  @Acces({ directorOnly: true })
  async createExtraService(
    @Body() dto: CreateExtraServiceDto,
    @Req() req: Request,
  ) {
    return this.tariffsService.createExtraService(dto, this.extractActor(req));
  }
}
