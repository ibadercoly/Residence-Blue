import { inject, Injectable } from '@angular/core';
import { ModuleConfigService } from '../services/module-config.service';

@Injectable({
  providedIn: 'root',
})
export class IdbService {
  private readonly dbName = 'residence_blue_db';
  private readonly dbVersion = 1;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly moduleConfig = inject(ModuleConfigService, { optional: true });

  // Mappage des magasins IndexedDB vers leurs modules respectifs
  private readonly storeModuleMapping: Record<string, string> = {
    rooms: 'rooms',
    reservations: 'planning',
    invoices: 'facturation',
    menu: 'restaurant',
    restaurant: 'restaurant',
    housekeeping: 'housekeeping',
    maintenance: 'maintenance',
    stocks: 'inventory',
    inventory: 'inventory',
    marketing: 'marketing_crm',
    channel_manager: 'channel_manager',
    accounting: 'accounting',
  };

  /**
   * Vérifie si le magasin IndexedDB appartient à un module actif.
   * RÈGLE : Aucune donnée n'est stockée pour un module reporté dans IndexedDB.
   */
  isStoreAllowed(storeName: string): boolean {
    const moduleId = this.storeModuleMapping[storeName];
    if (moduleId && this.moduleConfig) {
      return this.moduleConfig.isModuleEnabled(moduleId);
    }
    return true;
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB n’est pas supporté dans cet environnement.'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Magasins d'objets pour le mode hors-ligne
        if (!db.objectStoreNames.contains('rooms')) {
          db.createObjectStore('rooms', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('reservations')) {
          db.createObjectStore('reservations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('by_idempotencyKey', 'idempotencyKey', { unique: true });
          outboxStore.createIndex('by_status', 'status', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    if (!this.isStoreAllowed(storeName)) {
      return undefined;
    }
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.isStoreAllowed(storeName)) {
      return [];
    }
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    if (!this.isStoreAllowed(storeName)) {
      console.warn(`[IdbService] Écriture ignorée : le module lié au magasin « ${storeName} » est reporté/désactivé.`);
      return;
    }
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    if (!this.isStoreAllowed(storeName)) {
      return;
    }
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Purge automatique du cache hors ligne :
   * - Réservations : conserve uniquement les 14 prochains jours et les séjours en cours.
   * - Factures : conserve au maximum les 100 dernières factures.
   * - Menu restaurant : conservé intégralement pour la prise de commande.
   */
  async pruneOfflineCache(): Promise<{ prunedReservations: number; prunedInvoices: number }> {
    let prunedReservations = 0;
    let prunedInvoices = 0;

    try {
      const now = new Date();
      const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      // Purge réservations hors fenêtre
      const reservations = await this.getAll<any>('reservations');
      for (const res of reservations) {
        const isCurrentStay = res.status === 'CHECKED_IN' || res.status === 'OCCUPIED';
        const checkIn = res.checkInDate ? new Date(res.checkInDate) : null;
        const checkOut = res.checkOutDate ? new Date(res.checkOutDate) : null;

        const inHorizon =
          (checkIn && checkIn <= horizon && checkIn >= new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)) ||
          (checkOut && checkOut >= now && checkOut <= horizon);

        if (!isCurrentStay && !inHorizon && res.id) {
          await this.delete('reservations', res.id);
          prunedReservations++;
        }
      }

      // Purge factures (garder les 100 dernières)
      const db = await this.openDb();
      if (db.objectStoreNames.contains('invoices')) {
        const invoices = await this.getAll<any>('invoices');
        if (invoices.length > 100) {
          invoices.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          const toDelete = invoices.slice(100);
          for (const inv of toDelete) {
            if (inv.id) {
              await this.delete('invoices', inv.id);
              prunedInvoices++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Avertissement purge cache hors ligne :', err);
    }

    return { prunedReservations, prunedInvoices };
  }
}
