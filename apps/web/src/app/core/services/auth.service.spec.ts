import { Router } from '@angular/router';
import { AuthService, INACTIVITY_TIMEOUT_MS } from './auth.service';
import { Role } from '@residence-blue/shared';

describe('AuthService (Sécurité En Ligne)', () => {
  let service: AuthService;
  let mockRouter: { navigate: jest.Mock };
  let storageSpy: Map<string, string>;

  beforeEach(() => {
    storageSpy = new Map<string, string>();
    (global as any).localStorage = {
      getItem: (k: string) => storageSpy.get(k) ?? null,
      setItem: (k: string, v: string) => storageSpy.set(k, v),
      removeItem: (k: string) => storageSpy.delete(k),
      clear: () => storageSpy.clear(),
      get length() {
        return storageSpy.size;
      },
    };
    (global as any).sessionStorage = {
      getItem: () => null,
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
    };
    mockRouter = { navigate: jest.fn().mockResolvedValue(true) };
    service = new AuthService(mockRouter as unknown as Router);
  });

  afterEach(() => {
    service?.clearTimersForTest();
    jest.restoreAllMocks();
  });

  it('conserve le jeton d’accès uniquement en mémoire (jamais dans localStorage ni sessionStorage)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'AUTHENTICATED',
        accessToken: 'jwt.header.sig',
        expiresInSeconds: 900,
        user: {
          id: 'u-1',
          email: 'fatou.ndiaye@residenceblue.sn',
          fullName: 'Fatou Ndiaye',
          role: Role.RECEPTION,
          jobTitle: 'Chef de Réception',
          totpEnabled: false,
          totpRequired: false,
        },
      }),
    }) as any;

    const result = await service.login({
      login: 'fatou.ndiaye@residenceblue.sn',
      password: 'PasswordSecurise2026!',
    });

    expect(result.status).toBe('AUTHENTICATED');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.getAccessToken()).toBe('jwt.header.sig');
    expect(localStorage.getItem('residence_blue_auth_session')).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('gère le flux TOTP MFA_REQUIRED sans authentifier avant validation du code', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'MFA_REQUIRED',
          mfaToken: 'mfa-challenge-jwt',
          user: { fullName: 'Aïssatou Ba', role: Role.DIRECTION },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'AUTHENTICATED',
          accessToken: 'jwt.direction.verified',
          expiresInSeconds: 900,
          user: {
            id: 'u-dir',
            email: 'aissatou.ba@residenceblue.sn',
            fullName: 'Aïssatou Ba',
            role: Role.DIRECTION,
            jobTitle: 'Directrice',
            totpEnabled: true,
            totpRequired: true,
          },
        }),
      }) as any;

    const step1 = await service.login({
      login: 'aissatou.ba@residenceblue.sn',
      password: 'PasswordSecurise2026!',
    });

    expect(step1.status).toBe('MFA_REQUIRED');
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();

    if (step1.status === 'MFA_REQUIRED') {
      const user = await service.verifyTotpLogin(step1.mfaToken, '123456');
      expect(user.role).toBe(Role.DIRECTION);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.getAccessToken()).toBe('jwt.direction.verified');
    }
  });

  it('déconnecte automatiquement après 30 minutes d’inactivité', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'AUTHENTICATED',
          accessToken: 'jwt.short.lived',
          expiresInSeconds: 900,
          user: {
            id: 'u-1',
            email: 'fatou.ndiaye@residenceblue.sn',
            fullName: 'Fatou Ndiaye',
            role: Role.RECEPTION,
            jobTitle: 'Réception',
            totpEnabled: false,
            totpRequired: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ loggedOut: true }),
      }) as any;

    await service.login({
      login: 'fatou.ndiaye@residenceblue.sn',
      password: 'PasswordSecurise2026!',
    });
    expect(service.isAuthenticated()).toBe(true);

    service.simulateInactivityForTest(INACTIVITY_TIMEOUT_MS + 1000);
    const expired = await service.checkInactivityAndLogoutIfExpired();

    expect(expired).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/connexion'], {
      queryParams: { reason: 'inactivity' },
    });
  });

  it('tente un rafraîchissement par cookie httpOnly sur erreur 401 et réessaye la requête', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'AUTHENTICATED',
          accessToken: 'old-access-jwt',
          expiresInSeconds: 900,
          user: {
            id: 'u-1',
            email: 'fatou.ndiaye@residenceblue.sn',
            fullName: 'Fatou Ndiaye',
            role: Role.RECEPTION,
            jobTitle: 'Réception',
            totpEnabled: false,
            totpRequired: false,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'rotated-access-jwt',
          expiresInSeconds: 900,
          user: {
            id: 'u-1',
            email: 'fatou.ndiaye@residenceblue.sn',
            fullName: 'Fatou Ndiaye',
            role: Role.RECEPTION,
            jobTitle: 'Réception',
            totpEnabled: false,
            totpRequired: false,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) }) as any;

    await service.login({
      login: 'fatou.ndiaye@residenceblue.sn',
      password: 'PasswordSecurise2026!',
    });

    const res = await service.authenticatedFetch('/api/guests');
    expect(res.ok).toBe(true);
    expect(service.getAccessToken()).toBe('rotated-access-jwt');
  });
});
