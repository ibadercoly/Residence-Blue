import { Injectable, computed, inject, signal } from '@angular/core';
import { RoomProblemDto, TechniqueDashboardDto } from '@residence-blue/shared';
import { AuthService } from './auth.service';
import { NetworkService } from '../offline/network.service';

@Injectable({
  providedIn: 'root',
})
export class TechniqueService {
  private readonly authService: AuthService;
  private readonly network: NetworkService;

  readonly toTreat = signal<RoomProblemDto[]>([]);
  readonly inProgress = signal<RoomProblemDto[]>([]);
  readonly resolvedToday = signal<RoomProblemDto[]>([]);
  readonly totalToTreat = computed(() => this.toTreat().length);

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly soundEnabled = signal<boolean>(true);
  readonly sseConnected = signal<boolean>(false);
  readonly newProblemAlert = signal<string | null>(null);

  private eventSource: EventSource | null = null;

  constructor(authServiceOverride?: AuthService, networkOverride?: NetworkService) {
    let auth: AuthService | null = null;
    let net: NetworkService | null = null;
    try {
      auth = inject(AuthService, { optional: true });
    } catch {
      auth = null;
    }
    try {
      net = inject(NetworkService, { optional: true });
    } catch {
      net = null;
    }
    this.authService = authServiceOverride ?? (auth as AuthService);
    this.network = networkOverride ?? (net as NetworkService);
  }

  async fetchDashboard(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const response = await (this.authService
        ? this.authService.authenticatedFetch('/api/technique/problems')
        : fetch('/api/technique/problems', { credentials: 'include' }));

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data: TechniqueDashboardDto = await response.json();
      this.toTreat.set(data.toTreat || []);
      this.inProgress.set(data.inProgress || []);
      this.resolvedToday.set(data.resolvedToday || []);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Impossible de charger les pannes.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async takeProblem(problemId: string): Promise<boolean> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Optimistic UI : déplacer de toTreat vers inProgress
    const target = this.toTreat().find((p) => p.id === problemId);
    if (target) {
      const updated: RoomProblemDto = {
        ...target,
        status: 'IN_PROGRESS',
        acknowledgedAt: new Date().toISOString(),
        assignedToName: this.authService?.currentUser()?.fullName || 'Technicien',
      };
      this.toTreat.update((list) => list.filter((p) => p.id !== problemId));
      this.inProgress.update((list) => [updated, ...list]);
    }

    try {
      const response = await (this.authService
        ? this.authService.authenticatedFetch(`/api/technique/problems/${problemId}/take`, {
            method: 'PATCH',
          })
        : fetch(`/api/technique/problems/${problemId}/take`, {
            method: 'PATCH',
            credentials: 'include',
          }));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur serveur (${response.status})`);
      }

      this.successMessage.set('Prise en charge enregistrée. Bon courage !');
      await this.fetchDashboard();
      return true;
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Impossible de prendre en charge cette panne.');
      await this.fetchDashboard();
      return false;
    }
  }

  async resolveProblem(problemId: string, resolutionNote?: string): Promise<boolean> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Optimistic UI : déplacer de inProgress vers resolvedToday
    const target = this.inProgress().find((p) => p.id === problemId);
    if (target) {
      const updated: RoomProblemDto = {
        ...target,
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolvedByName: this.authService?.currentUser()?.fullName || 'Technicien',
        resolutionNote: resolutionNote?.trim() || null,
      };
      this.inProgress.update((list) => list.filter((p) => p.id !== problemId));
      this.resolvedToday.update((list) => [updated, ...list]);
    }

    try {
      const response = await (this.authService
        ? this.authService.authenticatedFetch(`/api/technique/problems/${problemId}/resolve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolutionNote: resolutionNote?.trim() || '' }),
          })
        : fetch(`/api/technique/problems/${problemId}/resolve`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolutionNote: resolutionNote?.trim() || '' }),
          }));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur serveur (${response.status})`);
      }

      this.successMessage.set('Panne marquée comme réparée. Merci !');
      await this.fetchDashboard();
      return true;
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Impossible de valider la réparation.');
      await this.fetchDashboard();
      return false;
    }
  }

  toggleSound(): void {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
  }

  playBeep(): void {
    if (!this.soundEnabled() || typeof window === 'undefined') return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio bloqué ou non disponible
    }
  }

  startSse(): void {
    if (typeof window === 'undefined' || this.eventSource) return;

    try {
      this.eventSource = new EventSource('/api/technique/stream', { withCredentials: true });

      this.eventSource.onopen = () => {
        this.sseConnected.set(true);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'TECHNIQUE_PROBLEM_CREATED') {
            this.playBeep();
            const prob = payload.problem;
            if (prob) {
              const label = prob.typeLabel || prob.type;
              this.newProblemAlert.set(`Nouveau problème signalé : Chambre ${prob.roomNumber} (${label})`);
            }
            this.fetchDashboard();
          } else if (payload.type === 'TECHNIQUE_PROBLEM_UPDATED') {
            this.fetchDashboard();
          }
        } catch {
          // ignore non-json
        }
      };

      this.eventSource.onerror = () => {
        this.sseConnected.set(false);
      };
    } catch {
      this.sseConnected.set(false);
    }
  }

  stopSse(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.sseConnected.set(false);
    }
  }
}
