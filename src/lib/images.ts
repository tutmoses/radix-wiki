// src/lib/images.ts — the single definition of the wiki's image standard.
//
// Every image the wiki serves is normalised to this shape on the way in, so it
// cannot drift: no 9MB phone photograph, no 4000px screenshot, one format.
// scripts/standardize-images.mjs applies the same rules to images already stored.

import sharp from 'sharp';

/** Prose column is ~800px, so 2x covers retina without paying for more. */
export const MAX_WIDTH = 1600;

/** Photographs tolerate q80; PNG sources are usually screenshots or diagrams
 *  whose text smears below q90. */
export const QUALITY = { photo: 80, flat: 90 } as const;

/** Accepted uploads. SVG is excluded deliberately — it is executable markup. */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

/** Generous because the output is re-encoded down anyway; this only bounds what
 *  we are willing to pull into memory. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type StandardImage = { buffer: Buffer; contentType: 'image/webp'; extension: 'webp'; width: number; originalFormat: string };

/**
 * Normalise any accepted image to the standard: at most MAX_WIDTH wide, WebP,
 * animation preserved. Throws with a user-facing message if the bytes cannot be
 * decoded — callers should surface that rather than storing the original, since
 * storing it is exactly how drift happens.
 */
export async function standardizeImage(input: Buffer): Promise<StandardImage> {
  let meta;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new Error('Could not read this image. Try re-saving it as PNG or JPEG.');
  }
  if (!meta.width || !meta.height) throw new Error('Could not read this image. Try re-saving it as PNG or JPEG.');

  const animated = (meta.pages ?? 1) > 1;
  const pipeline = sharp(input, animated ? { animated: true } : undefined).rotate();
  if (meta.width > MAX_WIDTH) pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });

  const quality = meta.format === 'png' ? QUALITY.flat : QUALITY.photo;
  let buffer: Buffer;
  try {
    buffer = await pipeline.webp({ quality, effort: 6 }).toBuffer();
  } catch {
    // sharp's bundled libheif rejects many valid AVIFs at pixel-decode time even
    // though metadata() succeeded, so this is the common failure in practice.
    throw new Error('Could not decode this image (AVIF is often unsupported). Try uploading PNG or JPEG.');
  }

  return {
    buffer,
    contentType: 'image/webp',
    extension: 'webp',
    width: Math.min(meta.width, MAX_WIDTH),
    originalFormat: meta.format ?? 'unknown',
  };
}
