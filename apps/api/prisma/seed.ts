import process from 'process';
import {
  InvoiceStatus,
  PaymentMethod,
  PrismaClient,
  ReservationStatus,
  Role,
  RoomStatus,
} from '@prisma/client';
import { SEED_ROOM_TYPES, SEED_ROOMS, getRoomImageUrl } from '@residence-blue/shared';
import { hashPassword, isArgon2idHash, isValidPasswordHash } from '../src/auth/password-hash.util';
import { CryptoService } from '../src/common/security/crypto.service';

const prisma = new PrismaClient();

export async function seedRooms(customPrisma: PrismaClient = prisma) {
  console.log('[SEED] Début du peuplement des types de chambres et des 12 chambres...');

  const typeMap = new Map<string, string>();
  for (const typeData of SEED_ROOM_TYPES) {
    const roomType = await customPrisma.roomType.upsert({
      where: { name: typeData.name },
      update: { pricePerNight: typeData.pricePerNight },
      create: {
        name: typeData.name,
        pricePerNight: typeData.pricePerNight,
      },
    });
    typeMap.set(typeData.name, roomType.id);
  }

  for (const roomData of SEED_ROOMS) {
    const typeId = typeMap.get(roomData.typeName);
    if (!typeId) {
      throw new Error(`Type de chambre introuvable pour ${roomData.typeName}`);
    }

    const defaultImg = getRoomImageUrl(roomData.number);
    const price = SEED_ROOM_TYPES.find((t) => t.name === roomData.typeName)?.pricePerNight || 35000;

    await customPrisma.room.upsert({
      where: { number: roomData.number },
      update: {
        typeId,
        category: roomData.typeName,
        floor: roomData.floor,
        amenities: roomData.amenities,
        pricePerNight: price,
      },
      create: {
        number: roomData.number,
        typeId,
        category: roomData.typeName,
        floor: roomData.floor,
        status: RoomStatus.FREE,
        amenities: roomData.amenities,
        pricePerNight: price,
        imageUrl: defaultImg,
      },
    });
  }

  console.log('[SEED] Peuplement des 12 chambres achevé avec succès.');
}

