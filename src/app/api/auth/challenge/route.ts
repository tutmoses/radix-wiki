// src/app/api/auth/challenge/route.ts

import { generateChallenge } from '@/lib/auth';
import { json, handleRoute } from '@/lib/api';

export async function GET() {
  return handleRoute(async () => {
    const { challenge, expiresAt } = await generateChallenge();
    return json({ challenge, expiresAt: expiresAt.toISOString() });
  }, 'Challenge generation error');
}
