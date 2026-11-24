import { Injectable, computed, inject, signal } from '@angular/core';
import {
  BillingArchiveStatusFilter,
  BillingArchivesResponse,
  BillingCounterFilter,
  BillingCounterResponse,
  BillingListPage,
  BillingNoteDetail,
  BillingPaymentMethod,
  BillingLineCategory,
  BillingSortField,
  BillingSortOrder,
  OutboxItem,
  Role,
  SyncStatus,
} from '@residence-blue/shared';
import { RoomsService } from '../../core/services/rooms.service';
import { AuthService } from '../../core/services/auth.service';
import { IdbService } from '../../core/offline/idb.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';
import { PlanningService } from '../../core/services/planning.service';

export interface CashClosureItemDto {
  id: string;
  businessDate: string;
  closedAt: string;
  closedById: string;
  closedByName: string;
  totalTheoreticalCash: number;
  totalCountedCash: number;
  difference: number;
  notes: string | null;
}

export interface TodayCashClosureStatusDto {
  businessDate: string;
  isClosedToday: boolean;
  latestClosureToday: CashClosureItemDto | null;
  totalTheoreticalCash: number;
  totalCollectedToday: number;
  byMethod: {
    CASH: number;
    ORANGE_MONEY: number;
    WAVE: number;
    CARD: number;
    BANK_TRANSFER: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class FacturationService {
  private readonly roomsService = inject(RoomsService, { optional: true });
  private readonly authService = inject(AuthService, { optional: true });
  private readonly planningService = inject(PlanningService, { optional: true });
  private readonly idb = inject(IdbService, { optional: true });
  private readonly network = inject(NetworkService, { optional: true });
  private readonly outbox = inject(OutboxService, { optional: true });

  private counterAbort: AbortController | null = null;
  private archivesAbort: AbortController | null = null;
  private noteAbort: AbortController | null = null;
  private syncingOffline = false;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => {
        void this.syncOfflinePayments();
      });
    }
  }

  readonly counter = signal<BillingCounterResponse | null>(null);
  readonly archivesPage = signal<BillingListPage | null>(null);
  readonly currentNote = signal<BillingNoteDetail | null>(null);
  readonly loadingCounter = signal<boolean>(false);
  readonly loadingMoreCounter = signal<boolean>(false);
  readonly loadingArchives = signal<boolean>(false);
  readonly loadingMoreArchives = signal<boolean>(false);
  readonly loadingNote = signal<boolean>(false);
  readonly busyAction = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly todayCashClosure = signal<TodayCashClosureStatusDto | null>(null);
  readonly submittingCashClosure = signal<boolean>(false);

  readonly canCloseCash = computed<boolean>(() => {
    const role = this.authService?.currentRole();
    return role === 'DIRECTION' || role === 'RECEPTION';
  });
  readonly pendingOfflinePaymentKeys = signal<string[]>([]);

  readonly currentRole = computed<string>(() => {
    return this.authService?.currentRole() || this.roomsService?.currentRole() || '';
  });

  readonly currentUserName = computed<string>(() => {
    return this.authService?.currentUser()?.fullName || '';
  });

  readonly canManageCreditsAndExport = computed<boolean>(() => {
    const role = this.currentRole();
    return role === Role.DIRECTION || role === Role.COMPTABLE;
  });

  readonly isDirection = computed<boolean>(() => this.currentRole() === Role.DIRECTION);

  authHeaderMap(): Record<string, string> {
    return this.authService ? this.authService.getAuthHeaders() : {};
  }

  private buildHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.authService ? this.authService.getAuthHeaders() : {}),
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private async extractError(res: Response, fallback: string): Promise<string> {
    try {
      const body = await res.json();
      if (Array.isArray(body?.message)) {
        return body.message.join(' • ');
      }
      if (typeof body?.message === 'string' && body.message.trim().length > 0) {
        return body.message;
      }
    } catch {
      // Ignorer
    }
    return fallback;
  }

  clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private buildCounterQueryString(params: {
    search?: string;
    filter?: BillingCounterFilter;
    sortBy?: BillingSortField;
    sortOrder?: BillingSortOrder;
    offset?: number;
    limit?: number;
  }): string {
    const qs = new URLSearchParams();
    const search = (params.search || '').trim();
    if (search) qs.set('search', search);
    if (params.filter) qs.set('filter', params.filter);
    if (params.sortBy) qs.set('sortBy', params.sortBy);
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
    qs.set('offset', String(Math.max(0, params.offset ?? 0)));
    qs.set('limit', String(Math.min(50, Math.max(1, params.limit ?? 50))));
    return qs.toString();
  }

  async loadCounter(
    params: {
      search?: string;
      filter?: BillingCounterFilter;
      sortBy?: BillingSortField;
      sortOrder?: BillingSortOrder;
      limit?: number;
    } = {},
  ): Promise<void> {
    this.counterAbort?.abort();
    const controller = new AbortController();
    this.counterAbort = controller;

    this.loadingCounter.set(true);
    this.errorMessage.set(null);

    try {
      const query = this.buildCounterQueryString({ ...params, offset: 0, limit: params.limit ?? 50 });
      const res = await fetch(`/api/invoices/counter?${query}`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg = await this.extractError(res, 'Impossible de charger le comptoir facturation.');
        this.errorMessage.set(msg);
        return;
      }

      const data = (await res.json()) as BillingCounterResponse;
      this.counter.set(data);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      this.errorMessage.set('Serveur inaccessible : affichage hors ligne indisponible pour le comptoir.');
    } finally {
      if (this.counterAbort === controller) {
        this.loadingCounter.set(false);
      }
    }
  }

  async loadMoreCounter(
    params: {
      search?: string;
      filter?: BillingCounterFilter;
      sortBy?: BillingSortField;
      sortOrder?: BillingSortOrder;
      limit?: number;
    } = {},
  ): Promise<void> {
    const current = this.counter();
    if (!current || !current.page.hasMore || this.loadingMoreCounter() || this.loadingCounter()) return;

    const offset = current.page.items.length;
    this.loadingMoreCounter.set(true);
    this.errorMessage.set(null);
    try {
      const query = this.buildCounterQueryString({
        ...params,
        offset,
        limit: params.limit ?? 50,
      });
      const res = await fetch(`/api/invoices/counter?${query}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!res.ok) {
        const msg = await this.extractError(res, 'Impossible de charger plus de notes.');
        this.errorMessage.set(msg);
        return;
      }

      const nextData = (await res.json()) as BillingCounterResponse;
      const merged = [...current.page.items, ...nextData.page.items].filter(
        (item, index, arr) => arr.findIndex((x) => x.id === item.id) === index,
      );

      this.counter.set({
        kpis: nextData.kpis,
        dailyCash: nextData.dailyCash,
        page: {
          items: merged,
          total: nextData.page.total,
          offset,
          limit: nextData.page.limit,
          hasMore: nextData.page.hasMore,
        },
      });
    } catch {
      this.errorMessage.set('Erreur r\u00e9seau lors du chargement des notes suppl\u00e9mentaires.');
    } finally {
      this.loadingMoreCounter.set(false);
    }
  }

  private buildArchivesQueryString(params: {
    search?: string;
    status?: BillingArchiveStatusFilter;
    paymentMethod?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: BillingSortField;
    sortOrder?: BillingSortOrder;
    offset?: number;
    limit?: number;
  }): string {
    const qs = new URLSearchParams();
    const search = (params.search || '').trim();
    if (search) qs.set('search', search);
    if (params.status) qs.set('status', params.status);
    if (params.paymentMethod) qs.set('paymentMethod', params.paymentMethod);
    if (params.fromDate) qs.set('fromDate', params.fromDate);
    if (params.toDate) qs.set('toDate', params.toDate);
    if (params.sortBy) qs.set('sortBy', params.sortBy);
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
    if (params.offset !== undefined) qs.set('offset', String(Math.max(0, params.offset)));
    if (params.limit !== undefined) qs.set('limit', String(Math.min(50, Math.max(1, params.limit))));
    return qs.toString();
  }

  async loadArchives(
    params: {
      search?: string;
      status?: BillingArchiveStatusFilter;
      paymentMethod?: string;
      fromDate?: string;
      toDate?: string;
      sortBy?: BillingSortField;
      sortOrder?: BillingSortOrder;
      limit?: number;
    } = {},
  ): Promise<void> {
    this.archivesAbort?.abort();
    const controller = new AbortController();
    this.archivesAbort = controller;
    this.loadingArchives.set(true);
    this.errorMessage.set(null);

    try {
      const query = this.buildArchivesQueryString({ ...params, offset: 0, limit: params.limit ?? 50 });
      const res = await fetch(`/api/invoices/archives?${query}`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Impossible de charger les archives.'));
        return;
      }
      const data = (await res.json()) as BillingArchivesResponse;
      this.archivesPage.set(data.page);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      this.errorMessage.set('Serveur inaccessible : archives indisponibles hors ligne.');
    } finally {
      if (this.archivesAbort === controller) {
        this.loadingArchives.set(false);
      }
    }
  }

  async loadMoreArchives(
    params: {
      search?: string;
      status?: BillingArchiveStatusFilter;
      paymentMethod?: string;
      fromDate?: string;
      toDate?: string;
      sortBy?: BillingSortField;
      sortOrder?: BillingSortOrder;
      limit?: number;
    } = {},
  ): Promise<void> {
    const current = this.archivesPage();
    if (!current || !current.hasMore || this.loadingMoreArchives() || this.loadingArchives()) return;

    const offset = current.items.length;
    this.loadingMoreArchives.set(true);
    this.errorMessage.set(null);
    try {
      const query = this.buildArchivesQueryString({ ...params, offset, limit: params.limit ?? 50 });
      const res = await fetch(`/api/invoices/archives?${query}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Impossible de charger plus de factures.'));
        return;
      }
      const nextData = (await res.json()) as BillingArchivesResponse;
      const merged = [...current.items, ...nextData.page.items].filter(
        (item, index, arr) => arr.findIndex((x) => x.id === item.id) === index,
      );
      this.archivesPage.set({
        items: merged,
        total: nextData.page.total,
        offset,
        limit: nextData.page.limit,
        hasMore: nextData.page.hasMore,
      });
    } catch {
      this.errorMessage.set('Erreur r\u00e9seau lors du chargement des archives.');
    } finally {
      this.loadingMoreArchives.set(false);
    }
  }

  downloadArchivesExport(params: {
    search?: string;
    status?: BillingArchiveStatusFilter;
    paymentMethod?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: BillingSortField;
    sortOrder?: BillingSortOrder;
  }): Promise<boolean> {
    const query = this.buildArchivesQueryString({ ...params });
    return this.downloadFile(
      `/api/invoices/archives/export?${query}`,
      'archives-facturation.xlsx',
    );
  }

  async loadNote(id: string): Promise<void> {
    this.noteAbort?.abort();
    const controller = new AbortController();
    this.noteAbort = controller;

    this.loadingNote.set(true);
    this.errorMessage.set(null);

    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg = await this.extractError(res, 'Note de séjour introuvable.');
        this.errorMessage.set(msg);
        this.currentNote.set(null);
        return;
      }

      const detail = (await res.json()) as BillingNoteDetail;
      this.currentNote.set(detail);
      this.idb?.put('invoices', detail).catch(() => {});
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const cached = await this.idb?.get<BillingNoteDetail>('invoices', id).catch(() => undefined);
      if (cached) {
        this.currentNote.set(cached);
        this.errorMessage.set('Mode hors ligne : affichage de la dernière note enregistrée.');
      } else {
        this.errorMessage.set('Impossible de charger cette note.');
      }
    } finally {
      if (this.noteAbort === controller) {
        this.loadingNote.set(false);
      }
    }
  }

  async addLine(
    invoiceId: string,
    payload: {
      description: string;
      category: BillingLineCategory;
      quantity: number;
      unitPriceFcfa: number;
    },
  ): Promise<boolean> {
    this.busyAction.set(true);
    this.clearMessages();
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/lines`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, "Impossible d'ajouter cette ligne."));
        return false;
      }
      const updated = (await res.json()) as BillingNoteDetail;
      if (updated?.lines) {
        this.currentNote.set(updated);
      } else {
        await this.loadNote(invoiceId);
      }
      this.successMessage.set('Prestation ajoutée à la note.');
      return true;
    } catch {
      this.errorMessage.set("Erreur réseau lors de l'ajout de la ligne.");
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async updateDiscount(invoiceId: string, discountFcfa: number, reason?: string): Promise<boolean> {
    this.busyAction.set(true);
    this.clearMessages();
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/discount`, {
        method: 'PATCH',
        headers: this.buildHeaders(),
        body: JSON.stringify({ discountFcfa, ...(reason ? { reason } : {}) }),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Remise refusée.'));
        return false;
      }
      const updated = (await res.json()) as BillingNoteDetail;
      this.currentNote.set(updated);
      this.successMessage.set('Remise mise à jour.');
      return true;
    } catch {
      this.errorMessage.set('Erreur réseau lors de la mise à jour de la remise.');
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async recordPayment(
    invoiceId: string,
    payload: {
      method: BillingPaymentMethod;
      amountFcfa: number;
      transactionRef?: string;
    },
  ): Promise<boolean> {
    this.busyAction.set(true);
    this.clearMessages();
    const idempotencyKey = this.generateUuid();
    const body = {
      method: payload.method,
      amountFcfa: Math.round(payload.amountFcfa),
      ...(payload.transactionRef?.trim() ? { transactionRef: payload.transactionRef.trim() } : {}),
    };

    try {
      if (this.network && !this.network.isOnline() && this.outbox) {
        const queued = await this.outbox.enqueue(
          'CREATE_INVOICE_PAYMENT',
          `/api/invoices/${invoiceId}/payments`,
          body,
        );
        this.pendingOfflinePaymentKeys.update((arr) => [...arr, queued.idempotencyKey]);
        this.successMessage.set('Paiement enregistré hors ligne — en attente de synchronisation.');
        return true;
      }

      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/payments`, {
        method: 'POST',
        headers: this.buildHeaders(idempotencyKey),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, "Échec de l'encaissement."));
        return false;
      }

      const updated = (await res.json()) as BillingNoteDetail;
      this.currentNote.set(updated);
      this.successMessage.set('Encaissement enregistré.');
      return true;
    } catch {
      if (this.outbox && this.network && !this.network.isOnline()) {
        const queued = await this.outbox.enqueue(
          'CREATE_INVOICE_PAYMENT',
          `/api/invoices/${invoiceId}/payments`,
          body,
        );
        this.pendingOfflinePaymentKeys.update((arr) => [...arr, queued.idempotencyKey]);
        this.successMessage.set('Paiement enregistré hors ligne — en attente de synchronisation.');
        return true;
      }
      this.errorMessage.set("Erreur réseau lors de l'encaissement.");
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  /**
   * Rejoue les paiements facturation en attente dans l'outbox avec les en-têtes
   * d'authentification et la clé d'idempotence d'origine (sans modifier OutboxService).
   */
  async syncOfflinePayments(): Promise<number> {
    if (this.syncingOffline || !this.idb || (this.network && !this.network.isOnline())) {
      return 0;
    }

    this.syncingOffline = true;
    let syncedCount = 0;
    try {
      // Laisser OutboxService terminer son cycle éventuel sans accès concurrent sur IndexedDB
      for (let wait = 0; wait < 20 && this.outbox?.isSyncing?.(); wait += 1) {
        await new Promise((r) => setTimeout(r, 100));
      }

      const all = await this.idb.getAll<OutboxItem>('outbox');
      const activeOutboxKeys = new Set(all.map((i) => i.idempotencyKey));
      let reconciledByOutbox = false;
      const beforePending = this.pendingOfflinePaymentKeys();
      const remainingTracked = beforePending.filter((k) => activeOutboxKeys.has(k));
      if (remainingTracked.length !== beforePending.length) {
        this.pendingOfflinePaymentKeys.set(remainingTracked);
        reconciledByOutbox = true;
      }

      const paymentItems = all.filter(
        (item) =>
          item.type === 'CREATE_INVOICE_PAYMENT' &&
          (item.status === SyncStatus.PENDING || item.status === SyncStatus.FAILED),
      );

      for (const item of paymentItems) {
        try {
          const res = await fetch(item.endpoint, {
            method: 'POST',
            headers: this.buildHeaders(item.idempotencyKey),
            body: JSON.stringify(item.payload),
          });
          if (res.ok || res.status === 409) {
            await this.idb.delete('outbox', item.id);
            this.pendingOfflinePaymentKeys.update((arr) =>
              arr.filter((k) => k !== item.idempotencyKey),
            );
            syncedCount += 1;
            const currentId = this.currentNote()?.id;
            if (currentId && item.endpoint.includes(currentId)) {
              const updated = (await res.json().catch(() => null)) as BillingNoteDetail | null;
              if (updated?.id) {
                this.currentNote.set(updated);
              }
            }
          }
        } catch {
          break;
        }
      }

      if (syncedCount > 0 || reconciledByOutbox) {
        await this.outbox?.refreshPendingCount?.();
        const activeId = this.currentNote()?.id;
        if (activeId) {
          await this.loadNote(activeId);
        }
      }
      return syncedCount;
    } finally {
      this.syncingOffline = false;
    }
  }

  async reversePayment(
    invoiceId: string,
    paymentId: string,
    reason: string,
  ): Promise<boolean> {
    this.busyAction.set(true);
    this.clearMessages();
    try {
      const res = await fetch(
        `/api/invoices/${encodeURIComponent(invoiceId)}/payments/${encodeURIComponent(paymentId)}/reverse`,
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({ reason }),
        },
      );
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, "Impossible d'annuler ce paiement."));
        return false;
      }
      const updated = (await res.json()) as BillingNoteDetail;
      this.currentNote.set(updated);
      this.successMessage.set('Paiement annulé par écriture inverse.');
      return true;
    } catch {
      this.errorMessage.set("Erreur réseau lors de l'annulation du paiement.");
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async checkout(
    invoiceId: string,
    options: { force?: boolean; reason?: string } = {},
  ): Promise<boolean> {
    this.busyAction.set(true);
    this.clearMessages();
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/checkout`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          ...(options.force ? { force: true } : {}),
          ...(options.reason?.trim() ? { reason: options.reason.trim() } : {}),
        }),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Check-out impossible.'));
        return false;
      }
      const updated = (await res.json()) as BillingNoteDetail;
      this.currentNote.set(updated);
      this.successMessage.set(
        `Check-out effectué — Facture ${updated.displayNumber} émise, chambre à nettoyer.`,
      );
      this.roomsService?.fetchFromServer?.().catch(() => {});
      this.planningService?.fetchFromServer?.().catch(() => {});
      return true;
    } catch {
      this.errorMessage.set('Erreur réseau lors du check-out.');
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async createCreditNote(
    invoiceId: string,
    reason: string,
    amountFcfa?: number,
  ): Promise<BillingNoteDetail | null> {
    this.busyAction.set(true);
    this.clearMessages();
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/credit-notes`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          reason: reason.trim(),
          ...(amountFcfa && amountFcfa > 0 ? { amountFcfa: Math.round(amountFcfa) } : {}),
        }),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, "Impossible de créer l'avoir."));
        return null;
      }
      const creditNote = (await res.json()) as BillingNoteDetail;
      await this.loadNote(invoiceId);
      this.successMessage.set(`Avoir ${creditNote.displayNumber} créé.`);
      return creditNote;
    } catch {
      this.errorMessage.set("Erreur réseau lors de la création de l'avoir.");
      return null;
    } finally {
      this.busyAction.set(false);
    }
  }

  async downloadFile(url: string, fallbackFilename: string): Promise<boolean> {
    this.clearMessages();
    try {
      const headers = this.buildHeaders();
      delete headers['Content-Type'];
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Téléchargement refusé ou indisponible.'));
        return false;
      }
      const blob = await res.blob();
      const disp = res.headers.get('content-disposition') || '';
      const match = disp.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || fallbackFilename;

      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 500);
      return true;
    } catch {
      this.errorMessage.set('Erreur lors du téléchargement du fichier.');
      return false;
    }
  }

  downloadInvoicePdf(invoiceId: string, label: string): Promise<boolean> {
    const clean = label.replace(/[^a-zA-Z0-9_-]/g, '_');
    return this.downloadFile(
      `/api/invoices/${encodeURIComponent(invoiceId)}/pdf`,
      `facture-${clean}.pdf`,
    );
  }

  downloadCashClosure(format: 'pdf' | 'excel'): Promise<boolean> {
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    return this.downloadFile(
      `/api/invoices/cash-closure/export?format=${format}`,
      `cloture-caisse.${ext}`,
    );
  }

  async loadTodayCashClosure(): Promise<void> {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/billing/cash-closure/today', {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as TodayCashClosureStatusDto;
        this.todayCashClosure.set(data);
      }
    } catch {
      // Silencieux si hors ligne
    }
  }

  async submitCashClosure(
    totalCountedCash: number,
    notes?: string,
  ): Promise<CashClosureItemDto | null> {
    this.submittingCashClosure.set(true);
    this.clearMessages();
    try {
      const res = await fetch('/api/billing/cash-closure', {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          totalCountedCash: Math.round(totalCountedCash),
          notes: notes?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        this.errorMessage.set(
          await this.extractError(res, 'Impossible d’enregistrer la clôture de caisse.'),
        );
        return null;
      }
      const created = (await res.json()) as CashClosureItemDto;
      await this.loadTodayCashClosure();
      const diffSign = created.difference > 0 ? '+' : '';
      const diffText = `${diffSign}${created.difference.toLocaleString('fr-FR')} FCFA`;
      this.successMessage.set(
        `Clôture de caisse enregistrée avec succès (écart : ${diffText}).`,
      );
      return created;
    } catch {
      this.errorMessage.set('Erreur réseau lors de la clôture de caisse.');
      return null;
    } finally {
      this.submittingCashClosure.set(false);
    }
  }
}
