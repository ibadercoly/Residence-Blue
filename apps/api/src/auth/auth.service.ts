import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, LoginDto, UpdateUserDto } from './dto/auth.dto';
import { hashPassword, verifyPassword } from './password-hash.util';
import { Role as PrismaRole } from '@prisma/client';
import { createHmac } from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private signToken(payload: { sub: string; email: string; role: string }): string {
    const secret = process.env.JWT_SECRET || 'residence-blue-dev-secret-key';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 8 * 3600,
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  private toPublicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName || user.email.split('@')[0],
      jobTitle: user.jobTitle || this.defaultJobTitle(user.role),
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private defaultJobTitle(role: string): string {
    switch (role) {
      case 'DIRECTION':
        return "Directrice d'Exploitation";
      case 'RECEPTION':
        return 'Chef de Réception';
      case 'RESTAURANT':
        return "Maître d'Hôtel";
      case 'SERVEUR':
        return 'Serveur Salle & Piscine';
      case 'CUISINE':
        return 'Chef de Cuisine';
      default:
        return 'Collaborateur Résidence Blue';
    }
  }

  async login(dto: LoginDto) {
    const email = (dto.login || '').trim().toLowerCase();
    if (!email || !dto.password) {
      throw new BadRequestException('Identifiant et mot de passe requis.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(
        'Identifiants incorrects. Veuillez vérifier votre adresse ou mot de passe.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Ce compte utilisateur a été désactivé.');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Ce compte est temporairement verrouillé suite à plusieurs échecs.');
    }

    const valid = verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      const nextFailed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: nextFailed,
          lockedUntil: nextFailed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException(
        'Identifiants incorrects. Veuillez vérifier votre adresse ou mot de passe.',
      );
    }

    if (user.failedLogins > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
    }

    const publicUser = this.toPublicUser(user);
    const token = this.signToken({ sub: user.id, email: user.email, role: user.role });

    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'USER_LOGIN',
          entity: 'User',
          entityId: user.id,
          after: { userId: user.id, email: user.email, role: user.role },
        },
      });
    } catch {}

    return {
      user: publicUser,
      token,
      expiresAt: Date.now() + (dto.stayConnected8h ? 8 * 3600 * 1000 : 2 * 3600 * 1000),
    };
  }

  async findAllUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this.toPublicUser(u));
  }

  async findOneUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable.`);
    }
    return this.toPublicUser(user);
  }

  async createUser(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(`Un utilisateur avec l'adresse "${email}" existe déjà.`);
    }

    const passwordHash = hashPassword(dto.password);

    const created = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          jobTitle: dto.jobTitle?.trim() || this.defaultJobTitle(dto.role),
          passwordHash,
          role: dto.role as unknown as PrismaRole,
          isActive: dto.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'USER_CREATE',
          entity: 'User',
          entityId: u.id,
          after: { id: u.id, email: u.email, fullName: u.fullName, role: u.role },
        },
      });

      return u;
    });

    return this.toPublicUser(created);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Utilisateur ${id} introuvable.`);
    }

    if (dto.email && dto.email.trim().toLowerCase() !== existing.email) {
      const dup = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (dup) {
        throw new ConflictException(`L'adresse "${dto.email}" est déjà utilisée.`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
          ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle.trim() } : {}),
          ...(dto.role !== undefined ? { role: dto.role as unknown as PrismaRole } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.password ? { passwordHash: hashPassword(dto.password) } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'USER_UPDATE',
          entity: 'User',
          entityId: u.id,
          before: { email: existing.email, fullName: existing.fullName, role: existing.role, isActive: existing.isActive },
          after: { email: u.email, fullName: u.fullName, role: u.role, isActive: u.isActive },
        },
      });

      return u;
    });

    return this.toPublicUser(updated);
  }

  async deleteOrDeactivateUser(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Utilisateur ${id} introuvable.`);
    }

    const reservationsCount = await this.prisma.reservation.count({ where: { createdById: id } });
    const paymentsCount = await this.prisma.payment.count({ where: { receivedById: id } });
    const auditCount = await this.prisma.auditLog.count({
      where: {
        OR: [
          { userId: id },
          { entity: 'User', entityId: id, action: 'USER_LOGIN' },
        ],
      },
    });

    if (reservationsCount > 0 || paymentsCount > 0 || auditCount > 0) {
      const deactivated = await this.prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id },
          data: { isActive: false },
        });
        await tx.auditLog.create({
          data: {
            action: 'USER_DEACTIVATE',
            entity: 'User',
            entityId: existing.id,
            before: { id: existing.id, email: existing.email, role: existing.role, isActive: existing.isActive },
            after: { id: u.id, email: u.email, role: u.role, isActive: false },
          },
        });
        return u;
      });
      return {
        deleted: false,
        deactivated: true,
        user: this.toPublicUser(deactivated),
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: 'USER_DELETE',
          entity: 'User',
          entityId: existing.id,
          before: { id: existing.id, email: existing.email, role: existing.role },
        },
      });
      await tx.user.delete({ where: { id } });
    });

    return {
      deleted: true,
      deactivated: false,
      id,
    };
  }
}
