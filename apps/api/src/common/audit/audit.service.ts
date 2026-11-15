import { Injectable, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntryInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

const SENSITIVE_KEY_PATTERN =
  /^(password|passwordHash|secret|token|refreshToken|accessToken|mfaToken|totpSecret|totpPendingSecret|backupCodes|idDocumentNumber|passportNumber|idDocumentEncrypted|cardNumber|cvv|pan)$/i;

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) {
    return value ?? null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeAuditValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return (
      '{' +
      entries
        .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

export function computeAuditEntryHash(params: {
  prevHash: string;
  id: string;
  createdAtIso: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}): string {
  const payload = [
    params.prevHash,
    params.id,
    params.createdAtIso,
    params.action,
    params.entity,
    params.entityId || '',
    canonicalJson(params.before ?? null),
    canonicalJson(params.after ?? null),
    params.ip || '',
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Écrit une entrée d'audit chaînée par SHA-256 (compatible transaction Prisma et mocks unitaires).
 */
export async function appendChainedAuditLog(
  client: any,
  input: AuditEntryInput,
): Promise<any> {
  if (!client?.auditLog?.create) {
    return null;
  }

  const sanitizedBefore =
    input.before !== undefined ? sanitizeAuditValue(input.before) : null;
  const sanitizedAfter =
    input.after !== undefined ? sanitizeAuditValue(input.after) : null;

  const writeInsideClient = async (tx: any) => {
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(948201)`;
    }

    let prevHash = 'GENESIS';
    if (typeof tx.auditLog?.findFirst === 'function') {
      const latest = await tx.auditLog.findFirst({
        orderBy: [{ seq: 'desc' }, { createdAt: 'desc' }],
        select: { entryHash: true },
      });
      if (latest?.entryHash) {
        prevHash = latest.entryHash;
      }
    }

    const id = crypto.randomUUID();
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();

    const entryHash = computeAuditEntryHash({
      prevHash,
      id,
      createdAtIso,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || null,
      before: sanitizedBefore,
      after: sanitizedAfter,
      ip: input.ip || null,
    });

    const data: Record<string, unknown> = {
      id,
      userId: input.userId || undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || undefined,
      ip: input.ip || undefined,
      prevHash,
      entryHash,
      createdAt,
    };
    if (sanitizedBefore !== null) {
      data.before = sanitizedBefore;
    }
    if (sanitizedAfter !== null) {
      data.after = sanitizedAfter;
    }

    return tx.auditLog.create({ data });
  };

  if (typeof client.$transaction === 'function') {
    return client.$transaction(async (tx: any) => writeInsideClient(tx));
  }
  return writeInsideClient(client);
}

@Injectable()
export class AuditService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async log(input: AuditEntryInput, txClient?: any): Promise<any> {
    const target = txClient || this.prisma;
    if (!target) return null;
    return appendChainedAuditLog(target, input);
  }

  async listLogs(limit = 100) {
    if (!this.prisma) return [];
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return this.prisma.auditLog.findMany({
      orderBy: [{ seq: 'desc' }],
      take: safeLimit,
      include: {
        user: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });
  }

  async verifyChain(): Promise<{
    valid: boolean;
    totalEntries: number;
    brokenAtSeq?: number;
    brokenAtId?: string;
    reason?: string;
    latestHash?: string;
  }> {
    if (!this.prisma) {
      return { valid: true, totalEntries: 0 };
    }

    const rows = await this.prisma.auditLog.findMany({
      orderBy: [{ seq: 'asc' }],
    });

    let expectedPrevHash = 'GENESIS';
    for (const row of rows) {
      if (!row.prevHash || !row.entryHash) {
        return {
          valid: false,
          totalEntries: rows.length,
          brokenAtSeq: row.seq,
          brokenAtId: row.id,
          reason: 'Entrée dépourvue d’empreinte de chaînage (prevHash ou entryHash manquant).',
        };
      }

      if (row.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalEntries: rows.length,
          brokenAtSeq: row.seq,
          brokenAtId: row.id,
          reason: 'Rupture du chaînage : prevHash ne correspond pas à l’empreinte de l’entrée précédente.',
        };
      }

      const recomputed = computeAuditEntryHash({
        prevHash: row.prevHash,
        id: row.id,
        createdAtIso: new Date(row.createdAt).toISOString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        before: row.before,
        after: row.after,
        ip: row.ip,
      });

      if (recomputed !== row.entryHash) {
        return {
          valid: false,
          totalEntries: rows.length,
          brokenAtSeq: row.seq,
          brokenAtId: row.id,
          reason: 'Altération détectée : le contenu de la ligne ne correspond plus à son empreinte SHA-256.',
        };
      }

      expectedPrevHash = row.entryHash;
    }

    return {
      valid: true,
      totalEntries: rows.length,
      latestHash: rows.length > 0 ? expectedPrevHash : 'GENESIS',
    };
  }
}
