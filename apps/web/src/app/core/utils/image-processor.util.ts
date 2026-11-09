/**
 * Utilitaire de traitement et de sécurisation des images dans le navigateur.
 * Respecte les exigences strictes de docs/security/envoi-fichiers.md :
 * - Vérification des signatures binaires réelles (Magic Bytes)
 * - Rejet catégorique des SVG, GIF, HEIC, PDF et autres formats suspects
 * - Plafond de taille (8 Mo) et dimensions max (6000x6000 px)
 * - Ré-encodage WebP via Canvas (suppression des métadonnées EXIF et GPS)
 * - Génération des variantes résolues (1600px, 800px, 400px)
 */

export interface ProcessedImageResult {
  fullDataUrl: string;       // WebP max 1600px
  mediumDataUrl: string;     // WebP 800px
  thumbnailDataUrl: string;  // WebP 400px
  fullBlob: Blob;
  format: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ImageValidationError {
  code:
    | 'FILE_TOO_LARGE'
    | 'INVALID_MAGIC_BYTES'
    | 'REJECTED_FORMAT'
    | 'DIMENSIONS_EXCEEDED'
    | 'CANVAS_PROCESSING_FAILED';
  message: string;
}

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo
export const MAX_DIMENSION_PX = 6000;

/**
 * Lit les premiers octets d'un ArrayBuffer et détecte le format réel via magic bytes.
 */
export function detectMagicBytes(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | 'gif' | 'pdf' | 'svg' | 'unknown' {
  if (bytes.length < 3) return 'unknown';

  // 1. JPEG : FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  // 2. PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }

  // 3. WebP : 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  // 4. GIF : 47 49 46 38 (GIF8)
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'gif';
  }

  // 5. PDF : 25 50 44 46 (%PDF)
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }

  // 6. SVG / XML (recherche textuelle sur les premiers octets)
  try {
    const headerStr = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.slice(0, 100))
      .trim()
      .toLowerCase();
    if (headerStr.startsWith('<svg') || headerStr.includes('<?xml') || headerStr.includes('<svg')) {
      return 'svg';
    }
  } catch {
    // ignoré
  }

  return 'unknown';
}

/**
 * Valide le fichier côté client avant tout traitement.
 */
export async function validateImageFile(file: File | Blob): Promise<{ valid: boolean; error?: ImageValidationError }> {
  // 1. Contrôle taille (8 Mo max)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `Le fichier est trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo). La taille maximale autorisée est de 8 Mo.`
      }
    };
  }

  // 2. Lecture des 64 premiers octets pour la signature binaire
  const headerSlice = await file.slice(0, 64).arrayBuffer();
  const bytes = new Uint8Array(headerSlice);
  const detected = detectMagicBytes(bytes);

  if (detected === 'gif') {
    return {
      valid: false,
      error: {
        code: 'REJECTED_FORMAT',
        message: 'Les GIF et GIF animés ne sont pas autorisés. Utilisez JPG, PNG ou WebP.'
      }
    };
  }

  if (detected === 'svg') {
    return {
      valid: false,
      error: {
        code: 'REJECTED_FORMAT',
        message: 'Les fichiers SVG sont strictement interdits pour des raisons de sécurité (scripts vectoriels). Utilisez JPG, PNG ou WebP.'
      }
    };
  }

  if (detected === 'pdf') {
    return {
      valid: false,
      error: {
        code: 'REJECTED_FORMAT',
        message: 'Les fichiers PDF ne sont pas autorisés comme photo de plat.'
      }
    };
  }

  if (detected !== 'jpeg' && detected !== 'png' && detected !== 'webp') {
    return {
      valid: false,
      error: {
        code: 'INVALID_MAGIC_BYTES',
        message: 'Format de fichier non reconnu. Seuls les formats JPG, PNG et WebP réels sont acceptés.'
      }
    };
  }

  return { valid: true };
}

/**
 * Redimensionne et ré-encode l'image via HTML Canvas en WebP (supprime automatiquement les EXIF).
 */
export async function processAndOptimizeImage(file: File | Blob): Promise<ProcessedImageResult> {
  const validation = await validateImageFile(file);
  if (!validation.valid || !validation.error) {
    // Si valide, continuer
  } else {
    throw new Error(validation.error.message);
  }

  // Charger l'image dans un élément Image
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Échec de la lecture locale de l'image."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("L'image est corrompue et n'a pas pu être décodée."));
    image.src = dataUrl;
  });

  // Contrôle des dimensions maximales (6000x6000)
  if (img.width > MAX_DIMENSION_PX || img.height > MAX_DIMENSION_PX) {
    throw new Error(
      `Dimensions excessives (${img.width}×${img.height} px). La dimension maximale acceptée est de 6000×6000 px.`
    );
  }

  // Génération des 3 variantes : 1600px (grand écran), 800px (catalogue standard), 400px (miniature tableau)
  const fullDataUrl = renderCanvasWebP(img, 1600, 0.85);
  const mediumDataUrl = renderCanvasWebP(img, 800, 0.80);
  const thumbnailDataUrl = renderCanvasWebP(img, 400, 0.75);

  const fullBlob = await (await fetch(fullDataUrl)).blob();

  return {
    fullDataUrl,
    mediumDataUrl,
    thumbnailDataUrl,
    fullBlob,
    format: 'image/webp',
    width: img.width,
    height: img.height,
    sizeBytes: fullBlob.size
  };
}

/**
 * Fonction interne de rendu sur Canvas HTML5 pour re-transcoder en WebP sans EXIF.
 */
function renderCanvasWebP(img: HTMLImageElement, maxDimension: number, quality: number): string {
  let targetWidth = img.width;
  let targetHeight = img.height;

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
      targetWidth = maxDimension;
    } else {
      targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
      targetHeight = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Le contexte graphique 2D du navigateur est indisponible.');
  }

  // Dessin sur canvas purifié (détruit les EXIF)
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Conversion en WebP (ou JPEG si non supporté)
  return canvas.toDataURL('image/webp', quality);
}
