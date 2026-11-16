import { NotificationsService } from './notifications.service';
import { AppNotificationDto } from '@residence-blue/shared';

describe('NotificationsService (Web Unit)', () => {
  let service: NotificationsService;

  beforeEach(() => {
    jest.useFakeTimers();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    service = new NotificationsService();
    (service as any).canReceiveOrderNotifications = () => true;
  });

  afterEach(() => {
    service.stopRealtime();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function makeMsg(overrides: Partial<AppNotificationDto> = {}): AppNotificationDto {
    return {
      id: overrides.id || 'n-1',
      category: 'RESTAURANT',
      type: 'PLAT_CONFIRME_TEMPS',
      severity: 'INFO',
      title: 'La cuisine prépare 1 Thiéboudienne royale. Prête vers 17:04 (dans 15 min)',
      detail: 'Chambre 301, M. Diop',
      orderId: 'ord-1',
      roomNumber: '301',
      link: '/restaurant?highlightOrder=ord-1',
      importantAlert: false,
      read: false,
      readAt: null,
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('affiche "9+" sur la pastille au-delà de 9 messages non lus', () => {
    const msgs = Array.from({ length: 11 }, (_, idx) =>
      makeMsg({ id: `n-${idx}`, read: false }),
    );
    service.serverMessages.set(msgs);
    service.unreadServerCount.set(11);

    expect(service.unreadCount()).toBe(11);
    expect(service.badgeLabel()).toBe('9+');

    service.unreadServerCount.set(9);
    expect(service.badgeLabel()).toBe('9');

    service.unreadServerCount.set(0);
    expect(service.badgeLabel()).toBe('');
  });

  it('affiche au plus 1 alerte importante pendant 8 s, sans son avant interaction, avec son après interaction', () => {
    const ready1 = makeMsg({
      id: 'n-ready-1',
      type: 'PRETE',
      severity: 'SUCCESS',
      title: 'Prête à servir : 2 Thiéboudiennes',
      importantAlert: true,
    });
    const missing2 = makeMsg({
      id: 'n-missing-2',
      type: 'PLAT_MANQUANT',
      severity: 'CRITICAL',
      title: "Plat manquant : Omelette n'est plus disponible. Motif : plus d'œufs. Que voulez-vous faire ?",
      importantAlert: true,
    });

    // Avant interaction utilisateur + son coupé : aucun son joué, mais popup s'affiche 8 s
    service.applyStreamEvent({
      eventId: 1,
      type: 'NOTIFICATION_CREATED',
      notification: ready1,
      timestamp: new Date().toISOString(),
    });
    expect(service.activeImportantAlert()?.id).toBe('n-ready-1');
    expect(service.soundPlayedCount()).toBe(0);

    // Une deuxième alerte importante pendant les 8 s ne remplace pas la première (elle entre seulement dans la cloche)
    service.applyStreamEvent({
      eventId: 2,
      type: 'NOTIFICATION_CREATED',
      notification: missing2,
      timestamp: new Date().toISOString(),
    });
    expect(service.activeImportantAlert()?.id).toBe('n-ready-1');
    expect(service.unreadMessages().map((m) => m.id)).toContain('n-missing-2');

    // Au bout de 8 000 ms, l'encadré disparaît
    jest.advanceTimersByTime(8000);
    expect(service.activeImportantAlert()).toBeNull();

    // Activer l'interrupteur Son (compte comme interaction) -> la prochaine alerte importante déclenche le son
    service.toggleSound();
    expect(service.soundEnabled()).toBe(true);
    expect(service.userInteracted()).toBe(true);

    const ready3 = makeMsg({
      id: 'n-ready-3',
      type: 'PRETE',
      severity: 'SUCCESS',
      title: 'Prête à servir : 1 Yassa poulet',
      importantAlert: true,
    });
    service.applyStreamEvent({
      eventId: 3,
      type: 'NOTIFICATION_CREATED',
      notification: ready3,
      timestamp: new Date().toISOString(),
    });
    expect(service.soundPlayedCount()).toBe(1);
    expect(service.lastSoundPlayedType()).toBe('PRETE');
  });

  it('ne déclenche aucune alerte popup ni son pour les messages silencieux', () => {
    service.toggleSound();
    const silent = makeMsg({
      id: 'n-silent',
      type: 'RETARD',
      severity: 'WARNING',
      title: 'En retard de 4 min : 1 Yassa poulet devait être prêt à 17:04',
      importantAlert: false,
    });
    service.applyStreamEvent({
      eventId: 10,
      type: 'NOTIFICATION_CREATED',
      notification: silent,
      timestamp: new Date().toISOString(),
    });
    expect(service.activeImportantAlert()).toBeNull();
    expect(service.soundPlayedCount()).toBe(0);
    expect(service.unreadMessages()).toHaveLength(1);
  });

  it('synchronise l’état lu via les événements SSE et met en file hors ligne', async () => {
    const m1 = makeMsg({ id: 'n-sync-1', read: false });
    const m2 = makeMsg({ id: 'n-sync-2', read: false });
    service.serverMessages.set([m1, m2]);
    service.unreadServerCount.set(2);

    service.applyStreamEvent({
      eventId: 20,
      type: 'NOTIFICATION_READ',
      notificationId: 'n-sync-1',
      readAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    });
    expect(service.unreadCount()).toBe(1);
    expect(service.unreadMessages().map((m) => m.id)).toEqual(['n-sync-2']);

    const enqueueMock = jest.fn(async () => ({} as any));
    (service as any).network = { isOnline: () => false };
    (service as any).outbox = { enqueue: enqueueMock };

    await service.markAsRead(m2);
    expect(enqueueMock).toHaveBeenCalledWith(
      'POST_NOTIFICATION_READ',
      '/api/notifications/n-sync-2/read',
      {},
    );
    expect(service.unreadCount()).toBe(0);
  });
});
