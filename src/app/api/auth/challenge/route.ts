// src/app/api/auth/challenge/route.ts

import { generateChallenge } from '@/lib/auth';
import { json, handleRoute } from '@/lib/api';

export async function GET() {
  return handleRoute(async () => {
    const { challenge, expiresAt } = await generateChallenge();
    console.log('[AUTH CHALLENGE] Generated:', challenge.slice(0, 16) + '...', 'expires:', expiresAt.toISOString());
    return json({ challenge, expiresAt: expiresAt.toISOString() });
  }, 'Challenge generation error');
}
