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
  CounterQueryDto,
  CreateCreditNoteDto,
  CreateInvoiceDto,
  CreateInvoiceLineDto,
  CreatePaymentDto,
  ReversePaymentDto,
  RoomRestaurantChargeDto,
  UpdateDiscountDto,
} from './dto/billing.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';

@Controller('invoices')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  private extractActor(req: Request, idempotencyKey?: string): BillingActorContext {
    const rawRole =
      ((req as any).user?.role as string) ||
      (req.headers['x-user-role'] as string) ||
      'RECEPTION';
    const actorRole =
      rawRole === 'ADMIN' || rawRole === 'MANAGER'
        ? 'DIRECTION'
        : rawRole === 'RECEPTIONIST'
          ? 'RECEPTION'
          : rawRole === 'RESTAURANT_STAFF'
            ? 'RESTAURANT'
            : rawRole;
    const actorName =
      ((req as any).user?.fullName as string) ||
      (req.headers['x-user-name'] as string) ||
      `Opérateur (${actorRole})`;
    const actorId = ((req as any).user?.id as string) || undefined;
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
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.COMPTABLE)
  async getCounter(@Query() query: CounterQueryDto) {
    return this.billingService.getCounterSummary(query);
  }

  @Get('cash-closure/export')
  @Roles(Role.DIRECTION, Role.COMPTABLE)
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
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.COMPTABLE)
  async findAll() {
    return this.billingService.findAll();
  }

  @Get(':id/pdf')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.COMPTABLE)
  async downloadPdf(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const actor = this.extractActor(req);
    await this.billingService.streamInvoicePdf(id, actor, res);
  }

  @Get(':id')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.COMPTABLE)
  async findOne(@Param('id') id: string) {
    return this.billingService.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async create(@Body() dto: CreateInvoiceDto, @Req() req: Request) {
    const actor = this.extractActor(req);
    return this.billingService.create(dto, actor);
  }

  @Post('room/:roomNumber/restaurant-charge')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT)
  async addRoomRestaurantCharge(
    @Param('roomNumber') roomNumber: string,
    @Body() dto: RoomRestaurantChargeDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.addRoomRestaurantCharge(roomNumber, dto, actor);
  }

  @Post(':id/lines')
  @Roles(Role.DIRECTION, Role.RECEPTION, Role.RESTAURANT)
  async addLine(
    @Param('id') id: string,
    @Body() dto: CreateInvoiceLineDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.addLine(id, dto, actor);
  }

  @Patch(':id/discount')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async updateDiscount(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.updateDiscount(id, dto, actor);
  }

  @Post(':id/payments')
  @Roles(Role.DIRECTION, Role.RECEPTION)
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
  @Roles(Role.DIRECTION)
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
  @Roles(Role.DIRECTION, Role.RECEPTION)
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
  @Roles(Role.DIRECTION, Role.RECEPTION)
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
  @Roles(Role.DIRECTION, Role.COMPTABLE)
  async createCreditNote(
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
    @Req() req: Request,
  ) {
    const actor = this.extractActor(req);
    return this.billingService.createCreditNote(id, dto, actor);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const actor = this.extractActor(req);
    return this.billingService.removeOrBlockIssued(id, actor);
  }
}
