import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AccessTokenPayload,
  INACTIVITY_TIMEOUT_MS,
  verifyJwt,
} from '../../auth/jwt.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const authHeader = request?.headers?.['authorization'];
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';

    if (isPublic) {
      // Sur les routes publiques (ex. /auth/logout), on attache l'utilisateur seulement si un JWT valide est fourni
      if (bearerToken) {
        const verified = verifyJwt<AccessTokenPayload>(bearerToken, 'access');
        if (verified?.sub && verified.role) {
          request.user = {
            id: verified.sub,
            email: verified.email,
            fullName: verified.fullName,
            role: verified.role,
            sid: verified.sid,
          };
        }
      }
      return true;
    }

    if (!bearerToken) {
      throw new UnauthorizedException(
        'Authentification requise : jeton Bearer manquant.',
      );
    }

    const payload = verifyJwt<AccessTokenPayload>(bearerToken, 'access');
    if (!payload || !payload.sub || !payload.role || !payload.sid) {
      throw new UnauthorizedException(
        'Jeton d’authentification invalide ou expiré.',
      );
    }

    // Vérification stricte en base : compte actif + session non révoquée + inactivité <= 30 min
    if (this.prisma && typeof (this.prisma as any).user?.findUnique === 'function') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Compte introuvable ou désactivé.');
      }

      if (typeof (this.prisma as any).refreshToken?.findFirst === 'function') {
        const now = new Date();
        const activeToken = await this.prisma.refreshToken.findFirst({
          where: {
            familyId: payload.sid,
            userId: user.id,
            revokedAt: null,
            usedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, lastUsedAt: true },
        });

        if (!activeToken) {
          throw new UnauthorizedException('Session révoquée ou expirée.');
        }

        const idleMs = now.getTime() - new Date(activeToken.lastUsedAt).getTime();
        if (idleMs > INACTIVITY_TIMEOUT_MS) {
          await this.prisma.refreshToken.updateMany({
            where: { familyId: payload.sid, revokedAt: null },
            data: { revokedAt: now, revokedReason: 'INACTIVITY_TIMEOUT' },
          });
          throw new UnauthorizedException(
            'Session expirée suite à 30 minutes d’inactivité.',
          );
        }

        if (idleMs > 60_000 && typeof (this.prisma as any).refreshToken?.update === 'function') {
          await this.prisma.refreshToken.update({
            where: { id: activeToken.id },
            data: { lastUsedAt: now },
          });
        }
      }

      request.user = {
        id: user.id,
        email: user.email,
        fullName: user.fullName || user.email,
        role: user.role,
        sid: payload.sid,
      };
      return true;
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
      sid: payload.sid,
    };
    return true;
  }
}
