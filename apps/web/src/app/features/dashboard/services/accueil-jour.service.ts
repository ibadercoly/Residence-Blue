import { Injectable, computed, inject, signal } from '@angular/core';
import { AccueilJourResponse } from '@residence-blue/shared';
import { AuthService } from '../../../core/services/auth.service';
import { NetworkService } from '../../../core/offline/network.service';

@Injectable({
  providedIn: 'root',
})
export class AccueilJourService {
  private readonly authService = inject(AuthService, { optional: true });
  private readonly network = inject(NetworkService, { optional: true });

  readonly stats = signal<AccueilJourResponse | null>(null);
  readonly loading = signal<boolean>(false);
  readonly offlineMode = signal<boolean>(false);
  readonly forbiddenError = signal<string | null>(null);

  readonly isOnline = computed<boolean>(() => {
    const net = this.network ? this.network.isOnline() : true;
    const nav = typeof navigator !== 'undefined' ? navigator.onLine : true;
    return net && nav;
  });

  private cacheKeyForRole(): string {
    const role = this.authService?.currentRole() || 'ANON';
    return `accueil_jour_${role}`;
  }

  private openCacheDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open('residence_blue_accueil_cache', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async readCache(key: string): Promise<AccueilJourResponse | null> {
    const db = await this.openCacheDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('cache', 'readonly');
        const req = tx.objectStore('cache').get(key);
        req.onsuccess = () => {
          const rec = req.result as { id: string; data: AccueilJourResponse } | undefined;
          resolve(rec?.data ?? null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async writeCache(key: string, data: AccueilJourResponse): Promise<void> {
    const db = await this.openCacheDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction('cache', 'readwrite');
        tx.objectStore('cache').put({ id: key, data });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async apiFetch(url: string): Promise<Response> {
    if (this.authService) {
      return this.authService.authenticatedFetch(url, { method: 'GET' });
    }
    return fetch(url, { method: 'GET', credentials: 'include' });
  }

  async loadTodayStats(): Promise<void> {
    const key = this.cacheKeyForRole();
    this.loading.set(true);

    if (!this.isOnline()) {
      this.offlineMode.set(true);
      const cached = await this.readCache(key);
      if (cached) {
        this.stats.set(cached);
      }
      this.loading.set(false);
      return;
    }

    try {
      const res = await this.apiFetch('/api/accueil/jour');
      if (res.status === 403) {
        this.stats.set(null);
        this.forbiddenError.set(
          'Votre rôle ne permet pas de consulter les statistiques du jour.',
        );
        this.offlineMode.set(false);
        return;
      }
      if (!res.ok) {
        const cached = await this.readCache(key);
        if (cached) {
          this.stats.set(cached);
        }
        return;
      }

      const data = (await res.json()) as AccueilJourResponse;
      this.stats.set(data);
      this.offlineMode.set(false);
      this.forbiddenError.set(null);
      await this.writeCache(key, data);
    } catch {
      this.offlineMode.set(true);
      const cached = await this.readCache(key);
      if (cached) {
        this.stats.set(cached);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
