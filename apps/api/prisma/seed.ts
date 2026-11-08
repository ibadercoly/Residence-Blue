import process from 'process';
import { PrismaClient, RoomStatus } from '@prisma/client';
import { SEED_ROOM_TYPES, SEED_ROOMS } from '@residence-blue/shared';

const prisma = new PrismaClient();

export async function seedRooms() {
  console.log('[SEED] Début du peuplement des types de chambres et des 12 chambres...');

  // 1. Création ou mise à jour des types de chambres avec tarifs stricts en FCFA
  const typeMap = new Map<string, string>();
  for (const typeData of SEED_ROOM_TYPES) {
    const roomType = await prisma.roomType.upsert({
      where: { name: typeData.name },
      update: { pricePerNight: typeData.pricePerNight },
      create: {
        name: typeData.name,
        pricePerNight: typeData.pricePerNight,
      },
    });
    typeMap.set(typeData.name, roomType.id);
    console.log(`[SEED] Catégorie ${roomType.name} : ${roomType.pricePerNight} FCFA / nuit (ID: ${roomType.id})`);
  }

  // 2. Création ou mise à jour des 12 chambres
  for (const roomData of SEED_ROOMS) {
    const typeId = typeMap.get(roomData.typeName);
    if (!typeId) {
      throw new Error(`Type de chambre introuvable pour ${roomData.typeName}`);
    }

    const room = await prisma.room.upsert({
      where: { number: roomData.number },
      update: {
        typeId,
        floor: roomData.floor,
        amenities: roomData.amenities,
      },
      create: {
        number: roomData.number,
        typeId,
        floor: roomData.floor,
        status: RoomStatus.FREE,
        amenities: roomData.amenities,
      },
    });
    console.log(`[SEED] Chambre ${room.number} (Étage ${room.floor}) -> Statut : ${room.status}`);
  }

  console.log('[SEED] Peuplement des 12 chambres achevé avec succès.');
}

async function main() {
  try {
    await seedRooms();
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
