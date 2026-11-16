import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Role,
  isDirectorAccount,
  resolveDefaultAccessForRole,
  sanitizeScreenAccess,
  sanitizeSpecialPermissions,
  ScreenAccessMap,
  SpecialPermissionsMap,
  StarterProfileKey,
} from '@residence-blue/shared';
import { SessionRevocationService } from './session-revocation.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/security/crypto.service';
import { AuditService, appendChainedAuditLog } from '../common/audit/audit.service';
import {
  ChangeInitialPasswordDto,
  CreateUserDto,
  LoginDto,
  UpdateUserDto,
} from './dto/auth.dto';
import {
  hashPassword,
  isArgon2idHash,
  validatePasswordPolicy,
  verifyPassword,
} from './password-hash.util';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  INACTIVITY_TIMEOUT_MS,
  REFRESH_COOKIE_NAME,
  signJwt,
} from './jwt.util';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  deviceLabel?: string;
}

export interface IssuedAuthResult {
  status: 'AUTHENTICATED';
  accessToken: string;
  expiresInSeconds: number;
  inactivityTimeoutSeconds: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    jobTitle: string;
    role: string;
    isPrimaryAdmin: boolean;
    mustChangePassword: boolean;
    starterProfile: StarterProfileKey;
    screenAccess: ScreenAccessMap;
    specialPermissions: SpecialPermissionsMap;
    totpEnabled: boolean;
    totpRequired: boolean;
  };
  refreshTokenRaw: string;
  refreshMaxAgeMs: number;
  backupCodes?: string[];
}

interface ThrottleBucket {
  failures: number;
  windowStartMs: number;
  lockedUntilMs: number;
}

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const REFRESH_TTL_8H_MS = 8 * 60 * 60 * 1000;
const REFRESH_TTL_2H_MS = 2 * 60 * 60 * 1000;
const GENERIC_INVALID_CREDENTIALS_MSG = 'Identifiants incorrects.';
const GENERIC_LOCKED_MSG =
  'Trop de tentatives de connexion. Veuillez patienter avant de réessayer.';

