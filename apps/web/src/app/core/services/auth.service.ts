import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Role } from '@residence-blue/shared';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  jobTitle: string;
  totpEnabled: boolean;
  totpRequired: boolean;
}

export interface LoginCredentials {
  login: string;
  password: string;
  stayConnected8h?: boolean;
  deviceLabel?: string;
}

export interface ConnectedSessionItem {
  familyId: string;
  isCurrentSession: boolean;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  deviceLabel: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface TotpSetupPayload {
  secret: string;
  otpauthUri: string;
}

export type LoginStepResult =
  | { status: 'AUTHENTICATED'; user: AuthUser }
  | {
      status: 'MFA_REQUIRED';
      mfaToken: string;
      user: { fullName: string; role: string };
    }
  | {
      status: 'MFA_SETUP_REQUIRED';
      mfaToken: string;
      totpSetup: TotpSetupPayload;
      user: { fullName: string; role: string };
    };

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACCESS_REFRESH_MARGIN_MS = 60 * 1000; // Rafraîchissement anticipé 60s avant expiration

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router: Router | null;

  // Jeton d'accès gardé STRICTEMENT en mémoire (jamais en localStorage ni sessionStorage)
  private accessToken: string | null = null;
  private accessTokenExpiresAtMs = 0;
  private lastActivityAtMs = Date.now();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityInterval: ReturnType<typeof setInterval> | null = null;
  private refreshInFlight: Promise<boolean> | null = null;
  private bootstrapPromise: Promise<boolean> | null = null;
  private activityListenersBound = false;

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _inactivityExpired = signal<boolean>(false);

  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null && this.accessToken !== null);
  readonly currentRole = computed<Role | null>(() => this._user()?.role ?? null);
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly inactivityExpired = this._inactivityExpired.asReadonly();

  constructor(routerOverride?: Router) {
    let injectedRouter: Router | null = null;
    try {
      injectedRouter = inject(Router, { optional: true });
    } catch {
      injectedRouter = null;
    }
    this.router = routerOverride ?? injectedRouter;
    this.cleanupLegacyStorage();
    this.bindActivityListeners();
  }

  private cleanupLegacyStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('residence_blue_auth_session');
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('residence_blue_auth_session');
      }
    } catch {
      // ignorer
    }
  }

  getAccessToken(): string | null {
    if (!this.accessToken) return null;
    if (Date.now() >= this.accessTokenExpiresAtMs) {
      return null;
    }
    return this.accessToken;
  }

  recordActivity(): void {
    this.lastActivityAtMs = Date.now();
  }

  getRemainingInactivityMs(): number {
    return Math.max(0, INACTIVITY_TIMEOUT_MS - (Date.now() - this.lastActivityAtMs));
  }

  /**
   * Pour les tests unitaires uniquement : permet de simuler une durée d'inactivité.
   */
  simulateInactivityForTest(elapsedMs: number): void {
    this.lastActivityAtMs = Date.now() - elapsedMs;
  }

  clearTimersForTest(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.inactivityInterval) {
      clearInterval(this.inactivityInterval);
      this.inactivityInterval = null;
    }
  }

  async checkInactivityAndLogoutIfExpired(): Promise<boolean> {
    if (!this.isAuthenticated()) return false;
    if (Date.now() - this.lastActivityAtMs >= INACTIVITY_TIMEOUT_MS) {
      await this.logout('inactivity');
      return true;
    }
    return false;
  }

  private bindActivityListeners(): void {
    if (this.activityListenersBound || typeof window === 'undefined') return;
    this.activityListenersBound = true;

    let lastRecorded = 0;
    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastRecorded > 5000) {
        lastRecorded = now;
        this.lastActivityAtMs = now;
      }
    };

    for (const evt of ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']) {
      window.addEventListener(evt, onUserActivity, { passive: true });
    }

    this.inactivityInterval = setInterval(() => {
      void this.checkInactivityAndLogoutIfExpired();
    }, 30_000);
  }

  private applyAuthenticatedResponse(data: {
    accessToken: string;
    expiresInSeconds?: number;
    user: AuthUser;
  }): AuthUser {
    this.accessToken = data.accessToken;
    const ttlMs = (data.expiresInSeconds || 900) * 1000;
    this.accessTokenExpiresAtMs = Date.now() + ttlMs;
    this.lastActivityAtMs = Date.now();
    this._inactivityExpired.set(false);
    this._user.set(data.user);
    this.scheduleSilentRefresh(ttlMs);
    return data.user;
  }

  private scheduleSilentRefresh(ttlMs: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    const delay = Math.max(10_000, ttlMs - ACCESS_REFRESH_MARGIN_MS);
    this.refreshTimer = setTimeout(() => {
      if (!this.isAuthenticated()) return;
      if (Date.now() - this.lastActivityAtMs >= INACTIVITY_TIMEOUT_MS) {
        void this.logout('inactivity');
        return;
      }
      void this.refreshToken();
    }, delay);
  }

  private clearInMemorySession(): void {
    this.accessToken = null;
    this.accessTokenExpiresAtMs = 0;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this._user.set(null);
  }

  async bootstrapSession(): Promise<boolean> {
    if (this.isAuthenticated()) return true;
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = this.refreshToken().finally(() => {
      this.bootstrapPromise = null;
    });
    return this.bootstrapPromise;
  }

  async login(credentials: LoginCredentials): Promise<LoginStepResult> {
    this._isLoading.set(true);
    this._error.set(null);
    this._inactivityExpired.set(false);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: credentials.login.trim().toLowerCase(),
          password: credentials.password,
          stayConnected8h: Boolean(credentials.stayConnected8h),
          ...(credentials.deviceLabel ? { deviceLabel: credentials.deviceLabel } : {}),
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const msg =
          (typeof body?.message === 'string' && body.message) ||
          'Identifiants incorrects. Veuillez vérifier votre adresse email ou mot de passe.';
        this._error.set(msg);
        throw new Error(msg);
      }

      if (body?.status === 'MFA_REQUIRED') {
        return {
          status: 'MFA_REQUIRED',
          mfaToken: body.mfaToken,
          user: body.user,
        };
      }

      if (body?.status === 'MFA_SETUP_REQUIRED') {
        return {
          status: 'MFA_SETUP_REQUIRED',
          mfaToken: body.mfaToken,
          totpSetup: body.totpSetup,
          user: body.user,
        };
      }

      const user = this.applyAuthenticatedResponse(body);
      return { status: 'AUTHENTICATED', user };
    } finally {
      this._isLoading.set(false);
    }
  }

  async verifyTotpLogin(mfaToken: string, code: string): Promise<AuthUser> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const response = await fetch('/api/auth/login/totp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: code.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          (typeof body?.message === 'string' && body.message) ||
          'Code de vérification invalide.';
        this._error.set(msg);
        throw new Error(msg);
      }
      return this.applyAuthenticatedResponse(body);
    } finally {
      this._isLoading.set(false);
    }
  }

  async confirmMandatoryTotpSetup(
    mfaToken: string,
    code: string,
  ): Promise<{ user: AuthUser; backupCodes: string[] }> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const response = await fetch('/api/auth/login/totp-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: code.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const msg =
          (typeof body?.message === 'string' && body.message) ||
          'Code TOTP invalide.';
        this._error.set(msg);
        throw new Error(msg);
      }
      const user = this.applyAuthenticatedResponse(body);
      return {
        user,
        backupCodes: Array.isArray(body?.backupCodes) ? body.backupCodes : [],
      };
    } finally {
      this._isLoading.set(false);
    }
  }

  async refreshToken(): Promise<boolean> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = (async () => {
      try {
        if (typeof fetch === 'undefined') return false;
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) {
          this.clearInMemorySession();
          return false;
        }
        const body = await response.json().catch(() => null);
        if (!body?.accessToken || !body?.user) {
          this.clearInMemorySession();
          return false;
        }
        this.applyAuthenticatedResponse(body);
        return true;
      } catch {
        this.clearInMemorySession();
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  async logout(reason?: 'inactivity' | 'manual' | 'revoked'): Promise<void> {
    const token = this.accessToken;
    this.clearInMemorySession();
    this._inactivityExpired.set(reason === 'inactivity');

    try {
      if (typeof fetch !== 'undefined') {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }
    } catch {
      // Déconnexion locale déjà effectuée
    }

    if (this.router) {
      await this.router.navigate(['/connexion'], {
        queryParams: reason === 'inactivity' ? { reason: 'inactivity' } : undefined,
      });
    }
  }

  getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...(extraHeaders || {}) };
    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Wrapper fetch centralisé : injecte le jeton Bearer en mémoire + credentials cookie,
   * et tente un rafraîchissement transparent sur 401 avant de rediriger vers /connexion.
   */
  async authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    this.recordActivity();
    const firstHeaders = new Headers(init.headers || {});
    const token = this.getAccessToken();
    if (token && !firstHeaders.has('Authorization')) {
      firstHeaders.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(input, {
      ...init,
      credentials: 'include',
      headers: firstHeaders,
    });

    if (res.status !== 401) {
      return res;
    }

    const refreshed = await this.refreshToken();
    if (!refreshed) {
      this.clearInMemorySession();
      if (this.router) {
        void this.router.navigate(['/connexion']);
      }
      return res;
    }

    const retryHeaders = new Headers(init.headers || {});
    const nextToken = this.getAccessToken();
    if (nextToken) {
      retryHeaders.set('Authorization', `Bearer ${nextToken}`);
    }
    return fetch(input, {
      ...init,
      credentials: 'include',
      headers: retryHeaders,
    });
  }

  async setupOptionalTotp(): Promise<TotpSetupPayload> {
    const res = await this.authenticatedFetch('/api/auth/totp/setup', { method: 'POST' });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message || 'Impossible d’initialiser le 2FA.');
    return body;
  }

  async enableOptionalTotp(code: string): Promise<{ totpEnabled: boolean; backupCodes: string[] }> {
    const res = await this.authenticatedFetch('/api/auth/totp/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message || 'Code TOTP invalide.');
    this._user.update((u) => (u ? { ...u, totpEnabled: true } : u));
    return body;
  }

  async disableOptionalTotp(password: string, code: string): Promise<void> {
    const res = await this.authenticatedFetch('/api/auth/totp/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, code: code.trim() }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message || 'Désactivation 2FA refusée.');
    this._user.update((u) => (u ? { ...u, totpEnabled: false } : u));
  }

  async listConnectedSessions(): Promise<ConnectedSessionItem[]> {
    const endpoint =
      this.currentRole() === Role.DIRECTION ? '/api/auth/sessions' : '/api/auth/my-sessions';
    const res = await this.authenticatedFetch(endpoint);
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }

  async revokeConnectedSession(familyId: string): Promise<boolean> {
    const res = await this.authenticatedFetch(
      `/api/auth/sessions/${encodeURIComponent(familyId)}`,
      { method: 'DELETE' },
    );
    return res.ok;
  }
}
