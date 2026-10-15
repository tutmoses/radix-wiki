// src/app/api/auth/challenge/route.ts

import { clientKey } from 'wiki-formant/rate-limit';
import { generateChallenge } from '@/lib/auth';
import { IP_LIMITS, overBudget } from '@/lib/api';
import { json, handleRoute } from 'wiki-formant/http';

export async function GET(request: Request) {
  return handleRoute(async () => {
    // Every call writes a row, and it is the one write that asks for nothing.
    const limited = overBudget(clientKey('challenge', request.headers), IP_LIMITS.challenge);
    if (limited) return limited;
    const { challenge, expiresAt } = await generateChallenge();
    return json({ challenge, expiresAt: expiresAt.toISOString() });
  }, 'Challenge generation error');
}
