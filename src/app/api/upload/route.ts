// src/app/api/upload/route.ts

import { NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { json, errors, handleRoute, requireAuth } from '@/lib/api';
import { standardizeImage, ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from '@/lib/images';

// sharp is a native module — this route must never be moved to the edge runtime.
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return errors.badRequest('No file provided');
    if (file.size > MAX_UPLOAD_BYTES) return errors.badRequest(`File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)`);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return errors.badRequest('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF');
    }

    // Every image is normalised to the standard here. This is the only route by
    // which an image enters the wiki, so nothing downstream has to cope with a
    // 4000px original — and a file we cannot decode is rejected rather than
    // stored as-is, since storing it is exactly how drift starts.
    let image;
    try {
      image = await standardizeImage(Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      return errors.badRequest(err instanceof Error ? err.message : 'Could not process this image');
    }

    const blob = await put(`${crypto.randomUUID()}.${image.extension}`, image.buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: image.contentType,
    });

    return json({ url: blob.url });
  }, 'Upload failed');
}
