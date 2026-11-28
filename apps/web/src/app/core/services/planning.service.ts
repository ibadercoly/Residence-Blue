import { Injectable, OnDestroy, signal, computed, effect, inject, Injector } from '@angular/core';
import {
  addDaysToIso,
  aujourdhuiDakarIso,
  estAujourdhuiDakar,
  formatPlanningPeriodLabel,
  getDayOfWeekFromIso,
  parseIsoParts,
  trouverIndexColonneAujourdhui,
} from '../utils/dakar-date.util';
import { RoomsService } from './rooms.service';
import { AuthService } from './auth.service';
import { IdbService } from '../offline/idb.service';
import { NetworkService } from '../offline/network.service';
import { OutboxService } from '../offline/outbox.service';
import { OutboxItem } from '@residence-blue/shared';
import { Observable, of } from 'rxjs';
import {
  PlanningData,
  PlanningDay,
  PlanningRoom,
  SelectedReservationDetail,
  PlanningReservation,
  PlanningFilterType,
  PlanningDailyMetrics,
  ReservationStatusType
} from '../models/planning.model';

@Injectable({
  providedIn: 'root'
})
export class PlanningService implements OnDestroy {
  private readonly injector = inject(Injector, { optional: true });
  private readonly idb = inject(IdbService, { optional: true });
  private readonly network = inject(NetworkService, { optional: true });
  private readonly outbox = inject(OutboxService, { optional: true });

  private idbServiceOverride?: IdbService;
  private networkServiceOverride?: NetworkService;
  private outboxServiceOverride?: OutboxService;

  get idbService(): IdbService | null {
    return this.idbServiceOverride ?? this.idb ?? this.injector?.get(IdbService, null) ?? null;
  }

  get networkService(): NetworkService | null {
    return this.networkServiceOverride ?? this.network ?? this.injector?.get(NetworkService, null) ?? null;
  }

  get outboxService(): OutboxService | null {
    return this.outboxServiceOverride ?? this.outbox ?? this.injector?.get(OutboxService, null) ?? null;
  }

  readonly isOffline = computed<boolean>(() => {
    return this.networkService ? !this.networkService.isOnline() : false;
  });

  /** Sauvegarde de l'état précédent pour rollback en cas de 409 Conflict côté serveur */
  private readonly rollbackMap = new Map<string, PlanningReservation>();

  /**
   * Résolution paresseuse de RoomsService : l'injection directe créerait une
   * dépendance circulaire (RoomsService dépend déjà de PlanningService).
   */
  private get roomsService(): RoomsService | null {
    return this.injector?.get(RoomsService, null) ?? null;
  }
  // Service du planning raccordé au backend NestJS et à la base PostgreSQL / Prisma (/api/reservations).

  /** Décalage de semaine (-1 = semaine précédente, 0 = semaine courante, +1 = semaine suivante) */
  readonly weekOffset = signal<number>(0);

  /** Recherche par nom de client ou numéro de chambre */
  readonly searchQuery = signal<string>('');

  /** Filtre unique : 'ALL' (Toutes), 'FREE' (Libres), 'OCCUPIED' (Occupées) */
  readonly filterMode = signal<PlanningFilterType>('ALL');

  /** Identifiant de la réservation sélectionnée pour le panneau de détail */
  readonly selectedReservationId = signal<string | null>(null);

  /** Message de feedback opérateur pour les actions rapides */
  readonly feedbackMessage = signal<string | null>(null);

  /** État réactif de toutes les réservations (source : API PostgreSQL, vide par défaut) */
  readonly allReservations = signal<PlanningReservation[]>([]);
  readonly serverSynced = signal<boolean>(false);
  readonly testCatalogRooms = signal<Omit<PlanningRoom, 'reservations'>[]>([]);

  /** Date du jour en heure officielle de Dakar (AAAA-MM-JJ), mise à jour au changement de jour */
  readonly todayIso = signal<string>(aujourdhuiDakarIso());

