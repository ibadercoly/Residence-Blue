import { MenuManagementService } from './menu-management.service';
import { RestaurantMockService } from './restaurant-mock.service';
import { HotelSettingsService } from './hotel-settings.service';
import { PhotoStorageService } from './photo-storage.service';

describe('MenuManagementService', () => {
  let service: MenuManagementService;
  let restaurantService: RestaurantMockService;
  let hotelSettings: HotelSettingsService;
  let photoStorage: PhotoStorageService;

  beforeEach(() => {
    hotelSettings = new HotelSettingsService();
    restaurantService = new RestaurantMockService(hotelSettings);
    photoStorage = new PhotoStorageService();
    service = new MenuManagementService(restaurantService, hotelSettings, photoStorage);
  });

  describe('Gestion des plats (CRUD & Unicité)', () => {
    it('devrait ajouter un nouveau plat avec validation du nom et prix en FCFA', () => {
      const res = service.addDish({
        name: 'Pastels au Poisson Somone',
        description: 'Beignets croustillants farcis au poisson local avec sauce pimentée douce.',
        categoryId: 'cat-1',
        priceFcfa: 2500,
        prepStation: 'CUISINE'
      });

      expect(res.success).toBe(true);
      expect(res.dish).toBeDefined();
      expect(res.dish?.name).toBe('Pastels au Poisson Somone');
      expect(res.dish?.priceFcfa).toBe(2500);
      expect(res.dish?.status).toBe('AVAILABLE');
      expect(res.dish?.vatRatePercent).toBe(10);
    });

    it('devrait refuser un plat avec un nom en double', () => {
      // "Thiéboudienne Royale" existe déjà
      const res = service.addDish({
        name: 'Thiéboudienne Royale',
        description: 'Une autre version...',
        categoryId: 'cat-1',
        priceFcfa: 5000
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('existe déjà');
    });

    it('devrait refuser un prix négatif ou supérieur à 1 000 000 FCFA', () => {
      const resNeg = service.addDish({
        name: 'Plat Gratuit Impossible',
        description: 'Test',
        categoryId: 'cat-1',
        priceFcfa: -100
      });
      expect(resNeg.success).toBe(false);

      const resTropCher = service.addDish({
        name: 'Plat Diamant',
        description: 'Test',
        categoryId: 'cat-1',
        priceFcfa: 1500000
      });
      expect(resTropCher.success).toBe(false);
    });

    it('devrait dupliquer un plat avec mention (copie) et statut Disponible', () => {
      const copy = service.duplicateDish('dish-1');
      expect(copy.name).toBe('Thiéboudienne Royale (copie)');
      expect(copy.status).toBe('AVAILABLE');
      expect(copy.id).not.toBe('dish-1');
      expect(service.allDishes().some((d) => d.id === copy.id)).toBe(true);
    });

    it('devrait basculer le statut Épuisé en 1 clic (AVAILABLE <-> SOLD_OUT)', () => {
      const dish = service.allDishes()[0];
      const initialStatus = dish.status;

      service.toggleSoldOut(dish.id);
      const updated1 = service.allDishes().find((d) => d.id === dish.id);
      expect(updated1?.status).toBe(initialStatus === 'AVAILABLE' ? 'SOLD_OUT' : 'AVAILABLE');

      service.toggleSoldOut(dish.id);
      const updated2 = service.allDishes().find((d) => d.id === dish.id);
      expect(updated2?.status).toBe(initialStatus);
    });

    it('devrait archiver un plat sans le supprimer définitivement', () => {
      const dishId = 'dish-2';
      service.archiveDish(dishId);

      const archived = service.allDishes().find((d) => d.id === dishId);
      expect(archived?.status).toBe('ARCHIVED');

      // Le plat archivé n'apparaît plus sur la caisse POS (filteredDishes de RestaurantMockService)
      const inPos = restaurantService.filteredDishes().some((d) => d.id === dishId);
      expect(inPos).toBe(false);
    });
  });

  describe('Gestion des catégories', () => {
    it('devrait créer une nouvelle catégorie', () => {
      const newCat = service.createCategory('Vins & Spiritueux', 'wine_bar');
      expect(newCat.name).toBe('Vins & Spiritueux');
      expect(service.categories().some((c) => c.id === newCat.id)).toBe(true);
    });

    it('devrait archiver une catégorie contenant des plats avec avertissement', () => {
      // cat-1 contient des plats actifs
      const res = service.archiveCategory('cat-1');
      expect(res.success).toBe(true);
      expect(res.error).toContain('plat(s) actif(s)');

      const cat1 = service.categories().find((c) => c.id === 'cat-1');
      expect(cat1?.isArchived).toBe(true);
    });
  });

  describe('Export CSV & Protection contre les injections de formules', () => {
    it('devrait neutraliser les cellules commençant par =, +, -, @ avec une apostrophe', () => {
      expect(service.sanitizeForCsv('=SUM(A1:A10)')).toBe("\"'=SUM(A1:A10)\"");
      expect(service.sanitizeForCsv('+123456')).toBe("\"'+123456\"");
      expect(service.sanitizeForCsv('-cmd|/C calc')).toBe("\"'-cmd|/C calc\"");
      expect(service.sanitizeForCsv('@attacker.sn')).toBe("\"'@attacker.sn\"");
      expect(service.sanitizeForCsv('Thiéboudienne Royale')).toBe('"Thiéboudienne Royale"');
    });

    it('devrait générer un fichier CSV avec UTF-8 BOM', () => {
      const csv = service.generateMenuCsv();
      expect(csv.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
      expect(csv).toContain('Thiéboudienne Royale');
      expect(csv).toContain('Plats sénégalais & Mer');
    });
  });

  describe('Import CSV & Validations strictes', () => {
    it('devrait rejeter un fichier dépassant 2 Mo', () => {
      const report = service.parseAndValidateCsv('dummy', 3 * 1024 * 1024);
      expect(report.success).toBe(false);
      expect(report.rejectionReason).toContain('2 Mo');
    });

    it('devrait rejeter un fichier dépassant 500 lignes', () => {
      const manyLines = ['Nom,Catégorie,Prix FCFA,Demi-portion,Statut,Poste,Description'];
      for (let i = 0; i < 505; i++) {
        manyLines.push(`Plat ${i},cat,1000,,AVAILABLE,CUISINE,Desc`);
      }
      const report = service.parseAndValidateCsv(manyLines.join('\n'), 10000);
      expect(report.success).toBe(false);
      expect(report.rejectionReason).toContain('500 lignes');
    });

    it('devrait rapporter les erreurs de validation ligne par ligne (nom manquant, prix invalide)', () => {
      const csvData = [
        'Nom,Catégorie,Prix FCFA,Demi-portion,Statut,Poste,Description',
        ',Plats sénégalais & Mer,3000,,AVAILABLE,CUISINE,Sans nom', // Erreur nom
        'Plat Invalide,Plats sénégalais & Mer,PRIX_NON_NUMERIQUE,,AVAILABLE,CUISINE,Desc' // Erreur prix
      ].join('\n');

      const report = service.parseAndValidateCsv(csvData, 500);
      expect(report.success).toBe(false);
      expect(report.errors.length).toBe(2);
      expect(report.errors.some((e) => e.field === 'Nom')).toBe(true);
      expect(report.errors.some((e) => e.field === 'Prix FCFA')).toBe(true);
    });

    it('devrait importer les lignes valides et créer la catégorie si inconnue', () => {
      const csvData = [
        'Nom,Catégorie,Prix FCFA,Demi-portion,Statut,Poste,Description',
        'Brochettes de Lotte Somone,Nouvelle Catégorie Grillades,5500,,AVAILABLE,CUISINE,Lotte fraîche marinée'
      ].join('\n');

      const report = service.parseAndValidateCsv(csvData, 500);
      expect(report.validRows.length).toBe(1);

      const commitRes = service.commitCsvImport(report.validRows);
      expect(commitRes.importedCount).toBe(1);

      const importedDish = service.allDishes().find((d) => d.name === 'Brochettes de Lotte Somone');
      expect(importedDish).toBeDefined();
      expect(importedDish?.priceFcfa).toBe(5500);
      expect(service.categories().some((c) => c.name === 'Nouvelle Catégorie Grillades')).toBe(true);
    });
  });
});
