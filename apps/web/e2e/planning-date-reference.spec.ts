import { test, expect, APIRequestContext } from '@playwright/test';
import { getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';

async function findFirstRoomAndGuest(
  request: APIRequestContext,
  headers: Record<string, string>,
): Promise<{ roomId: string; roomNumber: string; guestId: string }> {
  const roomsRes = await request.get('/api/rooms', { headers });
  expect(roomsRes.ok()).toBe(true);
  const rooms = (await roomsRes.json()) as Array<{ id: string; number: string; isActive?: boolean }>;
  const room = rooms.find((r) => r.isActive !== false) ?? rooms[0];
  expect(room).toBeTruthy();

  const guestRes = await request.post('/api/guests', {
    headers,
    data: {
      civility: 'M.',
      firstName: 'Test',
      lastName: `DateDakar${Date.now().toString().slice(-4)}`,
      phone: `+22177${Math.floor(1000000 + Math.random() * 8999999)}`,
      nationality: 'Sénégalaise',
    },
  });
  expect(guestRes.ok()).toBe(true);
  const guest = (await guestRes.json()) as { id: string };
  return { roomId: room.id, roomNumber: room.number, guestId: guest.id };
}

test.describe('Planning — date de référence en heure de Dakar (E2E)', () => {
  test.setTimeout(90_000);

  const scenarios = [
    {
      label: '15 juillet 2026 (jour ordinaire)',
      clockIso: '2026-07-15T10:00:00.000Z',
      expectedTodayIso: '2026-07-15',
      expectedNextWeekFirstIso: '2026-07-22',
      expectedPrevWeekFirstIso: '2026-07-08',
      resCheckIn: '2026-07-16',
      resCheckOut: '2026-07-18',
    },
    {
      label: '1er janvier 2027 à 00h01 (changement d’année)',
      clockIso: '2027-01-01T00:01:00.000Z',
      expectedTodayIso: '2027-01-01',
      expectedNextWeekFirstIso: '2027-01-08',
      expectedPrevWeekFirstIso: '2026-12-25',
      resCheckIn: '2027-01-02',
      resCheckOut: '2027-01-04',
    },
  ];

  for (const scenario of scenarios) {
    test(`affiche la vraie date simulée (${scenario.label}), la navigation et une réservation existante`, async ({
      page,
      request,
    }) => {
      const headers = await getApiAuthHeaders(request);
      const { roomId, roomNumber, guestId } = await findFirstRoomAndGuest(request, headers);

      // Créer une réservation réelle dans la base de test residence_blue_e2e
      const createRes = await request.post('/api/reservations', {
        headers,
        data: {
          guestId,
          roomId,
          checkInDate: scenario.resCheckIn,
          checkOutDate: scenario.resCheckOut,
          adultsCount: 1,
          childrenCount: 0,
          source: 'RECEPTION',
        },
      });
      expect(createRes.ok()).toBe(true);
      const created = (await createRes.json()) as { id: string };

      try {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginViaUi(page);

        // Installer l'horloge simulée avant le chargement complet du planning
        await page.clock.install({ time: new Date(scenario.clockIso) });
        await page.goto('/planning', { waitUntil: 'networkidle' });

        await expect(page.locator('[data-testid="planning-desktop-grid"]')).toBeVisible({
          timeout: 15_000,
        });

        // 1. La colonne marquée Aujourd'hui porte exactement la date du jour simulée
        const todayHeader = page.locator('[data-testid^="day-header-"][data-is-today="true"]');
        await expect(todayHeader).toHaveCount(1);
        await expect(todayHeader).toHaveAttribute('data-date-iso', scenario.expectedTodayIso);

        // 2. La grille ne contient plus le 10 novembre 2026
        await expect(page.locator('[data-date-iso="2026-11-10"]')).toHaveCount(0);

        // 3. La réservation existante s'affiche sur la ligne de sa chambre
        const roomRow = page.locator(`[data-testid="room-row-${roomNumber}"]`);
        await expect(roomRow).toBeVisible();
        const resBar = roomRow.locator(`[data-testid="res-bar-${created.id}"]`);
        await expect(resBar).toBeVisible({ timeout: 10_000 });

        // 4. Navigation Suivant -> aucune colonne Aujourd'hui, 1re colonne = J+7
        await page.locator('[data-testid="btn-next-week"]').click();
        await expect(page.locator('[data-testid="day-header-0"]')).toHaveAttribute(
          'data-date-iso',
          scenario.expectedNextWeekFirstIso,
        );
        await expect(page.locator('[data-testid^="day-header-"][data-is-today="true"]')).toHaveCount(0);

        // 5. Navigation Précédent (x2) -> 1re colonne = J-7
        await page.locator('[data-testid="btn-prev-week"]').click();
        await page.locator('[data-testid="btn-prev-week"]').click();
        await expect(page.locator('[data-testid="day-header-0"]')).toHaveAttribute(
          'data-date-iso',
          scenario.expectedPrevWeekFirstIso,
        );

        // 6. Bouton « Aujourd'hui » -> retour sur la date simulée
        await page.locator('[data-testid="btn-today"]').click();
        const todayHeaderAfter = page.locator('[data-testid^="day-header-"][data-is-today="true"]');
        await expect(todayHeaderAfter).toHaveCount(1);
        await expect(todayHeaderAfter).toHaveAttribute('data-date-iso', scenario.expectedTodayIso);
      } finally {
        await request.delete(`/api/reservations/${created.id}`, { headers }).catch(() => {});
        await request.delete(`/api/guests/${guestId}`, { headers }).catch(() => {});
      }
    });
  }
});
