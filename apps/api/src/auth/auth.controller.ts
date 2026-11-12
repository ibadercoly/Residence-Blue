import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService, IssuedAuthResult, RequestMeta } from './auth.service';
import {
  CreateUserDto,
  DisableTotpDto,
  LoginDto,
  UpdateUserDto,
  VerifyTotpCodeDto,
  VerifyTotpLoginDto,
} from './dto/auth.dto';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { ALL_ROLES, Role } from '@residence-blue/shared';
import { parseCookieHeader, REFRESH_COOKIE_NAME } from './jwt.util';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractMeta(req: Request, deviceLabel?: string): RequestMeta {
    return {
      ip:
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceLabel,
    };
  }

  private setRefreshCookie(res: Response, rawToken: string, maxAgeMs: number): void {
    const disableSecure = process.env.COOKIE_SECURE === 'false';
    res.cookie(REFRESH_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: !disableSecure,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: maxAgeMs,
    });
  }

  private clearRefreshCookie(res: Response): void {
    const disableSecure = process.env.COOKIE_SECURE === 'false';
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: !disableSecure,
      sameSite: 'strict',
      path: '/api/auth',
    });
  }

  private respondAuthenticated(res: Response, issued: IssuedAuthResult) {
    this.setRefreshCookie(res, issued.refreshTokenRaw, issued.refreshMaxAgeMs);
    return {
      status: issued.status,
      accessToken: issued.accessToken,
      expiresInSeconds: issued.expiresInSeconds,
      user: issued.user,
    };
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.extractMeta(req, dto.deviceLabel));
    if (result.status === 'AUTHENTICATED') {
      return this.respondAuthenticated(res, result);
    }
    return result;
  }

  @Public()
  @Post('auth/login/totp')
  @HttpCode(HttpStatus.OK)
  async verifyTotpLogin(
    @Body() dto: VerifyTotpLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyTotpLogin(
      dto,
      this.extractMeta(req, dto.deviceLabel),
    );
    return this.respondAuthenticated(res, result);
  }

  @Public()
  @Post('auth/login/totp-setup')
  @HttpCode(HttpStatus.OK)
  async confirmMandatoryTotpSetup(
    @Body() dto: VerifyTotpLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.confirmMandatoryTotpSetup(
      dto,
      this.extractMeta(req, dto.deviceLabel),
    );
    return this.respondAuthenticated(res, result);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = parseCookieHeader(req.headers.cookie);
    const rawRefresh = cookies[REFRESH_COOKIE_NAME];
    try {
      const result = await this.authService.refreshSession(rawRefresh, this.extractMeta(req));
      return this.respondAuthenticated(res, result);
    } catch (err) {
      this.clearRefreshCookie(res);
      throw err;
    }
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = parseCookieHeader(req.headers.cookie);
    const rawRefresh = cookies[REFRESH_COOKIE_NAME];
    const actor = (req as any).user as { id?: string; sid?: string } | undefined;
    const ip = this.extractMeta(req).ip;

    await this.authService.logoutByCookieOrSession(rawRefresh, actor?.sid, actor?.id, ip);
    this.clearRefreshCookie(res);
    return { loggedOut: true };
  }

  @Get('auth/me')
  @Roles(...ALL_ROLES)
  async getMe(@Req() req: Request) {
    const actor = (req as any).user as { id: string; sid?: string };
    return this.authService.getMe(actor.id, actor.sid);
  }

  @Post('auth/totp/setup')
  @Roles(...ALL_ROLES)
  async setupOptionalTotp(@Req() req: Request) {
    const actor = (req as any).user as { id: string };
    return this.authService.initiateOptionalTotpSetup(actor.id);
  }

  @Post('auth/totp/enable')
  @Roles(...ALL_ROLES)
  @HttpCode(HttpStatus.OK)
  async enableOptionalTotp(@Body() dto: VerifyTotpCodeDto, @Req() req: Request) {
    const actor = (req as any).user as { id: string };
    return this.authService.enableOptionalTotp(actor.id, dto.code, this.extractMeta(req).ip);
  }

  @Post('auth/totp/disable')
  @Roles(...ALL_ROLES)
  @HttpCode(HttpStatus.OK)
  async disableOptionalTotp(@Body() dto: DisableTotpDto, @Req() req: Request) {
    const actor = (req as any).user as { id: string };
    return this.authService.disableOptionalTotp(actor.id, dto, this.extractMeta(req).ip);
  }

  @Post('auth/totp/backup-codes/regenerate')
  @Roles(...ALL_ROLES)
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(@Body() dto: VerifyTotpCodeDto, @Req() req: Request) {
    const actor = (req as any).user as { id: string };
    return this.authService.regenerateBackupCodes(actor.id, dto.code, this.extractMeta(req).ip);
  }

  @Get('auth/sessions')
  @Roles(Role.DIRECTION)
  async listAllSessions(@Query('userId') userId: string | undefined, @Req() req: Request) {
    const actor = (req as any).user as { sid?: string };
    return this.authService.listSessions(userId, actor?.sid);
  }

  @Get('auth/my-sessions')
  @Roles(...ALL_ROLES)
  async listMySessions(@Req() req: Request) {
    const actor = (req as any).user as { id: string; sid?: string };
    return this.authService.listSessions(actor.id, actor.sid);
  }

  @Delete('auth/sessions/:familyId')
  @Roles(...ALL_ROLES)
  @HttpCode(HttpStatus.OK)
  async revokeSession(@Param('familyId') familyId: string, @Req() req: Request) {
    const actor = (req as any).user as { id: string; role: string };
    return this.authService.revokeSessionByFamilyId(
      familyId,
      actor,
      this.extractMeta(req).ip,
    );
  }

  @Get('users')
  @Roles(Role.DIRECTION)
  findAllUsers() {
    return this.authService.findAllUsers();
  }

  @Get('users/:id')
  @Roles(Role.DIRECTION)
  findOneUser(@Param('id') id: string) {
    return this.authService.findOneUser(id);
  }

  @Post('users')
  @Roles(Role.DIRECTION)
  createUser(@Body() dto: CreateUserDto, @Req() req: Request) {
    const actor = (req as any).user as { id?: string };
    return this.authService.createUser(dto, {
      id: actor?.id,
      ip: this.extractMeta(req).ip,
    });
  }

  @Patch('users/:id')
  @Roles(Role.DIRECTION)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    const actor = (req as any).user as { id?: string };
    return this.authService.updateUser(id, dto, {
      id: actor?.id,
      ip: this.extractMeta(req).ip,
    });
  }

  @Delete('users/:id')
  @Roles(Role.DIRECTION)
  @HttpCode(HttpStatus.OK)
  removeUser(@Param('id') id: string, @Req() req: Request) {
    const actor = (req as any).user as { id?: string };
    return this.authService.deleteOrDeactivateUser(id, {
      id: actor?.id,
      ip: this.extractMeta(req).ip,
    });
  }
}
