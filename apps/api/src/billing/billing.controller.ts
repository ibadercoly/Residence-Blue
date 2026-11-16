import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BillingService, BillingActorContext } from './billing.service';
import {
  CheckoutInvoiceDto,
  ArchivesQueryDto,
  CounterQueryDto,
  CreateCreditNoteDto,
  CreateInvoiceDto,
  CreateInvoiceLineDto,
  CreatePaymentDto,
  ReversePaymentDto,
  RoomRestaurantChargeDto,
  UpdateDiscountDto,
} from './dto/billing.dto';
import { ForbiddenException } from '@nestjs/common';
import { Acces } from '../common/decorators/acces.decorator';
import { Role, hasSpecialPermission, isDirectorAccount } from '@residence-blue/shared';
import { maskAmountsInPayload } from '../common/utils/mask-amounts.util';

@Controller('invoices')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  private extractActor(req: Request, idempotencyKey?: string): BillingActorContext {
    const user = (req as any).user as
      | { id?: string; role?: string; fullName?: string }
      | undefined;
    const rawRole = user?.role || '';
    const actorRole =
      rawRole === 'ADMIN' || rawRole === 'MANAGER'
        ? 'DIRECTION'
        : rawRole === 'RECEPTIONIST'
          ? 'RECEPTION'
          : rawRole === 'RESTAURANT_STAFF'
            ? 'RESTAURANT'
            : rawRole;
    const actorName = user?.fullName || `Opérateur (${actorRole || 'Inconnu'})`;
    const actorId = user?.id || undefined;
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      undefined;

    return {
      actorRole,
      actorName,
      actorId,
      ip,
      idempotencyKey: idempotencyKey?.trim(),
    };
  }

  @Get('counter')
  @Acces('facturation', 'LECTURE')
  async getCounter(@Query() query: CounterQueryDto, @Req() req: Request) {
    const res = await this.billingService.getCounterSummary(query);
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? res : maskAmountsInPayload(res);
  }

  @Get('archives/export')
  @Acces({
    allScreens: [
      { screen: 'facturation', level: 'LECTURE' },
      { screen: 'rapports', level: 'LECTURE' },
    ],
    specialPermission: 'voir_montants',
  })
  async exportArchives(
    @Query() query: ArchivesQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const actor = this.extractActor(req);
    await this.billingService.streamArchivesExport(query, actor, res);
  }

  @Get('archives')
  @Acces('facturation', 'LECTURE')
  async getArchives(@Query() query: ArchivesQueryDto, @Req() req: Request) {
    const res = await this.billingService.getArchives(query);
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? res : maskAmountsInPayload(res);
  }

  @Get('cash-closure/export')
  @Acces({
    allScreens: [
      { screen: 'facturation', level: 'LECTURE' },
      { screen: 'rapports', level: 'LECTURE' },
    ],
    specialPermission: 'voir_montants',
  })
  async exportCashClosure(
    @Query('format') format: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const actor = this.extractActor(req);
    const fmt = (format || 'pdf').toLowerCase() === 'excel' ? 'excel' : 'pdf';
    await this.billingService.streamCashClosureExport(fmt, actor, res);
  }

  @Get()
  @Acces('facturation', 'LECTURE')
  async findAll(@Req() req: Request) {
    const res = await this.billingService.findAll();
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? res : maskAmountsInPayload(res);
  }

  @Get(':id/pdf')
  @Acces({ screen: 'facturation', level: 'LECTURE', specialPermission: 'voir_montants' })
  async downloadPdf(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const actor = this.extractActor(req);
    await this.billingService.streamInvoicePdf(id, actor, res);
  }

  @Get(':id')
  @Acces('facturation', 'LECTURE')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const res = await this.billingService.findOne(id);
    const user = (req as any)?.user;
    return hasSpecialPermission(user, 'voir_montants') ? res : maskAmountsInPayload(res);
  }

  @Post()
  @Acces('facturation', 'ECRITURE')
  async create(@Body() dto: CreateInvoiceDto, @Req() req: Request) {
    const actor = this.extractActor(req);
    return this.billingService.create(dto, actor);
  }

  @Post('room/:roomNumber/restaurant-charge')
  @Acces({ anyScreens: [{ screen: 'facturation', level: 'ECRITURE' }, { screen: 'restaurant', level: 'ECRITURE' }] })
  async addRoomRestaurantCharge(
    @Param('roomNumber') roomNumber: string,
    @Body() dto: RoomRestaurantChargeDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.addRoomRestaurantCharge(roomNumber, dto, actor);
  }

  @Post(':id/lines')
  @Acces({ anyScreens: [{ screen: 'facturation', level: 'ECRITURE' }, { screen: 'restaurant', level: 'ECRITURE' }] })
  async addLine(
    @Param('id') id: string,
    @Body() dto: CreateInvoiceLineDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.addLine(id, dto, actor);
  }

  @Patch(':id/discount')
  @Acces('facturation', 'ECRITURE')
  async updateDiscount(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.updateDiscount(id, dto, actor);
  }

  @Post(':id/payments')
  @Acces({ screen: 'facturation', level: 'ECRITURE', specialPermission: 'encaisser_paiement' })
  async addPayment(
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req, idempotencyKey || dto.idempotencyKey);
    return this.billingService.addPayment(id, dto, actor);
  }

  @Post(':id/payments/:paymentId/reverse')
  @Acces({ directorOnly: true })
  @HttpCode(HttpStatus.CREATED)
  async reversePayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: ReversePaymentDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.reversePayment(id, paymentId, dto, actor);
  }

  @Post(':id/checkout')
  @Acces('facturation', 'ECRITURE')
  @HttpCode(HttpStatus.OK)
  async checkoutInvoice(
    @Param('id') id: string,
    @Body() dto: CheckoutInvoiceDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.checkoutAndIssue(id, dto, actor);
  }

  @Post(':id/issue')
  @Acces('facturation', 'ECRITURE')
  @HttpCode(HttpStatus.OK)
  async issueInvoice(
    @Param('id') id: string,
    @Body() dto: CheckoutInvoiceDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.checkoutAndIssue(id, dto, actor);
  }

  @Post(':id/credit-notes')
  @Acces('facturation', 'LECTURE')
  async createCreditNote(
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user;
    if (!isDirectorAccount(user) && !(user?.role === Role.COMPTABLE && !user?.hasExplicitAccess)) {
      throw new ForbiddenException('La création d’un avoir est réservée au directeur.');
    }
    const actor = this.extractActor(req);
    return this.billingService.createCreditNote(id, dto, actor);
  }

  @Delete(':id/lines/:lineId')
  @Acces('facturation', 'ECRITURE')
  @HttpCode(HttpStatus.OK)
  async removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.removeLine(id, lineId, actor);
  }

  @Delete(':id')
  @Acces({ directorOnly: true })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const actor = this.extractActor(req);
    return this.billingService.removeOrBlockIssued(id, actor);
  }
}
