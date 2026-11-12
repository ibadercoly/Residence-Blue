import { Injectable, computed, inject, signal } from '@angular/core';
import { RapportsPeriodKey, RapportsResponse } from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import { NetworkService } from '../../core/offline/network.service';

@Injectable({
  providedIn: 'root',
})
export class RapportsService {
  private readonly auth: AuthService | null;
  private readonly network: NetworkService | null;

  private readonly _period = signal<RapportsPeriodKey>('30j');
  private readonly _comparePrevious = signal<boolean>(true);
  private readonly _report = signal<RapportsResponse | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _forbiddenMessage = signal<string | null>(null);
  private readonly _offlineBlocked = signal<boolean>(false);

  readonly period = this._period.asReadonly();
  readonly comparePrevious = this._comparePrevious.asReadonly();
  readonly report = this._report.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly forbiddenMessage = this._forbiddenMessage.asReadonly();
  readonly isOnline = computed<boolean>(() => {
    const net = this.network ? this.network.isOnline() : true;
    const nav = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
    return net && nav;
  });
  readonly offlineBlocked = computed(() => !this.isOnline() || this._offlineBlocked());

  constructor(authOverride?: AuthService, networkOverride?: NetworkService) {
    let injectedAuth: AuthService | null = null;
    let injectedNetwork: NetworkService | null = null;
    try {
      injectedAuth = inject(AuthService, { optional: true });
      injectedNetwork = inject(NetworkService, { optional: true });
    } catch {
      injectedAuth = null;
      injectedNetwork = null;
    }
    this.auth = authOverride ?? injectedAuth;
    this.network = networkOverride ?? injectedNetwork;
  }

  setPeriod(period: RapportsPeriodKey): void {
    if (this._period() === period && this._report()) return;
    this._period.set(period);
    void this.load(period);
  }

  setComparePrevious(enabled: boolean): void {
    this._comparePrevious.set(enabled);
  }

  clearData(): void {
    this._report.set(null);
    this._errorMessage.set(null);
    this._forbiddenMessage.set(null);
  }

  async load(period: RapportsPeriodKey = this._period()): Promise<void> {
    if (!this.isOnline()) {
      this._offlineBlocked.set(true);
      this._report.set(null);
      this._errorMessage.set(null);
      return;
    }

    this._offlineBlocked.set(false);
    this._loading.set(true);
    this._errorMessage.set(null);
    this._forbiddenMessage.set(null);

    try {
      const token = this.auth?.getAccessToken() ?? null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/rapports?periode=${encodeURIComponent(period)}`, {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store',
      });

      if (res.status === 403) {
        this._report.set(null);
        this._forbiddenMessage.set(
          'Accès réservé à la Direction et à la Comptabilité.',
        );
        return;
      }

      if (!res.ok) {
        this._errorMessage.set('Impossible de charger les rapports pour le moment.');
        return;
      }

      const payload = (await res.json()) as RapportsResponse;
      this._report.set(payload);
    } catch {
      if (!this.isOnline()) {
        this._offlineBlocked.set(true);
        this._report.set(null);
      } else {
        this._errorMessage.set(
          'Connexion au serveur impossible pour charger les rapports.',
        );
      }
    } finally {
      this._loading.set(false);
    }
  }
}
