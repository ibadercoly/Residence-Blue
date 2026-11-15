import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo strict

export interface UploadedProductImageFile {
  fieldname?: string;
  originalname?: string;
  encoding?: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
}

export function getRestaurantUploadsDir(): string {
  const custom = process.env.RESTAURANT_MEDIA_DIR?.trim();
  const dir = custom
    ? path.resolve(custom)
    : path.resolve(process.env.MEDIA_DIR || 'uploads/rooms', '..', 'restaurant');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Valide les magic bytes (JPEG, PNG, WebP réels) et la taille ≤ 2 Mo.
 */
export function validateProductImageBuffer(buffer: Buffer): void {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException("Aucune donnée binaire d'image reçue.");
  }
  if (buffer.length > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    throw new BadRequestException('La photo dépasse la taille maximale autorisée de 2 Mo.');
  }

  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (!isJpeg && !isPng && !isWebp) {
    throw new BadRequestException(
      'Format non reconnu. Seuls JPEG, PNG et WebP valides (max 2 Mo) sont acceptés.',
    );
  }
}

/**
 * Enregistre la photo (réencodée sans EXIF) + sa miniature 200 px sous des UUID uniques.
 */
export async function saveProductImageAndThumb(buffer: Buffer): Promise<{
  photoUrl: string;
  thumbnailUrl: string;
  filename: string;
  thumbFilename: string;
}> {
  validateProductImageBuffer(buffer);

  const dir = getRestaurantUploadsDir();
  const baseUuid = randomUUID();
  const filename = `${baseUuid}.webp`;
  const thumbFilename = `${baseUuid}-200.webp`;
  const mainPath = path.join(dir, filename);
  const thumbPath = path.join(dir, thumbFilename);

  const sharpMod = await import('sharp');
  const sharpFn = (sharpMod as unknown as { default?: typeof sharpMod }).default ?? sharpMod;

  try {
    await (sharpFn as any)(buffer)
      .rotate()
      .resize({ width: 960, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(mainPath);

    await (sharpFn as any)(buffer)
      .rotate()
      .resize(200, 200, { fit: 'cover', position: 'center' })
      .webp({ quality: 82 })
      .toFile(thumbPath);
  } catch {
    safeUnlinkFile(mainPath);
    safeUnlinkFile(thumbPath);
    throw new BadRequestException("Impossible de décoder ou traiter cette image.");
  }

  return {
    filename,
    thumbFilename,
    photoUrl: `/api/restaurant/products/images/${filename}`,
    thumbnailUrl: `/api/restaurant/products/images/${thumbFilename}`,
  };
}

function safeUnlinkFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Suppression silencieuse
  }
}

/**
 * Supprime les anciennes images d'un produit en vérifiant strictement le format UUID du nom.
 */
export function deleteProductImageFiles(...urls: Array<string | null | undefined>): void {
  const dir = getRestaurantUploadsDir();
  for (const raw of urls) {
    if (!raw) continue;
    const filename = path.basename(raw.split('?')[0]);
    if (!/^[0-9a-fA-F-]{36}(-200)?\.(webp|jpg|jpeg|png)$/.test(filename)) {
      continue;
    }
    safeUnlinkFile(path.join(dir, filename));
  }
}
