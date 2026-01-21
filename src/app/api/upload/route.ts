// src/app/api/upload/route.ts

import { NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { json, errors, handleRoute, requireAuth } from '@/lib/api';

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return errors.badRequest('No file provided');

    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) return errors.badRequest('File too large (max 4MB)');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return errors.badRequest('Invalid file type. Allowed: JPEG, PNG, GIF, WebP');
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${crypto.randomUUID()}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    return json({ url: blob.url });
  }, 'Upload failed');
}