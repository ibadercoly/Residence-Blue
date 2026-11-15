import { Injectable, computed, inject, signal } from '@angular/core';
import { RapportsPeriodKey, RapportsResponse } from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import { NetworkService } from '../../core/offline/network.service';

export type RapportsExportFormat = 'pdf' | 'excel';

function parseFilenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  return match?.[1]?.trim() || fallback;
}

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
  private readonly _exportingFormat = signal<RapportsExportFormat | null>(null);
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _exportError = signal<string | null>(null);
  private readonly _forbiddenMessage = signal<string | null>(null);
  private readonly _offlineBlocked = signal<boolean>(false);

  readonly period = this._period.asReadonly();
  readonly comparePrevious = this._comparePrevious.asReadonly();
  readonly report = this._report.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly exportingFormat = this._exportingFormat.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly exportError = this._exportError.asReadonly();
  readonly forbiddenMessage = this._forbiddenMessage.asReadonly();
  readonly isOnline = computed<boolean>(() => {
    const net = this.network ? this.network.isOnline() : true;
    const nav =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
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
    this._exportError.set(null);
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
    this._exportError.set(null);
    this._forbiddenMessage.set(null);

    try {
      const token = this.auth?.getAccessToken() ?? null;
      const headers: Record<string, string> = {
        'ngsw-bypass': 'true',
      };
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

  async downloadExport(format: RapportsExportFormat): Promise<void> {
    if (!this.isOnline() || !this._report()?.hasData || this._exportingFormat()) {
      return;
    }

    this._exportingFormat.set(format);
    this._exportError.set(null);

    try {
      const period = this._period();
      const compare = this._comparePrevious();
      const query =
        format === 'pdf'
          ? `periode=${encodeURIComponent(period)}&comparer=${compare ? 'true' : 'false'}`
          : `periode=${encodeURIComponent(period)}`;

      const token = this.auth?.getAccessToken() ?? null;
      const headers: Record<string, string> = {
        Accept: 'application/octet-stream',
        'ngsw-bypass': 'true',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/rapports/export/${format}?${query}`, {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        this._exportError.set(
          `Impossible de générer l'export ${format.toUpperCase()} pour cette période.`,
        );
        return;
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0) {
        this._exportError.set(
          `Le fichier ${format.toUpperCase()} généré est vide.`,
        );
        return;
      }

      const defaultType =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([buffer], { type: defaultType });
      const todayIso = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Dakar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const fallbackName = `rapport-${todayIso}.${ext}`;
      const explicitHeaderName = res.headers.get('X-Export-Filename')?.trim();
      const fileName =
        explicitHeaderName && /^[a-zA-Z0-9_.-]+$/.test(explicitHeaderName)
          ? explicitHeaderName
          : parseFilenameFromHeader(
              res.headers.get('Content-Disposition'),
              fallbackName,
            );

      if (typeof URL !== 'undefined' && typeof document !== 'undefined') {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      }
    } catch {
      this._exportError.set(
        `Erreur réseau lors du téléchargement ${format.toUpperCase()}.`,
      );
    } finally {
      this._exportingFormat.set(null);
    }
  }
}
