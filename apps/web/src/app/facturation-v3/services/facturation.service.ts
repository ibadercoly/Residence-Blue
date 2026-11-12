import { Injectable, computed, inject, signal } from '@angular/core';
import {
  BillingCounterResponse,
  BillingNoteDetail,
  BillingPaymentMethod,
  BillingLineCategory,
  Role,
} from '@residence-blue/shared';
import { RoomsService } from '../../core/services/rooms.service';
import { AuthMockService } from '../../core/services/auth-mock.service';
import { IdbService } from '../../core/offline/idb.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';
import { PlanningMockService } from '../../core/services/planning-mock.service';

@Injectable({
  providedIn: 'root',
})
export class FacturationService {
  private readonly roomsService = inject(RoomsService, { optional: true });
  private readonly authService = inject(AuthMockService, { optional: true });
  private readonly planningService = inject(PlanningMockService, { optional: true });
  private readonly idb = inject(IdbService, { optional: true });
  private readonly network = inject(NetworkService, { optional: true });
  private readonly outbox = inject(OutboxService, { optional: true });

  private counterAbort: AbortController | null = null;
  private noteAbort: AbortController | null = null;

  readonly counter = signal<BillingCounterResponse | null>(null);
  readonly currentNote = signal<BillingNoteDetail | null>(null);
  readonly loadingCounter = signal<boolean>(false);
  readonly loadingNote = signal<boolean>(false);
  readonly busyAction = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly pendingOfflinePaymentKeys = signal<string[]>([]);

  readonly currentRole = computed<string>(() => {
    return (
      this.roomsService?.currentRole() ||
      this.authService?.currentUser()?.role ||
      Role.DIRECTION
    );
  });

  readonly currentUserName = computed<string>(() => {
    return this.authService?.currentUser()?.fullName || 'Aïssatou Ba';
  });

  readonly canManageCreditsAndExport = computed<boolean>(() => {
    const role = this.currentRole();
    return role === Role.DIRECTION || role === Role.COMPTABLE;
  });

  readonly isDirection = computed<boolean>(() => this.currentRole() === Role.DIRECTION);

  private buildHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-role': this.currentRole(),
      'x-user-name': this.currentUserName(),
    };
    const token = this.authService?.currentSession()?.token;
    if (token && !token.startsWith('mock-')) {
      headers['Authorization'] = `Bearer ${token}`;
    }
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

  async loadCounter(params: {
    search?: string;
    openLimit?: number;
    partialLimit?: number;
    paidLimit?: number;
  } = {}): Promise<void> {
    this.counterAbort?.abort();
    const controller = new AbortController();
    this.counterAbort = controller;

    this.loadingCounter.set(true);
    this.errorMessage.set(null);

    try {
      const search = (params.search || '').trim();
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      qs.set('limit', '8');
      qs.set('openOffset', '0');
      qs.set('partialOffset', '0');
      qs.set('paidOffset', '0');

      const res = await fetch(`/api/invoices/counter?${qs.toString()}`, {
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

  async loadMoreForColumn(
    column: 'toPay' | 'partial' | 'paid',
    search: string,
  ): Promise<void> {
    const current = this.counter();
    if (!current || this.busyAction()) return;

    const existingItems = current.columns[column].items;
    const offset = existingItems.length;

    this.busyAction.set(true);
    this.errorMessage.set(null);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      qs.set('limit', '8');
      qs.set('openOffset', column === 'toPay' ? String(offset) : '0');
      qs.set('partialOffset', column === 'partial' ? String(offset) : '0');
      qs.set('paidOffset', column === 'paid' ? String(offset) : '0');

      const res = await fetch(`/api/invoices/counter?${qs.toString()}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!res.ok) {
        const msg = await this.extractError(res, 'Impossible de charger plus de notes.');
        this.errorMessage.set(msg);
        return;
      }

      const nextData = (await res.json()) as BillingCounterResponse;
      const appended = nextData.columns[column];
      const merged = [...existingItems, ...appended.items].filter(
        (item, index, arr) => arr.findIndex((x) => x.id === item.id) === index,
      );

      this.counter.set({
        ...current,
        kpis: nextData.kpis,
        dailyCash: nextData.dailyCash,
        columns: {
          ...current.columns,
          [column]: {
            items: merged,
            total: appended.total,
            hasMore: appended.hasMore,
          },
        },
      });
    } catch {
      this.errorMessage.set('Erreur réseau lors du chargement des notes supplémentaires.');
    } finally {
      this.busyAction.set(false);
    }
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
        await this.outbox.enqueue(
          'CREATE_INVOICE_PAYMENT',
          `/api/invoices/${invoiceId}/payments`,
          body,
          idempotencyKey,
        );
        this.pendingOfflinePaymentKeys.update((arr) => [...arr, idempotencyKey]);
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
      this.errorMessage.set("Erreur réseau lors de l'encaissement.");
      return false;
    } finally {
      this.busyAction.set(false);
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
        `Check-out effectué — Facture ${updated.displayNumber} émise, chambre passée en Ménage.`,
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
}
