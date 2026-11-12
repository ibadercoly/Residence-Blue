import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HotelSettingsService } from '../../core/services/hotel-settings.service';

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
                  Connexion Collaborateur
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

  readonly login = signal<string>('');
  readonly password = signal<string>('');
  readonly stayConnected8h = signal<boolean>(true);
  readonly showPassword = signal<boolean>(false);
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

  onStayConnectedChange(event: Event): void {
    this.stayConnected8h.set((event.target as HTMLInputElement).checked);
  }

  onForgotPassword(): void {
    alert(
      `Veuillez vous adresser au support informatique (${this.settingsService.supportPhone}) pour la réinitialisation de vos accès sécurisés Résidence Blue.`,
    );
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
      await this.authService.login({
        login: currentLogin,
        password: currentPassword,
        stayConnected8h: this.stayConnected8h(),
      });
      await this.router?.navigate(['/tableau-de-bord']);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error
          ? err.message
          : 'Identifiants incorrects. Veuillez vérifier votre adresse email ou mot de passe.',
      );
    }
  }
}
