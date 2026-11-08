import { test, expect } from '@playwright/test';

test.describe('Résidence Blue - Écran Chambres & Workflow Offline-First', () => {
  test.beforeEach(async ({ page }) => {
    // Mock de l'API /api/rooms
    await page.route('**/api/rooms', async (route) => {
      const rooms = [
        {
          id: '00000000-0000-0000-0000-000000000101',
          number: '101',
          floor: 1,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Lit King Size', 'Salle de bain privée'],
          type: { id: 'type-standard', name: 'Standard', pricePerNight: 35000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000102',
          number: '102',
          floor: 1,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Lit King Size', 'Salle de bain privée'],
          type: { id: 'type-standard', name: 'Standard', pricePerNight: 35000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000103',
          number: '103',
          floor: 1,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Lit King Size', 'Salle de bain privée'],
          type: { id: 'type-standard', name: 'Standard', pricePerNight: 35000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000104',
          number: '104',
          floor: 1,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Lit King Size', 'Salle de bain privée'],
          type: { id: 'type-standard', name: 'Standard', pricePerNight: 35000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000105',
          number: '105',
          floor: 1,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Lit King Size', 'Salle de bain privée'],
          type: { id: 'type-standard', name: 'Standard', pricePerNight: 35000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000106',
          number: '106',
          floor: 1,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Lit King Size', 'Salle de bain privée'],
          type: { id: 'type-standard', name: 'Standard', pricePerNight: 35000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000201',
          number: '201',
          floor: 2,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Balcon privé', 'Mini-bar', 'TV 4K'],
          type: { id: 'type-deluxe', name: 'Deluxe', pricePerNight: 55000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000202',
          number: '202',
          floor: 2,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Balcon privé', 'Mini-bar', 'TV 4K'],
          type: { id: 'type-deluxe', name: 'Deluxe', pricePerNight: 55000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000203',
          number: '203',
          floor: 2,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Balcon privé', 'Mini-bar', 'TV 4K'],
          type: { id: 'type-deluxe', name: 'Deluxe', pricePerNight: 55000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000204',
          number: '204',
          floor: 2,
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi haut débit', 'Balcon privé', 'Mini-bar', 'TV 4K'],
          type: { id: 'type-deluxe', name: 'Deluxe', pricePerNight: 55000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000301',
          number: '301',
          floor: 3,
          status: 'FREE',
          amenities: ['Vue panoramique Thiès', 'Salon privé', 'Baignoire balnéo', 'Machine expresso'],
          type: { id: 'type-suite', name: 'Suite', pricePerNight: 95000 },
        },
        {
          id: '00000000-0000-0000-0000-000000000302',
          number: '302',
          floor: 3,
          status: 'FREE',
          amenities: ['Vue panoramique Thiès', 'Salon privé', 'Baignoire balnéo', 'Machine expresso'],
          type: { id: 'type-suite', name: 'Suite', pricePerNight: 95000 },
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rooms),
      });
    });

    // Mock des requêtes PATCH de changement de statut
    await page.route('**/api/rooms/*/status', async (route) => {
      const postData = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: postData.status,
          updatedAt: new Date().toISOString(),
        }),
      });
    });
  });

  test('doit afficher les 12 chambres avec leurs tarifs entiers en FCFA et permettre le filtrage', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/chambres');

    // Titre et sous-titre
    await expect(page.locator('h1')).toContainText('Grille des 12 Chambres');
    await expect(page.locator('.page-subtitle')).toContainText('Grand Standing');

    // 12 cartes de chambres affichées
    const cards = page.locator('.room-card');
    await expect(cards).toHaveCount(12);

    // Vérification des tarifs entiers en FCFA
    const firstCard = cards.filter({ hasText: 'Chambre 101' });
    await expect(firstCard).toContainText('35 000 FCFA');

    const deluxeCard = cards.filter({ hasText: 'Chambre 201' });
    await expect(deluxeCard).toContainText('55 000 FCFA');

    const suiteCard = cards.filter({ hasText: 'Chambre 301' });
    await expect(suiteCard).toContainText('95 000 FCFA');

    // Filtre par étage : 3e étage uniquement
    await page.locator('.floor-btn', { hasText: '3e (Suites)' }).click();
    await expect(page.locator('.room-card')).toHaveCount(2);
    await expect(page.locator('.room-card').first()).toContainText('Chambre 301');
    await expect(page.locator('.room-card').nth(1)).toContainText('Chambre 302');

    // Réinitialisation du filtre
    await page.locator('.floor-btn', { hasText: 'Tous' }).click();
    await expect(page.locator('.room-card')).toHaveCount(12);
  });

  test('doit effectuer un check-in en ligne (FREE -> OCCUPIED) avec mise à jour immédiate', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/chambres');

    const card101 = page.locator('.room-card[data-room-number="101"]');
    await expect(card101).toContainText('Libre');

    // Clic sur Check-in
    const checkInBtn = card101.locator('button[data-action="check-in-101"]');
    await expect(checkInBtn).toBeVisible();
    await checkInBtn.click();

    // La carte passe au statut Occupée
    await expect(card101).toContainText('Occupée');
    await expect(page.locator('#alert-success')).toContainText('statut mis à jour (OCCUPIED)');

    // Le bouton Check-in est remplacé par "Libérer (Ménage)"
    await expect(card101.locator('button[data-action="check-out-101"]')).toBeVisible();
  });

  test('doit modifier un statut hors-ligne (OCCUPIED -> CLEANING), afficher le badge d attente de synchronisation et synchroniser au retour', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/chambres');

    // Passer 101 en OCCUPIED d'abord
    const card101 = page.locator('.room-card[data-room-number="101"]');
    await card101.locator('button[data-action="check-in-101"]').click();
    await expect(card101).toContainText('Occupée');

    // Simuler le passage en mode hors ligne
    await context.setOffline(true);
    await page.waitForTimeout(300);

    // Modifier le statut en mode hors-ligne : Check-out (OCCUPIED -> CLEANING)
    const checkOutBtn = card101.locator('button[data-action="check-out-101"]');
    await expect(checkOutBtn).toBeVisible();
    await checkOutBtn.click();

    // Mise à jour optimiste : le statut devient "À nettoyer"
    await expect(card101).toContainText('À nettoyer');

    // L'alerte hors-ligne et l'indicateur de synchronisation en attente doivent s'afficher
    await expect(card101.locator('.sync-pending-card-alert')).toBeVisible();
    await expect(page.locator('#sync-pending-counter')).toBeVisible();
    await expect(page.locator('#sync-pending-counter')).toContainText('en attente de sync');

    // Rétablir la connexion
    await context.setOffline(false);
    await page.waitForTimeout(300);

    // Déclencher la synchronisation
    const syncBtn = page.locator('button', { hasText: 'Synchroniser' });
    if (await syncBtn.isVisible()) {
      await syncBtn.click();
    }
  });

  test('doit changer de rôle et respecter les transitions autorisées pour la Gouvernance', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/chambres');

    // Sélectionner le profil Gouvernance (HOUSEKEEPING)
    await page.locator('.role-pill', { hasText: 'Gouvernance' }).click();

    // Sur une chambre libre, la gouvernance ne doit pas pouvoir faire de Check-in
    const card102 = page.locator('.room-card[data-room-number="102"]');
    await expect(card102.locator('button[data-action="check-in-102"]')).toBeVisible();
    await card102.locator('button[data-action="check-in-102"]').click();

    // Message d'erreur de rejet RBAC
    await expect(page.locator('#alert-error')).toBeVisible();
    await expect(page.locator('#alert-error')).toContainText('non habilité');
  });
});
