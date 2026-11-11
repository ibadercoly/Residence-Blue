import { CommonModule, Location } from '@angular/common';
import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ClientsService,
  DuplicateGuestMatch,
  GuestDetail,
  GuestDirectoryFilter,
  GuestDirectoryItem,
  IdDocumentType,
} from '../../core/services/clients.service';
import { ReservationModalService } from '../../core/services/reservation-modal.service';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

type EditableFieldKey =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'address'
  | 'birthDate'
  | 'nationality'
  | 'idDocumentType'
  | 'idDocumentNumber';

interface LetterGroup {
  letter: string;
  items: GuestDirectoryItem[];
}

const AVATAR_PALETTE = [
  'bg-teal-700 text-white',
  'bg-sky-700 text-white',
  'bg-indigo-700 text-white',
  'bg-emerald-700 text-white',
  'bg-amber-700 text-white',
  'bg-rose-700 text-white',
  'bg-cyan-700 text-white',
];

const SENEGAL_PHONE_RE =
  /^(?:\+?221[\s.-]?)?(?:77|78|76|70|75|33)(?:[\s.-]?\d){7}$|^\+\d{8,15}$/;

@Component({
  selector: 'app-clients-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ActionButtonComponent, StatusBadgeComponent],
  styles: [
    `
      .rb-panel-transition {
        transition: opacity 180ms ease, transform 180ms ease;
      }
      @media (prefers-reduced-motion: reduce) {
        .rb-panel-transition {
          transition: none !important;
        }
      }
    `,
  ],
  template: `
    <div
      class="flex flex-col h-[calc(100vh-4.5rem)] w-full max-w-full overflow-hidden bg-[#f8fafc] font-['Manrope',sans-serif]"
      data-testid="clients-v2-root"
    >
      <!-- Grille principale : 2 colonnes >= 900px, 1 colonne plein écran < 900px -->
      <div
        class="flex-1 min-h-0 w-full min-[900px]:grid min-[900px]:grid-cols-[380px_minmax(0,1fr)]"
      >
        <!-- COLONNE GAUCHE : ANNUAIRE -->
        <aside
          aria-label="Annuaire des clients"
          data-testid="directory-pane"
          class="flex flex-col min-h-0 h-full bg-white border-r border-slate-200 overflow-hidden"
          [class.max-[899px]:hidden]="mobileDetailOpen()"
        >
          <!-- En-tête recherche + filtres -->
          <div class="p-4 border-b border-slate-200 space-y-3 shrink-0 bg-white">
            <div class="flex items-center justify-between gap-2">
              <h1 class="text-lg font-extrabold text-slate-900 tracking-tight">Clients</h1>
              <span class="text-xs font-semibold text-slate-500" data-testid="directory-count">
                {{ clientsService.total() }} client{{ clientsService.total() > 1 ? 's' : '' }}
              </span>
            </div>

            <!-- Grand champ de recherche auto-focusé -->
            <div class="relative">
              <label for="clients-search-input" class="sr-only">
                Rechercher un client par nom, téléphone ou numéro de pièce
              </label>
              <span
                class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none"
                aria-hidden="true"
              >
                search
              </span>
              <input
                #searchInputEl
                id="clients-search-input"
                type="search"
                [ngModel]="clientsService.searchQuery()"
                (ngModelChange)="onSearchChange($event)"
                (keydown.arrowdown)="focusFirstOrNextRow(1, $event)"
                placeholder="Nom, téléphone, pièce… (/ ou Ctrl+K)"
                autocomplete="off"
                data-testid="directory-search"
                class="w-full h-11 pl-10 pr-14 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00666f]/30 focus:border-[#00666f]"
              />
              @if (clientsService.searchQuery()) {
                <button
                  type="button"
                  (click)="clearSearch()"
                  aria-label="Effacer la recherche"
                  class="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-200/70 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                >
                  Effacer
                </button>
              } @else {
                <kbd
                  class="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-md absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  /
                </kbd>
              }
            </div>

            <!-- 3 pastilles de filtre uniquement -->
            <div class="flex items-center gap-2" role="group" aria-label="Filtrer les clients">
              @for (f of filters; track f.value) {
                <button
                  type="button"
                  (click)="onFilterChange(f.value)"
                  [attr.data-testid]="'filter-' + f.value.toLowerCase()"
                  [attr.aria-pressed]="clientsService.statusFilter() === f.value"
                  class="h-8 px-3 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                  [class]="
                    clientsService.statusFilter() === f.value
                      ? 'bg-[#00666f] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  "
                >
                  {{ f.label }}
                </button>
              }
            </div>
          </div>

          <!-- Corps scrollable de l'annuaire + index alphabétique -->
          <div class="relative flex-1 min-h-0 flex">
            <div
              id="clients-directory-list"
              (scroll)="onDirectoryScroll()"
              (keydown)="onDirectoryKeydown($event)"
              tabindex="0"
              aria-label="Liste des clients"
              data-testid="directory-list"
              class="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden focus:outline-none pb-20 min-[900px]:pb-4"
            >
              @if (clientsService.isLoading() && clientsService.items().length === 0) {
                <div class="p-3 space-y-2" data-testid="directory-skeleton">
                  @for (s of [1, 2, 3, 4, 5, 6, 7, 8]; track s) {
                    <div class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 animate-pulse">
                      <div class="w-10 h-10 rounded-full bg-slate-200 shrink-0"></div>
                      <div class="flex-1 space-y-2">
                        <div class="h-3.5 bg-slate-200 rounded w-3/4"></div>
                        <div class="h-2.5 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  }
                </div>
              } @else if (groupedItems().length === 0) {
                <div class="p-8 text-center space-y-2" data-testid="directory-empty">
                  <span class="material-symbols-outlined text-4xl text-slate-300" aria-hidden="true">
                    person_search
                  </span>
                  <p class="text-sm font-semibold text-slate-700">Aucun client trouvé</p>
                  <p class="text-xs text-slate-500">
                    Essayez un autre nom, numéro ou créez un client en un clic.
                  </p>
                </div>
              } @else {
                @for (group of groupedItems(); track group.letter) {
                  <section [id]="'letter-group-' + group.letter">
                    <div
                      class="sticky top-0 z-10 px-4 py-1 bg-slate-50/95 backdrop-blur-sm border-y border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-500"
                    >
                      {{ group.letter }}
                    </div>
                    <ul role="listbox" aria-label="Clients commençant par {{ group.letter }}">
                      @for (guest of group.items; track guest.id) {
                        <li>
                          <button
                            type="button"
                            role="option"
                            [attr.aria-selected]="clientsService.selectedGuestId() === guest.id && !quickCreateMode()"
                            [attr.data-testid]="'guest-row-' + guest.id"
                            (click)="openGuest(guest.id)"
                            (mouseenter)="clientsService.prefetchGuest(guest.id)"
                            (focus)="clientsService.prefetchGuest(guest.id)"
                            class="w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00666f]"
                            [class]="
                              clientsService.selectedGuestId() === guest.id && !quickCreateMode()
                                ? 'bg-[#00666f]/10 border-l-4 border-l-[#00666f]'
                                : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                            "
                          >
                            <!-- Avatar rond à couleur stable -->
                            <div
                              class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                              [class]="avatarColorClass(guest.id)"
                              aria-hidden="true"
                            >
                              {{ initials(guest.firstName, guest.lastName, guest.fullName) }}
                            </div>

                            <!-- 2 lignes : nom complet (jamais tronqué) + téléphone/nationalité -->
                            <div class="flex-1 min-w-0">
                              <p
                                class="text-sm font-bold text-slate-900 leading-snug break-words"
                                data-testid="guest-row-name"
                              >
                                {{ guest.fullName }}
                              </p>
                              <p class="text-xs text-slate-500 leading-snug break-words">
                                {{ guest.phone }} · {{ guest.nationality || 'Sénégalaise' }}
                              </p>
                            </div>

                            <!-- Point unique d'état (vert en séjour, bleu à venir) -->
                            @if (guest.state === 'IN_STAY') {
                              <span
                                class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"
                                title="En séjour"
                                aria-label="En séjour"
                              ></span>
                            } @else if (guest.state === 'UPCOMING') {
                              <span
                                class="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"
                                title="À venir"
                                aria-label="À venir"
                              ></span>
                            }
                          </button>
                        </li>
                      }
                    </ul>
                  </section>
                }

                @if (clientsService.isLoadingMore()) {
                  <div class="p-3 text-center text-xs font-semibold text-slate-400">
                    Chargement des clients suivants…
                  </div>
                }
              }
            </div>

            <!-- Petit index alphabétique cliquable sur le bord droit -->
            @if (availableLetters().length > 1) {
              <nav
                aria-label="Index alphabétique"
                class="w-6 shrink-0 py-2 flex flex-col items-center justify-center gap-0.5 bg-white/90 border-l border-slate-100 select-none overflow-y-auto"
              >
                @for (letter of availableLetters(); track letter) {
                  <button
                    type="button"
                    (click)="jumpToLetter(letter)"
                    class="w-5 h-5 text-[10px] font-bold text-slate-500 hover:text-[#00666f] hover:bg-[#00666f]/10 rounded flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-[#00666f]"
                    [attr.aria-label]="'Aller à la lettre ' + letter"
                  >
                    {{ letter }}
                  </button>
                }
              </nav>
            }
          </div>

          <!-- Bouton "+ Nouveau client" fixé en bas de l'annuaire -->
          <div
            class="p-3 border-t border-slate-200 bg-white shrink-0 fixed bottom-0 left-0 right-0 z-20 min-[900px]:static"
          >
            <app-action-button
              label="+ Nouveau client"
              variant="solid"
              color="primary"
              testId="new-client-btn"
              (action)="startQuickCreate()"
            ></app-action-button>
          </div>
        </aside>

        <!-- COLONNE DROITE : ACCUEIL / CRÉATION RAPIDE / FICHE CLIENT -->
        <main
          aria-label="Détail client"
          data-testid="detail-pane"
          class="min-h-0 h-full overflow-y-auto overflow-x-hidden bg-[#f8fafc] rb-panel-transition"
          [class.max-[899px]:hidden]="!mobileDetailOpen()"
        >
          <!-- Barre retour mobile (< 900px) -->
          @if (mobileDetailOpen()) {
            <div
              class="min-[900px]:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200"
            >
              <button
                type="button"
                (click)="backToDirectoryMobile()"
                data-testid="mobile-back-btn"
                class="inline-flex items-center gap-1.5 text-sm font-bold text-[#00666f] focus:outline-none focus:ring-2 focus:ring-[#00666f] rounded-lg px-2 py-1"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
                  arrow_back
                </span>
                Annuaire
              </button>
              @if (clientsService.saveFeedback()) {
                <span class="text-xs font-semibold text-emerald-700" role="status">
                  {{ clientsService.saveFeedback() }}
                </span>
              }
            </div>
          }

          <!-- MODE CRÉATION RAPIDE (dans la colonne droite, sans modale) -->
          @if (quickCreateMode()) {
            <div class="max-w-2xl mx-auto p-6 sm:p-8 space-y-6" data-testid="quick-create-panel">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                  <div
                    class="w-14 h-14 rounded-2xl bg-[#00666f]/10 text-[#00666f] flex items-center justify-center font-extrabold text-xl"
                    aria-hidden="true"
                  >
                    +
                  </div>
                  <div>
                    <h2 class="text-xl font-extrabold text-slate-900">Nouveau client</h2>
                    <p class="text-xs text-slate-500">
                      Renseignez le nom complet et le téléphone pour créer la fiche instantanément.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="cancelQuickCreate()"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                >
                  Annuler
                </button>
              </div>

              <!-- Bannière doublon détecté pendant la frappe -->
              @if (quickDuplicate(); as dup) {
                <div
                  role="alert"
                  data-testid="quick-duplicate-banner"
                  class="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div class="text-sm text-amber-900">
                    Un client existe déjà avec ce numéro :
                    <strong class="font-bold">{{ dup.fullName }}</strong> ({{ dup.phone }})
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      (click)="openDuplicateGuest(dup.id)"
                      data-testid="open-duplicate-btn"
                      class="px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
                    >
                      Ouvrir {{ dup.fullName }}
                    </button>
                    @if (!quickDuplicateConfirmed()) {
                      <button
                        type="button"
                        (click)="confirmDuplicateWanted()"
                        data-testid="confirm-duplicate-btn"
                        class="px-3 py-1.5 rounded-xl border border-amber-400 text-amber-900 text-xs font-semibold hover:bg-amber-100"
                      >
                        Créer quand même
                      </button>
                    }
                  </div>
                </div>
              }

              @if (quickError()) {
                <div
                  role="alert"
                  data-testid="quick-error-banner"
                  class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 font-medium"
                >
                  {{ quickError() }}
                </div>
              }

              <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
                <div>
                  <label for="quick-fullname" class="block text-xs font-bold text-slate-700 mb-1.5">
                    Nom complet <span class="text-rose-600">*</span>
                  </label>
                  <input
                    #quickFullNameEl
                    id="quick-fullname"
                    type="text"
                    [(ngModel)]="quickFullName"
                    (ngModelChange)="onQuickFieldInput()"
                    (keydown.enter)="tryAutoCreateQuick()"
                    (blur)="tryAutoCreateQuick()"
                    placeholder="Ex. Aminata Diagne"
                    data-testid="quick-fullname-input"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30 focus:border-[#00666f]"
                  />
                </div>

                <div>
                  <label for="quick-phone" class="block text-xs font-bold text-slate-700 mb-1.5">
                    Téléphone <span class="text-rose-600">*</span>
                  </label>
                  <input
                    id="quick-phone"
                    type="tel"
                    [(ngModel)]="quickPhone"
                    (ngModelChange)="onQuickPhoneInput($event)"
                    (keydown.enter)="tryAutoCreateQuick()"
                    (blur)="tryAutoCreateQuick()"
                    placeholder="Ex. +221 77 410 20 30"
                    data-testid="quick-phone-input"
                    class="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30 focus:border-[#00666f]"
                  />
                  @if (quickPhoneError()) {
                    <p class="mt-1.5 text-xs font-medium text-rose-600" data-testid="quick-phone-error">
                      {{ quickPhoneError() }}
                    </p>
                  } @else {
                    <p class="mt-1.5 text-xs text-slate-400">
                      Formats acceptés : +221, 77, 78, 76, 70, 75. La fiche se crée dès validation.
                    </p>
                  }
                </div>
              </div>
            </div>
          } @else if (clientsService.selectedGuest(); as guest) {
            <!-- FICHE CLIENT (modification en place) -->
            <div class="max-w-2xl mx-auto p-6 sm:p-8 space-y-6" data-testid="client-detail-panel">
              <!-- Feedback discret / Conflit / Erreur -->
              @if (clientsService.conflictError()) {
                <div
                  role="alert"
                  data-testid="version-conflict-banner"
                  class="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between gap-3"
                >
                  <p class="text-sm font-medium text-amber-900">
                    {{ clientsService.conflictError() }}
                  </p>
                  <button
                    type="button"
                    (click)="reloadSelectedGuest()"
                    data-testid="reload-guest-btn"
                    class="px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 shrink-0"
                  >
                    Recharger
                  </button>
                </div>
              }

              @if (clientsService.errorMessage()) {
                <div
                  role="alert"
                  data-testid="inline-error-banner"
                  class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
                >
                  {{ clientsService.errorMessage() }}
                </div>
              }

              <!-- En-tête fiche -->
              <header class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="flex items-center gap-4 min-w-0 flex-1">
                    <div
                      class="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-extrabold shrink-0"
                      [class]="avatarColorClass(guest.id)"
                      aria-hidden="true"
                    >
                      {{ initials(guest.firstName, guest.lastName, guest.fullName) }}
                    </div>

                    <div class="min-w-0 flex-1 space-y-1.5">
                      <!-- Nom modifiable en place -->
                      @if (editingField() === 'fullName') {
                        <input
                          type="text"
                          [(ngModel)]="editBuffer"
                          (keydown.enter)="commitEdit(guest, 'fullName')"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(guest, 'fullName')"
                          aria-label="Nom complet"
                          data-testid="inline-input-fullName"
                          autofocus
                          class="w-full px-2.5 py-1 rounded-lg border border-[#00666f] text-xl font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30"
                        />
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit('fullName', guest.fullName)"
                          data-testid="inline-display-fullName"
                          title="Cliquer pour modifier le nom"
                          class="text-left text-xl font-extrabold text-slate-900 leading-snug break-words hover:text-[#00666f] hover:underline decoration-dashed underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#00666f] rounded"
                        >
                          {{ guest.fullName }}
                        </button>
                      }

                      <div class="flex flex-wrap items-center gap-2">
                        @if (guest.state === 'IN_STAY') {
                          <app-status-badge status="success" label="En séjour"></app-status-badge>
                        } @else if (guest.state === 'UPCOMING') {
                          <app-status-badge status="info" label="À venir"></app-status-badge>
                        } @else {
                          <app-status-badge status="neutral" label="Client enregistré"></app-status-badge>
                        }

                        @if (clientsService.saveFeedback()) {
                          <span
                            class="text-xs font-semibold text-emerald-700"
                            role="status"
                            data-testid="save-feedback"
                          >
                            ✓ {{ clientsService.saveFeedback() }}
                          </span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Deux actions : Nouvelle réservation + Menu ⋯ -->
                  <div class="flex items-center gap-2 shrink-0">
                    <app-action-button
                      label="Nouvelle réservation"
                      icon="add"
                      variant="solid"
                      color="primary"
                      testId="new-reservation-btn"
                      (action)="openReservation(guest)"
                    ></app-action-button>

                    <div class="relative">
                      <button
                        type="button"
                        (click)="toggleActionsMenu($event)"
                        aria-label="Plus d'actions"
                        [attr.aria-expanded]="actionsMenuOpen()"
                        data-testid="detail-menu-btn"
                        class="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                      >
                        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
                          more_horiz
                        </span>
                      </button>

                      @if (actionsMenuOpen()) {
                        <div
                          role="menu"
                          data-testid="detail-menu-dropdown"
                          class="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-30"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            (click)="copyCoordinates(guest)"
                            data-testid="menu-copy-coords"
                            class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                              content_copy
                            </span>
                            Dupliquer les coordonnées
                          </button>

                          @if (isDirection()) {
                            <div class="my-1 border-t border-slate-100"></div>
                            <button
                              type="button"
                              role="menuitem"
                              (click)="openDeleteBox(guest)"
                              data-testid="menu-delete-guest"
                              class="w-full text-left px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                            >
                              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                                delete
                              </span>
                              Supprimer
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </header>

              <!-- Boîte de confirmation de suppression inline -->
              @if (deleteTarget(); as target) {
                <section
                  role="alertdialog"
                  aria-label="Confirmer la suppression"
                  data-testid="delete-confirm-box"
                  class="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 space-y-3"
                >
                  <p class="text-sm font-bold text-rose-900">
                    Supprimer définitivement {{ target.fullName }} ?
                  </p>
                  @if (deleteError()) {
                    <p
                      class="text-sm font-semibold text-rose-700 bg-white rounded-xl p-3 border border-rose-200"
                      role="alert"
                      data-testid="delete-error-msg"
                    >
                      {{ deleteError() }}
                    </p>
                  }
                  <div class="space-y-2">
                    <label for="delete-lastname-input" class="block text-xs font-semibold text-rose-900">
                      Tapez le nom de famille <strong>{{ target.lastName }}</strong> pour confirmer :
                    </label>
                    <input
                      id="delete-lastname-input"
                      type="text"
                      [(ngModel)]="deleteConfirmInput"
                      data-testid="delete-confirm-input"
                      class="w-full h-10 px-3 rounded-xl border border-rose-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div class="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      (click)="closeDeleteBox()"
                      class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      [disabled]="
                        deleteConfirmInput.trim().toLowerCase() !==
                          target.lastName.trim().toLowerCase() || clientsService.isSaving()
                      "
                      (click)="confirmDelete(target)"
                      data-testid="delete-confirm-btn"
                      class="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-40"
                    >
                      Supprimer définitivement
                    </button>
                  </div>
                </section>
              }

              <!-- BLOC 1 : COORDONNÉES -->
              <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Coordonnées
                </h3>

                <dl class="divide-y divide-slate-100">
                  <!-- Téléphone -->
                  <div class="py-3 first:pt-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <dt class="w-36 shrink-0 text-xs font-semibold text-slate-500">Téléphone</dt>
                    <dd class="flex-1 min-w-0">
                      @if (editingField() === 'phone') {
                        <input
                          type="tel"
                          [(ngModel)]="editBuffer"
                          (keydown.enter)="commitEdit(guest, 'phone')"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(guest, 'phone')"
                          aria-label="Téléphone"
                          data-testid="inline-input-phone"
                          autofocus
                          class="w-full h-9 px-3 rounded-lg border border-[#00666f] text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30"
                        />
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit('phone', guest.phone)"
                          data-testid="inline-display-phone"
                          class="w-full text-left text-sm font-semibold text-slate-900 hover:text-[#00666f] py-1 px-2 -mx-2 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                        >
                          {{ guest.phone || 'Ajouter un téléphone' }}
                        </button>
                      }
                    </dd>
                  </div>

                  <!-- E-mail -->
                  <div class="py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <dt class="w-36 shrink-0 text-xs font-semibold text-slate-500">E-mail</dt>
                    <dd class="flex-1 min-w-0">
                      @if (editingField() === 'email') {
                        <input
                          type="email"
                          [(ngModel)]="editBuffer"
                          (keydown.enter)="commitEdit(guest, 'email')"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(guest, 'email')"
                          aria-label="E-mail"
                          data-testid="inline-input-email"
                          autofocus
                          class="w-full h-9 px-3 rounded-lg border border-[#00666f] text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30"
                        />
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit('email', guest.email)"
                          data-testid="inline-display-email"
                          class="w-full text-left text-sm py-1 px-2 -mx-2 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                          [class]="guest.email ? 'font-medium text-slate-900' : 'text-slate-400 italic'"
                        >
                          {{ guest.email || 'Ajouter un e-mail' }}
                        </button>
                      }
                    </dd>
                  </div>

                  <!-- Adresse -->
                  <div class="py-3 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <dt class="w-36 shrink-0 text-xs font-semibold text-slate-500">Adresse</dt>
                    <dd class="flex-1 min-w-0">
                      @if (editingField() === 'address') {
                        <input
                          type="text"
                          [(ngModel)]="editBuffer"
                          (keydown.enter)="commitEdit(guest, 'address')"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(guest, 'address')"
                          aria-label="Adresse"
                          data-testid="inline-input-address"
                          autofocus
                          class="w-full h-9 px-3 rounded-lg border border-[#00666f] text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30"
                        />
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit('address', guest.address)"
                          data-testid="inline-display-address"
                          class="w-full text-left text-sm py-1 px-2 -mx-2 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                          [class]="guest.address ? 'font-medium text-slate-900' : 'text-slate-400 italic'"
                        >
                          {{ guest.address || 'Ajouter une adresse' }}
                        </button>
                      }
                    </dd>
                  </div>
                </dl>
              </section>

              <!-- BLOC 2 : IDENTITÉ -->
              <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Identité
                </h3>

                <dl class="divide-y divide-slate-100">
                  <!-- Date de naissance -->
                  <div class="py-3 first:pt-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <dt class="w-36 shrink-0 text-xs font-semibold text-slate-500">Naissance</dt>
                    <dd class="flex-1 min-w-0">
                      @if (editingField() === 'birthDate') {
                        <input
                          type="date"
                          [(ngModel)]="editBuffer"
                          (keydown.enter)="commitEdit(guest, 'birthDate')"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(guest, 'birthDate')"
                          aria-label="Date de naissance"
                          data-testid="inline-input-birthDate"
                          autofocus
                          class="h-9 px-3 rounded-lg border border-[#00666f] text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30"
                        />
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit('birthDate', guest.birthDate)"
                          data-testid="inline-display-birthDate"
                          class="w-full text-left text-sm py-1 px-2 -mx-2 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                          [class]="guest.birthDate ? 'font-medium text-slate-900' : 'text-slate-400 italic'"
                        >
                          {{ guest.birthDate || 'Renseigner la date' }}
                        </button>
                      }
                    </dd>
                  </div>

                  <!-- Nationalité -->
                  <div class="py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <dt class="w-36 shrink-0 text-xs font-semibold text-slate-500">Nationalité</dt>
                    <dd class="flex-1 min-w-0">
                      @if (editingField() === 'nationality') {
                        <input
                          type="text"
                          [(ngModel)]="editBuffer"
                          (keydown.enter)="commitEdit(guest, 'nationality')"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(guest, 'nationality')"
                          aria-label="Nationalité"
                          data-testid="inline-input-nationality"
                          autofocus
                          class="w-full h-9 px-3 rounded-lg border border-[#00666f] text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30"
                        />
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit('nationality', guest.nationality)"
                          data-testid="inline-display-nationality"
                          class="w-full text-left text-sm font-medium text-slate-900 py-1 px-2 -mx-2 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                        >
                          {{ guest.nationality || 'Sénégalaise' }}
                        </button>
                      }
                    </dd>
                  </div>

                  <!-- Pièce d'identité (type + numéro masqué / Afficher) -->
                  <div class="py-3 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <dt class="w-36 shrink-0 text-xs font-semibold text-slate-500">Pièce d'identité</dt>
                    <dd class="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                      @if (editingField() === 'idDocumentType') {
                        <select
                          [(ngModel)]="editBuffer"
                          (change)="commitEdit(guest, 'idDocumentType')"
                          (keydown.escape)="cancelEdit()"
                          (blur)="cancelEdit()"
                          aria-label="Type de pièce"
                          class="h-9 px-2.5 rounded-lg border border-[#00666f] text-sm text-slate-900"
                        >
                          <option value="CNI">CNI</option>
                          <option value="PASSPORT">Passeport</option>
                          <option value="PERMIS">Permis</option>
                          <option value="AUTRE">Autre</option>
                        </select>
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit('idDocumentType', guest.idDocumentType || 'CNI')"
                          class="px-2 py-0.5 rounded-md bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                        >
                          {{ docTypeLabel(guest.idDocumentType) }}
                        </button>
                      }

                      @if (editingField() === 'idDocumentNumber') {
                        <input
                          type="text"
                          [(ngModel)]="editBuffer"
                          (keydown.enter)="commitEdit(guest, 'idDocumentNumber')"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(guest, 'idDocumentNumber')"
                          placeholder="Nouveau numéro de pièce"
                          aria-label="Numéro de pièce"
                          data-testid="inline-input-idDocumentNumber"
                          autofocus
                          class="flex-1 min-w-[160px] h-9 px-3 rounded-lg border border-[#00666f] text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00666f]/30"
                        />
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit('idDocumentNumber', '')"
                          data-testid="inline-display-idDocumentNumber"
                          class="text-left text-sm font-mono py-1 px-2 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                          [class]="guest.hasIdDocument ? 'font-semibold text-slate-900' : 'text-slate-400 italic font-sans'"
                        >
                          @if (revealedDocNumber() !== null && revealedForGuestId() === guest.id) {
                            {{ revealedDocNumber() }}
                          } @else if (guest.hasIdDocument) {
                            {{ guest.idDocumentMasked || '****' }}
                          } @else {
                            Ajouter un numéro
                          }
                        </button>

                        @if (guest.hasIdDocument && canRevealDocument()) {
                          <button
                            type="button"
                            (click)="toggleRevealDocument(guest.id)"
                            data-testid="reveal-document-btn"
                            class="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-[#00666f] hover:bg-[#00666f]/10 focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                          >
                            {{
                              revealedDocNumber() !== null && revealedForGuestId() === guest.id
                                ? 'Masquer'
                                : 'Afficher'
                            }}
                          </button>
                        }
                      }
                    </dd>
                  </div>
                </dl>
              </section>

              <!-- BLOC 3 : SÉJOURS (Timeline verticale, lots de 10) -->
              <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Séjours ({{ guest.staysTotal }})
                  </h3>
                </div>

                @if (guest.stays.length === 0) {
                  <p class="text-sm text-slate-500 italic" data-testid="stays-empty">
                    Aucun séjour enregistré pour ce client.
                  </p>
                } @else {
                  <ol class="relative border-l-2 border-slate-200 ml-2 space-y-4" data-testid="stays-timeline">
                    @for (stay of guest.stays; track stay.id) {
                      <li class="pl-5 relative">
                        <span
                          class="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white"
                          [class]="
                            stay.status === 'CHECKED_IN'
                              ? 'bg-emerald-500'
                              : stay.status === 'CONFIRMED'
                                ? 'bg-blue-500'
                                : 'bg-slate-400'
                          "
                          aria-hidden="true"
                        ></span>
                        <button
                          type="button"
                          (click)="openStayReservation(stay.id)"
                          data-testid="stay-timeline-item"
                          class="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-[#00666f]/40 hover:bg-slate-50/70 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00666f]"
                        >
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <span class="text-sm font-bold text-slate-900">
                              Ch. {{ stay.roomNumber || '—' }} · {{ stay.roomCategory }}
                            </span>
                            <span class="text-sm font-extrabold text-[#00666f]">
                              {{ formatFcfa(stay.totalFcfa) }}
                            </span>
                          </div>
                          <div class="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span>
                              {{ stay.checkInDate }} → {{ stay.checkOutDate }} ({{ stay.nights }} nuit{{
                                stay.nights > 1 ? 's' : ''
                              }})
                            </span>
                            <span class="font-semibold">{{ stayStatusLabel(stay.status) }}</span>
                          </div>
                        </button>
                      </li>
                    }
                  </ol>

                  @if (guest.staysNextCursor) {
                    <div class="pt-2">
                      <button
                        type="button"
                        (click)="clientsService.loadMoreStays(guest.id)"
                        [disabled]="clientsService.isLoadingMoreStays()"
                        data-testid="load-more-stays-btn"
                        class="text-xs font-bold text-[#00666f] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00666f] rounded px-1"
                      >
                        {{
                          clientsService.isLoadingMoreStays()
                            ? 'Chargement…'
                            : 'Charger les séjours précédents'
                        }}
                      </button>
                    </div>
                  }
                }
              </section>

              <!-- EN BAS : NOTE INTERNE À ENREGISTREMENT AUTOMATIQUE -->
              <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
                <label
                  for="internal-note-input"
                  class="block text-xs font-extrabold uppercase tracking-wider text-slate-500"
                >
                  Note interne
                </label>
                <textarea
                  id="internal-note-input"
                  rows="3"
                  [ngModel]="noteDraft()"
                  (ngModelChange)="onNoteInput($event, guest)"
                  (blur)="flushNote(guest)"
                  placeholder="Préférences, remarques d'accueil… (enregistrement automatique)"
                  data-testid="internal-note-input"
                  class="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00666f]/30 focus:border-[#00666f]"
                ></textarea>
              </section>
            </div>
          } @else {
            <!-- ÉCRAN D'ACCUEIL (aucun client sélectionné) -->
            <div
              class="h-full flex items-center justify-center p-6 sm:p-10"
              data-testid="welcome-panel"
            >
              <div class="max-w-lg w-full text-center space-y-6">
                <div class="space-y-2">
                  <div
                    class="w-14 h-14 mx-auto rounded-2xl bg-[#00666f]/10 text-[#00666f] flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span class="material-symbols-outlined text-[28px]">groups</span>
                  </div>
                  <h2 class="text-xl font-extrabold text-slate-900">
                    Sélectionnez un client dans l’annuaire
                  </h2>
                  <p class="text-sm text-slate-500">
                    Appuyez sur
                    <kbd class="px-1.5 py-0.5 text-xs font-bold bg-white border border-slate-200 rounded">
                      /
                    </kbd>
                    ou
                    <kbd class="px-1.5 py-0.5 text-xs font-bold bg-white border border-slate-200 rounded">
                      Ctrl+K
                    </kbd>
                    pour rechercher par nom, téléphone ou pièce.
                  </p>
                </div>

                <!-- Trois chiffres uniquement -->
                <div class="grid grid-cols-3 gap-3">
                  <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <p class="text-2xl font-extrabold text-emerald-600" data-testid="stat-in-stay">
                      {{ clientsService.stats().inStayCount }}
                    </p>
                    <p class="text-xs font-semibold text-slate-500 mt-1">En séjour</p>
                  </div>
                  <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <p class="text-2xl font-extrabold text-blue-600" data-testid="stat-expected-today">
                      {{ clientsService.stats().expectedTodayCount }}
                    </p>
                    <p class="text-xs font-semibold text-slate-500 mt-1">Arrivées aujourd’hui</p>
                  </div>
                  <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <p class="text-2xl font-extrabold text-[#00666f]" data-testid="stat-new-month">
                      {{ clientsService.stats().newThisMonthCount }}
                    </p>
                    <p class="text-xs font-semibold text-slate-500 mt-1">Nouveaux ce mois</p>
                  </div>
                </div>
              </div>
            </div>
          }
        </main>
      </div>
    </div>
  `,
})
export class ClientsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly clientsService: ClientsService;
  private readonly route: ActivatedRoute;
  private readonly router: Router;
  private readonly location: Location;
  private readonly reservationModal: ReservationModalService;

  constructor(
    clientsService?: ClientsService,
    route?: ActivatedRoute,
    router?: Router,
    location?: Location,
    reservationModal?: ReservationModalService,
  ) {
    this.clientsService = clientsService ?? inject(ClientsService);
    this.route = route ?? inject(ActivatedRoute);
    this.router = router ?? inject(Router);
    this.location = location ?? inject(Location);
    this.reservationModal = reservationModal ?? inject(ReservationModalService);

    try {
      effect(
        () => {
          const g = this.clientsService.selectedGuest();
          if (g && this.noteGuestIdSynced !== g.id) {
            this.noteGuestIdSynced = g.id;
            this.noteDraftSignal.set(g.internalNote || '');
          }
        },
        { allowSignalWrites: true },
      );
    } catch {
      // Hors contexte d'injection Angular (tests unitaires Jest)
    }
  }

  private getSearchEl(): HTMLInputElement | null {
    return typeof document !== 'undefined'
      ? (document.getElementById('clients-search-input') as HTMLInputElement | null)
      : null;
  }

  private getDirectoryListEl(): HTMLElement | null {
    return typeof document !== 'undefined'
      ? document.getElementById('clients-directory-list')
      : null;
  }

  private getQuickFullNameEl(): HTMLInputElement | null {
    return typeof document !== 'undefined'
      ? (document.getElementById('quick-fullname') as HTMLInputElement | null)
      : null;
  }

  readonly filters: Array<{ value: GuestDirectoryFilter; label: string }> = [
    { value: 'ALL', label: 'Tous' },
    { value: 'IN_STAY', label: 'En séjour' },
    { value: 'UPCOMING', label: 'À venir' },
  ];

  readonly quickCreateMode = signal<boolean>(false);
  readonly mobileDetailOpen = signal<boolean>(false);
  readonly actionsMenuOpen = signal<boolean>(false);
  readonly editingField = signal<EditableFieldKey | null>(null);
  readonly deleteTarget = signal<GuestDetail | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly revealedDocNumber = signal<string | null>(null);
  readonly revealedForGuestId = signal<string | null>(null);

  // Création rapide
  quickFullName = '';
  quickPhone = '';
  readonly quickPhoneError = signal<string | null>(null);
  readonly quickError = signal<string | null>(null);
  readonly quickDuplicate = signal<DuplicateGuestMatch | null>(null);
  readonly quickDuplicateConfirmed = signal<boolean>(false);

  // Édition sur place & Note
  editBuffer = '';
  deleteConfirmInput = '';
  private readonly noteDraftSignal = signal<string>('');
  private noteGuestIdSynced: string | null = null;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private dupTimer: ReturnType<typeof setTimeout> | null = null;
  private noteTimer: ReturnType<typeof setTimeout> | null = null;

  readonly groupedItems = computed<LetterGroup[]>(() => {
    const items = this.clientsService.items();
    const map = new Map<string, GuestDirectoryItem[]>();
    for (const item of items) {
      const firstChar = (item.fullName || '?').trim().charAt(0).toUpperCase();
      const letter = /[A-ZÀ-ÖØ-Ý]/.test(firstChar)
        ? firstChar.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : '#';
      const arr = map.get(letter) || [];
      arr.push(item);
      map.set(letter, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([letter, list]) => ({ letter, items: list }));
  });

  readonly availableLetters = computed<string[]>(() =>
    this.groupedItems().map((g) => g.letter),
  );

  noteDraft(): string {
    return this.noteDraftSignal();
  }

  ngOnInit(): void {
    this.clientsService.loadDirectory(true);
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.mobileDetailOpen.set(true);
      this.clientsService.selectGuest(idParam);
    }
  }

  ngAfterViewInit(): void {
    // Focus automatique sur le champ de recherche au chargement
    setTimeout(() => {
      if (!this.mobileDetailOpen()) {
        this.getSearchEl()?.focus();
      }
      const listEl = this.getDirectoryListEl();
      if (listEl && this.clientsService.directoryScrollTop > 0) {
        listEl.scrollTop = this.clientsService.directoryScrollTop;
      }
    }, 50);
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.dupTimer) clearTimeout(this.dupTimer);
    if (this.noteTimer) clearTimeout(this.noteTimer);
  }

  @HostListener('window:popstate')
  onPopState(): void {
    const path = this.location.path();
    const match = path.match(/^\/clients\/([^/]+)/);
    if (match) {
      this.quickCreateMode.set(false);
      this.mobileDetailOpen.set(true);
      this.clientsService.selectGuest(match[1]);
    } else {
      this.quickCreateMode.set(false);
      this.mobileDetailOpen.set(false);
      this.clientsService.selectGuest(null);
      setTimeout(() => {
        const listEl = this.getDirectoryListEl();
        if (listEl) {
          listEl.scrollTop = this.clientsService.directoryScrollTop;
        }
      }, 30);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.actionsMenuOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTyping =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT');

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.focusSearch();
      return;
    }

    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      this.focusSearch();
      return;
    }

    if (event.key === 'Escape') {
      this.actionsMenuOpen.set(false);
      if (this.editingField()) {
        this.cancelEdit();
      } else if (this.deleteTarget()) {
        this.closeDeleteBox();
      }
    }
  }

  focusSearch(): void {
    if (this.mobileDetailOpen()) {
      this.backToDirectoryMobile();
    }
    setTimeout(() => {
      const el = this.getSearchEl();
      el?.focus();
      el?.select();
    }, 20);
  }

  onSearchChange(value: string): void {
    this.clientsService.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.clientsService.loadDirectory(true);
    }, 200);
  }

  clearSearch(): void {
    this.clientsService.searchQuery.set('');
    this.clientsService.loadDirectory(true);
    this.getSearchEl()?.focus();
  }

  onFilterChange(filter: GuestDirectoryFilter): void {
    this.clientsService.statusFilter.set(filter);
    this.clientsService.loadDirectory(true);
  }

  onDirectoryScroll(): void {
    const el = this.getDirectoryListEl();
    if (!el) return;
    this.clientsService.directoryScrollTop = el.scrollTop;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) {
      this.clientsService.loadDirectory(false);
    }
  }

  onDirectoryKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveSelection(-1);
    }
  }

  focusFirstOrNextRow(delta: number, event: Event): void {
    event.preventDefault();
    this.moveSelection(delta);
    this.getDirectoryListEl()?.focus();
  }

  private moveSelection(delta: number): void {
    const items = this.clientsService.items();
    if (items.length === 0) return;
    const currentId = this.clientsService.selectedGuestId();
    const idx = currentId ? items.findIndex((g) => g.id === currentId) : -1;
    const nextIdx =
      idx === -1 ? 0 : Math.min(Math.max(idx + delta, 0), items.length - 1);
    const target = items[nextIdx];
    if (target) {
      this.openGuest(target.id);
    }
  }

  jumpToLetter(letter: string): void {
    const el = document.getElementById(`letter-group-${letter}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openGuest(id: string): void {
    this.quickCreateMode.set(false);
    this.editingField.set(null);
    this.deleteTarget.set(null);
    this.revealedDocNumber.set(null);
    this.revealedForGuestId.set(null);
    this.noteGuestIdSynced = null;
    this.mobileDetailOpen.set(true);
    this.clientsService.selectGuest(id);
    this.router.navigate(['/clients', id], { replaceUrl: false });
  }

  backToDirectoryMobile(): void {
    this.quickCreateMode.set(false);
    this.mobileDetailOpen.set(false);
    this.clientsService.selectGuest(null);
    this.router.navigate(['/clients']);
    setTimeout(() => {
      const listEl = this.getDirectoryListEl();
      if (listEl) {
        listEl.scrollTop = this.clientsService.directoryScrollTop;
      }
    }, 30);
  }

  // --- Création rapide ---
  startQuickCreate(): void {
    this.quickFullName = '';
    this.quickPhone = '';
    this.quickPhoneError.set(null);
    this.quickError.set(null);
    this.quickDuplicate.set(null);
    this.quickDuplicateConfirmed.set(false);
    this.quickCreateMode.set(true);
    this.mobileDetailOpen.set(true);
    setTimeout(() => this.getQuickFullNameEl()?.focus(), 40);
  }

  cancelQuickCreate(): void {
    this.quickCreateMode.set(false);
    if (!this.clientsService.selectedGuestId()) {
      this.mobileDetailOpen.set(false);
    }
  }

  onQuickFieldInput(): void {
    this.quickError.set(null);
  }

  onQuickPhoneInput(value: string): void {
    this.quickError.set(null);
    const trimmed = value.trim();
    if (!trimmed) {
      this.quickPhoneError.set(null);
      this.quickDuplicate.set(null);
      return;
    }
    if (!SENEGAL_PHONE_RE.test(trimmed)) {
      this.quickPhoneError.set(
        'Format sénégalais attendu (ex. +221 77 410 20 30 ou 77 410 20 30).',
      );
      return;
    }
    this.quickPhoneError.set(null);

    if (this.dupTimer) clearTimeout(this.dupTimer);
    this.dupTimer = setTimeout(async () => {
      const dup = await this.clientsService.checkDuplicate({ phone: trimmed });
      this.quickDuplicate.set(dup);
    }, 220);
  }

  confirmDuplicateWanted(): void {
    this.quickDuplicateConfirmed.set(true);
    void this.tryAutoCreateQuick();
  }

  openDuplicateGuest(id: string): void {
    this.quickDuplicate.set(null);
    this.openGuest(id);
  }

  async tryAutoCreateQuick(): Promise<void> {
    if (!this.quickCreateMode() || this.clientsService.isSaving()) return;
    const name = this.quickFullName.trim();
    const phone = this.quickPhone.trim();
    if (!name || !phone || !SENEGAL_PHONE_RE.test(phone)) return;

    if (this.quickDuplicate() && !this.quickDuplicateConfirmed()) {
      return;
    }

    try {
      const created = await this.clientsService.createQuick({ fullName: name, phone });
      this.quickCreateMode.set(false);
      this.noteGuestIdSynced = created.id;
      this.noteDraftSignal.set(created.internalNote || '');
      this.router.navigate(['/clients', created.id]);
    } catch (err: any) {
      this.quickError.set(err?.message || 'Impossible de créer le client.');
    }
  }

  // --- Édition en place ---
  startEdit(field: EditableFieldKey, currentValue: string): void {
    this.editingField.set(field);
    this.editBuffer = currentValue || '';
  }

  cancelEdit(): void {
    this.editingField.set(null);
    this.editBuffer = '';
  }

  async commitEdit(guest: GuestDetail, field: EditableFieldKey): Promise<void> {
    if (this.editingField() !== field) return;
    const nextVal = this.editBuffer.trim();
    this.editingField.set(null);

    const currentVal =
      field === 'idDocumentNumber' ? '' : ((guest as any)[field] || '').trim();
    if (nextVal === currentVal && field !== 'idDocumentNumber') return;
    if (field === 'idDocumentNumber' && !nextVal) return;

    if (field === 'fullName' && !nextVal) {
      this.clientsService.errorMessage.set('Le nom complet ne peut pas être vide.');
      return;
    }
    if (field === 'phone' && !SENEGAL_PHONE_RE.test(nextVal)) {
      this.clientsService.errorMessage.set(
        'Numéro de téléphone sénégalais invalide (ex. +221 77 123 45 67).',
      );
      return;
    }

    await this.clientsService.patchField(guest.id, { [field]: nextVal });
    if (field === 'idDocumentNumber') {
      this.revealedDocNumber.set(null);
      this.revealedForGuestId.set(null);
    }
  }

  onNoteInput(value: string, guest: GuestDetail): void {
    this.noteDraftSignal.set(value);
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => {
      void this.flushNote(guest);
    }, 600);
  }

  async flushNote(guest: GuestDetail): Promise<void> {
    if (this.noteTimer) {
      clearTimeout(this.noteTimer);
      this.noteTimer = null;
    }
    const next = this.noteDraftSignal().trim();
    if (next === (guest.internalNote || '').trim()) return;
    await this.clientsService.patchField(guest.id, { internalNote: next });
  }

  async reloadSelectedGuest(): Promise<void> {
    const id = this.clientsService.selectedGuestId();
    if (!id) return;
    this.noteGuestIdSynced = null;
    await this.clientsService.selectGuest(id);
  }

  // --- Pièce d'identité ---
  canRevealDocument(): boolean {
    const role = this.clientsService.getCurrentRole();
    return role === 'DIRECTION' || role === 'RECEPTION';
  }

  async toggleRevealDocument(id: string): Promise<void> {
    if (this.revealedDocNumber() !== null && this.revealedForGuestId() === id) {
      this.revealedDocNumber.set(null);
      this.revealedForGuestId.set(null);
      return;
    }
    const plain = await this.clientsService.revealDocument(id);
    if (plain !== null) {
      this.revealedDocNumber.set(plain);
      this.revealedForGuestId.set(id);
    }
  }

  docTypeLabel(t: IdDocumentType | string): string {
    switch (t) {
      case 'PASSPORT':
        return 'Passeport';
      case 'PERMIS':
        return 'Permis';
      case 'AUTRE':
        return 'Autre';
      default:
        return 'CNI';
    }
  }

  // --- Actions fiche ---
  openReservation(guest: GuestDetail): void {
    this.reservationModal.open({ guestId: guest.id });
  }

  openStayReservation(_stayId: string): void {
    this.router.navigate(['/planning']);
  }

  toggleActionsMenu(event: Event): void {
    event.stopPropagation();
    this.actionsMenuOpen.set(!this.actionsMenuOpen());
  }

  async copyCoordinates(guest: GuestDetail): Promise<void> {
    this.actionsMenuOpen.set(false);
    const lines = [
      guest.fullName,
      guest.phone,
      guest.email || '',
      guest.address || '',
    ].filter(Boolean);
    try {
      await navigator.clipboard?.writeText(lines.join(' — '));
      this.clientsService.saveFeedback.set('Coordonnées copiées');
      setTimeout(() => this.clientsService.saveFeedback.set(null), 2000);
    } catch {
      // ignore clipboard errors in headless environments
    }
  }

  isDirection(): boolean {
    return this.clientsService.getCurrentRole() === 'DIRECTION';
  }

  openDeleteBox(guest: GuestDetail): void {
    this.actionsMenuOpen.set(false);
    this.deleteConfirmInput = '';
    this.deleteError.set(null);
    this.deleteTarget.set(guest);
  }

  closeDeleteBox(): void {
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  async confirmDelete(guest: GuestDetail): Promise<void> {
    const res = await this.clientsService.deleteGuest(guest.id);
    if (!res.ok) {
      this.deleteError.set(res.error || 'Suppression refusée.');
      return;
    }
    this.deleteTarget.set(null);
    const nextId = this.clientsService.selectedGuestId();
    if (nextId) {
      this.router.navigate(['/clients', nextId], { replaceUrl: true });
    } else {
      this.mobileDetailOpen.set(false);
      this.router.navigate(['/clients'], { replaceUrl: true });
    }
  }

  // --- Helpers visuels ---
  initials(first: string, last: string, full: string): string {
    if (first && last && first !== last) {
      return `${first[0]}${last[0]}`.toUpperCase();
    }
    const parts = (full || '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (full || 'CL').slice(0, 2).toUpperCase();
  }

  avatarColorClass(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  }

  formatFcfa(amount: number): string {
    return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount || 0))} FCFA`;
  }

  stayStatusLabel(status: string): string {
    switch (status) {
      case 'CHECKED_IN':
        return 'En séjour';
      case 'CONFIRMED':
        return 'Confirmé';
      case 'CHECKED_OUT':
        return 'Terminé';
      case 'CANCELLED':
        return 'Annulé';
      default:
        return status;
    }
  }
}
