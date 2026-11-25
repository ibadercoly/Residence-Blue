import { Injectable, inject, signal } from '@angular/core';
import { IdbService } from './idb.service';
import { NetworkService } from './network.service';
import { AuthService } from '../services/auth.service';
import { OutboxItem, SyncStatus } from '@residence-blue/shared';

@Injectable({
  providedIn: 'root',
})
export class OutboxService {
  private readonly authService = inject(AuthService, { optional: true });
  private readonly injectedIdb = inject(IdbService, { optional: true });
  private readonly injectedNet = inject(NetworkService, { optional: true });

  private readonly idbService?: IdbService;
  private readonly networkService?: NetworkService;

  readonly pendingCount = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);
  readonly lastConflict = signal<{ item: OutboxItem; message?: string } | null>(null);
  private activeSyncPromise: Promise<void> | null = null;

  constructor(
    idbService?: IdbService,
    networkService?: NetworkService,
  ) {
    this.idbService = idbService ?? this.injectedIdb ?? undefined;
    this.networkService = networkService ?? this.injectedNet ?? undefined;
    this.refreshPendingCount();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.syncOutbox();
      });
    }
  }

  /**
   * Ajoute une opération dans la file d'attente (outbox) locale.
   * RÈGLE AGENTS.MD : UUID généré côté client + Idempotency-Key.
   */
  async enqueue<T>(type: string, endpoint: string, payload: T): Promise<OutboxItem<T>> {
    const item: OutboxItem<T> = {
      id: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      type,
      endpoint,
      payload,
      createdAt: Date.now(),
      status: SyncStatus.PENDING,
      retryCount: 0,
    };

    if (this.idbService) {
      await this.idbService.put('outbox', item);
    }
    await this.refreshPendingCount();

    // Si on est en ligne, tentative immédiate de synchronisation en arrière-plan
    if (this.networkService?.isOnline()) {
      void this.syncOutbox();
    }

    return item;
  }

  async refreshPendingCount(): Promise<number> {
    try {
      if (!this.idbService) return 0;
      const items = await this.idbService.getAll<OutboxItem>('outbox');
      const pending = items.filter((i) => i.status === SyncStatus.PENDING || i.status === SyncStatus.FAILED);
      this.pendingCount.set(pending.length);
      return pending.length;
    } catch {
      return 0;
    }
  }

  /**
   * Synchronise la file d'attente avec le serveur (source de vérité).
   */
  async syncOutbox(): Promise<void> {
    if (this.networkService && !this.networkService.isOnline()) {
      return;
    }
    if (this.activeSyncPromise) {
      return this.activeSyncPromise;
    }
    this.activeSyncPromise = this.runSyncOutbox().finally(() => {
      this.activeSyncPromise = null;
    });
    return this.activeSyncPromise;
  }

  private async runSyncOutbox(): Promise<void> {
    if (this.isSyncing() || (this.networkService && !this.networkService.isOnline())) {
      return;
    }
    if (!this.idbService) {
      return;
    }

    this.isSyncing.set(true);
    try {
      const items = await this.idbService.getAll<OutboxItem>('outbox');
      const pendingItems = items.filter(
        (i) => i.status === SyncStatus.PENDING || i.status === SyncStatus.FAILED,
      );

      for (const item of pendingItems) {
        try {
          const method = item.type.startsWith('PATCH') ? 'PATCH' : 'POST';
          const reqHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'Idempotency-Key': item.idempotencyKey,
            ...(this.authService ? this.authService.getAuthHeaders() : {}),
          };
          const response = this.authService
            ? await this.authService.authenticatedFetch(item.endpoint, {
                method,
                headers: reqHeaders,
                body: JSON.stringify(item.payload),
              })
            : await fetch(item.endpoint, {
                method,
                credentials: 'include',
                headers: reqHeaders,
                body: JSON.stringify(item.payload),
              });

          if (response.ok) {
            // Succès côté serveur
            await this.idbService.delete('outbox', item.id);
          } else if (response.status === 409) {
            // Conflit côté serveur : rejet définitif, suppression de l'outbox et notification
            await this.idbService.delete('outbox', item.id);
            const errData = await response.json().catch(() => ({}));
            const conflictMessage = errData.message || 'Action rejetée par le serveur (conflit 409).';
            this.lastConflict.set({ item, message: conflictMessage });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('outbox-conflict', {
                  detail: { item, message: conflictMessage, status: 409 },
                }),
              );
            }
          } else {
            item.status = SyncStatus.FAILED;
            item.retryCount += 1;
            item.lastError = `Erreur HTTP ${response.status}`;
            await this.idbService.put('outbox', item);
          }
        } catch (err: unknown) {
          item.status = SyncStatus.FAILED;
          item.retryCount += 1;
          item.lastError = err instanceof Error ? err.message : 'Erreur réseau';
          await this.idbService.put('outbox', item);
          break; // Si le réseau coupe, on arrête la boucle
        }
      }
    } finally {
      await this.refreshPendingCount();
      this.isSyncing.set(false);
    }
  }
}
