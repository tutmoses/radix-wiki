// src/lib/upload.ts
//
// The only way an image enters the wiki, so every image is brought to the
// wiki's standard here: at most 1600px wide (2x the ~800px prose column) and
// WebP, at q90 for PNG sources, which are usually screenshots or diagrams whose
// text smears lower, and q80 for photographs.
//
// /api/upload serves it, and the upload_image tool calls it in-process with the
// agent's own request headers, so its per-IP limit counts the agent rather than
// the server forwarding for every agent at once.

import { uploadHandler } from 'wiki-formant/upload';
import { requireAuth, UPLOAD } from '@/lib/api';

export const uploadImage = uploadHandler({
  authorize: async request => {
    const auth = await requireAuth(request);
    return 'error' in auth ? auth.error : auth.session.userId;
  },
  maxBytes: UPLOAD.maxBytes,
  encode: (image, { format, width }) => ({
    image: (width > UPLOAD.maxWidth ? image.resize({ width: UPLOAD.maxWidth }) : image).webp({ quality: format === 'png' ? 90 : 80, effort: 6 }),
    format: 'webp',
  }),
});