  private dayCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.refreshTodayDate();
    }
  };
  private readonly handleWindowFocus = (): void => {
    this.refreshTodayDate();
  };

  constructor(
    idb?: IdbService,
    network?: NetworkService,
    outbox?: OutboxService,
    authService?: AuthService,
  ) {
    if (idb) this.idbServiceOverride = idb;
    if (network) this.networkServiceOverride = network;
    if (outbox) this.outboxServiceOverride = outbox;
    if (authService) this.authServiceOverride = authService;

    this.startDayChangeWatcher();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('outbox-conflict', this.handleOutboxConflict);
    }

    void this.fetchFromServer().catch(() => {});
    try {
      effect(() => {
        if (this.authService?.isAuthenticated()) {
          void this.fetchFromServer();
        }
      });
    } catch {
      // Hors contexte d'injection Angular
    }
  }

  private readonly handleOnline = (): void => {
    void this.syncOutbox();
  };

  private readonly handleOutboxConflict = (event: Event): void => {
    const customEvent = event as CustomEvent<{ item: OutboxItem; message?: string }>;
    const item = customEvent?.detail?.item;
    if (item && item.type.startsWith('RESERVATION_')) {
      const reservationId = (item.payload as { id?: string })?.id;
      if (reservationId) {
        this.handleConflict(reservationId, customEvent.detail?.message);
      }
    }
  };

  ngOnDestroy(): void {
    if (this.dayCheckIntervalId !== null) {
      clearInterval(this.dayCheckIntervalId);
      this.dayCheckIntervalId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWindowFocus);
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('outbox-conflict', this.handleOutboxConflict);
    }
  }

  /** Vérifie si la date du jour à Dakar a changé et met à jour la référence sans perdre l'état courant */
  refreshTodayDate(reference: Date = new Date()): boolean {
    const nextIso = aujourdhuiDakarIso(reference);
    if (nextIso !== this.todayIso()) {
      this.todayIso.set(nextIso);
      return true;
    }
    return false;
  }

  private startDayChangeWatcher(): void {
    if (typeof setInterval !== 'undefined') {
      this.dayCheckIntervalId = setInterval(() => {
        this.refreshTodayDate();
      }, 60_000);
      if (
        this.dayCheckIntervalId &&
        typeof (this.dayCheckIntervalId as unknown as { unref?: () => void }).unref === 'function'
      ) {
        (this.dayCheckIntervalId as unknown as { unref: () => void }).unref();
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWindowFocus);
    }
  }

  private authServiceOverride?: AuthService;
  private get authService(): AuthService | null {
    return this.authServiceOverride ?? this.injector?.get(AuthService, null) ?? null;
  }

  private getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      ...(this.authService ? this.authService.getAuthHeaders() : {}),
      ...(extra || {}),
    };
  }

  async fetchFromServer(): Promise<void> {
    // Si hors ligne : lire la copie locale stockée dans IndexedDB (magasin reservations)
    if (this.networkService && !this.networkService.isOnline()) {
      await this.loadFromIndexedDb();
      return;
    }

    if (typeof fetch === 'undefined') {
      await this.loadFromIndexedDb();
      return;
    }

    if (this.authService && !this.authService.isAuthenticated()) {
      return;
    }

    try {
      const res = await fetch('/api/reservations', {
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        const list: PlanningReservation[] = await res.json();
        this.serverSynced.set(true);
        this.allReservations.set(list);
        // Quand le réseau répond, mettre à jour la copie locale dans IndexedDB
        await this.saveToIndexedDb(list);
      } else {
        await this.loadFromIndexedDb();
      }
    } catch {
      // Coupure réseau : repli sur la copie locale stockée dans IndexedDB
      await this.loadFromIndexedDb();
    }
  }

  async loadFromIndexedDb(): Promise<void> {
    if (!this.idbService) return;
    try {
      const cached = await this.idbService.getAll<PlanningReservation>('reservations');
      if (cached && cached.length > 0) {
        this.allReservations.set(cached);
      }
    } catch (err) {
      console.warn('[PlanningService] Impossible de charger les réservations depuis IndexedDB :', err);
    }
  }

  async saveToIndexedDb(list: PlanningReservation[]): Promise<void> {
    if (!this.idbService) return;
    try {
      const cached = (await this.idbService.getAll<PlanningReservation>('reservations')) || [];
      const currentServerIds = new Set(list.map((r) => r.id));
      for (const old of cached) {
        if (old.id && !currentServerIds.has(old.id)) {
          await this.idbService.delete('reservations', old.id);
        }
      }
      for (const item of list) {
        await this.idbService.put('reservations', item);
      }
    } catch (err) {
      console.warn('[PlanningService] Erreur lors de la mise à jour IndexedDB :', err);
    }
  }

  async syncOutbox(): Promise<void> {
    if (this.outboxService) {
      await this.outboxService.syncOutbox();
    }
    await this.fetchFromServer();
  }

  handleConflict(reservationId: string, errorMsg?: string): void {
    const previous = this.rollbackMap.get(reservationId);
    if (previous) {
      this.allReservations.update((list) => {
        const idx = list.findIndex((r) => r.id === reservationId);
        if (idx >= 0) {
          const copy = [...list];
          copy[idx] = previous;
          return copy;
        }
        return [...list, previous];
      });
      if (this.idbService) {
        void this.idbService.put('reservations', previous).catch(() => {});
      }
    }
    const msg = errorMsg || 'Action rejetée par le serveur (conflit 409). L’action a été annulée.';
    this.feedbackMessage.set(msg);
  }

  upsertReservationFromApi(saved: PlanningReservation): void {
    this.allReservations.update((list) => {
      const idx = list.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const copy = list.slice();
        copy[idx] = saved;
        return copy;
      }
      return [...list, saved];
    });
    this.serverSynced.set(true);
  }

  /** Définition des chambres de l'hôtel (depuis RoomsService ou vide si base vide) */
  get catalogRooms(): Omit<PlanningRoom, 'reservations'>[] {
    if (this.testCatalogRooms().length > 0) {
      return this.testCatalogRooms();
    }
    if (this.roomsService) {
      return this.roomsService.activeRooms().map((r) => ({
        number: r.number,
        category: r.tariffCategory?.name || r.category || r.type?.name || 'À classer',
        typeLabel: `${r.tariffCategory?.name || r.category || r.type?.name || 'À classer'} ${r.view || ''}`.trim(),
        description: r.description || `Étage ${r.floor}`,
        status: r.status,
        maintenanceReason: r.status === 'MAINTENANCE' ? (r.maintenanceReason || 'Problème signalé') : null,
      }));
    }
    return [];
  }

  /** Calcul dynamique des 7 jours affichés à partir de la date du jour à Dakar */
  readonly currentDays = computed<PlanningDay[]>(() => {
    const offset = this.weekOffset();
    const today = this.todayIso();
    const startIso = addDaysToIso(today, offset * 7);

    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const monthNames = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

    const days: PlanningDay[] = [];
    for (let i = 0; i < 7; i++) {
      const dateIso = addDaysToIso(startIso, i);
      const { mois, jour } = parseIsoParts(dateIso);
      const dayOfWeek = getDayOfWeekFromIso(dateIso);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Samedi ou Dimanche
      const isToday = estAujourdhuiDakar(dateIso, today);

      days.push({
        name: dayNames[dayOfWeek],
        number: String(jour).padStart(2, '0'),
        month: monthNames[mois - 1],
        isToday,
        isWeekend,
        dayIndex: i,
        dateIso
      });
    }

    return days;
  });

  /** Index de la colonne « Aujourd'hui » déterminé par comparaison de dates (-1 si hors période) */
  readonly todayColumnIndex = computed<number>(() =>
    trouverIndexColonneAujourdhui(this.currentDays(), this.todayIso()),
  );

  /** Libellé de période sur une seule ligne (ex: « 10 – 16 nov. 2026 ») */
  readonly periodLabel = computed<string>(() => {
    const days = this.currentDays();
    if (days.length === 0) return '';
    const first = days[0];
    const last = days[days.length - 1];
    return formatPlanningPeriodLabel(first.dateIso, last.dateIso);
  });

  /** 3 chiffres clés du jour (Arrivées aujourd'hui, Départs aujourd'hui, Chambres libres) */
  readonly dailyMetrics = computed<PlanningDailyMetrics>(() => {
    const todayIso = this.todayIso();
    const all = this.allReservations();

    // Arrivées aujourd'hui : checkInDate === today
    const arrivalsToday = all.filter(r => r.checkInDate === todayIso).length;

    // Départs aujourd'hui : checkOutDate === today ou status === 'DEPART_AUJ'
    const departuresToday = all.filter(r => r.checkOutDate === todayIso || r.status === 'DEPART_AUJ').length;

    // Chambres occupées aujourd'hui (hors départs déjà libérés)
    const occupiedTodaySet = new Set(
      all
        .filter(r => {
          if (r.status === 'DEPART_AUJ' || r.status === 'CHECKOUT') return false;
          return r.checkInDate <= todayIso && r.checkOutDate > todayIso;
        })
        .map(r => r.roomNumber)
    );

    const freeRoomsToday = Math.max(0, this.catalogRooms.length - occupiedTodaySet.size);

    return {
      arrivalsToday,
      departuresToday,
      freeRoomsToday
    };
  });

  /** Chambres avec leurs réservations positionnées sur les 7 jours de la semaine courante */
  readonly roomsWithWeekReservations = computed<PlanningRoom[]>(() => {
    const days = this.currentDays();
    if (days.length === 0) return [];

    const weekStartIso = days[0].dateIso;
    const weekEndIso = days[days.length - 1].dateIso;
    const all = this.allReservations();

    return this.catalogRooms.map(room => {
      // Trouver les réservations qui intersectent la semaine courante
      const roomReservations = all
        .filter(r => r.roomNumber === room.number)
        .filter(r => !(r.checkOutDate <= weekStartIso || r.checkInDate > weekEndIso))
        .map(r => {
          // Calculer les colonnes de début et fin dans la grille 7 jours
          const startIndex = days.findIndex(d => d.dateIso >= r.checkInDate);
          const startDayIndex = startIndex === -1 ? 0 : startIndex;

          // Date de fin
          const endIndex = days.findIndex(d => d.dateIso >= r.checkOutDate);
          const endDayIndex = endIndex === -1 ? 6 : Math.max(startDayIndex, endIndex - 1);
          const durationDays = Math.max(1, endDayIndex - startDayIndex + 1);

          return {
            ...r,
            startDayIndex,
            durationDays
          };
        });

      return {
        ...room,
        reservations: roomReservations
      };
    });
  });

  /** Liste des chambres filtrées selon la recherche et le filtre Toutes / Libres / Occupées */
  readonly filteredRooms = computed<PlanningRoom[]>(() => {
    const rooms = this.roomsWithWeekReservations();
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.filterMode();

    return rooms.filter(room => {
      // Filtre statut
      if (filter === 'FREE' && room.reservations.length > 0) {
        return false;
      }
      if (filter === 'OCCUPIED' && room.reservations.length === 0) {
        return false;
      }

      // Recherche par numéro de chambre ou nom de client
      if (query) {
        const matchRoom = room.number.toLowerCase().includes(query) || room.category.toLowerCase().includes(query);
        const matchGuest = room.reservations.some(r => r.guestName.toLowerCase().includes(query));
        if (!matchRoom && !matchGuest) return false;
      }

      return true;
    });
  });

  /** Réservation activement inspectée pour le panneau de détail */
  readonly selectedReservation = computed<SelectedReservationDetail | null>(() => {
    const id = this.selectedReservationId();
    if (!id) return null;

    const res = this.allReservations().find(r => r.id === id);
    if (!res) return null;

    const room = this.catalogRooms.find(r => r.number === res.roomNumber);

    return {
      id: res.id,
      guestName: res.guestName,
      status: res.status,
      statusBadge: res.statusLabel || (res.status === 'EN_SEJOUR' ? 'En séjour' : res.status === 'CONFIRME' ? 'Confirmée' : 'Départ aujourd\'hui'),
      roomNumber: res.roomNumber,
      roomCategory: room ? `Chambre ${room.number} • ${room.category}` : `Chambre ${res.roomNumber}`,
      roomDescription: room?.description || '',
      checkInDate: res.checkInDate,
      checkInDetails: '15:00',
      checkOutDate: res.checkOutDate,
      checkOutDetails: '12:00',
      nights: res.nights,
      folio: {
        totalFcfa: res.totalFcfa,
        paidFcfa: res.totalFcfa - res.remainingFcfa,
        remainingFcfa: res.remainingFcfa,
        depositBadge: res.remainingFcfa === 0 ? 'Réglé' : 'Acompte versé',
        preferredPayment: 'Espèces / Wave'
      },
      contact: {
        phone: res.contactPhone || '+221 77 000 00 00',
        email: res.contactEmail || 'client@residenceblue.sn'
      }
    };
  });

  // --- Actions de Navigation ---

  navigatePrevious(): void {
    this.weekOffset.update(v => v - 1);
  }

  navigateNext(): void {
    this.weekOffset.update(v => v + 1);
  }

  navigateToday(): void {
    this.weekOffset.set(0);
  }

  // --- Actions de Recherche & Filtre ---

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  setFilterMode(filter: PlanningFilterType): void {
    this.filterMode.set(filter);
  }

  // --- Sélection et Panneau de détail ---

  openDetail(reservationId: string): void {
    this.selectedReservationId.set(reservationId);
  }

  closeDetail(): void {
    this.selectedReservationId.set(null);
  }

  // --- 4 Boutons d'Action du Panneau de Détail ---

  /** 1. Modifier : déclenche la modification */
  modifyReservation(id: string): PlanningReservation | undefined {
    return this.allReservations().find(r => r.id === id);
  }

  /** 2. Prolonger : ajoute 1 nuit si la chambre est disponible */
  extendReservation(id: string, additionalNights = 1): { success: boolean; message: string } {
    const res = this.allReservations().find(r => r.id === id);
    if (!res) {
      return { success: false, message: 'Réservation introuvable.' };
    }

    // Calculer la nouvelle date de départ
    const currentEnd = new Date(res.checkOutDate);
    const newEnd = new Date(currentEnd);
    newEnd.setDate(currentEnd.getDate() + additionalNights);
    const newEndIso = newEnd.toISOString().split('T')[0];

    // Vérifier si la prolongation chevauche une autre réservation sur la même chambre
    const hasOverlap = this.hasConflict(res.roomNumber, res.checkOutDate, newEndIso, res.id);
    if (hasOverlap) {
      const msg = `Impossible de prolonger : la chambre ${res.roomNumber} est déjà réservée à partir du ${res.checkOutDate}.`;
      this.feedbackMessage.set(msg);
      return { success: false, message: msg };
    }

    // Appliquer la prolongation
    const newNights = res.nights + additionalNights;
    const nightRate = res.nights > 0 ? Math.round(res.totalFcfa / res.nights) : 85000;
    const additionalTotal = nightRate * additionalNights;

    this.allReservations.update(list =>
      list.map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          checkOutDate: newEndIso,
          nights: newNights,
          durationDays: r.durationDays + additionalNights,
          totalFcfa: r.totalFcfa + additionalTotal,
          remainingFcfa: r.remainingFcfa + additionalTotal
        };
      })
    );

    const successMsg = `Séjour de ${res.guestName} prolongé de ${additionalNights} nuit(s) jusqu'au ${newEndIso}.`;
    this.feedbackMessage.set(successMsg);
    return { success: true, message: successMsg };
  }

  /** 3. Check-in ou Check-out selon l'état actuel avec support hors ligne via Outbox */
  toggleCheckInCheckOut(id: string): { success: boolean; newStatus: ReservationStatusType; message: string } {
    const res = this.allReservations().find(r => r.id === id);
    if (!res) {
      return { success: false, newStatus: 'CONFIRME', message: 'Réservation introuvable.' };
    }

    this.rollbackMap.set(id, { ...res });

    let nextStatus: ReservationStatusType = 'EN_SEJOUR';
    let nextLabel = 'En séjour';
    let msg = '';

    if (res.status === 'CONFIRME' || res.status === 'ARRIVEE_AUJ') {
      nextStatus = 'EN_SEJOUR';
      nextLabel = 'En séjour';
      msg = `Check-in validé pour ${res.guestName} (Chambre ${res.roomNumber}). Clé remise.`;
    } else if (res.status === 'EN_SEJOUR') {
      nextStatus = 'DEPART_AUJ';
      nextLabel = 'Départ aujourd\'hui';
      msg = `Check-out validé pour ${res.guestName} (Chambre ${res.roomNumber}). Chambre libérée.`;
    } else {
      nextStatus = 'EN_SEJOUR';
      nextLabel = 'En séjour';
      msg = `Statut réinitialisé en séjour pour ${res.guestName}.`;
    }

    const updatedRes: PlanningReservation = {
      ...res,
      status: nextStatus,
      statusLabel: nextLabel,
    };

    // 1. Optimistic UI : mise à jour immédiate locale
    this.allReservations.update(list =>
      list.map(r => (r.id === id ? updatedRes : r))
    );

    // 2. Persistance locale dans IndexedDB
    if (this.idbService) {
      void this.idbService.put('reservations', updatedRes).catch(() => {});
    }

    // 3. Enregistrement dans l'Outbox (avec Idempotency-Key UUID)
    const actionPath = nextStatus === 'EN_SEJOUR' ? 'check-in' : 'check-out';
    const actionType = nextStatus === 'EN_SEJOUR' ? 'RESERVATION_CHECK_IN' : 'RESERVATION_CHECK_OUT';
    const endpoint = `/api/reservations/${id}/${actionPath}`;

    if (this.outboxService) {
      void this.outboxService.enqueue(actionType, endpoint, { id }).catch(() => {});
    }

    const isOffline = this.networkService ? !this.networkService.isOnline() : false;
    const finalMsg = isOffline
      ? `${msg} (enregistré hors ligne, en attente de synchronisation)`
      : msg;

    this.feedbackMessage.set(finalMsg);
    return { success: true, newStatus: nextStatus, message: finalMsg };
  }

  /** 4. Annuler : retire la réservation avec support hors ligne via Outbox */
  cancelReservation(id: string): { success: boolean; message: string } {
    const res = this.allReservations().find(r => r.id === id);
    if (!res) {
      return { success: false, message: 'Réservation introuvable.' };
    }

    this.rollbackMap.set(id, { ...res });

    // 1. Optimistic UI : retrait immédiat de l'affichage local
    this.allReservations.update(list => list.filter(r => r.id !== id));
    this.closeDetail();

    // 2. Suppression locale dans IndexedDB
    if (this.idbService) {
      void this.idbService.delete('reservations', id).catch(() => {});
    }

    // 3. Mise en file d'attente Outbox
    if (this.outboxService) {
      void this.outboxService.enqueue('RESERVATION_CANCEL', `/api/reservations/${id}/cancel`, { id }).catch(() => {});
    }

    const isOffline = this.networkService ? !this.networkService.isOnline() : false;
    const baseMsg = `Réservation de ${res.guestName} en Chambre ${res.roomNumber} annulée.`;
    const finalMsg = isOffline
      ? `${baseMsg} (enregistré hors ligne, en attente de synchronisation)`
      : baseMsg;

    this.feedbackMessage.set(finalMsg);
    return { success: true, message: finalMsg };
  }

  // --- Contrôle des Conflits & Nouvelle Réservation ---

  /** Vérifie si une chambre est déjà occupée sur la période demandée [checkIn, checkOut[ */
  hasConflict(roomNumber: string, checkInIso: string, checkOutIso: string, excludeResId?: string): boolean {
    const existing = this.allReservations().filter(r => r.roomNumber === roomNumber && r.id !== excludeResId);

    return existing.some(r => {
      // Deux intervalles [A, B[ et [C, D[ se chevauchent si A < D et C < B
      return checkInIso < r.checkOutDate && r.checkInDate < checkOutIso;
    });
  }

  /** Création d'une nouvelle réservation avec refus strict en cas de chevauchement */
  createReservation(payload: {
    guestName: string;
    roomNumber: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    totalFcfa: number;
    depositAmountFcfa?: number;
    contactPhone?: string;
    contactEmail?: string;
  }): { success: boolean; errorMessage?: string; reservation?: PlanningReservation } {
    // Vérification du conflit
    if (this.hasConflict(payload.roomNumber, payload.checkInDate, payload.checkOutDate)) {
      const error = `La chambre ${payload.roomNumber} est déjà réservée sur cette période (du ${payload.checkInDate} au ${payload.checkOutDate}). Réservation refusée.`;
      this.feedbackMessage.set(error);
      return { success: false, errorMessage: error };
    }

    const newRes: PlanningReservation = {
      id: `res-${payload.roomNumber}-${Date.now().toString(36)}`,
      guestName: payload.guestName,
      roomNumber: payload.roomNumber,
      startDayIndex: 0,
      durationDays: payload.nights,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      status: 'CONFIRME',
      statusLabel: 'Confirmée',
      nights: payload.nights,
      totalFcfa: payload.totalFcfa,
      remainingFcfa: Math.max(0, payload.totalFcfa - (payload.depositAmountFcfa || 0)),
      contactPhone: payload.contactPhone,
      contactEmail: payload.contactEmail
    };

    this.allReservations.update(list => [...list, newRes]);
    this.feedbackMessage.set(`Réservation confirmée pour ${payload.guestName} en Chambre ${payload.roomNumber}.`);

    if (typeof fetch !== 'undefined') {
      fetch('/api/reservations', {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          guestName: payload.guestName,
          roomNumber: payload.roomNumber,
          checkInDate: payload.checkInDate,
          checkOutDate: payload.checkOutDate,
          nights: payload.nights,
          totalFcfa: payload.totalFcfa,
          depositFcfa: payload.depositAmountFcfa || 0,
          contactPhone: payload.contactPhone,
          contactEmail: payload.contactEmail,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            const saved = await res.json();
            this.allReservations.update((list) =>
              list.map((r) => (r.id === newRes.id ? saved : r)),
            );
          }
        })
        .catch(() => {});
    }

    return { success: true, reservation: newRes };
  }

  /** Données de compatibilité pour getPlanningData */
  getPlanningData(): Observable<PlanningData> {
    const days = this.currentDays();
    const rooms = this.roomsWithWeekReservations();
    const metrics = this.dailyMetrics();

    return of({
      periodLabel: this.periodLabel(),
      weeksLabel: 'Semaine en cours',
      days,
      occupancyStats: {
        ratePercent: '75%',
        occupiedRooms: 9,
        totalRooms: 12,
        arrivalsCount: metrics.arrivalsToday,
        departuresCount: metrics.departuresToday,
        realtimeLabel: 'Données en direct Résidence Blue'
      },
      conflictAlert: {
        title: 'Chambre occupée',
        badge: 'Disponibilité',
        roomNumber: '202',
        roomName: 'Chambre 202',
        period: '12 – 15 Nov. 2026',
        message: 'Conflit évité grâce au contrôle d\'attribution.',
        suggestionText: '',
        targetRoomNumber: '',
        targetRoomName: ''
      },
      rooms,
      selectedReservation: this.selectedReservation(),
      housekeeping: {
        title: 'Gouvernante',
        detail: '12 chambres suivies'
      }
    });
  }
}
