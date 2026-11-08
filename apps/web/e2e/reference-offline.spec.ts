import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Pages de référence hors ligne (design/reference/)', () => {
  const screens = [
    { name: 'tableau_de_bord', title: 'Résidence Blue' },
    { name: 'tableau_de_bord_mode_clair', title: 'Résidence Blue' },
    { name: 'connexion_r_sidence_blue_pms', title: 'Résidence Blue' },
    { name: 'planning_des_r_servations', title: 'Planning' },
    { name: 'point_de_vente_restaurant_la_teranga', title: 'Teranga' },
    { name: 'fiche_profil_client_m._mamadou_diop', title: 'Diop' },
    { name: 'facturation_folio_client_encaissement', title: 'Folio' },
    { name: 'maintenance_suivi_des_tickets_techniques', title: 'Maintenance' },
    { name: 'modal_nouvelle_r_servation', title: 'Réservation' },
    { name: 'rapports_statistiques_financi_res', title: 'Rapports' },
  ];

  for (const s of screens) {
    test(`doit s'afficher hors ligne sans réseau pour ${s.name}`, async ({ context, page }) => {
      // Coupure totale du réseau
      await context.setOffline(true);

      const filePath = path.resolve(__dirname, '../../../design/reference', `${s.name}.html`);
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;

      await page.goto(fileUrl, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      // Vérifier que le corps de page est bien rendu
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Vérifier la présence du contenu clé
      const content = await page.content();
      expect(content.length).toBeGreaterThan(1000);

      // Reconnexion pour le test suivant
      await context.setOffline(false);
    });
  }
});
