import { Injectable, signal } from '@angular/core';

export type GuestDirectoryFilter = 'ALL' | 'IN_STAY' | 'UPCOMING';
export type GuestStayState = 'IN_STAY' | 'UPCOMING' | 'NONE';
export type IdDocumentType = 'CNI' | 'PASSPORT' | 'PERMIS' | 'AUTRE';

export interface GuestDirectoryItem {
  id: string;
  civility: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  nationality: string;
  address: string;
  idDocumentType: IdDocumentType;
  idDocumentMasked: string;
  hasIdDocument: boolean;
  internalNote: string;
  state: GuestStayState;
  version: number;
  updatedAt: string;
}

export interface GuestStayItem {
  id: string;
  reference: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  roomNumber: string;
  roomCategory: string;
  totalFcfa: number;
  status: string;
}

export interface GuestDetail extends GuestDirectoryItem {
  stays: GuestStayItem[];
  staysNextCursor: string | null;
  staysTotal: number;
  invoicesTotal: number;
}

export interface DirectoryStats {
  inStayCount: number;
  expectedTodayCount: number;
  newThisMonthCount: number;
}

export interface DuplicateGuestMatch {
  id: string;
  fullName: string;
  phone: string;
}

const IDB_NAME = 'rb_clients_v2_db';
const IDB_STORE = 'directory_cache';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  readonly items = signal<GuestDirectoryItem[]>([]);
  readonly total = signal<number>(0);
  readonly nextCursor = signal<string | null>(null);
  readonly stats = signal<DirectoryStats>({
    inStayCount: 0,
    expectedTodayCount: 0,
    newThisMonthCount: 0,
  });

  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<GuestDirectoryFilter>('ALL');

  readonly selectedGuestId = signal<string | null>(null);
  readonly selectedGuest = signal<GuestDetail | null>(null);

  readonly isLoading = signal<boolean>(false);
  readonly isLoadingMore = signal<boolean>(false);
  readonly isLoadingDetail = signal<boolean>(false);
  readonly isLoadingMoreStays = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  readonly saveFeedback = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly conflictError = signal<string | null>(null);

  /** Conservation de la position de défilement de l'annuaire (utile sur retour mobile) */
  directoryScrollTop = 0;

  private listAbort: AbortController | null = null;
  private detailAbort: AbortController | null = null;
  private prefetchCache = new Map<string, { data: GuestDetail; ts: number }>();
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  getCurrentRole(): string {
    try {
      const raw = localStorage.getItem('rb_auth_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user?.role) return parsed.user.role;
      }
    } catch {
      // ignore
    }
    return 'RECEPTION';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-user-role': this.getCurrentRole(),
    };
  }

  private flashSaved(msg = 'Enregistré'): void {
    this.saveFeedback.set(msg);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      this.saveFeedback.set(null);
    }, 2200);
  }

  private async saveToIdb(items: GuestDirectoryItem[]): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(items, 'latest');
      };
    } catch {
      // ignore offline cache errors
    }
  }

  private async loadFromIdb(): Promise<GuestDirectoryItem[]> {
    if (typeof indexedDB === 'undefined') return [];
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get('latest');
          getReq.onsuccess = () => resolve(Array.isArray(getReq.result) ? getReq.result : []);
          getReq.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async loadDirectory(reset = true): Promise<void> {
    if (reset) {
      if (this.listAbort) this.listAbort.abort();
      this.listAbort = new AbortController();
      this.isLoading.set(true);
      this.nextCursor.set(null);
    } else {
      if (!this.nextCursor() || this.isLoadingMore()) return;
      this.isLoadingMore.set(true);
    }

    const signal = this.listAbort?.signal;

    try {
      const qs = new URLSearchParams();
      const search = this.searchQuery().trim();
      if (search) qs.set('search', search);
      if (this.statusFilter() !== 'ALL') qs.set('filter', this.statusFilter());
      qs.set('limit', '40');
      if (!reset && this.nextCursor()) {
        qs.set('cursor', this.nextCursor()!);
      }

      const res = await fetch(`/api/guests?${qs.toString()}`, {
        headers: this.headers(),
        signal,
      });

      if (!res.ok) throw new Error('Erreur de chargement de l’annuaire.');
      const data = await res.json();
      const incoming: GuestDirectoryItem[] = Array.isArray(data.items) ? data.items : [];

      if (reset) {
        this.items.set(incoming);
        if (!search && this.statusFilter() === 'ALL') {
          void this.saveToIdb(incoming);
        }
      } else {
        const existingIds = new Set(this.items().map((i) => i.id));
        this.items.set([...this.items(), ...incoming.filter((i) => !existingIds.has(i.id))]);
      }

      this.total.set(data.total ?? incoming.length);
      this.nextCursor.set(data.nextCursor ?? null);
      if (data.stats) {
        this.stats.set(data.stats);
      }
      this.errorMessage.set(null);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (reset) {
        const cached = await this.loadFromIdb();
        if (cached.length > 0) {
          const q = this.searchQuery().trim().toLowerCase();
          const filtered = cached.filter(
            (g) =>
              !q ||
              g.fullName.toLowerCase().includes(q) ||
              g.phone.toLowerCase().includes(q),
          );
          this.items.set(filtered);
          this.total.set(filtered.length);
        }
      }
    } finally {
      this.isLoading.set(false);
      this.isLoadingMore.set(false);
    }
  }

  async prefetchGuest(id: string): Promise<void> {
    if (!id) return;
    const cached = this.prefetchCache.get(id);
    if (cached && Date.now() - cached.ts < 15000) return;

    try {
      const res = await fetch(`/api/guests/${id}`, { headers: this.headers() });
      if (res.ok) {
        const detail: GuestDetail = await res.json();
        this.prefetchCache.set(id, { data: detail, ts: Date.now() });
      }
    } catch {
      // ignore prefetch error
    }
  }

  async selectGuest(id: string | null): Promise<void> {
    this.selectedGuestId.set(id);
    this.conflictError.set(null);
    this.errorMessage.set(null);

    if (!id) {
      if (this.detailAbort) this.detailAbort.abort();
      this.selectedGuest.set(null);
      return;
    }

    // Affichage progressif immédiat depuis l'annuaire ou le cache prefetch
    const cached = this.prefetchCache.get(id);
    if (cached && Date.now() - cached.ts < 15000) {
      this.selectedGuest.set(cached.data);
    } else {
      const fromList = this.items().find((g) => g.id === id);
      if (fromList) {
        this.selectedGuest.set({
          ...fromList,
          stays: [],
          staysNextCursor: null,
          staysTotal: 0,
          invoicesTotal: 0,
        });
      }
    }

    if (this.detailAbort) this.detailAbort.abort();
    this.detailAbort = new AbortController();
    this.isLoadingDetail.set(true);

    try {
      const res = await fetch(`/api/guests/${id}`, {
        headers: this.headers(),
        signal: this.detailAbort.signal,
      });
      if (!res.ok) throw new Error('Client introuvable.');
      const detail: GuestDetail = await res.json();
      if (this.selectedGuestId() === id) {
        this.selectedGuest.set(detail);
        this.prefetchCache.set(id, { data: detail, ts: Date.now() });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    } finally {
      this.isLoadingDetail.set(false);
    }
  }

  async loadMoreStays(id: string): Promise<void> {
    const current = this.selectedGuest();
    if (!current || current.id !== id || !current.staysNextCursor || this.isLoadingMoreStays()) {
      return;
    }
    this.isLoadingMoreStays.set(true);
    try {
      const qs = new URLSearchParams({ cursor: current.staysNextCursor, limit: '10' });
      const res = await fetch(`/api/guests/${id}/stays?${qs.toString()}`, {
        headers: this.headers(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const incoming: GuestStayItem[] = Array.isArray(data.items) ? data.items : [];
      const existingIds = new Set(current.stays.map((s) => s.id));
      const updated: GuestDetail = {
        ...current,
        stays: [...current.stays, ...incoming.filter((s) => !existingIds.has(s.id))],
        staysNextCursor: data.nextCursor ?? null,
      };
      this.selectedGuest.set(updated);
      this.prefetchCache.set(id, { data: updated, ts: Date.now() });
    } finally {
      this.isLoadingMoreStays.set(false);
    }
  }

  async patchField(
    id: string,
    patch: Partial<{
      fullName: string;
      phone: string;
      email: string;
      birthDate: string;
      nationality: string;
      address: string;
      idDocumentType: IdDocumentType;
      idDocumentNumber: string;
      internalNote: string;
    }>,
  ): Promise<boolean> {
    const current = this.selectedGuest();
    if (!current || current.id !== id) return false;

    // Sauvegarde de l'état précédent pour rollback si erreur API
    const prevDetail: GuestDetail = { ...current };
    const prevItems = [...this.items()];

    // Mise à jour optimiste immédiate
    const optimisticDetail: GuestDetail = {
      ...current,
      ...patch,
      ...(patch.idDocumentNumber !== undefined
        ? {
            idDocumentMasked: patch.idDocumentNumber
              ? `****${patch.idDocumentNumber.slice(-4)}`
              : '',
            hasIdDocument: Boolean(patch.idDocumentNumber),
          }
        : {}),
    };
    this.selectedGuest.set(optimisticDetail);
    this.items.set(
      this.items().map((item) =>
        item.id === id ? { ...item, ...optimisticDetail } : item,
      ),
    );

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.conflictError.set(null);

    try {
      const res = await fetch(`/api/guests/${id}`, {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify({
          ...patch,
          expectedVersion: prevDetail.version,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Rollback
        this.selectedGuest.set(prevDetail);
        this.items.set(prevItems);

        if (res.status === 409 && body?.code === 'VERSION_CONFLICT') {
          this.conflictError.set(
            body.message ||
              'Ce client a été modifié entre-temps. Rechargez la fiche pour voir les dernières données.',
          );
        } else {
          const msg = Array.isArray(body?.message)
            ? body.message.join(' ')
            : body?.message || 'Modification refusée par le serveur.';
          this.errorMessage.set(msg);
        }
        return false;
      }

      const updated: GuestDetail = body;
      this.selectedGuest.set(updated);
      this.items.set(
        this.items().map((item) => (item.id === id ? { ...item, ...updated } : item)),
      );
      this.prefetchCache.set(id, { data: updated, ts: Date.now() });
      this.flashSaved('Enregistré');
      return true;
    } catch {
      this.selectedGuest.set(prevDetail);
      this.items.set(prevItems);
      this.errorMessage.set('Impossible de contacter le serveur. Modification annulée.');
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  async createQuick(payload: { fullName: string; phone: string }): Promise<GuestDetail> {
    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(body?.message)
          ? body.message.join(' ')
          : body?.message || 'Impossible de créer le client.';
        throw new Error(msg);
      }
      const created: GuestDetail = body;
      this.prefetchCache.set(created.id, { data: created, ts: Date.now() });
      this.selectedGuestId.set(created.id);
      this.selectedGuest.set(created);
      this.flashSaved('Client créé');
      await this.loadDirectory(true);
      return created;
    } finally {
      this.isSaving.set(false);
    }
  }

  async checkDuplicate(params: {
    phone?: string;
    idDocumentNumber?: string;
    excludeId?: string;
  }): Promise<DuplicateGuestMatch | null> {
    const qs = new URLSearchParams();
    if (params.phone) qs.set('phone', params.phone);
    if (params.idDocumentNumber) qs.set('idDocumentNumber', params.idDocumentNumber);
    if (params.excludeId) qs.set('excludeId', params.excludeId);
    if (!qs.toString()) return null;

    try {
      const res = await fetch(`/api/guests/check-duplicate?${qs.toString()}`, {
        headers: this.headers(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.duplicate ?? null;
    } catch {
      return null;
    }
  }

  async revealDocument(id: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/guests/${id}/reveal-document`, {
        method: 'POST',
        headers: this.headers(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.errorMessage.set(err?.message || 'Accès refusé.');
        return null;
      }
      const data = await res.json();
      return data.idDocumentNumber || '';
    } catch {
      return null;
    }
  }

  async deleteGuest(id: string): Promise<{ ok: boolean; error?: string }> {
    this.isSaving.set(true);
    try {
      const res = await fetch(`/api/guests/${id}`, {
        method: 'DELETE',
        headers: this.headers(),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          error: body?.message || 'Suppression impossible.',
        };
      }
      this.prefetchCache.delete(id);
      const currentList = this.items();
      const idx = currentList.findIndex((g) => g.id === id);
      const nextList = currentList.filter((g) => g.id !== id);
      this.items.set(nextList);
      this.total.set(Math.max(0, this.total() - 1));

      // Sélectionner le client voisin après suppression
      const neighbor = nextList[idx] ?? nextList[idx - 1] ?? null;
      await this.selectGuest(neighbor ? neighbor.id : null);
      this.flashSaved('Client supprimé');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erreur réseau lors de la suppression.' };
    } finally {
      this.isSaving.set(false);
    }
  }
}
