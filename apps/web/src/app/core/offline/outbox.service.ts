import { Injectable, signal } from '@angular/core';
import { IdbService } from './idb.service';
import { NetworkService } from './network.service';
import { OutboxItem, SyncStatus } from '@residence-blue/shared';

@Injectable({
  providedIn: 'root',
})
export class OutboxService {
  readonly pendingCount = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);

  constructor(
    private readonly idbService: IdbService,
    private readonly networkService: NetworkService,
  ) {
    this.refreshPendingCount();
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

    await this.idbService.put('outbox', item);
    await this.refreshPendingCount();

    // Si on est en ligne, tentative immédiate de synchronisation en arrière-plan
    if (this.networkService.isOnline()) {
      this.syncOutbox();
    }

    return item;
  }

  async refreshPendingCount(): Promise<number> {
    try {
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
    if (this.isSyncing() || !this.networkService.isOnline()) {
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
          const response = await fetch(item.endpoint, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': item.idempotencyKey,
            },
            body: JSON.stringify(item.payload),
          });

          if (response.ok || response.status === 409) {
            // Succès ou déjà traité côté serveur (idempotence)
            await this.idbService.delete('outbox', item.id);
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
