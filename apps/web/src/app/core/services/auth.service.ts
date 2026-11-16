import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AccessLevel,
  Role,
  SCREEN_DEFINITIONS,
  ScreenAccessMap,
  ScreenKey,
  SpecialPermissionKey,
  SpecialPermissionsMap,
  StarterProfileKey,
  hasScreenAccess,
  hasSpecialPermission,
  isDirectorAccount,
} from '@residence-blue/shared';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  jobTitle: string;
  isPrimaryAdmin?: boolean;
  mustChangePassword?: boolean;
  starterProfile?: StarterProfileKey;
  screenAccess?: ScreenAccessMap;
  specialPermissions?: SpecialPermissionsMap;
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

export type LoginStepResult = { status: 'AUTHENTICATED'; user: AuthUser };

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACCESS_REFRESH_MARGIN_MS = 60 * 1000; // Rafraîchissement anticipé 60s avant expiration

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router: Router | null;
  private readonly ngZone: NgZone | null;

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
  readonly isDirector = computed(() => {
    const u = this._user();
    return Boolean(u && isDirectorAccount(u));
  });
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly inactivityExpired = this._inactivityExpired.asReadonly();

  constructor(routerOverride?: Router, ngZoneOverride?: NgZone) {
    let injectedRouter: Router | null = null;
    let injectedNgZone: NgZone | null = null;
    try {
      injectedRouter = inject(Router, { optional: true });
      injectedNgZone = inject(NgZone, { optional: true });
    } catch {
      injectedRouter = null;
      injectedNgZone = null;
    }
    this.router = routerOverride ?? injectedRouter;
    this.ngZone = ngZoneOverride ?? injectedNgZone;
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

    const attach = () => {
      for (const evt of ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']) {
        window.addEventListener(evt, onUserActivity, { passive: true });
      }

      this.inactivityInterval = setInterval(() => {
        if (!this.isAuthenticated()) return;
        if (Date.now() - this.lastActivityAtMs >= INACTIVITY_TIMEOUT_MS) {
          if (this.ngZone) {
            this.ngZone.run(() => {
              void this.logout('inactivity');
            });
          } else {
            void this.logout('inactivity');
          }
        }
      }, 30_000);
    };

    if (this.ngZone && typeof this.ngZone.runOutsideAngular === 'function') {
      this.ngZone.runOutsideAngular(attach);
    } else {
      attach();
    }
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
    const schedule = () => {
      this.refreshTimer = setTimeout(() => {
        if (!this.isAuthenticated()) return;
        const runAction = () => {
          if (Date.now() - this.lastActivityAtMs >= INACTIVITY_TIMEOUT_MS) {
            void this.logout('inactivity');
            return;
          }
          void this.refreshToken();
        };
        if (this.ngZone && typeof this.ngZone.run === 'function') {
          this.ngZone.run(runAction);
        } else {
          runAction();
        }
      }, delay);
    };
    if (this.ngZone && typeof this.ngZone.runOutsideAngular === 'function') {
      this.ngZone.runOutsideAngular(schedule);
    } else {
      schedule();
    }
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
          (response.status === 401
            ? 'Identifiants incorrects. Veuillez vérifier votre adresse email ou mot de passe.'
            : `Serveur d'authentification inaccessible (HTTP ${response.status}).`);
        this._error.set(msg);
        throw new Error(msg);
      }

      const user = this.applyAuthenticatedResponse(body);
      return { status: 'AUTHENTICATED', user };
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

  hasScreen(screen: ScreenKey, level: Exclude<AccessLevel, 'AUCUN'> = 'LECTURE'): boolean {
    return hasScreenAccess(this._user(), screen, level);
  }

  hasPermission(permission: SpecialPermissionKey): boolean {
    return hasSpecialPermission(this._user(), permission);
  }

  getFirstAuthorizedRoute(): string {
    const u = this._user();
    if (!u) return '/connexion';
    if (u.mustChangePassword) return '/changer-mot-de-passe';
    if (isDirectorAccount(u)) return '/tableau-de-bord';
    for (const def of SCREEN_DEFINITIONS) {
      if (hasScreenAccess(u, def.key, 'LECTURE')) {
        return def.key === 'accueil' ? '/tableau-de-bord' : def.route;
      }
    }
    return '/connexion';
  }

  updateLocalUser(partial: Partial<AuthUser>): void {
    const cur = this._user();
    if (cur) {
      this._user.set({ ...cur, ...partial });
    }
  }

  async syncUserFromMe(): Promise<boolean> {
    if (!this.accessToken || typeof fetch === 'undefined') return this.isAuthenticated();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return this.isAuthenticated();
    }
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.status === 401) {
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          this.clearInMemorySession();
          return false;
        }
        return true;
      }
      if (!res.ok) {
        return this.isAuthenticated();
      }
      const user = (await res.json().catch(() => null)) as AuthUser | null;
      if (user?.id) {
        this._user.set(user);
      }
      return true;
    } catch {
      return this.isAuthenticated();
    }
  }

  async changeInitialPassword(newPassword: string, currentPassword?: string): Promise<AuthUser> {
    const res = await this.authenticatedFetch('/api/auth/change-initial-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newPassword,
        ...(currentPassword ? { currentPassword } : {}),
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.message || 'Impossible de modifier le mot de passe.');
    }
    this._user.set(body as AuthUser);
    return body as AuthUser;
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
