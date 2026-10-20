// src/app/api/upload/route.ts — the upload handler (@/lib/upload) as a route.

// sharp is a native module — this route must never be moved to the edge runtime.
export const runtime = 'nodejs';

export { uploadImage as POST } from '@/lib/upload';
