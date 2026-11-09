import { ConnexionPageComponent } from './connexion-page.component';

describe('ConnexionPageComponent', () => {
  let component: ConnexionPageComponent;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    component = new ConnexionPageComponent();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('devrait être initialisé avec les champs vides', () => {
    expect(component).toBeTruthy();
    expect(component.login()).toBe('');
    expect(component.password()).toBe('');
    expect(component.loginInvalid()).toBe(false);
    expect(component.passwordInvalid()).toBe(false);
    expect(component.errorMessage()).toBeNull();
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

  it('devrait préremplir les données lors du clic sur un profil démo', () => {
    component.fillDemo('aissatou.ba@residenceblue.sn', "Directrice d'Exploitation");
    expect(component.login()).toBe('aissatou.ba@residenceblue.sn');
    expect(component.password()).toBe('ThiesTeranga2024!');
    expect(component.selectedRole()).toBe("Directrice d'Exploitation");
    expect(component.loginInvalid()).toBe(false);
    expect(component.passwordInvalid()).toBe(false);
  });

  it('devrait afficher une erreur explicite si les identifiants sont erronés', async () => {
    component.login.set('inconnu@residenceblue.sn');
    component.password.set('FauxMotDePasse!');

    await component.handleLogin();

    expect(component.errorMessage()).toContain('Identifiants incorrects');
  });

  it('devrait réussir la connexion avec des identifiants valides', async () => {
    component.login.set('aissatou.ba@residenceblue.sn');
    component.password.set('ThiesTeranga2024!');

    await component.handleLogin();

    expect(component.errorMessage()).toBeNull();
    expect(component.authService.isAuthenticated()).toBe(true);
  });

  it('devrait exposer le numéro de support issu des paramètres de l’hôtel', () => {
    expect(component.settingsService.supportPhone).toBe('+221 33 957 00 00');
    expect(component.settingsService.supportPhoneLink).toBe('tel:+221339570000');
  });
});
