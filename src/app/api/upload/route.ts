// src/app/api/upload/route.ts
//
// The only route by which an image enters the wiki, so every image is brought
// to the wiki's standard here: at most 1600px wide (2x the ~800px prose column)
// and WebP, at q90 for PNG sources, which are usually screenshots or diagrams
// whose text smears lower, and q80 for photographs.
// scripts/standardize-images.mjs applies the same rules to images already stored.

import { uploadHandler } from 'wiki-formant/upload';
import { requireAuth } from '@/lib/api';

// sharp is a native module — this route must never be moved to the edge runtime.
export const runtime = 'nodejs';

export const POST = uploadHandler({
  authorize: async request => {
    const auth = await requireAuth(request);
    return 'error' in auth ? auth.error : auth.session.userId;
  },
  // Generous because the output is re-encoded down anyway.
  maxBytes: 25 * 1024 * 1024,
  encode: (image, { format, width }) => ({
    image: (width > 1600 ? image.resize({ width: 1600 }) : image).webp({ quality: format === 'png' ? 90 : 80, effort: 6 }),
    format: 'webp',
  }),
});
