import { Injectable } from '@angular/core';
import { ProcessedImageResult } from '../utils/image-processor.util';

export interface QueuedPhotoUpload {
  id: string;
  dishId: string;
  idempotencyKey: string;
  thumbnailDataUrl: string;
  mediumDataUrl: string;
  createdAt: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
}

const DB_NAME = 'residence_blue_photos_db';
const DB_VERSION = 1;
const STORE_PHOTOS = 'dish_photos';
const STORE_OUTBOX = 'photo_outbox';

@Injectable({
  providedIn: 'root'
})
export class PhotoStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      // Si environnement SSR ou tests sans IndexedDB disponible
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB non disponible dans cet environnement.'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          db.createObjectStore(STORE_PHOTOS, { keyPath: 'dishId' });
        }
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Sauvegarde une photo traitée localement dans IndexedDB et place une tâche dans la file d'attente hors ligne (Outbox).
   */
  async saveDishPhoto(dishId: string, photo: ProcessedImageResult): Promise<string> {
    try {
      const db = await this.getDB();
      const photoRecord = {
        dishId,
        fullDataUrl: photo.fullDataUrl,
        mediumDataUrl: photo.mediumDataUrl,
        thumbnailDataUrl: photo.thumbnailDataUrl,
        updatedAt: new Date().toISOString()
      };

      // 1. Stocker la photo pour affichage hors ligne immédiat
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        const store = tx.objectStore(STORE_PHOTOS);
        store.put(photoRecord);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // 2. Enregistrer dans la file d'attente Outbox avec Idempotency-Key
      const idempotencyKey = crypto.randomUUID();
      const queuedUpload: QueuedPhotoUpload = {
        id: `upload-${Date.now()}-${dishId}`,
        dishId,
        idempotencyKey,
        thumbnailDataUrl: photo.thumbnailDataUrl,
        mediumDataUrl: photo.mediumDataUrl,
        createdAt: new Date().toISOString(),
        status: 'PENDING'
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_OUTBOX, 'readwrite');
        const store = tx.objectStore(STORE_OUTBOX);
        store.put(queuedUpload);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // TODO(API): Envoi au serveur NestJS POST /restaurant/dishes/:id/photo avec Idempotency-Key
      return photo.thumbnailDataUrl;
    } catch {
      // Fallback mémoire si IndexedDB n'est pas accessible
      return photo.thumbnailDataUrl;
    }
  }

  /**
   * Récupère la photo locale d'un plat.
   */
  async getDishPhoto(dishId: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const store = tx.objectStore(STORE_PHOTOS);
        const request = store.get(dishId);
        request.onsuccess = () => {
          const res = request.result;
          resolve(res ? res.thumbnailDataUrl || res.mediumDataUrl : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * Supprime la photo locale d'un plat.
   */
  async deleteDishPhoto(dishId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        const store = tx.objectStore(STORE_PHOTOS);
        store.delete(dishId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Silencieux
    }
  }

  /**
   * Retourne les transferts de photos en attente de synchronisation réseau.
   */
  async getPendingUploads(): Promise<QueuedPhotoUpload[]> {
    try {
      const db = await this.getDB();
      return new Promise<QueuedPhotoUpload[]>((resolve, reject) => {
        const tx = db.transaction(STORE_OUTBOX, 'readonly');
        const store = tx.objectStore(STORE_OUTBOX);
        const request = store.getAll();
        request.onsuccess = () => {
          const all = (request.result as QueuedPhotoUpload[]) || [];
          resolve(all.filter((u) => u.status === 'PENDING'));
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return [];
    }
  }
}
