import { Component, inject, signal, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthMockService } from '../../core/services/auth-mock.service';
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
            <!-- Background Image with Scrim -->
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
              <!-- Statut & Climat Thiès (ADAPTATION-THIES.md) -->
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

            <!-- Bottom Content: Editorial Quote & Signature (ADAPTATION-THIES.md) -->
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

              <!-- Caractéristiques de l'hôtel à Thiès -->
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

          <!-- Right Column: Login Card & Credentials Canvas (45% desktop) -->
          <div class="w-full lg:w-[45%] flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-surface-container-lowest">
            <!-- Top Utilities (français seul, retrait v2.4 PMS Pro) -->
            <div class="flex items-center justify-between w-full pb-6" data-adapted-zone="true">
              <div class="flex items-center gap-2">
                <span class="font-label-md text-label-md px-2.5 py-1 rounded bg-surface-container-high text-primary font-bold">FR</span>
              </div>
              <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-tertiary font-label-md text-label-md">
                <span class="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                <span>Portail Interne</span>
              </div>
            </div>

            <!-- Main Login Section -->
            <div class="w-full max-w-md mx-auto my-auto flex flex-col">
              <!-- Brand Mark -->
              <div class="flex items-center gap-3 mb-6">
                <div class="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
                  <span class="material-symbols-outlined text-on-primary text-[24px]">apartment</span>
                </div>
                <div class="flex flex-col">
                  <h1 class="font-headline-md text-headline-md tracking-tight font-serif text-on-surface leading-tight">
                    Résidence Blue
                  </h1>
                  <span class="font-label-md text-label-md uppercase tracking-widest text-primary font-semibold">
                    HÔTEL BOUTIQUE • GRAND STANDING, THIÈS
                  </span>
                </div>
              </div>

              <!-- Heading & Context -->
              <div class="mb-6">
                <h2 class="font-headline-sm text-headline-sm font-serif text-on-surface">
                  Connexion Collaborateur
                </h2>
                <p class="font-body-md text-body-md text-on-surface-variant mt-1">
                  Portail de gestion hôtelière &amp; restaurant La Teranga
                </p>
              </div>

              <!-- Quick Role Demo Selector (SEULEMENT si indicateur dev actif) -->
              @if (showDevProfiles()) {
                <div class="mb-6 p-3 rounded-xl bg-surface-container-low flex flex-col gap-2" data-adapted-zone="true">
                  <div class="flex items-center justify-between">
                    <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                      Profils rapides de démonstration (Dev)
                    </span>
                    <span class="material-symbols-outlined text-outline text-[16px]">touch_app</span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      (click)="fillDemoDirector()"
                      class="px-2.5 py-1.5 rounded-lg text-left bg-surface-container-lowest hover:bg-primary/10 transition-colors flex flex-col text-on-surface"
                    >
                      <span class="font-label-md text-label-md font-bold truncate">Direction / Récept.</span>
                      <span class="font-body-sm text-body-sm text-outline truncate">Aïssatou Ba</span>
                    </button>
                    <button
                      type="button"
                      (click)="fillDemoRestaurant()"
                      class="px-2.5 py-1.5 rounded-lg text-left bg-surface-container-lowest hover:bg-primary/10 transition-colors flex flex-col text-on-surface"
                    >
                      <span class="font-label-md text-label-md font-bold truncate">Restaurant</span>
                      <span class="font-body-sm text-body-sm text-outline truncate">La Teranga</span>
                    </button>
                    <button
                      type="button"
                      (click)="fillDemoMaintenance()"
                      class="px-2.5 py-1.5 rounded-lg text-left bg-surface-container-lowest hover:bg-primary/10 transition-colors flex flex-col text-on-surface"
                    >
                      <span class="font-label-md text-label-md font-bold truncate">Maintenance</span>
                      <span class="font-body-sm text-body-sm text-outline truncate">Chambres &amp; Parc</span>
                    </button>
                  </div>
                </div>
              }

              <!-- Authentication Form -->
              <form class="flex flex-col gap-4" id="pms-login-form" (submit)="handleLogin($event)">
                <!-- Erreur globale « Identifiants incorrects » -->
                @if (errorMessage()) {
                  <div
                    class="p-3 rounded-lg bg-error-container/40 border border-error/30 text-error flex items-start gap-2.5"
                    role="alert"
                    aria-live="assertive"
                    data-test="error-banner"
                  >
                    <span class="material-symbols-outlined text-[20px] shrink-0 text-error mt-0.5">error</span>
                    <div class="flex flex-col">
                      <span class="font-title-md text-sm font-semibold">Identifiants incorrects</span>
                      <span class="font-body-sm text-xs text-on-surface">{{ errorMessage() }}</span>
                    </div>
                  </div>
                }

                <!-- Username / Email Field -->
                <div class="flex flex-col gap-1.5">
                  <label class="font-label-lg text-label-lg text-on-surface flex items-center justify-between" for="user-login">
                    <span>Identifiant ou Email professionnel</span>
                    @if (selectedRole()) {
                      <span class="px-2 py-0.5 rounded text-[11px] bg-secondary-fixed text-on-secondary-fixed font-semibold">
                        {{ selectedRole() }}
                      </span>
                    }
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
                      placeholder="ex: aissatou.ba@residenceblue.sn"
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

                <!-- Password Field -->
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

                <!-- Options Row -->
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

                <!-- Primary Submit Button -->
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

              <!-- Security Badge: "Connexion sécurisée" (écarts voulus) -->
              <div class="mt-6 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-surface-container-low text-tertiary" data-adapted-zone="true">
                <span class="material-symbols-outlined text-[16px] text-primary">verified_user</span>
                <span class="font-body-sm text-body-sm">
                  Connexion sécurisée
                </span>
              </div>
            </div>

            <!-- Support Footer: lu dynamiquement depuis HotelSettingsService -->
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
  `
})
export class ConnexionPageComponent {
  readonly authService = inject(AuthMockService);
  readonly settingsService = inject(HotelSettingsService);
  private readonly router = inject(Router);

  // Champs de saisie (vides au départ selon la règle)
  readonly login = signal<string>('');
  readonly password = signal<string>('');
  readonly stayConnected8h = signal<boolean>(true);
  readonly showPassword = signal<boolean>(false);
  readonly selectedRole = signal<string | null>(null);

  // Indicateur d'environnement : n'affiche les profils démo qu'en développement
  readonly showDevProfiles = signal<boolean>(isDevMode());

  // États d'erreurs et de validation
  readonly loginInvalid = signal<boolean>(false);
  readonly passwordInvalid = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  fillDemoDirector(): void {
    this.fillDemo('aissatou.ba@residenceblue.sn', "Directrice d'Exploitation");
  }

  fillDemoRestaurant(): void {
    this.fillDemo('teranga.resto@residenceblue.sn', "Maître d'Hôtel");
  }

  fillDemoMaintenance(): void {
    this.fillDemo('technique@residenceblue.sn', 'Chef Maintenance');
  }

  fillDemo(email: string, roleTitle: string): void {
    this.login.set(email);
    this.password.set('ThiesTeranga2024!');
    this.selectedRole.set(roleTitle);
    this.loginInvalid.set(false);
    this.passwordInvalid.set(false);
    this.errorMessage.set(null);
  }

  onLoginChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.login.set(value);
    this.loginInvalid.set(false);
    this.errorMessage.set(null);
  }

  onPasswordChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.password.set(value);
    this.passwordInvalid.set(false);
    this.errorMessage.set(null);
  }

  onStayConnectedChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.stayConnected8h.set(checked);
  }

  onForgotPassword(): void {
    alert(
      `Veuillez vous adresser au support informatique (${this.settingsService.supportPhone}) pour la réinitialisation de vos accès sécurisés Résidence Blue.`
    );
  }

  async handleLogin(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
    }

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

    if (hasError) {
      return;
    }

    try {
      this.errorMessage.set(null);
      await this.authService.login({
        login: currentLogin,
        password: currentPassword,
        stayConnected8h: this.stayConnected8h()
      });

      // Redirection vers le tableau de bord après authentification réussie
      await this.router.navigate(['/tableau-de-bord']);
    } catch {
      this.errorMessage.set('Identifiants incorrects. Veuillez vérifier votre adresse email ou mot de passe.');
    }
  }
}
