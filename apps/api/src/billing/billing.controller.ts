import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateInvoiceDto, CreateInvoiceLineDto, CreatePaymentDto } from './dto/billing.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@residence-blue/shared';

@Controller('invoices')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findAll() {
    return this.billingService.findAll();
  }

  @Get(':id')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async findOne(@Param('id') id: string) {
    return this.billingService.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async create(@Body() dto: CreateInvoiceDto) {
    return this.billingService.create(dto);
  }

  @Post(':id/lines')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async addLine(@Param('id') id: string, @Body() dto: CreateInvoiceLineDto) {
    return this.billingService.addLine(id, dto);
  }

  @Post(':id/payments')
  @Roles(Role.DIRECTION, Role.RECEPTION)
  async addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.billingService.addPayment(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.billingService.removeOrCancel(id);
  }
}
