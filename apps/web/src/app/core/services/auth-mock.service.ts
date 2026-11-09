import { Injectable, signal, computed } from '@angular/core';
import { Role } from '@residence-blue/shared';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  jobTitle: string;
}

export interface LoginCredentials {
  login: string;
  password: string;
  stayConnected8h?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: number;
  stayConnected8h: boolean;
  lastActivityAt: number;
  isLocked: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthMockService {
  private readonly SESSION_STORAGE_KEY = 'residence_blue_auth_session';
  private readonly INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes d'inactivité avant verrouillage
  private readonly SESSION_DURATION_8H_MS = 8 * 60 * 60 * 1000; // 8 heures
  private readonly STANDARD_SESSION_MS = 2 * 60 * 60 * 1000; // 2 heures par défaut

  // Comptes de démonstration connus (utilisés en mode développement / mock)
  // TODO(API): En production, l'authentification s'effectue via POST /api/auth/login avec mot de passe haché bcrypt
  private readonly mockUsers: Array<{ email: string; passwordHash: string; user: AuthUser }> = [
    {
      email: 'aissatou.ba@residenceblue.sn',
      passwordHash: 'ThiesTeranga2024!',
      user: {
        id: 'usr-001-ba',
        email: 'aissatou.ba@residenceblue.sn',
        fullName: 'Aïssatou Ba',
        role: Role.DIRECTION,
        jobTitle: "Directrice d'Exploitation"
      }
    },
    {
      email: 'teranga.resto@residenceblue.sn',
      passwordHash: 'ThiesTeranga2024!',
      user: {
        id: 'usr-002-resto',
        email: 'teranga.resto@residenceblue.sn',
        fullName: 'Ibrahima Diallo',
        role: Role.RESTAURANT,
        jobTitle: "Maître d'Hôtel"
      }
    },
    {
      email: 'technique@residenceblue.sn',
      passwordHash: 'ThiesTeranga2024!',
      user: {
        id: 'usr-003-maint',
        email: 'technique@residenceblue.sn',
        fullName: 'Moussa Ndiaye',
        role: Role.MAINTENANCE,
        jobTitle: 'Chef Maintenance'
      }
    }
  ];

  private readonly _session = signal<AuthSession | null>(this.loadSessionFromStorage());
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly currentSession = this._session.asReadonly();
  readonly currentUser = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => {
    const session = this._session();
    if (!session) return false;
    return Date.now() < session.expiresAt && !session.isLocked;
  });
  readonly isLocked = computed(() => this._session()?.isLocked ?? false);
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  constructor() {
    this.checkInactivityLock();
  }

  /**
   * Connexion au portail PMS Résidence Blue
   * TODO(API): Remplacer le comportement mock par un appel HttpClient.post('/api/auth/login', credentials)
   */
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    this._isLoading.set(true);
    this._error.set(null);

    // Simulation de latence réseau pour afficher l'état de chargement
    await new Promise(resolve => setTimeout(resolve, 450));

    try {
      const trimmedLogin = (credentials.login || '').trim().toLowerCase();
      const trimmedPassword = credentials.password || '';

      if (!trimmedLogin || !trimmedPassword) {
        throw new Error('Veuillez renseigner votre identifiant et mot de passe.');
      }

      // Recherche de l'utilisateur dans le catalogue mock
      const matched = this.mockUsers.find(
        u => u.email.toLowerCase() === trimmedLogin && u.passwordHash === trimmedPassword
      );

      if (!matched) {
        throw new Error('Identifiants incorrects. Veuillez vérifier votre adresse ou mot de passe.');
      }

      const now = Date.now();
      const sessionDuration = credentials.stayConnected8h ? this.SESSION_DURATION_8H_MS : this.STANDARD_SESSION_MS;

      const session: AuthSession = {
        user: matched.user,
        token: `mock-jwt-token-${matched.user.id}-${now}`,
        expiresAt: now + sessionDuration,
        stayConnected8h: !!credentials.stayConnected8h,
        lastActivityAt: now,
        isLocked: false
      };

      this._session.set(session);
      this.saveSessionToStorage(session);
      return matched.user;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Identifiants incorrects.';
      this._error.set(message);
      throw err;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Déconnexion complète
   * TODO(API): Notifier le backend POST /api/auth/logout pour révoquer le refresh token
   */
  logout(): void {
    this._session.set(null);
    this.clearSessionFromStorage();
  }

  /**
   * Enregistre l'activité de l'utilisateur pour différer le verrouillage
   */
  recordActivity(): void {
    const current = this._session();
    if (current && !current.isLocked) {
      const updated: AuthSession = {
        ...current,
        lastActivityAt: Date.now()
      };
      this._session.set(updated);
      this.saveSessionToStorage(updated);
    }
  }

  /**
   * Verrouille la session après inactivité
   */
  lockSession(): void {
    const current = this._session();
    if (current) {
      const updated: AuthSession = {
        ...current,
        isLocked: true
      };
      this._session.set(updated);
      this.saveSessionToStorage(updated);
    }
  }

  /**
   * Déverrouillage après saisie du mot de passe
   */
  unlockSession(password: string): boolean {
    const current = this._session();
    if (!current) return false;

    const matched = this.mockUsers.find(
      u => u.user.id === current.user.id && u.passwordHash === password
    );

    if (matched) {
      const updated: AuthSession = {
        ...current,
        isLocked: false,
        lastActivityAt: Date.now()
      };
      this._session.set(updated);
      this.saveSessionToStorage(updated);
      return true;
    }
    return false;
  }

  private checkInactivityLock(): void {
    const current = this._session();
    if (!current) return;

    const now = Date.now();
    if (now > current.expiresAt) {
      this.logout();
      return;
    }

    if (now - current.lastActivityAt > this.INACTIVITY_TIMEOUT_MS) {
      this.lockSession();
    }
  }

  private loadSessionFromStorage(): AuthSession | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthSession;
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(this.SESSION_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private saveSessionToStorage(session: AuthSession): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(session));
      }
    } catch {
      // Ignorer si le stockage est restreint
    }
  }

  private clearSessionFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignorer
    }
  }
}
