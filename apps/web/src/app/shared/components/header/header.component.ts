import {
  Component,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReservationModalService } from '../../../core/services/reservation-modal.service';
import { AuthService, ConnectedSessionItem } from '../../../core/services/auth.service';
import { RoomsService } from '../../../core/services/rooms.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';
import {
  AppNotificationDto,
  NotificationSeverity,
  Role,
  getAuthorizedScreens,
  isKitchenAccount,
} from '@residence-blue/shared';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ModalShellComponent],
  host: { class: 'block' },
  styles: [
    `
      .rb-notif-scroll {
        scrollbar-width: thin;
        scrollbar-color: #64748b #f1f5f9;
      }
      .rb-notif-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .rb-notif-scroll::-webkit-scrollbar-track {
        background: #f1f5f9;
      }
      .rb-notif-scroll::-webkit-scrollbar-thumb {
        background: #64748b;
        border-radius: 9999px;
      }
    `,
  ],
  template: `
    <!-- Région aria-live polie pour annoncer les nouveaux messages sans interrompre -->
    <div class="sr-only" aria-live="polite" data-testid="notifications-aria-live">
      {{ notificationsService?.liveAnnouncement() }}
    </div>

    <!-- Encadré alerte importante (Prête à servir / Plat manquant) : 1 seul à la fois, 8 secondes -->
    @if (activeImportantAlert(); as popup) {
      <aside
        role="status"
        aria-live="polite"
        data-testid="header-important-alert"
        [attr.data-notification-id]="popup.id"
        [attr.data-notification-type]="popup.type"
        [attr.data-sound-played-count]="soundPlayedCount()"
        class="fixed top-20 right-4 max-[599px]:top-16 max-[599px]:left-3 max-[599px]:right-3 sm:w-[400px] max-w-[calc(100vw-24px)] z-[75] rounded-2xl border-2 shadow-2xl p-4 flex items-start gap-3"
        [ngClass]="
          popup.type === 'PRETE'
            ? 'bg-[#ecfdf5] border-[#0f5132] text-[#0f5132]'
            : 'bg-[#fef2f2] border-[#9b1c1c] text-[#9b1c1c]'
        "
      >
        <span class="material-symbols-outlined text-[24px] shrink-0 mt-0.5" aria-hidden="true">
          {{ popup.type === 'PRETE' ? 'room_service' : 'warning' }}
        </span>
        <button
          type="button"
          (click)="openImportantAlert(popup)"
          data-testid="header-important-alert-action"
          class="flex-1 min-w-0 min-h-[48px] text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006875]"
        >
          <span class="block text-[16px] font-bold leading-snug break-words">{{ popup.title }}</span>
          <span class="block text-[16px] font-medium leading-snug mt-1 break-words opacity-95">
            {{ popup.detail }}
          </span>
        </button>
        <button
          type="button"
          (click)="dismissImportantAlert()"
          data-testid="header-important-alert-close"
          aria-label="Fermer l'alerte"
          class="min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center shrink-0 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006875] cursor-pointer"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      </aside>
    }

    <!-- Desktop Header (tableau_de_bord) -->
    <header
      class="hidden md:flex fixed top-0 left-64 right-0 h-20 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 items-center justify-between px-margin"
      role="banner"
    >
      @if (canUseGlobalSearch()) {
        <!-- Global Search -->
        <div class="flex items-center gap-gutter flex-1 max-w-xl min-w-0">
          <div class="relative w-full">
            <label for="global-search" class="sr-only">Rechercher une réservation, client, chambre</label>
            <span class="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none" aria-hidden="true">
              search
            </span>
            <input
              id="global-search"
              data-testid="header-global-search"
              class="w-full h-11 pl-11 pr-space-md rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-body-sm outline-none shadow-[0_2px_8px_rgba(10,37,64,0.04)] focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Rechercher une réservation, client, chambre..."
              type="text"
            />
          </div>
        </div>
      } @else {
        <div class="flex-1"></div>
      }

      <!-- Action items & authenticated profile -->
      <div class="flex items-center gap-gutter">
        @if (canCreateReservation()) {
          <button
            type="button"
            (click)="openNewReservation()"
            class="inline-flex items-center gap-space-sm h-11 px-gutter bg-primary hover:bg-primary-container text-on-primary rounded-xl font-label-lg text-label-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            aria-label="Créer une nouvelle réservation"
            data-testid="header-new-reservation-btn"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            <span>Nouvelle réservation</span>
          </button>
        }

        <!-- Centre de notifications (cloche) -->
        @if (canShowBell()) {
          <div class="relative flex items-center gap-2" data-testid="header-notifications-wrapper">
            @if (latestUnreadRoomAlert(); as latestAlert) {
              <button
                type="button"
                (click)="toggleNotifications($event)"
                data-testid="header-live-room-alert"
                class="hidden lg:inline-flex items-center gap-2 max-w-[220px] h-10 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold shadow-sm hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true"></span>
                <span class="truncate">{{ latestAlert.message }}</span>
              </button>
            }

            <button
              type="button"
              (click)="toggleNotifications($event)"
              data-testid="header-notifications-btn"
              class="relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-on-surface shadow-[0_2px_8px_rgba(10,37,64,0.04)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006875] focus-visible:ring-offset-2 cursor-pointer"
              aria-label="Messages et notifications"
              aria-haspopup="dialog"
              [attr.aria-expanded]="isNotificationsOpen()"
            >
              <span class="material-symbols-outlined text-[24px]" aria-hidden="true">notifications</span>
              @if (unreadCount() > 0) {
                <span
                  data-testid="header-notifications-badge"
                  class="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#dc2626] text-white text-[12px] font-extrabold flex items-center justify-center shadow-sm"
                >
                  {{ badgeLabel() }}
                </span>
              }
            </button>
          </div>
        } @else if (!isSingleScreenProfile()) {
          <button
            type="button"
            class="relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-on-surface shadow-[0_2px_8px_rgba(10,37,64,0.04)] transition-colors focus-visible:ring-2 focus-visible:ring-[#006875]"
            aria-label="Notifications"
          >
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">notifications</span>
          </button>
        }

        <div class="h-8 w-px bg-surface-variant/60" aria-hidden="true"></div>

        <!-- Authenticated User Profile Menu -->
        <div class="relative" data-testid="user-profile">
          <button
            type="button"
            (click)="toggleMenu($event)"
            data-testid="user-profile-dropdown-btn"
            class="flex items-center gap-space-md p-1.5 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-primary"
            aria-haspopup="menu"
            [attr.aria-expanded]="isMenuOpen()"
          >
            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span class="material-symbols-outlined text-on-primary text-[18px]" aria-hidden="true">person</span>
            </div>
            <div class="hidden xl:flex flex-col text-left">
              <div class="flex items-center gap-space-xs">
                <span class="font-label-lg text-label-lg text-on-surface leading-tight font-semibold" data-testid="header-user-name">
                  {{ displayName() }}
                </span>
                <span class="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true"></span>
              </div>
              <span class="font-label-md text-label-md text-on-surface-variant" data-testid="header-user-role">
                {{ displayRoleLabel() }}
              </span>
            </div>
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform" [class.rotate-180]="isMenuOpen()">
              expand_more
            </span>
          </button>

          @if (isMenuOpen()) {
            <div
              class="absolute right-0 mt-2 w-72 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/60 py-2 z-50"
              role="menu"
              data-testid="user-profile-dropdown"
              (click)="$event.stopPropagation()"
            >
              <div class="px-4 py-2 border-b border-outline-variant/40">
                <span class="text-xs font-bold text-on-surface block">{{ displayName() }}</span>
                <span class="text-[11px] text-outline block">{{ currentUser()?.email }}</span>
              </div>

              <div class="py-1">
                <button
                  type="button"
                  (click)="openSessionsModal()"
                  data-testid="menu-sessions-btn"
                  role="menuitem"
                  class="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[20px] text-primary">devices</span>
                  <div>
                    <div class="font-medium text-sm text-on-surface">Appareils connectés</div>
                    <div class="text-[11px] text-outline">
                      {{ isDirection() ? 'Supervision & révocation Direction' : 'Vos sessions actives' }}
                    </div>
                  </div>
                </button>

                <div class="my-1 border-t border-outline-variant/40"></div>

                <button
                  type="button"
                  (click)="logout()"
                  data-testid="menu-logout-btn"
                  role="menuitem"
                  class="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-error-container/20 text-error transition-colors cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[20px]">logout</span>
                  <span class="font-medium text-sm">Se déconnecter</span>
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </header>

    <!-- Mobile Header (tableau_de_bord_mode_clair) -->
    <header
      class="md:hidden fixed top-0 w-full z-50 pt-safe bg-surface-container-lowest/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
      role="banner"
    >
      <div class="h-16 px-gutter-sm flex items-center justify-between gap-space-sm">
        <div class="flex items-center gap-space-sm min-w-0">
          @if (!isSingleScreenProfile()) {
            <button
              type="button"
              (click)="menuToggle.emit()"
              data-testid="mobile-menu-toggle"
              aria-label="Ouvrir le menu principal"
              class="w-10 h-10 rounded-xl bg-surface-container-low text-on-surface flex items-center justify-center shrink-0 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[22px]" aria-hidden="true">menu</span>
            </button>
          }
          <div class="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm flex-shrink-0">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">hotel</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-title-md text-title-md text-primary tracking-tight truncate leading-tight">Résidence Blue</span>
            <span class="font-label-md text-label-md text-on-surface-variant truncate">{{ displayRoleLabel() }}</span>
          </div>
        </div>
        <div class="flex items-center gap-space-xs flex-shrink-0">
          @if (isSingleScreenProfile()) {
            <button
              type="button"
              (click)="logout()"
              data-testid="mobile-logout-btn"
              class="min-h-[48px] px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
              <span>Se déconnecter</span>
            </button>
          } @else {
            @if (canCreateReservation()) {
              <button
                aria-label="Nouvelle réservation"
                type="button"
                (click)="openNewReservation()"
                data-testid="header-new-reservation-mobile-btn"
                class="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm cursor-pointer min-h-[44px] min-w-[44px]"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
              </button>
            }
          }
          @if (canShowBell()) {
            <button
              type="button"
              (click)="toggleNotifications($event)"
              data-testid="header-notifications-mobile-btn"
              class="relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006875]"
              aria-label="Messages et notifications"
              aria-haspopup="dialog"
              [attr.aria-expanded]="isNotificationsOpen()"
            >
              <span class="material-symbols-outlined text-[22px]" aria-hidden="true">notifications</span>
              @if (unreadCount() > 0) {
                <span
                  data-testid="header-notifications-mobile-badge"
                  class="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-[#dc2626] text-white text-[11px] font-extrabold flex items-center justify-center"
                >
                  {{ badgeLabel() }}
                </span>
              }
            </button>
          }
          <div class="relative" data-testid="user-profile-mobile">
            <button
              type="button"
              (click)="toggleMenu($event)"
              data-testid="user-profile-dropdown-mobile-btn"
              class="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer"
              aria-label="Menu utilisateur"
            >
              <span class="material-symbols-outlined text-[20px]">person</span>
            </button>

            @if (isMenuOpen()) {
              <div
                class="absolute right-0 top-12 w-64 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/60 py-2 z-50"
                role="menu"
                data-testid="user-profile-dropdown-mobile"
                (click)="$event.stopPropagation()"
              >
                <div class="px-3 py-1.5 border-b border-outline-variant/40">
                  <span class="text-xs font-bold text-on-surface block truncate">{{ displayName() }}</span>
                  <span class="text-[11px] text-outline block truncate">{{ displayRoleLabel() }}</span>
                </div>
                <div class="py-1">
                  <button
                    type="button"
                    (click)="openSessionsModal()"
                    class="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface-container-low text-sm text-on-surface"
                  >
                    <span class="material-symbols-outlined text-[18px] text-primary">devices</span>
                    <span>Appareils connectés</span>
                  </button>
                  <button
                    type="button"
                    (click)="logout()"
                    class="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-error-container/20 text-sm text-error"
                  >
                    <span class="material-symbols-outlined text-[18px]">logout</span>
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </header>

    <!-- Backdrop menu utilisateur -->
    @if (isMenuOpen()) {
      <div class="fixed inset-0 z-30" (click)="closeMenu()" aria-hidden="true"></div>
    }

    <!-- Panneau Centre de Messages de la cloche (420 px desktop, plein écran < 600 px) -->
    @if (isNotificationsOpen()) {
      <div
        class="fixed inset-0 z-[60] bg-slate-900/25"
        (click)="closeNotifications()"
        data-testid="notifications-backdrop"
        aria-hidden="true"
      ></div>

      <section
        role="dialog"
        aria-modal="false"
        aria-label="Messages"
        data-testid="header-notifications-dropdown"
        (click)="$event.stopPropagation()"
        class="fixed z-[70] bg-white border border-[#cbd5e1] shadow-2xl flex flex-col overflow-hidden top-[76px] right-4 md:right-6 w-[420px] max-w-[calc(100vw-32px)] max-h-[min(78dvh,640px)] rounded-2xl max-[599px]:inset-0 max-[599px]:top-0 max-[599px]:right-0 max-[599px]:w-screen max-[599px]:max-w-none max-[599px]:h-[100dvh] max-[599px]:max-h-[100dvh] max-[599px]:rounded-none"
      >
        <!-- En-tête du panneau : Titre 18 px + bouton Fermer >= 48 px -->
        <div class="px-4 py-3 border-b border-[#cbd5e1] bg-white flex items-center justify-between gap-2 shrink-0">
          <h2 class="text-[18px] font-bold text-[#161d20] leading-tight">Messages</h2>
          <button
            type="button"
            (click)="closeNotifications()"
            data-testid="notifications-close-btn"
            class="min-h-[48px] min-w-[48px] px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-[16px] font-semibold text-[#161d20] bg-[#f1f5f9] hover:bg-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006875] cursor-pointer"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            <span>Fermer</span>
          </button>
        </div>

        <!-- Barre actions : Tout marquer comme lu + Interrupteur Son (zones >= 48 px, texte >= 16 px) -->
        <div class="px-4 py-2 border-b border-[#cbd5e1] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            role="switch"
            [attr.aria-checked]="soundEnabled()"
            (click)="toggleAlertSound($event)"
            data-testid="notifications-sound-toggle"
            class="min-h-[48px] px-3 rounded-xl inline-flex items-center gap-2 text-[16px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006875]"
            [ngClass]="
              soundEnabled()
                ? 'bg-[#006875] text-white'
                : 'bg-white border border-[#94a3b8] text-[#161d20] hover:bg-[#f1f5f9]'
            "
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
              {{ soundEnabled() ? 'volume_up' : 'volume_off' }}
            </span>
            <span>Son : {{ soundEnabled() ? 'Activé' : 'Coupé' }}</span>
          </button>

          @if (unreadCount() > 0) {
            <button
              type="button"
              (click)="markAllNotificationsRead($event)"
              data-testid="notifications-mark-read-btn"
              class="min-h-[48px] px-3 rounded-xl text-[16px] font-semibold text-[#005a66] hover:bg-[#e0f2fe]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006875] cursor-pointer"
            >
              Tout marquer comme lu
            </button>
          }
        </div>

        <!-- Liste à défilement vertical interne uniquement -->
        <div
          data-testid="notifications-scroll-list"
          class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden rb-notif-scroll divide-y divide-[#e2e8f0]"
        >
          @if (allMessages().length === 0) {
            <div class="px-4 py-8 text-center text-[16px] text-[#334155]" data-testid="notifications-empty">
              Aucun message sur les dernières 24 heures.
            </div>
          } @else {
            @if (unreadMessages().length > 0) {
              <div data-testid="notifications-group-new">
                <div class="px-4 py-2 bg-[#f1f5f9] border-b border-[#e2e8f0] text-[16px] font-bold text-[#0f172a]">
                  Nouveaux
                </div>
                <div class="divide-y divide-[#e2e8f0]">
                  @for (notif of unreadMessages(); track notif.id) {
                    <button
                      type="button"
                      (click)="openNotification(notif)"
                      [attr.data-testid]="'notification-card-' + notif.id"
                      [attr.data-notification-type]="notif.type"
                      [attr.data-read]="notif.read"
                      class="w-full min-h-[48px] px-4 py-3.5 text-left bg-[#f0f9ff]/55 hover:bg-[#e0f2fe]/60 transition-colors flex items-start gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006875]"
                    >
                      <span
                        class="material-symbols-outlined text-[24px] shrink-0 mt-0.5"
                        [ngClass]="severityIconClass(notif.severity)"
                        aria-hidden="true"
                      >
                        {{ notificationIcon(notif.type, notif.category) }}
                      </span>
                      <div class="flex-1 min-w-0 space-y-1">
                        <p class="text-[16px] font-bold leading-snug break-words" [ngClass]="severityTitleClass(notif.severity)">
                          {{ notif.title }}
                        </p>
                        <p class="text-[16px] font-medium text-[#1e293b] leading-snug break-words" data-testid="notification-detail">
                          {{ notif.detail }}
                        </p>
                        <p class="text-[16px] text-[#475569] leading-snug" data-testid="notification-time">
                          <span>{{ formatRelativeTime(notif.createdAt) }}</span>
                          <span class="ml-2 inline-block font-bold text-[#005a66]">• Nouveau</span>
                        </p>
                      </div>
                    </button>
                  }
                </div>
              </div>
            }

            @if (olderMessages().length > 0) {
              <div data-testid="notifications-group-older">
                <div class="px-4 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] text-[16px] font-bold text-[#334155]">
                  Plus anciens
                </div>
                <div class="divide-y divide-[#e2e8f0]">
                  @for (notif of olderMessages(); track notif.id) {
                    <button
                      type="button"
                      (click)="openNotification(notif)"
                      [attr.data-testid]="'notification-card-' + notif.id"
                      [attr.data-notification-type]="notif.type"
                      [attr.data-read]="notif.read"
                      class="w-full min-h-[48px] px-4 py-3.5 text-left bg-white hover:bg-[#f8fafc] transition-colors flex items-start gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006875]"
                    >
                      <span
                        class="material-symbols-outlined text-[24px] shrink-0 mt-0.5"
                        [ngClass]="severityIconClass(notif.severity)"
                        aria-hidden="true"
                      >
                        {{ notificationIcon(notif.type, notif.category) }}
                      </span>
                      <div class="flex-1 min-w-0 space-y-1">
                        <p class="text-[16px] font-bold leading-snug break-words" [ngClass]="severityTitleClass(notif.severity)">
                          {{ notif.title }}
                        </p>
                        <p class="text-[16px] font-medium text-[#1e293b] leading-snug break-words" data-testid="notification-detail">
                          {{ notif.detail }}
                        </p>
                        <p class="text-[16px] text-[#475569] leading-snug" data-testid="notification-time">
                          <span>{{ formatRelativeTime(notif.createdAt) }}</span>
                          <span class="ml-2 text-[#475569]">• Lu</span>
                        </p>
                      </div>
                    </button>
                  }
                </div>
              </div>
            }
          }
        </div>
      </section>
    }

    <!-- Modal Appareils connectés & Révocation (ModalShellComponent) -->
    <app-modal-shell
      [isOpen]="isSessionsModalOpen()"
      title="Appareils connectés"
      [subtitle]="isDirection() ? 'Supervision et révocation des sessions actives' : 'Vos sessions ouvertes'"
      icon="devices"
      testId="sessions-modal"
      (closed)="closeSessionsModal()"
    >
      <div class="flex flex-col gap-3">
        @if (sessionsLoading()) {
          <p class="text-sm text-outline py-4 text-center">Chargement des sessions actives...</p>
        } @else if (sessions().length === 0) {
          <p class="text-sm text-outline py-4 text-center">Aucune session active détectée.</p>
        } @else {
          @for (s of sessions(); track s.familyId) {
            <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm text-on-surface">{{ s.deviceLabel }}</span>
                  @if (s.isCurrentSession) {
                    <span class="px-2 py-0.5 rounded-full text-[11px] bg-primary/10 text-primary font-semibold">
                      Session actuelle
                    </span>
                  }
                </div>
                <div class="text-xs text-on-surface-variant">
                  {{ s.userName }} ({{ s.userRole }}) • IP : {{ s.ipAddress || 'Locale' }}
                </div>
                <div class="text-[11px] text-outline">
                  Dernière activité : {{ s.lastUsedAt | date:'short' }}
                </div>
              </div>
              <button
                type="button"
                (click)="revokeSession(s.familyId)"
                [attr.data-testid]="'revoke-session-' + s.familyId"
                class="px-3 py-1.5 rounded-lg bg-error-container/30 text-error hover:bg-error-container/50 text-xs font-semibold cursor-pointer"
              >
                Révoquer
              </button>
            </div>
          }
        }
      </div>
      <div modal-footer class="flex justify-end">
        <button
          type="button"
          (click)="closeSessionsModal()"
          class="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold cursor-pointer"
        >
          Fermer
        </button>
      </div>
    </app-modal-shell>
  `,
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() menuToggle = new EventEmitter<void>();
  readonly modalService = inject(ReservationModalService);
  readonly authService = inject(AuthService);
  readonly roomsService = inject(RoomsService, { optional: true });
  readonly notificationsService = inject(NotificationsService, { optional: true });
  private readonly router = inject(Router, { optional: true });

  readonly isMenuOpen = signal<boolean>(false);
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly nowMs = signal<number>(Date.now());
  private relativeTimeTimer: ReturnType<typeof setInterval> | null = null;

  readonly canShowBell = computed(() => {
    const user = this.currentUser();
    if (!user || isKitchenAccount(user)) return false;
    return Boolean(this.notificationsService?.canShowBell());
  });

  readonly allMessages = computed(() => this.notificationsService?.allMessages() ?? []);
  readonly unreadMessages = computed(() => this.notificationsService?.unreadMessages() ?? []);
  readonly olderMessages = computed(() => this.notificationsService?.olderMessages() ?? []);
  readonly unreadCount = computed(() => this.notificationsService?.unreadCount() ?? 0);
  readonly badgeLabel = computed(() => this.notificationsService?.badgeLabel() ?? '');
  readonly activeImportantAlert = computed(
    () => this.notificationsService?.activeImportantAlert() ?? null,
  );
  readonly soundPlayedCount = computed(() => this.notificationsService?.soundPlayedCount() ?? 0);
  readonly soundEnabled = computed(() => this.notificationsService?.soundEnabled() ?? false);

  readonly latestUnreadRoomAlert = computed(() => {
    if (!this.roomsService?.canReceiveRoomAlerts()) return null;
    return this.roomsService.roomAlerts().find((a) => !a.read) ?? null;
  });

  readonly currentUser = this.authService.currentUser;

  readonly isSessionsModalOpen = signal<boolean>(false);
  readonly sessionsLoading = signal<boolean>(false);
  readonly sessions = signal<ConnectedSessionItem[]>([]);

  readonly displayName = computed(() => this.currentUser()?.fullName || 'Collaborateur');
  readonly displayRoleLabel = computed(() => {
    const u = this.currentUser();
    if (!u) return '';
    return u.jobTitle || u.role;
  });

  readonly isDirection = computed(() => this.currentUser()?.role === Role.DIRECTION);
  readonly canCreateReservation = computed(() => {
    const r = this.currentUser()?.role;
    return r === Role.DIRECTION || r === Role.RECEPTION;
  });
  readonly canUseGlobalSearch = computed(() =>
    Boolean(this.authService.hasScreen('planning', 'LECTURE') || this.authService.hasScreen('clients', 'LECTURE')),
  );
  readonly isSingleScreenProfile = computed(() => {
    const user = this.currentUser();
    if (!user || this.authService.isDirector()) return false;
    return getAuthorizedScreens(user).length <= 1;
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.relativeTimeTimer = setInterval(() => {
        this.nowMs.set(Date.now());
      }, 30_000);
    }
  }

  ngOnDestroy(): void {
    if (this.relativeTimeTimer) {
      clearInterval(this.relativeTimeTimer);
      this.relativeTimeTimer = null;
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isMenuOpen()) {
      this.closeMenu();
    }
    if (this.isNotificationsOpen()) {
      this.closeNotifications();
    }
  }

  toggleMenu(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isNotificationsOpen()) this.closeNotifications();
    this.isMenuOpen.update((v) => !v);
  }

  toggleNotifications(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isMenuOpen()) this.closeMenu();
    const nextOpen = !this.isNotificationsOpen();
    this.isNotificationsOpen.set(nextOpen);
    if (nextOpen) {
      this.nowMs.set(Date.now());
      void this.notificationsService?.loadNotifications();
    }
  }

  closeNotifications(): void {
    this.isNotificationsOpen.set(false);
  }

  toggleAlertSound(event?: Event): void {
    if (event) event.stopPropagation();
    this.notificationsService?.toggleSound();
  }

  markAllNotificationsRead(event?: Event): void {
    if (event) event.stopPropagation();
    void this.notificationsService?.markAllAsRead();
  }

  async openNotification(notif: AppNotificationDto): Promise<void> {
    this.closeNotifications();
    await this.notificationsService?.markAsRead(notif);
    if (this.router && notif.link) {
      await this.router.navigateByUrl(notif.link);
    }
  }

  async openImportantAlert(notif: AppNotificationDto): Promise<void> {
    this.notificationsService?.dismissImportantAlert();
    await this.notificationsService?.markAsRead(notif);
    if (this.router && notif.link) {
      await this.router.navigateByUrl(notif.link);
    }
  }

  dismissImportantAlert(): void {
    this.notificationsService?.dismissImportantAlert();
  }

  notificationIcon(type: string, category: string): string {
    if (category === 'HOUSEKEEPING') {
      return type === 'CHAMBRE_PROBLEME' ? 'build' : 'check_circle';
    }
    switch (type) {
      case 'PRETE':
        return 'room_service';
      case 'PLAT_MANQUANT':
        return 'warning';
      case 'PLAT_CONFIRME_TEMPS':
        return 'skillet';
      case 'TEMPS_AJOUTE':
        return 'more_time';
      case 'RETARD':
        return 'schedule';
      case 'COMMANDE_ANNULEE':
        return 'cancel';
      default:
        return 'notifications';
    }
  }

  severityIconClass(severity: NotificationSeverity): string {
    switch (severity) {
      case 'SUCCESS':
        return 'text-[#0f5132]';
      case 'CRITICAL':
        return 'text-[#9b1c1c]';
      case 'WARNING':
        return 'text-[#9a3412]';
      default:
        return 'text-[#0c4a6e]';
    }
  }

  severityTitleClass(severity: NotificationSeverity): string {
    switch (severity) {
      case 'SUCCESS':
        return 'text-[#0f5132]';
      case 'CRITICAL':
        return 'text-[#9b1c1c]';
      case 'WARNING':
        return 'text-[#9a3412]';
      default:
        return 'text-[#0c4a6e]';
    }
  }

  formatRelativeTime(iso: string): string {
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return 'il y a 0 min';
    const diffMin = Math.max(0, Math.floor((this.nowMs() - ts) / 60_000));
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const hours = Math.floor(diffMin / 60);
    return `il y a ${hours} h`;
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  openNewReservation(): void {
    this.modalService.open();
  }

  async openSessionsModal(): Promise<void> {
    this.closeMenu();
    this.isSessionsModalOpen.set(true);
    this.sessionsLoading.set(true);
    try {
      this.sessions.set(await this.authService.listConnectedSessions());
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  closeSessionsModal(): void {
    this.isSessionsModalOpen.set(false);
  }

  async revokeSession(familyId: string): Promise<void> {
    const ok = await this.authService.revokeConnectedSession(familyId);
    if (ok) {
      this.sessions.set(await this.authService.listConnectedSessions());
    }
  }

  async logout(): Promise<void> {
    this.closeMenu();
    await this.authService.logout('manual');
  }
}