export async function seedAll(customPrisma: PrismaClient = prisma) {
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Compte DIRECTION initial (autorisé même en production s'il n'en existe aucun)
  const directionCount = await customPrisma.user.count({
    where: { role: Role.DIRECTION },
  });

  if (isProd && directionCount > 0) {
    throw new Error(
      '[SEED] Exécution refusée : NODE_ENV=production et un compte DIRECTION existe déjà.',
    );
  }

  const defaultPasswordHash = await hashPassword('ThiesTeranga2024!');

  await customPrisma.user.upsert({
    where: { email: 'aissatou.ba@residenceblue.sn' },
    update: {
      fullName: 'Aïssatou Ba',
      jobTitle: "Directrice d'Exploitation",
      role: Role.DIRECTION,
      isActive: true,
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: 'aissatou.ba@residenceblue.sn',
      fullName: 'Aïssatou Ba',
      jobTitle: "Directrice d'Exploitation",
      role: Role.DIRECTION,
      isActive: true,
      passwordHash: defaultPasswordHash,
    },
  });

  if (isProd) {
    console.log('[SEED] Mode production : seul le premier compte DIRECTION a été vérifié/créé.');
    return;
  }

  // Mettre à niveau tout compte existant dont le hash ne serait pas au format scrypt/bcrypt/argon2
  const existingUsers = await customPrisma.user.findMany();
  for (const u of existingUsers) {
    if (!isArgon2idHash(u.passwordHash) || !isValidPasswordHash(u.passwordHash)) {
      await customPrisma.user.update({
        where: { id: u.id },
        data: { passwordHash: defaultPasswordHash },
      });
    }
  }

  // 2. Un compte par rôle
  const roleAccounts: Array<{ email: string; fullName: string; jobTitle: string; role: Role }> = [
    {
      email: 'fatou.ndiaye@residenceblue.sn',
      fullName: 'Fatou Ndiaye',
      jobTitle: 'Chef de Réception',
      role: Role.RECEPTION,
    },
    {
      email: 'teranga.resto@residenceblue.sn',
      fullName: 'Ibrahima Diallo',
      jobTitle: "Maître d'Hôtel",
      role: Role.RESTAURANT,
    },
    {
      email: 'moussa.fall@residenceblue.sn',
      fullName: 'Moussa Fall',
      jobTitle: 'Serveur Salle & Piscine',
      role: Role.SERVEUR,
    },
    {
      email: 'cheikh.sow@residenceblue.sn',
      fullName: 'Cheikh Sow',
      jobTitle: 'Chef de Cuisine',
      role: Role.CUISINE,
    },
    {
      email: 'comptable@residenceblue.sn',
      fullName: 'Ndeye Diouf',
      jobTitle: 'Responsable Comptable',
      role: Role.COMPTABLE,
    },
  ];

  for (const acc of roleAccounts) {
    await customPrisma.user.upsert({
      where: { email: acc.email },
      update: {
        fullName: acc.fullName,
        jobTitle: acc.jobTitle,
        role: acc.role,
        isActive: true,
        passwordHash: defaultPasswordHash,
      },
      create: {
        email: acc.email,
        fullName: acc.fullName,
        jobTitle: acc.jobTitle,
        role: acc.role,
        isActive: true,
        passwordHash: defaultPasswordHash,
      },
    });
  }

  // 3. Chambres (12 clés)
  await seedRooms(customPrisma);

  // S'assurer que les 12 chambres ont bien une image existante sur disque si imageUrl est null
  const allRooms = await customPrisma.room.findMany();
  for (const r of allRooms) {
    if (!r.imageUrl) {
      await customPrisma.room.update({
        where: { id: r.id },
        data: { imageUrl: getRoomImageUrl(r.number) },
      });
    }
  }

  // 4. Paramètres de l'hôtel
  await customPrisma.hotelSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      hotelName: 'Résidence Blue',
      legalName: 'Résidence Blue S.A.R.L.',
      tagline: 'Hôtel Boutique • Grand Standing, Thiès',
      city: 'Thiès',
      neighborhood: 'Grand Standing',
      country: 'Sénégal',
      fullAddress: 'Quartier Grand Standing • Thiès, Sénégal',
      ninea: '004819230',
      rccm: 'SN-THS-2021-B-114',
      supportPhone: '+221 33 957 00 00',
      supportEmail: 'support@residenceblue.sn',
      roomCount: 12,
      restaurantName: 'La Teranga',
      currency: 'XOF',
      vatRatePercent: 10,
      tourismTaxPerNightPerPerson: 1000,
      exchangeRateEurToFcfa: 655.957,
    },
  });

  // 5. Clients (avec pièce d'identité chiffrée en AES-256-GCM)
  const cryptoService = new CryptoService();
  const sampleGuests = [
    {
      civility: 'M.',
      firstName: 'Mamadou',
      lastName: 'Diop',
      fullName: 'M. Mamadou Diop',
      phone: '+221 77 654 32 10',
      email: 'mamadou.diop@terangagroup.sn',
      nationality: 'Sénégalaise',
      residenceCity: 'Almadies, Dakar',
      companyName: 'Teranga Group',
      companyRole: 'Dir. Associé',
      vipTier: 'VIP Gold',
      passportPlain: 'SN-982341-B',
      passportExpiry: '14/09/2027',
    },
    {
      civility: 'Mme',
      firstName: 'Claire',
      lastName: 'Lefèvre',
      fullName: 'Mme Claire Lefèvre',
      phone: '+33 6 45 67 89 01',
      email: 'claire.lefevre@avocat.fr',
      nationality: 'Française',
      residenceCity: 'Paris, France',
      companyName: 'Cabinet Lefèvre',
      companyRole: 'Avocate Associée',
      vipTier: 'VIP Business',
      passportPlain: 'FR-441892-P',
      passportExpiry: '22/11/2028',
    },
    {
      civility: 'M.',
      firstName: 'Babacar',
      lastName: 'Sylla',
      fullName: 'M. Babacar Sylla',
      phone: '+221 70 890 12 34',
      email: 'b.sylla@sylla-holding.sn',
      nationality: 'Sénégalaise',
      residenceCity: 'Saint-Louis, Sénégal',
      companyName: 'Sylla Holding',
      companyRole: 'Directeur Général',
      vipTier: 'Client Fidèle',
      passportPlain: 'SN-551209-C',
      passportExpiry: '03/04/2029',
    },
  ];

  const guestMap = new Map<string, string>();
  for (const g of sampleGuests) {
    const existing = await customPrisma.guest.findFirst({
      where: { email: g.email },
    });
    const encryptedDoc = cryptoService.encrypt(g.passportPlain);
    if (existing) {
      await customPrisma.guest.update({
        where: { id: existing.id },
        data: {
          fullName: g.fullName,
          phone: g.phone,
          vipTier: g.vipTier,
          idDocumentEncrypted: encryptedDoc,
        },
      });
      guestMap.set(g.email, existing.id);
    } else {
      const created = await customPrisma.guest.create({
        data: {
          civility: g.civility,
          firstName: g.firstName,
          lastName: g.lastName,
          fullName: g.fullName,
          phone: g.phone,
          email: g.email,
          nationality: g.nationality,
          residenceCity: g.residenceCity,
          companyName: g.companyName,
          companyRole: g.companyRole,
          vipTier: g.vipTier,
          idDocumentEncrypted: encryptedDoc,
          idDocumentExpiry: g.passportExpiry,
          notes: [
            {
              id: 'note-seed-1',
              authorName: 'Aminata S.',
              department: 'Housekeeping',
              timeAgo: 'Hier, 14:20',
              content: 'Client particulièrement courtois. A demandé 2 draps de bain de piscine supplémentaires.',
            },
          ],
          preferences: [
            {
              id: 'pref-seed-1',
              category: 'morning',
              icon: 'wb_twilight',
              title: 'Réveil & Matin',
              description: 'Café Touba traditionnel servi en terrasse à 08h00 pile.',
            },
          ],
          permanentInstructions: [
            { icon: 'airport_shuttle', text: 'Navette aéroport systématique', variant: 'secondary' },
            { icon: 'wine_bar', text: "Bouteille d'accueil", variant: 'surface' },
          ],
        },
      });
      guestMap.set(g.email, created.id);
    }
  }

  // 6. Réservations de test (idempotentes par référence)
  const room301 = await customPrisma.room.findUnique({ where: { number: '301' } });
  const room202 = await customPrisma.room.findUnique({ where: { number: '202' } });
  const room204 = await customPrisma.room.findUnique({ where: { number: '204' } });

  const diopId = guestMap.get('mamadou.diop@terangagroup.sn');
  const lefevreId = guestMap.get('claire.lefevre@avocat.fr');
  const syllaId = guestMap.get('b.sylla@sylla-holding.sn');

  if (room301 && diopId) {
    await customPrisma.reservation.upsert({
      where: { reference: '#RB-2026-0894' },
      update: {},
      create: {
        reference: '#RB-2026-0894',
        guestId: diopId,
        roomId: room301.id,
        checkInDate: new Date('2026-11-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-11-14T00:00:00.000Z'),
        adultsCount: 2,
        childrenCount: 0,
        nights: 4,
        status: ReservationStatus.CHECKED_IN,
        depositFcfa: 500000,
        totalFcfa: 788000,
        checkedInAt: new Date('2026-11-10T14:00:00.000Z'),
        notes: 'Suite Panoramique VIP • Transfert AIBD inclus',
      },
    });
  }

  if (room202 && lefevreId) {
    await customPrisma.reservation.upsert({
      where: { reference: '#RB-2026-0895' },
      update: {},
      create: {
        reference: '#RB-2026-0895',
        guestId: lefevreId,
        roomId: room202.id,
        checkInDate: new Date('2026-11-12T00:00:00.000Z'),
        checkOutDate: new Date('2026-11-15T00:00:00.000Z'),
        adultsCount: 1,
        childrenCount: 0,
        nights: 3,
        status: ReservationStatus.CONFIRMED,
        depositFcfa: 190000,
        totalFcfa: 390000,
        notes: 'Séjour affaires Thiès',
      },
    });
  }

  if (room204 && syllaId) {
    await customPrisma.reservation.upsert({
      where: { reference: '#RB-2026-0896' },
      update: {},
      create: {
        reference: '#RB-2026-0896',
        guestId: syllaId,
        roomId: room204.id,
        checkInDate: new Date('2026-11-11T00:00:00.000Z'),
        checkOutDate: new Date('2026-11-14T00:00:00.000Z'),
        adultsCount: 2,
        childrenCount: 0,
        nights: 3,
        status: ReservationStatus.CONFIRMED,
        depositFcfa: 200000,
        totalFcfa: 390000,
        notes: 'Bungalow Terrasse',
      },
    });
  }

  // 7. Facture et Paiement de démonstration cohérents (totalFcfa === somme des lignes)
  const resDiop = await customPrisma.reservation.findUnique({ where: { reference: '#RB-2026-0894' } });
  if (room301 && diopId && resDiop) {
    const existingInv = await customPrisma.invoice.findUnique({
      where: { invoiceNumber: '#INV-2024-0542' },
    });
    if (!existingInv) {
      await customPrisma.invoice.create({
        data: {
          invoiceNumber: '#INV-2024-0542',
          reservationId: resDiop.id,
          guestId: diopId,
          roomId: room301.id,
          subtotalHtFcfa: 716364,
          vatRatePercent: 10,
          vatAmountFcfa: 71636,
          tourismTaxFcfa: 8000,
          totalFcfa: 788000,
          depositFcfa: 500000,
          paidAmountFcfa: 0,
          balanceFcfa: 288000,
          status: InvoiceStatus.PARTIAL,
          billingCompanyName: 'Teranga Group Dakar S.A.',
          billingNinea: '0029103-2V2',
          billingAddress: '12 Bd de la République, Dakar Plateau',
          lines: {
            create: [
              {
                dateLabel: '23/05 - 27/05',
                description: 'Hébergement Suite Panoramique (Ch. 301)',
                subDescription: 'Vue dégagée sur jardin arboré, terrasse privée & petit-déjeuner inclus',
                category: 'ROOM',
                quantity: 4,
                quantityLabel: '4 nuits',
                unitPriceFcfa: 150000,
                totalPriceFcfa: 600000,
              },
              {
                dateLabel: '24/05 13:40',
                description: "Restauration 'La Teranga' — Ticket #CMD-0428",
                subDescription: 'Thiéboudienne Royale, Thiof grillé, 2 Bissap, 1 Saloum Sunset',
                category: 'RESTAURANT',
                quantity: 1,
                quantityLabel: '1',
                unitPriceFcfa: 14500,
                totalPriceFcfa: 14500,
              },
              {
                dateLabel: '25/05 20:50',
                description: "Restauration 'La Teranga' — Dîner Grillades",
                subDescription: 'Thiéboudienne Penda Mbaye royale & Bouteille de vin rouge',
                category: 'RESTAURANT',
                quantity: 1,
                quantityLabel: '1',
                unitPriceFcfa: 38000,
                totalPriceFcfa: 38000,
              },
              {
                dateLabel: '23/05 16:15',
                description: 'Conciergerie — Navette VIP SUV DSS Aéroport A/R',
                subDescription: 'Transfert privé climatisé aéroport Blaise Diagne (AIBD - Thiès)',
                category: 'CONCIERGE',
                quantity: 1,
                quantityLabel: '1',
                unitPriceFcfa: 45000,
                totalPriceFcfa: 45000,
              },
              {
                dateLabel: '25/05 11:00',
                description: 'Housekeeping — Blanchisserie Express',
                subDescription: '2 chemises en lin, 1 pantalon blanc repassage doux',
                category: 'HOUSEKEEPING',
                quantity: 1,
                quantityLabel: '1 lot',
                unitPriceFcfa: 7500,
                totalPriceFcfa: 7500,
              },
              {
                dateLabel: '26/05 08:30',
                description: 'Excursion guidée — Forêt de Bandia & Manufacture des Arts de Thiès',
                subDescription: 'Mise à disposition véhicule avec chauffeur',
                category: 'CONCIERGE',
                quantity: 1,
                quantityLabel: '1',
                unitPriceFcfa: 75000,
                totalPriceFcfa: 75000,
              },
              {
                dateLabel: '27/05 08:00',
                description: 'Taxe Touristique de Séjour Réglementaire',
                subDescription: 'Barème légal République du Sénégal : 4 nuits x 2 adultes x 1 000 FCFA',
                category: 'TAX',
                quantity: 8,
                quantityLabel: '8 pax',
                unitPriceFcfa: 1000,
                totalPriceFcfa: 8000,
              },
            ],
          },
        },
      });
    }
  }

  // 8. Catégories et Produits du Restaurant « La Teranga »
  const categoriesSeed = [
    { name: 'Plats sénégalais & Mer', icon: 'dinner_dining', displayOrder: 1 },
    { name: 'Boissons & Cocktails', icon: 'local_bar', displayOrder: 2 },
    { name: 'Desserts Teranga', icon: 'icecream', displayOrder: 3 },
    { name: 'Petit-déjeuner', icon: 'bakery_dining', displayOrder: 4 },
    { name: 'Entrées & Tapas', icon: 'tapas', displayOrder: 5 },
  ];

  const catMap = new Map<string, string>();
  for (const c of categoriesSeed) {
    const saved = await customPrisma.restaurantCategory.upsert({
      where: { name: c.name },
      update: { icon: c.icon, displayOrder: c.displayOrder },
      create: c,
    });
    catMap.set(c.name, saved.id);
  }

  const productsSeed = [
    {
      name: 'Thiéboudienne Royale',
      description: 'Riz rouge traditionnel Penda Mbaye, mérou blanc frais, légumes mijotés & tamarin.',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 4500,
      tags: ['LOCAL_SPECIALTY'],
      allergens: ['FISH'],
      prepTimeMinutes: 25,
      prepStation: 'CUISINE',
      displayOrder: 1,
      status: 'AVAILABLE',
    },
    {
      name: 'Yassa Poulet Fermier',
      description: 'Poulet fermier mariné au citron vert de Casamance, oignons doux caramélisés et riz blanc parfumé.',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 4000,
      tags: ['POPULAR'],
      allergens: ['MUSTARD'],
      prepTimeMinutes: 20,
      prepStation: 'CUISINE',
      displayOrder: 2,
      status: 'AVAILABLE',
    },
    {
      name: 'Poisson Grillé du Jour',
      description: 'Thiof ou Capitaine au feu de bois, sauce braisée pimentée douce, accompagnement aloco & attiéké.',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 6000,
      tags: ['LOCAL_SPECIALTY'],
      allergens: ['FISH'],
      prepTimeMinutes: 30,
      prepStation: 'CUISINE',
      displayOrder: 3,
      status: 'SOLD_OUT',
    },
    {
      name: 'Jus de Bissap Maison',
      description: "Infusion fraîche de fleurs d'hibiscus bio, menthe du jardin et pointe de vanille bourbon.",
      categoryName: 'Boissons & Cocktails',
      priceFcfa: 1500,
      tags: ['POPULAR'],
      allergens: [],
      prepTimeMinutes: 5,
      prepStation: 'BAR',
      displayOrder: 4,
      status: 'AVAILABLE',
    },
    {
      name: 'Mafé de Bœuf Fondant',
      description: "Sauce pâte d'arachide onctueuse, mijoté de bœuf tendre, légumes du potager et riz brisé.",
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 4500,
      tags: [],
      allergens: ['PEANUT'],
      prepTimeMinutes: 25,
      prepStation: 'CUISINE',
      displayOrder: 5,
      status: 'AVAILABLE',
    },
    {
      name: 'Cocktail Saloum Sunset',
      description: 'Rhum ambré, purée de mangue fraîche, nectar de bouye (pain de singe) et infusion de citronnelle.',
      categoryName: 'Boissons & Cocktails',
      priceFcfa: 3500,
      tags: ['SIGNATURE_BAR'],
      allergens: [],
      prepTimeMinutes: 5,
      prepStation: 'BAR',
      displayOrder: 6,
      status: 'AVAILABLE',
    },
    {
      name: 'Crevettes Sautées à l’Ail',
      description: 'Gambas sautées persillade minute, frites croustillantes de patate douce et mayonnaise pimentée.',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 6500,
      tags: [],
      allergens: ['CRUSTACEAN', 'EGG'],
      prepTimeMinutes: 15,
      prepStation: 'CUISINE',
      displayOrder: 7,
      status: 'AVAILABLE',
    },
    {
      name: 'Thiakry & Mangue Rôtie',
      description: "Couscous de mil fin au yaourt onctueux parfumé à la muscade, fleur d'oranger et mangues caramélisées.",
      categoryName: 'Desserts Teranga',
      priceFcfa: 2500,
      tags: [],
      allergens: ['MILK'],
      prepTimeMinutes: 10,
      prepStation: 'PATISSERIE',
      displayOrder: 8,
      status: 'AVAILABLE',
    },
  ];

  for (const prod of productsSeed) {
    const categoryId = catMap.get(prod.categoryName)!;
    await customPrisma.restaurantProduct.upsert({
      where: { name: prod.name },
      update: {
        description: prod.description,
        categoryId,
        priceFcfa: prod.priceFcfa,
        tags: prod.tags,
        allergens: prod.allergens,
        prepTimeMinutes: prod.prepTimeMinutes,
        prepStation: prod.prepStation,
        displayOrder: prod.displayOrder,
        status: prod.status,
      },
      create: {
        name: prod.name,
        description: prod.description,
        categoryId,
        priceFcfa: prod.priceFcfa,
        tags: prod.tags,
        allergens: prod.allergens,
        prepTimeMinutes: prod.prepTimeMinutes,
        prepStation: prod.prepStation,
        availability: { type: 'ALWAYS' },
        options: [],
        vatRatePercent: 10,
        displayOrder: prod.displayOrder,
        status: prod.status,
      },
    });
  }

  // 8. Commande de démonstration du restaurant (idempotente)
  await customPrisma.restaurantOrder.deleteMany({
    where: { lines: { none: {} } },
  });
  const room102ForOrder = await customPrisma.room.findUnique({ where: { number: '102' } });
  const thiebProd = await customPrisma.restaurantProduct.findUnique({
    where: { name: 'Thiéboudienne Royale' },
  });
  const bissapProd = await customPrisma.restaurantProduct.findUnique({
    where: { name: 'Jus de Bissap Maison' },
  });
  if (thiebProd && bissapProd) {
    const existingSeedOrder = await customPrisma.restaurantOrder.findFirst({
      where: { ticketNumber: '#CMD-2026-0001' },
    });
    if (!existingSeedOrder) {
      await customPrisma.restaurantOrder.create({
        data: {
          ticketNumber: '#CMD-2026-0001',
          destinationType: 'ROOM',
          tableLabel: 'Ch. 102',
          roomId: room102ForOrder?.id || null,
          serverName: 'Moussa Fall',
          status: 'SENT_TO_KITCHEN',
          paymentMethod: 'ROOM_CHARGE',
          subtotalHtFcfa: 5455,
          vatAmountFcfa: 545,
          totalTtcFcfa: 6000,
          lines: {
            create: [
              {
                productId: thiebProd.id,
                name: thiebProd.name,
                quantity: 1,
                unitPriceFcfa: 4500,
                totalPriceFcfa: 4500,
                prepStation: 'CUISINE',
              },
              {
                productId: bissapProd.id,
                name: bissapProd.name,
                quantity: 1,
                unitPriceFcfa: 1500,
                totalPriceFcfa: 1500,
                prepStation: 'BAR',
              },
            ],
          },
        },
      });
    }
  }

  console.log('[SEED] Peuplement intégral de la base de test terminé avec succès.');
}

async function main() {
  try {
    await seedAll();
  } catch (error) {
    console.error('[SEED][ERREUR]', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  main();
}
