// src/app/api/challenge/route.ts

import { generateChallenge } from '@/lib/radix/rola';
import { success, serverError } from '@/lib/api/responses';

export async function POST() {
  try {
    const { challenge, expiresAt } = await generateChallenge();
    return success({ challenge, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    return serverError(error, 'Failed to generate challenge');
  }
}