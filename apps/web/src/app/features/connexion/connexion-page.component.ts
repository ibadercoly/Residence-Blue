import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, TotpSetupPayload } from '../../core/services/auth.service';
import { HotelSettingsService } from '../../core/services/hotel-settings.service';

type LoginUiStep = 'CREDENTIALS' | 'MFA_VERIFY' | 'MFA_SETUP' | 'BACKUP_CODES';

@Component({
  selector: 'app-connexion-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="min-h-screen w-full bg-surface flex flex-col justify-center">
      <div class="flex flex-col w-full">
        <div class="w-full min-h-[calc(100vh-2rem)] flex flex-col lg:flex-row overflow-hidden rounded-2xl bg-surface shadow-xl">
          <!-- Left Column: Visual Showcase (55% desktop) -->
          <div class="relative w-full lg:w-[55%] min-h-[440px] lg:min-h-full flex flex-col justify-between p-6 sm:p-8 lg:p-12 overflow-hidden text-on-primary">
            <div
              class="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105 hover:scale-100"
              style="background-image: url('/assets/images/hero-dashboard.webp');"
              data-photo-zone="true"
            ></div>
            <div class="absolute inset-0 bg-gradient-to-t from-on-background/95 via-on-background/40 to-on-background/60"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-primary-container/20 to-transparent mix-blend-overlay"></div>

            <!-- Top Elements -->
            <div class="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest/15 backdrop-blur-md">
                  <span class="w-2 h-2 rounded-full bg-secondary-fixed-dim animate-pulse"></span>
                  <span class="font-label-md text-label-md tracking-wider uppercase text-surface">Thiès (Grand Standing) • Sénégal</span>
                </div>
                <div class="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-surface-container-lowest/10 backdrop-blur-md" data-adapted-zone="true">
                  <span class="font-label-md text-label-md text-surface/90">Chambres d'Exception • Restaurant La Teranga</span>
                </div>
              </div>
              <div class="flex items-center gap-3 px-3 py-1.5 rounded-full bg-surface-container-lowest/15 backdrop-blur-md" data-adapted-zone="true">
                <div class="flex items-center gap-1.5 text-surface">
                  <span class="material-symbols-outlined text-[16px] text-secondary-fixed-dim">sunny</span>
                  <span class="font-body-sm text-body-sm">Ciel dégagé</span>
                </div>
                <span class="w-1 h-1 rounded-full bg-surface/50"></span>
                <div class="flex items-center gap-1 text-surface font-label-md text-label-md">
                  <span>28°C</span>
                </div>
              </div>
            </div>

            <!-- Bottom Content -->
            <div class="relative z-10 mt-auto pt-16 flex flex-col gap-6" data-adapted-zone="true">
              <div class="max-w-xl">
                <span class="inline-block px-2.5 py-1 rounded bg-secondary-container/20 text-secondary-fixed-dim font-label-md text-label-md uppercase tracking-widest mb-3 backdrop-blur-sm">
                  Cadre Paisible &amp; Résidentiel
                </span>
                <p class="font-display-lg-mobile lg:font-display-lg text-display-lg-mobile lg:text-display-lg italic leading-tight text-surface drop-shadow-sm font-serif">
                  « Le raffinement hôtelier et l'art de recevoir la Teranga au cœur de Thiès. »
                </p>
                <div class="flex items-center gap-3 mt-4">
                  <div class="w-8 h-[2px] bg-secondary-fixed-dim"></div>
                  <p class="font-title-md text-title-md text-surface/90 tracking-wide">
                    Résidence Blue, Hôtel Boutique &amp; Restaurant La Teranga
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-6 pt-6 bg-surface-container-lowest/5 backdrop-blur-sm px-4 py-3 rounded-xl">
                <div class="flex items-center gap-2 text-surface/85">
                  <span class="material-symbols-outlined text-[18px] text-primary-fixed-dim">yard</span>
                  <span class="font-body-sm text-body-sm">Espaces Végétalisés &amp; Patio</span>
                </div>
                <div class="flex items-center gap-2 text-surface/85">
                  <span class="material-symbols-outlined text-[18px] text-primary-fixed-dim">restaurant</span>
                  <span class="font-body-sm text-body-sm">Table Gastronomique La Teranga</span>
                </div>
                <div class="flex items-center gap-2 text-surface/85">
                  <span class="material-symbols-outlined text-[18px] text-primary-fixed-dim">pool</span>
                  <span class="font-body-sm text-body-sm">Bassin de Détente &amp; Sérénité</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Login & 2FA Card -->
          <div class="w-full lg:w-[45%] flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-surface-container-lowest">
            <div class="flex items-center justify-between w-full pb-6" data-adapted-zone="true">
              <div class="flex items-center gap-2">
                <span class="font-label-md text-label-md px-2.5 py-1 rounded bg-surface-container-high text-primary font-bold">FR</span>
              </div>
              <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-tertiary font-label-md text-label-md">
                <span class="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                <span>Portail Interne</span>
              </div>
            </div>

            <div class="w-full max-w-md mx-auto my-auto flex flex-col">
              <!-- Brand Mark -->
              <div class="flex items-center gap-3 mb-6">
                <div class="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-md">
                  <span class="material-symbols-outlined text-[24px]">hotel</span>
                </div>
                <div>
                  <h1 class="font-headline-sm text-headline-sm font-bold text-primary tracking-tight">Résidence Blue</h1>
                  <p class="font-label-md text-label-md text-outline">Hôtel 12 Clés • Grand Standing, Thiès</p>
                </div>
              </div>

              <div class="mb-6">
                <h2 class="font-headline-sm text-headline-sm font-serif text-on-surface">
                  @if (step() === 'CREDENTIALS') {
                    Connexion Collaborateur
                  } @else if (step() === 'MFA_VERIFY') {
                    Double Authentification (2FA)
                  } @else if (step() === 'MFA_SETUP') {
                    Activation 2FA Obligatoire
                  } @else {
                    Codes de secours à conserver
                  }
                </h2>
                <p class="font-body-md text-body-md text-on-surface-variant mt-1">
                  Portail de gestion hôtelière &amp; restaurant La Teranga
                </p>
              </div>

              @if (inactivityNotice()) {
                <div
                  class="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5"
                  role="status"
                  data-testid="inactivity-notice"
                >
                  <span class="material-symbols-outlined text-[20px] shrink-0 text-amber-700 mt-0.5">schedule</span>
                  <span class="font-body-sm text-xs">
                    Votre session a été fermée automatiquement après 30 minutes d’inactivité.
                  </span>
                </div>
              }

              @if (errorMessage()) {
                <div
                  class="mb-4 p-3 rounded-lg bg-error-container/40 border border-error/30 text-error flex items-start gap-2.5"
                  role="alert"
                  aria-live="assertive"
                  data-test="error-banner"
                >
                  <span class="material-symbols-outlined text-[20px] shrink-0 text-error mt-0.5">error</span>
                  <div class="flex flex-col">
                    <span class="font-title-md text-sm font-semibold">Authentification refusée</span>
                    <span class="font-body-sm text-xs text-on-surface">{{ errorMessage() }}</span>
                  </div>
                </div>
              }

              @if (step() === 'CREDENTIALS') {
                <form class="flex flex-col gap-4" id="pms-login-form" (submit)="handleLogin($event)">
                  <div class="flex flex-col gap-1.5">
                    <label class="font-label-lg text-label-lg text-on-surface flex items-center justify-between" for="user-login">
                      <span>Identifiant ou Email professionnel</span>
                    </label>
                    <div class="relative flex items-center">
                      <span class="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                        alternate_email
                      </span>
                      <input
                        id="user-login"
                        type="text"
                        [value]="login()"
                        (input)="onLoginChange($event)"
                        placeholder="prenom.nom&#64;residenceblue.sn"
                        [class]="loginInvalid()
                          ? 'w-full h-12 pl-11 pr-4 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md shadow-sm outline-none border border-error ring-1 ring-error transition-all'
                          : 'w-full h-12 pl-11 pr-4 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md shadow-sm outline-none focus:bg-surface-container-low transition-all'"
                        [disabled]="authService.isLoading()"
                        autocomplete="username"
                      />
                    </div>
                    @if (loginInvalid()) {
                      <span class="font-body-sm text-[12px] text-error">Veuillez renseigner votre identifiant ou email professionnel.</span>
                    }
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="font-label-lg text-label-lg text-on-surface" for="user-password">
                      Mot de passe confidentiel
                    </label>
                    <div class="relative flex items-center">
                      <span class="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                        lock
                      </span>
                      <input
                        id="user-password"
                        [type]="showPassword() ? 'text' : 'password'"
                        [value]="password()"
                        (input)="onPasswordChange($event)"
                        placeholder="••••••••••••"
                        [class]="passwordInvalid()
                          ? 'w-full h-12 pl-11 pr-12 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md shadow-sm outline-none border border-error ring-1 ring-error transition-all'
                          : 'w-full h-12 pl-11 pr-12 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md shadow-sm outline-none focus:bg-surface-container-low transition-all'"
                        [disabled]="authService.isLoading()"
                        autocomplete="current-password"
                      />
                      <button
                        type="button"
                        id="toggle-pwd-btn"
                        (click)="togglePasswordVisibility()"
                        class="absolute right-3 p-1.5 rounded text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Afficher ou masquer le mot de passe"
                      >
                        <span class="material-symbols-outlined text-[20px]">
                          {{ showPassword() ? 'visibility_off' : 'visibility' }}
                        </span>
                      </button>
                    </div>
                    @if (passwordInvalid()) {
                      <span class="font-body-sm text-[12px] text-error">Veuillez saisir votre mot de passe.</span>
                    }
                  </div>

                  <div class="flex items-center justify-between pt-1">
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="remember-me"
                        [checked]="stayConnected8h()"
                        (change)="onStayConnectedChange($event)"
                        class="w-4 h-4 rounded text-primary accent-primary bg-surface-container-high cursor-pointer"
                      />
                      <span class="font-body-sm text-body-sm text-on-surface-variant">Rester connecté 8 h</span>
                    </label>
                    <button
                      type="button"
                      (click)="onForgotPassword()"
                      class="font-label-md text-label-md text-primary hover:underline bg-transparent border-0 cursor-pointer p-0"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>

                  <button
                    id="login-btn"
                    type="submit"
                    [disabled]="authService.isLoading()"
                    [class]="authService.isLoading()
                      ? 'mt-2 w-full h-12 rounded-lg bg-primary opacity-80 cursor-wait text-on-primary font-title-md text-title-md flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/25'
                      : 'mt-2 w-full h-12 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/25 active:scale-[0.99] cursor-pointer'"
                  >
                    @if (authService.isLoading()) {
                      <span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                      <span id="btn-text">Ouverture de session PMS...</span>
                    } @else {
                      <span id="btn-text">Se connecter au PMS</span>
                      <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                    }
                  </button>
                </form>
              }

              @if (step() === 'MFA_VERIFY') {
                <form class="flex flex-col gap-4" (submit)="handleTotpVerify($event)" data-testid="mfa-verify-form">
                  <div class="p-3 rounded-xl bg-surface-container-low text-sm text-on-surface-variant">
                    Bonjour <strong>{{ pendingUserName() }}</strong>. Saisissez le code à 6 chiffres de votre application d’authentification (ou un code de secours).
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="font-label-lg text-label-lg text-on-surface" for="totp-code-input">
                      Code TOTP ou code de secours
                    </label>
                    <input
                      id="totp-code-input"
                      type="text"
                      [value]="totpCode()"
                      (input)="onTotpCodeChange($event)"
                      placeholder="123456 ou XXXX-XXXX"
                      autocomplete="one-time-code"
                      class="w-full h-12 px-4 rounded-lg bg-surface-container-lowest text-on-surface font-mono text-lg tracking-widest shadow-sm outline-none border border-outline-variant/40 focus:border-primary"
                    />
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      (click)="resetToCredentials()"
                      class="px-4 h-12 rounded-lg bg-surface-container-high text-on-surface font-label-lg cursor-pointer"
                    >
                      Retour
                    </button>
                    <button
                      id="verify-totp-btn"
                      type="submit"
                      [disabled]="authService.isLoading()"
                      class="flex-1 h-12 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-title-md cursor-pointer"
                    >
                      Valider le code
                    </button>
                  </div>
                </form>
              }

              @if (step() === 'MFA_SETUP' && totpSetup(); as setup) {
                <form class="flex flex-col gap-4" (submit)="handleTotpSetupConfirm($event)" data-testid="mfa-setup-form">
                  <div class="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface-variant leading-relaxed">
                    La double authentification (2FA) est obligatoire pour votre rôle (<strong>{{ pendingUserName() }}</strong>).
                    Ajoutez cette clé secrète dans votre application TOTP :
                  </div>
                  <div class="p-3 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-1">
                    <span class="text-[11px] uppercase tracking-wider text-outline font-bold">Clé secrète TOTP (Base32)</span>
                    <code class="text-sm font-mono font-bold text-primary break-all select-all" data-testid="totp-secret-display">
                      {{ setup.secret }}
                    </code>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="font-label-lg text-label-lg text-on-surface" for="totp-setup-code-input">
                      Confirmez avec le code à 6 chiffres généré
                    </label>
                    <input
                      id="totp-setup-code-input"
                      type="text"
                      [value]="totpCode()"
                      (input)="onTotpCodeChange($event)"
                      placeholder="123456"
                      autocomplete="one-time-code"
                      class="w-full h-12 px-4 rounded-lg bg-surface-container-lowest text-on-surface font-mono text-lg tracking-widest shadow-sm outline-none border border-outline-variant/40 focus:border-primary"
                    />
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      (click)="resetToCredentials()"
                      class="px-4 h-12 rounded-lg bg-surface-container-high text-on-surface font-label-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      id="confirm-totp-setup-btn"
                      type="submit"
                      [disabled]="authService.isLoading()"
                      class="flex-1 h-12 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-title-md cursor-pointer"
                    >
                      Activer la 2FA et continuer
                    </button>
                  </div>
                </form>
              }

              @if (step() === 'BACKUP_CODES') {
                <div class="flex flex-col gap-4" data-testid="backup-codes-panel">
                  <div class="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
                    Notez ces codes de secours à usage unique dès maintenant. Ils ne seront plus réaffichés.
                  </div>
                  <div class="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface-container">
                    @for (code of backupCodes(); track code) {
                      <code class="px-2 py-1.5 rounded bg-surface-container-lowest font-mono text-sm text-center font-semibold text-on-surface">
                        {{ code }}
                      </code>
                    }
                  </div>
                  <button
                    id="continue-after-backup-btn"
                    type="button"
                    (click)="proceedToDashboard()"
                    class="w-full h-12 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-title-md cursor-pointer"
                  >
                    J'ai enregistré mes codes • Accéder au PMS
                  </button>
                </div>
              }

              <!-- Security Badge -->
              <div class="mt-6 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-surface-container-low text-tertiary" data-adapted-zone="true">
                <span class="material-symbols-outlined text-[16px] text-primary">verified_user</span>
                <span class="font-body-sm text-body-sm">
                  Connexion sécurisée
                </span>
              </div>
            </div>

            <!-- Support Footer -->
            <div class="pt-6 text-center" data-adapted-zone="true">
              <p class="font-body-sm text-body-sm text-on-surface-variant">
                Besoin d'assistance ?
                <a
                  class="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                  [href]="settingsService.supportPhoneLink"
                >
                  <span class="material-symbols-outlined text-[14px]">phone_in_talk</span>
                  Support informatique ({{ settingsService.supportPhone }})
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class ConnexionPageComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly settingsService = inject(HotelSettingsService);
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });

  readonly step = signal<LoginUiStep>('CREDENTIALS');
  readonly login = signal<string>('');
  readonly password = signal<string>('');
  readonly totpCode = signal<string>('');
  readonly stayConnected8h = signal<boolean>(true);
  readonly showPassword = signal<boolean>(false);
  readonly mfaToken = signal<string>('');
  readonly pendingUserName = signal<string>('');
  readonly totpSetup = signal<TotpSetupPayload | null>(null);
  readonly backupCodes = signal<string[]>([]);
  readonly inactivityNotice = signal<boolean>(false);

  readonly loginInvalid = signal<boolean>(false);
  readonly passwordInvalid = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const reason = this.route?.snapshot?.queryParamMap?.get('reason');
    if (reason === 'inactivity' || this.authService.inactivityExpired()) {
      this.inactivityNotice.set(true);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  onLoginChange(event: Event): void {
    this.login.set((event.target as HTMLInputElement).value);
    this.loginInvalid.set(false);
    this.errorMessage.set(null);
  }

  onPasswordChange(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.passwordInvalid.set(false);
    this.errorMessage.set(null);
  }

  onTotpCodeChange(event: Event): void {
    this.totpCode.set((event.target as HTMLInputElement).value);
    this.errorMessage.set(null);
  }

  onStayConnectedChange(event: Event): void {
    this.stayConnected8h.set((event.target as HTMLInputElement).checked);
  }

  onForgotPassword(): void {
    alert(
      `Veuillez vous adresser au support informatique (${this.settingsService.supportPhone}) pour la réinitialisation de vos accès sécurisés Résidence Blue.`,
    );
  }

  resetToCredentials(): void {
    this.step.set('CREDENTIALS');
    this.totpCode.set('');
    this.mfaToken.set('');
    this.totpSetup.set(null);
    this.errorMessage.set(null);
  }

  async handleLogin(event?: Event): Promise<void> {
    if (event) event.preventDefault();

    const currentLogin = this.login().trim();
    const currentPassword = this.password();

    let hasError = false;
    if (!currentLogin) {
      this.loginInvalid.set(true);
      hasError = true;
    }
    if (!currentPassword) {
      this.passwordInvalid.set(true);
      hasError = true;
    }
    if (hasError) return;

    try {
      this.errorMessage.set(null);
      const result = await this.authService.login({
        login: currentLogin,
        password: currentPassword,
        stayConnected8h: this.stayConnected8h(),
      });

      if (result.status === 'MFA_REQUIRED') {
        this.mfaToken.set(result.mfaToken);
        this.pendingUserName.set(result.user.fullName);
        this.totpCode.set('');
        this.step.set('MFA_VERIFY');
        return;
      }

      if (result.status === 'MFA_SETUP_REQUIRED') {
        this.mfaToken.set(result.mfaToken);
        this.pendingUserName.set(result.user.fullName);
        this.totpSetup.set(result.totpSetup);
        this.totpCode.set('');
        this.step.set('MFA_SETUP');
        return;
      }

      await this.router?.navigate(['/tableau-de-bord']);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error
          ? err.message
          : 'Identifiants incorrects. Veuillez vérifier votre adresse email ou mot de passe.',
      );
    }
  }

  async handleTotpVerify(event?: Event): Promise<void> {
    if (event) event.preventDefault();
    if (!this.totpCode().trim()) {
      this.errorMessage.set('Veuillez saisir votre code à 6 chiffres ou code de secours.');
      return;
    }
    try {
      this.errorMessage.set(null);
      await this.authService.verifyTotpLogin(this.mfaToken(), this.totpCode());
      await this.router?.navigate(['/tableau-de-bord']);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Code de vérification invalide.',
      );
    }
  }

  async handleTotpSetupConfirm(event?: Event): Promise<void> {
    if (event) event.preventDefault();
    if (!this.totpCode().trim()) {
      this.errorMessage.set('Veuillez saisir le code à 6 chiffres généré.');
      return;
    }
    try {
      this.errorMessage.set(null);
      const res = await this.authService.confirmMandatoryTotpSetup(
        this.mfaToken(),
        this.totpCode(),
      );
      if (res.backupCodes.length > 0) {
        this.backupCodes.set(res.backupCodes);
        this.step.set('BACKUP_CODES');
      } else {
        await this.router?.navigate(['/tableau-de-bord']);
      }
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Code TOTP invalide.',
      );
    }
  }

  async proceedToDashboard(): Promise<void> {
    await this.router?.navigate(['/tableau-de-bord']);
  }
}
