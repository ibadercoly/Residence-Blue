import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Role,
  SCREEN_DEFINITIONS,
  SPECIAL_PERMISSION_DEFINITIONS,
  STARTER_PROFILES,
  ScreenAccessMap,
  SpecialPermissionsMap,
  StarterProfileKey,
  getStarterProfileByKey,
  inferRoleFromScreenAccess,
  isDirectorAccount,
  resolveDefaultAccessForRole,
  sanitizeScreenAccess,
  sanitizeSpecialPermissions,
} from '@residence-blue/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/security/crypto.service';
import { AuditService, appendChainedAuditLog } from '../common/audit/audit.service';
import { SessionRevocationService } from '../auth/session-revocation.service';
import {
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from '../auth/password-hash.util';
import {
  CreateManagedAccountDto,
  DeleteManagedAccountDto,
  UpdateDirectorCredentialsDto,
  UpdateManagedAccountDto,
} from './dto/administration.dto';

const VALID_LEVELS: ReadonlySet<string> = new Set(['AUCUN', 'LECTURE', 'ECRITURE']);
const VALID_SCREENS: ReadonlySet<string> = new Set(SCREEN_DEFINITIONS.map((s) => s.key));
const VALID_SPECIALS: ReadonlySet<string> = new Set(
  SPECIAL_PERMISSION_DEFINITIONS.map((p) => p.key),
);

interface RateBucket {
  count: number;
  windowStartMs: number;
  lockedUntilMs: number;
}

const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_WRONG_PASSWORD_ATTEMPTS = 5;
const MAX_ADMIN_WRITE_OPS = 40;

@Injectable()
export class AdministrationService {
  private readonly passwordFailureBuckets = new Map<string, RateBucket>();
  private readonly writeOpsBuckets = new Map<string, RateBucket>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly sessionRevocation: SessionRevocationService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  private checkRateLimit(
    buckets: Map<string, RateBucket>,
    key: string,
    limit: number,
    incrementNow = true,
  ): void {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (bucket && bucket.lockedUntilMs > now) {
      throw new HttpException(
        'Trop de tentatives récentes. Patientez quelques minutes avant de réessayer.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!incrementNow) return;
    if (!bucket || now - bucket.windowStartMs > RATE_WINDOW_MS) {
      buckets.set(key, { count: 1, windowStartMs: now, lockedUntilMs: 0 });
      return;
    }
    bucket.count += 1;
    if (bucket.count >= limit) {
      bucket.lockedUntilMs = now + RATE_WINDOW_MS;
      throw new HttpException(
        'Trop de tentatives récentes. Patientez quelques minutes avant de réessayer.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private clearRateBucket(buckets: Map<string, RateBucket>, key: string): void {
    buckets.delete(key);
  }

  private async logAudit(
    userId: string | null,
    action: string,
    entityId: string,
    after: Record<string, unknown>,
    ip?: string,
    txClient?: any,
  ): Promise<void> {
    if (txClient) {
      await appendChainedAuditLog(txClient, {
        userId,
        action,
        entity: 'User',
        entityId,
        after,
        ip: ip || null,
      });
      return;
    }
    if (this.auditService) {
      await this.auditService.log({
        userId,
        action,
        entity: 'User',
        entityId,
        after,
        ip: ip || null,
      });
    }
  }

  private generateProvisionalPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#%*-';
    const all = upper + lower + digits + symbols;

    for (let attempt = 0; attempt < 20; attempt++) {
      const picks = [
        upper[crypto.randomInt(upper.length)],
        lower[crypto.randomInt(lower.length)],
        digits[crypto.randomInt(digits.length)],
        symbols[crypto.randomInt(symbols.length)],
      ];
      while (picks.length < 12) {
        picks.push(all[crypto.randomInt(all.length)]);
      }
      for (let i = picks.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        const tmp = picks[i];
        picks[i] = picks[j];
        picks[j] = tmp;
      }
      const candidate = picks.join('');
      if (validatePasswordPolicy(candidate).valid) {
        return candidate;
      }
    }
    return `Blue@${crypto.randomBytes(5).toString('hex')}9`;
  }

  private validateScreenAccessPayload(raw: Record<string, unknown>): ScreenAccessMap {
    for (const [k, v] of Object.entries(raw)) {
      if (!VALID_SCREENS.has(k)) {
        throw new BadRequestException(
          `L’écran « ${k} » n’est pas attribuable.`,
        );
      }
      if (typeof v !== 'string' || !VALID_LEVELS.has(v)) {
        throw new BadRequestException(
          `Niveau d’accès invalide pour l’écran « ${k} ».`,
        );
      }
    }
    return sanitizeScreenAccess(raw);
  }

  private validateSpecialPermissionsPayload(
    raw: Record<string, unknown>,
  ): SpecialPermissionsMap {
    for (const [k, v] of Object.entries(raw)) {
      if (!VALID_SPECIALS.has(k)) {
        throw new BadRequestException(
          `Le droit particulier « ${k} » n’existe pas ou reste réservé au directeur.`,
        );
      }
      if (typeof v !== 'boolean') {
        throw new BadRequestException(
          `Valeur invalide pour le droit « ${k} ».`,
        );
      }
    }
    return sanitizeSpecialPermissions(raw);
  }

  private assertStarterProfileAssignable(profileKey: string): StarterProfileKey {
    if (profileKey === 'DIRECTEUR' || profileKey === 'DIRECTION') {
      throw new ForbiddenException(
        'Il n’existe qu’un seul compte directeur ; aucun second administrateur ne peut être créé.',
      );
    }
    const found = getStarterProfileByKey(profileKey);
    if (!found) {
      throw new BadRequestException(`Profil de départ inconnu : « ${profileKey} ».`);
    }
    return found.key;
  }

  private formatManagedUser(u: any, hasPrimaryAdminInDb = true) {
    const isPrimary = Boolean(u.isPrimaryAdmin);
    const isDirector = isPrimary || (!hasPrimaryAdminInDb && u.role === Role.DIRECTION);
    const defaults = resolveDefaultAccessForRole(u.role, isDirector);
    const screenAccess = isDirector
      ? defaults.screenAccess
      : sanitizeScreenAccess(u.screenAccess, defaults.screenAccess);
    const specialPermissions = isDirector
      ? defaults.specialPermissions
      : sanitizeSpecialPermissions(u.specialPermissions, defaults.specialPermissions);

    const resolvedStarter = isDirector
      ? 'DIRECTEUR'
      : u.role === Role.DIRECTION && !isPrimary
        ? (u.starterProfile && u.starterProfile !== 'DIRECTEUR'
            ? u.starterProfile
            : 'NON_PRINCIPAL_DIRECTION')
        : u.starterProfile || defaults.starterProfile;

    return {
      id: u.id,
      email: u.email,
      fullName: (u.fullName || '').trim(),
      jobTitle: u.jobTitle || '',
      role: u.role,
      isActive: Boolean(u.isActive),
      isPrimaryAdmin: isPrimary,
      isProtectedDirector: isDirector,
      mustChangePassword: Boolean(u.mustChangePassword),
      starterProfile: resolvedStarter as StarterProfileKey,
      screenAccess,
      specialPermissions,
      totpEnabled: Boolean(u.totpEnabled),
      lastLoginAt: u.lastLoginAt || null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  getReferenceModel() {
    return {
      screens: SCREEN_DEFINITIONS,
      specialPermissions: SPECIAL_PERMISSION_DEFINITIONS,
      starterProfiles: STARTER_PROFILES,
    };
  }

  async listAccounts(search?: string) {
    const q = search?.trim();
    const [users, primaryCount] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  { fullName: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ isPrimaryAdmin: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.user.count({
        where: { isPrimaryAdmin: true, deletedAt: null },
      }),
    ]);
    return users.map((u) => this.formatManagedUser(u, primaryCount > 0));
  }

  async getAccount(id: string) {
    const [user, primaryCount] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { isPrimaryAdmin: true, deletedAt: null },
      }),
    ]);
    if (!user) {
      throw new NotFoundException('Compte introuvable.');
    }
    return this.formatManagedUser(user, primaryCount > 0);
  }

  async createAccount(
    dto: CreateManagedAccountDto,
    actorId: string,
    ip?: string,
  ) {
    this.checkRateLimit(this.writeOpsBuckets, `write:${actorId}`, MAX_ADMIN_WRITE_OPS, true);

    const starterProfile = this.assertStarterProfileAssignable(dto.starterProfile);
    const screenAccess = this.validateScreenAccessPayload(dto.screenAccess);
    const specialPermissions = this.validateSpecialPermissionsPayload(dto.specialPermissions);

    if (starterProfile === 'ASSISTANT_RESTAURANT' && screenAccess.cuisine !== 'AUCUN') {
      throw new ForbiddenException(
        'L’assistant(e) du restaurant ne peut jamais accéder à l’écran Cuisine.',
      );
    }

    if (!dto.fullName || dto.fullName.trim().length < 2) {
      throw new BadRequestException('Le nom complet est obligatoire (2 caractères minimum).');
    }

    const cleanEmail = dto.email.trim().toLowerCase();
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });
    if (existingEmail) {
      throw new ConflictException(`Un compte utilise déjà l’adresse ${cleanEmail}.`);
    }

    const provisionalPassword = this.generateProvisionalPassword();
    const passwordHash = await hashPassword(provisionalPassword);
    const derivedRole = inferRoleFromScreenAccess(screenAccess, starterProfile);
    if (derivedRole === Role.DIRECTION) {
      throw new ForbiddenException('Impossible de créer un compte directeur.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          fullName: dto.fullName.trim(),
          passwordHash,
          role: derivedRole as any,
          isActive: true,
          isPrimaryAdmin: false,
          mustChangePassword: true,
          starterProfile,
          screenAccess: screenAccess as any,
          specialPermissions: specialPermissions as any,
        },
      });

      await this.logAudit(
        actorId,
        'ADMIN_COMPTE_CREE',
        user.id,
        {
          email: user.email,
          fullName: user.fullName,
          starterProfile,
          role: user.role,
          screenAccess,
          specialPermissions,
          mustChangePassword: true,
        },
        ip,
        tx,
      );

      return user;
    });

    return {
      account: this.formatManagedUser(created),
      provisionalPassword,
    };
  }

  async updateAccount(
    id: string,
    dto: UpdateManagedAccountDto,
    actorId: string,
    ip?: string,
  ) {
    this.checkRateLimit(this.writeOpsBuckets, `write:${actorId}`, MAX_ADMIN_WRITE_OPS, true);

    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Compte introuvable.');
    }
    if (existing.isPrimaryAdmin || existing.role === Role.DIRECTION) {
      throw new ForbiddenException(
        'Le compte directeur principal est protégé : ses accès et son profil ne peuvent jamais être modifiés.',
      );
    }

    const starterProfile = dto.starterProfile
      ? this.assertStarterProfileAssignable(dto.starterProfile)
      : ((existing.starterProfile || resolveDefaultAccessForRole(existing.role).starterProfile) as StarterProfileKey);

    const currentFormatted = this.formatManagedUser(existing);
    const screenAccess: ScreenAccessMap = dto.screenAccess
      ? this.validateScreenAccessPayload(dto.screenAccess)
      : currentFormatted.screenAccess;
    const specialPermissions: SpecialPermissionsMap = dto.specialPermissions
      ? this.validateSpecialPermissionsPayload(dto.specialPermissions)
      : currentFormatted.specialPermissions;

    if (starterProfile === 'ASSISTANT_RESTAURANT' && screenAccess.cuisine !== 'AUCUN') {
      throw new ForbiddenException(
        'L’assistant(e) du restaurant ne peut jamais accéder à l’écran Cuisine.',
      );
    }

    let nextEmail = existing.email;
    if (dto.email && dto.email.trim().toLowerCase() !== existing.email) {
      nextEmail = dto.email.trim().toLowerCase();
      const collision = await this.prisma.user.findUnique({
        where: { email: nextEmail },
        select: { id: true },
      });
      if (collision && collision.id !== id) {
        throw new ConflictException(`L’adresse ${nextEmail} est déjà utilisée.`);
      }
    }

    const derivedRole = inferRoleFromScreenAccess(screenAccess, starterProfile);
    if (derivedRole === Role.DIRECTION) {
      throw new ForbiddenException('Impossible d’attribuer le rôle directeur.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          fullName: dto.fullName ? dto.fullName.trim() : existing.fullName,
          email: nextEmail,
          role: derivedRole as any,
          starterProfile,
          screenAccess: screenAccess as any,
          specialPermissions: specialPermissions as any,
        },
      });

      await this.logAudit(
        actorId,
        'ADMIN_COMPTE_ACCES_MODIFIES',
        id,
        {
          email: user.email,
          fullName: user.fullName,
          starterProfile,
          role: user.role,
          screenAccess,
          specialPermissions,
        },
        ip,
        tx,
      );

      return user;
    });

    return this.formatManagedUser(updated);
  }

  async resetPassword(id: string, actorId: string, ip?: string) {
    this.checkRateLimit(this.writeOpsBuckets, `write:${actorId}`, MAX_ADMIN_WRITE_OPS, true);

    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Compte introuvable.');
    }
    if (existing.isPrimaryAdmin || existing.role === Role.DIRECTION) {
      throw new ForbiddenException(
        'Le compte directeur principal modifie son mot de passe uniquement avec son mot de passe actuel.',
      );
    }

    const provisionalPassword = this.generateProvisionalPassword();
    const passwordHash = await hashPassword(provisionalPassword);

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLogins: 0,
          lockedUntil: null,
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ADMIN_PASSWORD_RESET' },
      });

      await this.logAudit(
        actorId,
        'ADMIN_MOT_DE_PASSE_REINITIALISE',
        id,
        {
          email: user.email,
          mustChangePassword: true,
          sessionsRevoked: true,
        },
        ip,
        tx,
      );

      return user;
    });

    this.sessionRevocation.notifyUserRevoked(id);

    return {
      account: this.formatManagedUser(updated),
      provisionalPassword,
    };
  }

  async deactivateAccount(id: string, actorId: string, ip?: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Compte introuvable.');
    }
    if (existing.isPrimaryAdmin || existing.role === Role.DIRECTION) {
      throw new ForbiddenException(
        'Le compte directeur principal ne peut jamais être désactivé.',
      );
    }
    if (existing.id === actorId) {
      throw new ForbiddenException('Vous ne pouvez pas désactiver votre propre compte.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ACCOUNT_DEACTIVATED' },
      });

      await this.logAudit(
        actorId,
        'ADMIN_COMPTE_DESACTIVE',
        id,
        { email: user.email, isActive: false },
        ip,
        tx,
      );

      return user;
    });

    this.sessionRevocation.notifyUserRevoked(id);

    return this.formatManagedUser(updated);
  }

  async reactivateAccount(id: string, actorId: string, ip?: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Compte introuvable.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          isActive: true,
          failedLogins: 0,
          lockedUntil: null,
        },
      });

      await this.logAudit(
        actorId,
        'ADMIN_COMPTE_REACTIVE',
        id,
        { email: user.email, isActive: true },
        ip,
        tx,
      );

      return user;
    });

    return this.formatManagedUser(updated);
  }

  async deleteAccount(
    id: string,
    dto: DeleteManagedAccountDto,
    actorId: string,
    ip?: string,
  ) {
    this.checkRateLimit(
      this.passwordFailureBuckets,
      `pwd:${actorId}`,
      MAX_WRONG_PASSWORD_ATTEMPTS,
      false,
    );

    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Compte introuvable.');
    }
    if (existing.isPrimaryAdmin || existing.role === Role.DIRECTION) {
      throw new ForbiddenException(
        'Le compte directeur principal ne peut jamais être supprimé.',
      );
    }
    if (existing.id === actorId) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer votre propre compte.');
    }

    const expectedName = (existing.fullName || existing.email).trim().toLowerCase();
    if (dto.confirmName.trim().toLowerCase() !== expectedName) {
      throw new BadRequestException(
        'Le nom saisi ne correspond pas au compte à supprimer.',
      );
    }

    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (!actor) {
      throw new ForbiddenException('Directeur introuvable.');
    }

    const passwordValid = await verifyPassword(dto.directorPassword, actor.passwordHash);
    if (!passwordValid) {
      this.checkRateLimit(
        this.passwordFailureBuckets,
        `pwd:${actorId}`,
        MAX_WRONG_PASSWORD_ATTEMPTS,
        true,
      );
      throw new ForbiddenException('Mot de passe du directeur incorrect.');
    }
    this.clearRateBucket(this.passwordFailureBuckets, `pwd:${actorId}`);

    const baseName = existing.fullName || existing.email;
    const deletedDisplayName = baseName.endsWith('(compte supprimé)')
      ? baseName
      : `${baseName} (compte supprimé)`;
    const originalEmail = existing.email;
    const anonymizedEmail = `deleted.${existing.id}@supprime.residence-blue.local`;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'ACCOUNT_DELETED' },
      });

      await tx.payment.updateMany({
        where: { receivedById: id },
        data: { receivedByName: deletedDisplayName },
      });

      await tx.reservation.updateMany({
        where: { createdById: id },
        data: { createdByName: deletedDisplayName },
      });

      await tx.restaurantOrder.updateMany({
        where: { envoyeeById: id },
        data: { serverName: deletedDisplayName },
      });

      await tx.restaurantOrder.updateMany({
        where: { priseEnChargeById: id },
        data: { priseEnChargeByName: deletedDisplayName },
      });

      await tx.restaurantOrder.updateMany({
        where: { autoriseById: id },
        data: { autoriseByName: deletedDisplayName },
      });

      await tx.restaurantOrder.updateMany({
        where: { cancelledById: id },
        data: { cancelledByName: deletedDisplayName },
      });

      await tx.restaurantOrderEvent.updateMany({
        where: { userId: id },
        data: { userName: deletedDisplayName },
      });

      await tx.user.update({
        where: { id },
        data: {
          email: anonymizedEmail,
          fullName: deletedDisplayName,
          deletedDisplayName,
          deletedAt: now,
          isActive: false,
        },
      });

      await this.logAudit(
        actorId,
        'ADMIN_COMPTE_SUPPRIME',
        id,
        {
          deletedDisplayName,
          freedEmail: originalEmail,
        },
        ip,
        tx,
      );
    });

    this.sessionRevocation.notifyUserRevoked(id);

    return {
      deleted: true,
      id,
      deletedDisplayName,
      freedEmail: originalEmail,
    };
  }

  private verifyTotpCode(secretBase32: string, code: string): boolean {
    const clean = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) return false;

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const ch of secretBase32.toUpperCase().replace(/=+$/, '')) {
      const idx = alphabet.indexOf(ch);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    const key = Buffer.from(bytes);
    const currentStep = Math.floor(Date.now() / 30_000);
    for (const delta of [-1, 0, 1]) {
      const buf = Buffer.alloc(8);
      buf.writeBigUInt64BE(BigInt(currentStep + delta));
      const hmac = crypto.createHmac('sha1', key).update(buf).digest();
      const offset = hmac[hmac.length - 1] & 0x0f;
      const otp =
        (((hmac[offset] & 0x7f) << 24) |
          ((hmac[offset + 1] & 0xff) << 16) |
          ((hmac[offset + 2] & 0xff) << 8) |
          (hmac[offset + 3] & 0xff)) %
        1_000_000;
      if (String(otp).padStart(6, '0') === clean) {
        return true;
      }
    }
    return false;
  }

  async updateDirectorCredentials(
    actorId: string,
    currentSid: string | undefined,
    dto: UpdateDirectorCredentialsDto,
    ip?: string,
  ) {
    this.checkRateLimit(
      this.passwordFailureBuckets,
      `dir:${actorId}`,
      MAX_WRONG_PASSWORD_ATTEMPTS,
      false,
    );

    const nextFullName = dto.fullName?.trim();
    if (!nextFullName && !dto.email && !dto.newPassword) {
      throw new BadRequestException(
        'Renseignez un nouveau nom, une nouvelle adresse e-mail ou un nouveau mot de passe.',
      );
    }

    const director = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null },
    });
    if (!director || !isDirectorAccount(director)) {
      throw new ForbiddenException('Action réservée au compte directeur.');
    }

    const ok = await verifyPassword(dto.currentPassword, director.passwordHash);
    if (!ok) {
      this.checkRateLimit(
        this.passwordFailureBuckets,
        `dir:${actorId}`,
        MAX_WRONG_PASSWORD_ATTEMPTS,
        true,
      );
      throw new ForbiddenException('Mot de passe actuel incorrect.');
    }

    if (director.totpEnabled && director.totpSecretEncrypted) {
      if (!dto.totpCode?.trim()) {
        throw new ForbiddenException(
          'Le code de double authentification est requis.',
        );
      }
      const decryptedSecret = this.cryptoService.decrypt(director.totpSecretEncrypted);
      if (!decryptedSecret || !this.verifyTotpCode(decryptedSecret, dto.totpCode)) {
        this.checkRateLimit(
          this.passwordFailureBuckets,
          `dir:${actorId}`,
          MAX_WRONG_PASSWORD_ATTEMPTS,
          true,
        );
        throw new ForbiddenException('Code de double authentification invalide.');
      }
    }
    this.clearRateBucket(this.passwordFailureBuckets, `dir:${actorId}`);

    const updateData: Record<string, unknown> = {};
    if (nextFullName && nextFullName !== director.fullName) {
      updateData.fullName = nextFullName;
    }
    if (dto.email && dto.email.trim().toLowerCase() !== director.email) {
      const cleanEmail = dto.email.trim().toLowerCase();
      const conflict = await this.prisma.user.findUnique({
        where: { email: cleanEmail },
        select: { id: true },
      });
      if (conflict && conflict.id !== director.id) {
        throw new ConflictException(`L’adresse ${cleanEmail} est déjà utilisée.`);
      }
      updateData.email = cleanEmail;
    }

    if (dto.newPassword) {
      const policy = validatePasswordPolicy(dto.newPassword);
      if (!policy.valid) {
        throw new BadRequestException(policy.reason);
      }
      updateData.passwordHash = await hashPassword(dto.newPassword);
      updateData.mustChangePassword = false;
    }

    let revokedCount = 0;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: director.id },
        data: updateData,
      });

      if (updateData.email || updateData.passwordHash) {
        const revRes = await tx.refreshToken.updateMany({
          where: {
            userId: director.id,
            revokedAt: null,
            ...(currentSid ? { familyId: { not: currentSid } } : {}),
          },
          data: {
            revokedAt: new Date(),
            revokedReason: 'DIRECTOR_CREDENTIALS_CHANGED',
          },
        });
        revokedCount = revRes.count;
      }

      await this.logAudit(
        director.id,
        'ADMIN_DIRECTEUR_IDENTIFIANTS_MODIFIES',
        director.id,
        {
          fullNameChanged: Boolean(updateData.fullName),
          fullName: u.fullName,
          emailChanged: Boolean(updateData.email),
          email: u.email,
          passwordChanged: Boolean(updateData.passwordHash),
          otherSessionsRevoked: revokedCount,
        },
        ip,
        tx,
      );

      return u;
    });

    return {
      user: this.formatManagedUser(updated),
      otherSessionsRevoked: revokedCount,
    };
  }
}
