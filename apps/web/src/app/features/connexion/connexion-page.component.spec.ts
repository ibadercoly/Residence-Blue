import { ConnexionPageComponent } from './connexion-page.component';
import { Role } from '@residence-blue/shared';

describe('ConnexionPageComponent', () => {
  let component: ConnexionPageComponent;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hotelName: 'Résidence Blue' }),
    }) as any;
    component = new ConnexionPageComponent();
  });

  afterEach(() => {
    component.authService.clearTimersForTest();
    jest.restoreAllMocks();
  });

  it('devrait être initialisé avec les champs vides', () => {
    expect(component).toBeTruthy();
    expect(component.login()).toBe('');
    expect(component.password()).toBe('');
    expect(component.loginInvalid()).toBe(false);
    expect(component.passwordInvalid()).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.step()).toBe('CREDENTIALS');
  });

  it('devrait basculer la visibilité du mot de passe', () => {
    expect(component.showPassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(false);
  });

  it('devrait marquer les champs invalides si la soumission est vide', async () => {
    await component.handleLogin();
    expect(component.loginInvalid()).toBe(true);
    expect(component.passwordInvalid()).toBe(true);
  });

  it('devrait afficher une erreur générique si les identifiants sont erronés', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Identifiants incorrects.' }),
    }) as any;

    component.login.set('inconnu@residenceblue.sn');
    component.password.set('FauxMotDePasse!');

    await component.handleLogin();

    expect(component.errorMessage()).toContain('Identifiants incorrects');
  });

  it('devrait basculer sur l’étape 2FA TOTP quand l’API renvoie MFA_REQUIRED', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'MFA_REQUIRED',
          mfaToken: 'mfa-jwt-token',
          user: { fullName: 'Aïssatou Ba', role: Role.DIRECTION },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'AUTHENTICATED',
          accessToken: 'access-jwt-token',
          expiresInSeconds: 900,
          user: {
            id: 'dir-1',
            email: 'aissatou.ba@residenceblue.sn',
            fullName: 'Aïssatou Ba',
            role: Role.DIRECTION,
            jobTitle: 'Directrice',
            totpEnabled: true,
            totpRequired: true,
          },
        }),
      }) as any;

    component.login.set('aissatou.ba@residenceblue.sn');
    component.password.set('MotDePasseRobuste2026!');

    await component.handleLogin();
    expect(component.step()).toBe('MFA_VERIFY');
    expect(component.authService.isAuthenticated()).toBe(false);

    component.totpCode.set('123456');
    await component.handleTotpVerify();
    expect(component.errorMessage()).toBeNull();
    expect(component.authService.isAuthenticated()).toBe(true);
  });

  it('devrait réussir la connexion directe pour un rôle sans 2FA activée', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'AUTHENTICATED',
        accessToken: 'jwt-reception',
        expiresInSeconds: 900,
        user: {
          id: 'rec-1',
          email: 'fatou.ndiaye@residenceblue.sn',
          fullName: 'Fatou Ndiaye',
          role: Role.RECEPTION,
          jobTitle: 'Chef de Réception',
          totpEnabled: false,
          totpRequired: false,
        },
      }),
    }) as any;

    component.login.set('fatou.ndiaye@residenceblue.sn');
    component.password.set('MotDePasseRobuste2026!');

    await component.handleLogin();

    expect(component.errorMessage()).toBeNull();
    expect(component.authService.isAuthenticated()).toBe(true);
  });

  it('devrait exposer le numéro de support issu des paramètres de l’hôtel', () => {
    expect(component.settingsService.supportPhone).toBe('+221 33 957 00 00');
    expect(component.settingsService.supportPhoneLink).toBe('tel:+221339570000');
  });
});