@Injectable()
export class AuthService {
  private readonly accountBuckets = new Map<string, ThrottleBucket>();
  private readonly ipBuckets = new Map<string, ThrottleBucket>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly sessionRevocation?: SessionRevocationService,
  ) {}

  isTotpMandatory(_role: string): boolean {
    return false;
  }

  private sanitizeUser(u: any) {
    const isDirector = isDirectorAccount(u);
    const defaults = resolveDefaultAccessForRole(u.role, isDirector);
    const screenAccess = isDirector
      ? defaults.screenAccess
      : sanitizeScreenAccess(u.screenAccess, defaults.screenAccess);
    const specialPermissions = isDirector
      ? defaults.specialPermissions
      : sanitizeSpecialPermissions(u.specialPermissions, defaults.specialPermissions);
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName || u.email,
      jobTitle: u.jobTitle || '',
      role: u.role,
      isActive: u.isActive,
      isPrimaryAdmin: Boolean(u.isPrimaryAdmin),
      mustChangePassword: Boolean(u.mustChangePassword),
      starterProfile: (u.starterProfile || defaults.starterProfile) as StarterProfileKey,
      screenAccess,
      specialPermissions,
      totpEnabled: Boolean(u.totpEnabled),
      totpRequired: false,
      lastLoginAt: u.lastLoginAt || null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  private hashOpaqueToken(raw: string): string {
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  private deriveDeviceLabel(meta?: RequestMeta): string {
    if (meta?.deviceLabel?.trim()) {
      return meta.deviceLabel.trim().slice(0, 120);
    }
    const ua = (meta?.userAgent || '').trim();
    if (!ua) return 'Navigateur web';
    if (/mobile|android|iphone|ipad/i.test(ua)) return 'Appareil mobile';
    if (/playwright|headless|supertest/i.test(ua)) return 'Poste automatisé / API';
    if (/edg\//i.test(ua)) return 'Microsoft Edge';
    if (/firefox/i.test(ua)) return 'Mozilla Firefox';
    if (/chrome/i.test(ua)) return 'Google Chrome';
    if (/safari/i.test(ua)) return 'Safari';
    return 'Navigateur web';
  }

  private normalizeIp(ip?: string): string {
    return (ip || 'unknown').split(',')[0].trim() || 'unknown';
  }

  private getBucketLockRemainingMs(map: Map<string, ThrottleBucket>, key: string): number {
    const b = map.get(key);
    if (!b) return 0;
    const now = Date.now();
    if (b.lockedUntilMs > now) {
      return b.lockedUntilMs - now;
    }
    if (now - b.windowStartMs > ATTEMPT_WINDOW_MS) {
      map.delete(key);
      return 0;
    }
    return 0;
  }

  private recordBucketFailure(map: Map<string, ThrottleBucket>, key: string): boolean {
    const now = Date.now();
    let b = map.get(key);
    if (!b || now - b.windowStartMs > ATTEMPT_WINDOW_MS) {
      b = { failures: 0, windowStartMs: now, lockedUntilMs: 0 };
    }
    b.failures += 1;
    if (b.failures >= MAX_ATTEMPTS) {
      b.lockedUntilMs = now + LOCK_DURATION_MS;
      map.set(key, b);
      return true;
    }
    map.set(key, b);
    return false;
  }

  private clearThrottleForSuccess(loginKey: string, ipKey: string): void {
    this.accountBuckets.delete(loginKey);
    this.ipBuckets.delete(ipKey);
  }

  private async logAudit(
    userId: string | null | undefined,
    action: string,
    entity: string,
    entityId?: string | null,
    after?: unknown,
    ip?: string | null,
    tx?: any,
  ) {
    if (this.auditService) {
      await this.auditService.log(
        { userId, action, entity, entityId, after, ip },
        tx,
      );
      return;
    }
    const client = tx || this.prisma;
    await appendChainedAuditLog(client, {
      userId: userId || null,
      action,
      entity,
      entityId: entityId || null,
      after,
      ip: ip || null,
    });
  }

  async revokeAllUserSessions(
    userId: string,
    reason: string,
    txClient?: any,
  ): Promise<void> {
    const client = txClient || this.prisma;
    await client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    if (!txClient) {
      this.sessionRevocation?.notifyUserRevoked(userId);
    }
  }

  private async issueSession(
    user: any,
    stayConnected8h: boolean,
    meta?: RequestMeta,
    extra?: { backupCodes?: string[]; twoFactorMethod?: string },
  ): Promise<IssuedAuthResult> {
    const familyId = crypto.randomUUID();
    const rawRefresh = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashOpaqueToken(rawRefresh);
    const refreshMaxAgeMs = stayConnected8h ? REFRESH_TTL_8H_MS : REFRESH_TTL_2H_MS;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + refreshMaxAgeMs);
    const ipAddress = this.normalizeIp(meta?.ip);
    const userAgent = (meta?.userAgent || '').slice(0, 300) || null;
    const deviceLabel = this.deriveDeviceLabel(meta);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          familyId,
          deviceLabel,
          userAgent,
          ipAddress,
          lastUsedAt: now,
          expiresAt,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLogins: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      });

      await this.logAudit(
        user.id,
        'LOGIN_SUCCESS',
        'User',
        user.id,
        {
          role: user.role,
          familyId,
          deviceLabel,
          ...(extra?.twoFactorMethod ? { twoFactorMethod: extra.twoFactorMethod } : {}),
        },
        ipAddress,
        tx,
      );
    });

    const accessToken = signJwt(
      {
        sub: user.id,
        email: user.email,
        fullName: user.fullName || user.email,
        role: user.role,
        sid: familyId,
        jti: crypto.randomUUID(),
        type: 'access',
      },
      ACCESS_TOKEN_TTL_SECONDS,
    );

    return {
      status: 'AUTHENTICATED',
      accessToken,
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      inactivityTimeoutSeconds: Math.floor(INACTIVITY_TIMEOUT_MS / 1000),
      user: this.sanitizeUser(user),
      refreshTokenRaw: rawRefresh,
      refreshMaxAgeMs,
    };
  }

  async login(
    dto: LoginDto,
    meta?: RequestMeta,
  ): Promise<IssuedAuthResult> {
    const loginNormalized = dto.login.trim().toLowerCase();
    const ipKey = this.normalizeIp(meta?.ip);

    // 1. Vérification du throttling par compte ET par IP avant toute fuite d'information
    if (
      this.getBucketLockRemainingMs(this.ipBuckets, ipKey) > 0 ||
      this.getBucketLockRemainingMs(this.accountBuckets, loginNormalized) > 0
    ) {
      throw new HttpException(GENERIC_LOCKED_MSG, HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { email: loginNormalized },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(GENERIC_LOCKED_MSG, HttpStatus.TOO_MANY_REQUESTS);
    }

    // 2. Compte absent, supprimé ou désactivé : même logique de comptage et même message
    if (!user || !user.isActive || user.deletedAt) {
      const accLocked = this.recordBucketFailure(this.accountBuckets, loginNormalized);
      const ipLocked = this.recordBucketFailure(this.ipBuckets, ipKey);
      if (accLocked || ipLocked) {
        throw new HttpException(GENERIC_LOCKED_MSG, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS_MSG);
    }

    // 3. Vérification mot de passe (argon2id ou migration depuis scrypt)
    const passwordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      const nextFailures = user.failedLogins + 1;
      const shouldLock = nextFailures >= MAX_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: nextFailures,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      });
      await this.logAudit(
        user.id,
        'LOGIN_FAILED',
        'User',
        user.id,
        { failedLogins: nextFailures, locked: shouldLock },
        ipKey,
      );

      const accLocked = this.recordBucketFailure(this.accountBuckets, loginNormalized);
      const ipLocked = this.recordBucketFailure(this.ipBuckets, ipKey);
      if (shouldLock || accLocked || ipLocked) {
        throw new HttpException(GENERIC_LOCKED_MSG, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS_MSG);
    }

    // Ré-encodage transparent en argon2id si l'ancien hash était encore en scrypt
    if (!isArgon2idHash(user.passwordHash)) {
      const policy = validatePasswordPolicy(dto.password);
      if (policy.valid) {
        const upgraded = await hashPassword(dto.password);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: upgraded },
        });
      }
    }

    this.clearThrottleForSuccess(loginNormalized, ipKey);

    // 4. Connexion directe par mot de passe vérifié (double authentification supprimée)
    return this.issueSession(user, Boolean(dto.stayConnected8h), meta);
  }

  async refreshSession(
    rawRefreshToken: string | undefined,
    meta?: RequestMeta,
  ): Promise<IssuedAuthResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Jeton de rafraîchissement manquant.');
    }

    const tokenHash = this.hashOpaqueToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Jeton de rafraîchissement invalide.');
    }

    const now = new Date();
    const ipAddress = this.normalizeIp(meta?.ip);

    // Détection de réutilisation : si un jeton déjà utilisé ou révoqué revient, toute la famille est révoquée !
    if (existing.usedAt !== null || existing.revokedAt !== null) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'REUSE_DETECTED' },
      });
      await this.logAudit(
        existing.userId,
        'TOKEN_REUSE_DETECTED',
        'RefreshToken',
        existing.familyId,
        { compromisedTokenId: existing.id, familyId: existing.familyId },
        ipAddress,
      );
      throw new UnauthorizedException(
        'Réutilisation suspecte de session détectée : toute la session a été révoquée.',
      );
    }

    if (!existing.user || !existing.user.isActive || existing.user.deletedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'ACCOUNT_DEACTIVATED' },
      });
      throw new UnauthorizedException('Compte désactivé.');
    }

    if (existing.expiresAt <= now) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'EXPIRED' },
      });
      throw new UnauthorizedException('Session expirée.');
    }

    // Contrôle d'inactivité (30 minutes maximum sans activité)
    if (now.getTime() - new Date(existing.lastUsedAt).getTime() > INACTIVITY_TIMEOUT_MS) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'INACTIVITY_TIMEOUT' },
      });
      await this.logAudit(
        existing.userId,
        'SESSION_INACTIVITY_EXPIRED',
        'RefreshToken',
        existing.familyId,
        { familyId: existing.familyId },
        ipAddress,
      );
      throw new UnauthorizedException('Session expirée suite à 30 minutes d’inactivité.');
    }

    // Rotation atomique du jeton dans la même famille
    const nextRawRefresh = crypto.randomBytes(48).toString('base64url');
    const nextTokenHash = this.hashOpaqueToken(nextRawRefresh);
    const remainingLifetimeMs = Math.max(
      existing.expiresAt.getTime() - now.getTime(),
      ACCESS_TOKEN_TTL_SECONDS * 1000,
    );

    await this.prisma.$transaction(async (tx) => {
      const nextCreated = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: nextTokenHash,
          familyId: existing.familyId,
          deviceLabel: existing.deviceLabel || this.deriveDeviceLabel(meta),
          userAgent: (meta?.userAgent || existing.userAgent || '').slice(0, 300) || null,
          ipAddress,
          lastUsedAt: now,
          expiresAt: existing.expiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: {
          usedAt: now,
          replacedByTokenId: nextCreated.id,
        },
      });
    });

    const accessToken = signJwt(
      {
        sub: existing.user.id,
        email: existing.user.email,
        fullName: existing.user.fullName || existing.user.email,
        role: existing.user.role,
        sid: existing.familyId,
        jti: crypto.randomUUID(),
        type: 'access',
      },
      ACCESS_TOKEN_TTL_SECONDS,
    );

    return {
      status: 'AUTHENTICATED',
      accessToken,
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      inactivityTimeoutSeconds: Math.floor(INACTIVITY_TIMEOUT_MS / 1000),
      user: this.sanitizeUser(existing.user),
      refreshTokenRaw: nextRawRefresh,
      refreshMaxAgeMs: remainingLifetimeMs,
    };
  }

  async logoutByCookieOrSession(
    rawRefreshToken?: string,
    sid?: string,
    actorId?: string,
    ip?: string,
  ): Promise<void> {
    const now = new Date();
    let familyIdToRevoke = sid;
    let userId = actorId;

    if (rawRefreshToken) {
      const tokenHash = this.hashOpaqueToken(rawRefreshToken);
      const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (token) {
        familyIdToRevoke = token.familyId;
        userId = token.userId;
      }
    }

    if (familyIdToRevoke) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: familyIdToRevoke, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'LOGOUT' },
      });
      await this.logAudit(
        userId,
        'LOGOUT',
        'RefreshToken',
        familyIdToRevoke,
        { familyId: familyIdToRevoke },
        ip,
      );
    }
  }

  async listSessions(userIdFilter?: string, currentSid?: string) {
    const now = new Date();
    const inactivityCutoff = new Date(now.getTime() - INACTIVITY_TIMEOUT_MS);

    const rows = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        usedAt: null,
        expiresAt: { gt: now },
        lastUsedAt: { gte: inactivityCutoff },
        ...(userIdFilter ? { userId: userIdFilter } : {}),
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, role: true, isActive: true },
        },
      },
      orderBy: [{ lastUsedAt: 'desc' }],
    });

    const seenFamilies = new Set<string>();
    const sessions: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      if (!row.user?.isActive || seenFamilies.has(row.familyId)) continue;
      seenFamilies.add(row.familyId);
      sessions.push({
        familyId: row.familyId,
        isCurrentSession: currentSid ? row.familyId === currentSid : false,
        userId: row.userId,
        userEmail: row.user.email,
        userName: row.user.fullName || row.user.email,
        userRole: row.user.role,
        deviceLabel: row.deviceLabel || 'Navigateur web',
        userAgent: row.userAgent || '',
        ipAddress: row.ipAddress || '',
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt,
        expiresAt: row.expiresAt,
      });
    }

    return sessions;
  }

  async revokeSessionByFamilyId(
    familyId: string,
    actor: { id: string; role: string },
    ip?: string,
  ) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { familyId },
      select: { id: true, userId: true, revokedAt: true },
    });

    if (tokens.length === 0) {
      throw new NotFoundException('Session introuvable.');
    }

    const ownerId = tokens[0].userId;
    if (actor.role !== Role.DIRECTION && ownerId !== actor.id) {
      throw new ForbiddenException(
        'Seule la Direction peut révoquer la session d’un autre utilisateur.',
      );
    }

    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: ownerId === actor.id ? 'USER_REVOKED' : 'ADMIN_REVOKED',
      },
    });

    await this.logAudit(
      actor.id,
      'SESSION_REVOKED',
      'RefreshToken',
      familyId,
      { targetUserId: ownerId, revokedBy: actor.id },
      ip,
    );

    return { revoked: true, familyId };
  }

  async getMe(userId: string, sid?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Compte introuvable ou désactivé.');
    }
    return {
      ...this.sanitizeUser(user),
      sid: sid || null,
    };
  }

  async findAllUsers() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'asc' }],
    });
    return users.map((u) => this.sanitizeUser(u));
  }

  async findOneUser(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException(`Utilisateur "${id}" introuvable.`);
    return this.sanitizeUser(user);
  }

  async createUser(dto: CreateUserDto, actor?: { id?: string; ip?: string }) {
    if (dto.role === Role.DIRECTION) {
      throw new ForbiddenException(
        'Il n’existe qu’un seul compte directeur ; impossible d’en créer un second.',
      );
    }
    const cleanEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      throw new ConflictException(`Un compte existe déjà avec l'adresse ${cleanEmail}.`);
    }

    const policy = validatePasswordPolicy(dto.password);
    if (!policy.valid) {
      throw new BadRequestException(policy.reason);
    }

    const passwordHash = await hashPassword(dto.password);
    const resolvedAccess = resolveDefaultAccessForRole(dto.role);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          fullName: dto.fullName.trim(),
          jobTitle: dto.jobTitle?.trim() || null,
          passwordHash,
          role: dto.role as any,
          isActive: dto.isActive ?? true,
          starterProfile: resolvedAccess.starterProfile,
          screenAccess: resolvedAccess.screenAccess as any,
          specialPermissions: resolvedAccess.specialPermissions as any,
        },
      });

      await this.logAudit(
        actor?.id || user.id,
        'USER_CREATE',
        'User',
        user.id,
        {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        actor?.ip,
        tx,
      );

      return user;
    });

    return this.sanitizeUser(created);
  }

  async updateUser(id: string, dto: UpdateUserDto, actor?: { id?: string; ip?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Utilisateur "${id}" introuvable.`);
    if (existing.isPrimaryAdmin || existing.role === Role.DIRECTION || dto.role === Role.DIRECTION) {
      throw new ForbiddenException('Le compte directeur principal est protégé.');
    }

    const updateData: Record<string, any> = {};
    if (dto.email) updateData.email = dto.email.trim().toLowerCase();
    if (dto.fullName) updateData.fullName = dto.fullName.trim();
    if (dto.jobTitle !== undefined) updateData.jobTitle = dto.jobTitle.trim() || null;
    if (dto.role) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password) {
      const policy = validatePasswordPolicy(dto.password);
      if (!policy.valid) {
        throw new BadRequestException(policy.reason);
      }
      updateData.passwordHash = await hashPassword(dto.password);
    }

    const shouldRevokeSessions =
      dto.isActive === false ||
      (dto.role && dto.role !== existing.role) ||
      Boolean(dto.password);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: updateData,
      });

      if (shouldRevokeSessions) {
        await this.revokeAllUserSessions(
          id,
          dto.isActive === false ? 'ACCOUNT_DEACTIVATED' : 'CREDENTIALS_OR_ROLE_CHANGED',
          tx,
        );
      }

      await this.logAudit(
        actor?.id || id,
        'USER_UPDATE',
        'User',
        id,
        {
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          isActive: u.isActive,
          sessionsRevoked: shouldRevokeSessions,
        },
        actor?.ip,
        tx,
      );

      return u;
    });

    if (shouldRevokeSessions) {
      this.sessionRevocation?.notifyUserRevoked(id);
    }
    return this.sanitizeUser(updated);
  }

  async deleteOrDeactivateUser(id: string, actor?: { id?: string; ip?: string }) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            createdReservations: true,
            receivedPayments: true,
            auditLogs: true,
          },
        },
      },
    });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Utilisateur "${id}" introuvable.`);
    if (existing.isPrimaryAdmin || existing.role === Role.DIRECTION) {
      throw new ForbiddenException(
        'Le compte directeur principal ne peut ni être supprimé ni être désactivé.',
      );
    }

    const auditCount = await this.prisma.auditLog.count({
      where: { userId: id },
    });

    const hasHistory =
      existing._count.createdReservations > 0 ||
      existing._count.receivedPayments > 0 ||
      auditCount > 0;

    if (hasHistory) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: { isActive: false },
        });
        await this.revokeAllUserSessions(id, 'ACCOUNT_DEACTIVATED', tx);
        await this.logAudit(
          actor?.id || id,
          'USER_DEACTIVATE',
          'User',
          id,
          { isActive: false },
          actor?.ip,
          tx,
        );
      });
      this.sessionRevocation?.notifyUserRevoked(id);
      return {
        deleted: false,
        deactivated: true,
        message: 'Compte désactivé et toutes ses sessions révoquées.',
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.revokeAllUserSessions(id, 'ACCOUNT_DELETED', tx);
      await tx.user.delete({ where: { id } });
      await this.logAudit(
        actor?.id || null,
        'USER_DELETE',
        'User',
        id,
        { email: existing.email },
        actor?.ip,
        tx,
      );
    });
    return { deleted: true, deactivated: false };
  }

  async changeInitialPassword(
    userId: string,
    dto: ChangeInitialPasswordDto,
    currentSid?: string,
    ip?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Compte introuvable ou désactivé.');
    }
    if (dto.currentPassword) {
      const ok = await verifyPassword(dto.currentPassword, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Mot de passe provisoire incorrect.');
      }
    }
    const sameAsProvisional = await verifyPassword(dto.newPassword, user.passwordHash);
    if (sameAsProvisional) {
      throw new BadRequestException(
        'Choisissez un mot de passe différent du mot de passe provisoire.',
      );
    }
    const policy = validatePasswordPolicy(dto.newPassword);
    if (!policy.valid) {
      throw new BadRequestException(policy.reason);
    }
    const newHash = await hashPassword(dto.newPassword);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, mustChangePassword: false },
      });
      await tx.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSid ? { familyId: { not: currentSid } } : {}),
        },
        data: { revokedAt: new Date(), revokedReason: 'INITIAL_PASSWORD_CHANGED' },
      });
      await this.logAudit(
        userId,
        'USER_INITIAL_PASSWORD_CHANGED',
        'User',
        userId,
        { mustChangePassword: false },
        ip,
        tx,
      );
      return u;
    });
    return this.sanitizeUser(updated);
  }

  static getCookieName(): string {
    return REFRESH_COOKIE_NAME;
  }
}
