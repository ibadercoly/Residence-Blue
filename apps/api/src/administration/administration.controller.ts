import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Acces } from '../common/decorators/acces.decorator';
import { AdministrationService } from './administration.service';
import {
  CreateManagedAccountDto,
  DeleteManagedAccountDto,
  UpdateDirectorCredentialsDto,
  UpdateManagedAccountDto,
} from './dto/administration.dto';

@Controller('administration')
@Acces({ directorOnly: true })
export class AdministrationController {
  constructor(private readonly administrationService: AdministrationService) {}

  private extractIp(req: Request): string | undefined {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress
    );
  }

  @Get('modele')
  getReferenceModel() {
    return this.administrationService.getReferenceModel();
  }

  @Get('comptes')
  listAccounts(@Query('search') search?: string) {
    return this.administrationService.listAccounts(search);
  }

  @Get('comptes/:id')
  getAccount(@Param('id', ParseUUIDPipe) id: string) {
    return this.administrationService.getAccount(id);
  }

  @Post('comptes')
  createAccount(@Body() dto: CreateManagedAccountDto, @Req() req: Request) {
    const actor = (req as any).user as { id: string };
    return this.administrationService.createAccount(
      dto,
      actor.id,
      this.extractIp(req),
    );
  }

  @Patch('comptes/:id')
  updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateManagedAccountDto,
    @Req() req: Request,
  ) {
    const actor = (req as any).user as { id: string };
    return this.administrationService.updateAccount(
      id,
      dto,
      actor.id,
      this.extractIp(req),
    );
  }

  @Post('comptes/:id/reinitialiser-mot-de-passe')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const actor = (req as any).user as { id: string };
    return this.administrationService.resetPassword(
      id,
      actor.id,
      this.extractIp(req),
    );
  }

  @Post('comptes/:id/desactiver')
  @HttpCode(HttpStatus.OK)
  deactivateAccount(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const actor = (req as any).user as { id: string };
    return this.administrationService.deactivateAccount(
      id,
      actor.id,
      this.extractIp(req),
    );
  }

  @Post('comptes/:id/reactiver')
  @HttpCode(HttpStatus.OK)
  reactivateAccount(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const actor = (req as any).user as { id: string };
    return this.administrationService.reactivateAccount(
      id,
      actor.id,
      this.extractIp(req),
    );
  }

  @Post('comptes/:id/supprimer')
  @HttpCode(HttpStatus.OK)
  deleteAccountPost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteManagedAccountDto,
    @Req() req: Request,
  ) {
    const actor = (req as any).user as { id: string };
    return this.administrationService.deleteAccount(
      id,
      dto,
      actor.id,
      this.extractIp(req),
    );
  }

  @Delete('comptes/:id')
  @HttpCode(HttpStatus.OK)
  deleteAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteManagedAccountDto,
    @Req() req: Request,
  ) {
    const actor = (req as any).user as { id: string };
    return this.administrationService.deleteAccount(
      id,
      dto,
      actor.id,
      this.extractIp(req),
    );
  }

  @Patch('directeur/identifiants')
  @HttpCode(HttpStatus.OK)
  updateDirectorCredentials(
    @Body() dto: UpdateDirectorCredentialsDto,
    @Req() req: Request,
  ) {
    const actor = (req as any).user as { id: string; sid?: string };
    return this.administrationService.updateDirectorCredentials(
      actor.id,
      actor.sid,
      dto,
      this.extractIp(req),
    );
  }
}
