/**
 * Types relatifs à la synchronisation hors-ligne (Offline-First).
 * RÈGLE AGENTS.MD :
 * - Lecture depuis IndexedDB, écriture dans une file d'attente (outbox) synchronisée ensuite.
 * - UUIDs générés côté client.
 * - Idempotency-Key obligatoire.
 * - Le serveur est la source de vérité et arbitre les conflits.
 */

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
  CONFLICT = 'CONFLICT',
}

export interface OutboxItem<T = unknown> {
  id: string; // UUID v4 de l'élément d'outbox
  idempotencyKey: string; // Clé d'idempotence unique de la transaction
  type: string; // Ex: 'RESERVATION_CREATE', 'PAYMENT_RECORD', etc.
  endpoint: string; // Ex: '/api/reservations'
  payload: T;
  createdAt: number; // Timestamp Unix ms
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

export interface SyncResult<T = unknown> {
  idempotencyKey: string;
  success: boolean;
  serverEntity?: T;
  error?: string;
  timestamp: number;
}
