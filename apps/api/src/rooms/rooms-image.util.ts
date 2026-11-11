import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export const MAX_ROOM_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo strict

export interface UploadedImageFile {
  fieldname?: string;
  originalname?: string;
  encoding?: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
}

export function getUploadsDir(): string {
  const dir = path.resolve(process.env.MEDIA_DIR || 'uploads/rooms');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export type AllowedImageFormat = 'jpeg' | 'png' | 'webp';

/**
 * Valide les magic bytes (signature binaire réelle) et la taille du fichier.
 */
export function detectAndValidateImage(buffer: Buffer): { format: AllowedImageFormat; extension: string } {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException("Aucune donnée binaire d'image reçue.");
  }

  if (buffer.length > MAX_ROOM_IMAGE_SIZE_BYTES) {
    throw new BadRequestException('Le fichier dépasse la taille maximale autorisée de 2 Mo.');
  }

  // 1. JPEG : FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { format: 'jpeg', extension: '.jpg' };
  }

  // 2. PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { format: 'png', extension: '.png' };
  }

  // 3. WebP : 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { format: 'webp', extension: '.webp' };
  }

  throw new BadRequestException(
    "Format d'image non reconnu. Seuls les formats JPEG, PNG et WebP réels sont acceptés.",
  );
}

/**
 * Enregistre une image avec un nom cryptographique unique (UUID v4).
 * Ne jamais utiliser le numéro de chambre seul comme nom de fichier.
 */
export function saveRoomImageFile(buffer: Buffer): { filename: string; url: string; filePath: string } {
  const { extension } = detectAndValidateImage(buffer);
  const dir = getUploadsDir();
  const filename = `${randomUUID()}${extension}`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, buffer);

  return {
    filename,
    url: `/api/rooms/images/${filename}`,
    filePath,
  };
}

/**
 * Supprime un fichier image du disque sans erreur s'il est absent.
 */
export function deleteRoomImageFile(urlOrPath?: string | null): void {
  if (!urlOrPath) return;

  try {
    const filename = path.basename(urlOrPath.split('?')[0]);
    // Vérification de sécurité : empêcher toute traversée de répertoire
    if (!/^[0-9a-fA-F-]{36}\.(webp|jpg|jpeg|png)$/.test(filename)) {
      return;
    }

    const dir = getUploadsDir();
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Suppression silencieuse et sécurisée
  }
}
