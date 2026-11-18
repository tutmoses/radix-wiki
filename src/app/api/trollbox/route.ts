// src/app/api/trollbox/route.ts – the trollbox: read the room, say a line.

import { NextRequest } from 'next/server';
import { errors, handleRoute, json } from 'wiki-formant/http';
import { clientKey, type RateLimitOptions } from 'wiki-formant/rate-limit';
import { overBudget, requireAuth } from '@/lib/api';
import { prisma } from '@/lib/prisma/client';
import { GatewayUnavailableError } from '@/lib/radix/gateway';
import { MAX_BODY } from '@/lib/trollbox';
import { BLOCKED, isPostable } from '@/lib/trollbox/blocklist';
import { HOLDER_XRD, latestId, mutedUntil, readMessage, readRoom, weightOf } from '@/lib/trollbox/server';

// A read is the same for every reader at the same cursor (nothing in it depends
// on who asks), so the CDN answers all of them from one function call. Two
// seconds is the delay that buys: an open room polls every four.
const READ_CACHE = { 'Cache-Control': 'public, s-maxage=2' };
const HEAD_CACHE = { 'Cache-Control': 'public, s-maxage=30' };

/** What any account may post: a burst of five, then a line every four seconds. */
const SAY: RateLimitOptions = { capacity: 5, refillPerSec: 1 / 4 };
/** Below the holder's bar an account costs nothing to make, so it posts slowly, and so does its address. */
const SAY_UNWEIGHTED: RateLimitOptions = { capacity: 3, refillPerSec: 1 / 20 };

/** A cursor from the query string: a whole number, or undefined. */
const cursor = (value: string | null) => (value !== null && /^\d{1,15}$/.test(value) ? Number(value) : undefined);

/**
 * GET /api/trollbox            the newest page
 * GET /api/trollbox?since=ID   lines after ID
 * GET /api/trollbox?before=ID  the page before ID
 * GET /api/trollbox?head       the newest line's id
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const params = request.nextUrl.searchParams;
    if (params.has('head')) return json({ latest: await latestId() }, { headers: HEAD_CACHE });
    return json(await readRoom({ since: cursor(params.get('since')), before: cursor(params.get('before')) }), { headers: READ_CACHE });
  }, 'The room could not be read');
}

/** The line as posted: line endings made one kind, blank runs cut to one, control characters dropped. */
function cleanBody(body: unknown): string {
  if (typeof body !== 'string') return '';
  return body.replace(/\r\n?/g, '\n').replace(/[^\P{Cc}\n]/gu, '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;
    const { userId } = auth.session;
    const limited = overBudget(`chat:${userId}`, SAY);
    if (limited) return limited;

    const body = cleanBody((await request.json().catch(() => ({})) as { body?: unknown }).body);
    if (!body) return errors.badRequest('Say something first.');
    if (body.length > MAX_BODY) return errors.badRequest(`A line is at most ${MAX_BODY} characters.`);
    if (!isPostable(body)) return errors.badRequest(BLOCKED);

    let weight: number;
    try {
      weight = await weightOf(userId);
    } catch (error) {
      if (!(error instanceof GatewayUnavailableError)) throw error;
      return json({ error: 'Your wallet could not be read just now: the Radix Gateway is not answering. Try again shortly.' }, 503);
    }
    if (weight < HOLDER_XRD) {
      const slow = overBudget(`chat-slow:${userId}`, SAY_UNWEIGHTED) ?? overBudget(clientKey('chat-slow', request.headers), SAY_UNWEIGHTED);
      if (slow) return slow;
    }

    const muted = await mutedUntil(userId);
    if (muted) return errors.forbidden(`Holders collapsed three of your lines in a day, so you cannot post until ${muted.toISOString().slice(0, 16).replace('T', ' ')} UTC.`);

    const { id } = await prisma.chatMessage.create({ data: { authorId: userId, body, authorWeight: weight }, select: { id: true } });
    return json({ message: await readMessage(id) }, 201);
  }, 'Your line was not posted');
}
