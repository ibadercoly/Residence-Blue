import { AuthMockService } from './auth-mock.service';
import { Role } from '@residence-blue/shared';

describe('AuthMockService', () => {
  let service: AuthMockService;

  beforeEach(() => {
    // Nettoyer le localStorage mock si présent
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    service = new AuthMockService();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('devrait être initialisé sans utilisateur connecté', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('devrait connecter un utilisateur avec des identifiants valides', async () => {
    const user = await service.login({
      login: 'aissatou.ba@residenceblue.sn',
      password: 'ThiesTeranga2024!',
      stayConnected8h: false
    });

    expect(user.fullName).toBe('Aïssatou Ba');
    expect(user.role).toBe(Role.DIRECTION);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.error()).toBeNull();
  });

  it('devrait rejeter une tentative avec un mot de passe incorrect', async () => {
    await expect(
      service.login({
        login: 'aissatou.ba@residenceblue.sn',
        password: 'MauvaisMotDePasse!'
      })
    ).rejects.toThrow('Identifiants incorrects');

    expect(service.isAuthenticated()).toBe(false);
    expect(service.error()).toContain('Identifiants incorrects');
  });

  it('devrait configurer une session de 8h lorsque stayConnected8h est activé', async () => {
    const before = Date.now();
    await service.login({
      login: 'aissatou.ba@residenceblue.sn',
      password: 'ThiesTeranga2024!',
      stayConnected8h: true
    });

    const session = service.currentSession();
    expect(session).not.toBeNull();
    expect(session?.stayConnected8h).toBe(true);
    const duration = (session?.expiresAt ?? 0) - before;
    expect(duration).toBeGreaterThanOrEqual(8 * 3600 * 1000 - 2000);
  });

  it('devrait effacer la session lors de la déconnexion', async () => {
    await service.login({
      login: 'aissatou.ba@residenceblue.sn',
      password: 'ThiesTeranga2024!'
    });
    expect(service.isAuthenticated()).toBe(true);

    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('devrait verrouiller la session manuellement et permettre le déverrouillage', async () => {
    await service.login({
      login: 'aissatou.ba@residenceblue.sn',
      password: 'ThiesTeranga2024!'
    });

    service.lockSession();
    expect(service.isLocked()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);

    const unlocked = service.unlockSession('ThiesTeranga2024!');
    expect(unlocked).toBe(true);
    expect(service.isLocked()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);
  });
});
