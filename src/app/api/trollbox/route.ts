// src/app/api/trollbox/route.ts – the trollbox: read the room, say a line.

import { NextRequest, after } from 'next/server';
import { errors, handleRoute, json } from 'wiki-formant/http';
import { clientKey, type RateLimitOptions } from 'wiki-formant/rate-limit';
import { overBudget, requireAuth } from '@/lib/api';
import { prisma } from '@/lib/prisma/client';
import { GatewayUnavailableError } from '@/lib/radix/gateway';
import { MAX_BODY } from '@/lib/trollbox';
import { BLOCKED, isPostable } from '@/lib/trollbox/blocklist';
import { refsOf } from '@/lib/trollbox/refs';
import { HOLDER_XRD, latestId, mutedUntil, readMessage, readRoom, weightOf } from '@/lib/trollbox/server';
import type { NotificationType } from '@/types';

// A read is the same for every reader at the same cursor (nothing in it depends
// on who asks), so the CDN answers all of them from one function call. Two
// seconds is the delay that buys: an open room polls every four.
const READ_CACHE = { 'Cache-Control': 'public, s-maxage=2' };
const HEAD_CACHE = { 'Cache-Control': 'public, s-maxage=30' };

/** What any account may post: a burst of five, then a line every four seconds. */
const SAY: RateLimitOptions = { capacity: 5, refillPerSec: 1 / 4 };
/** Below the holder's bar an account costs nothing to make, so it posts slowly, and so does its address. */
const SAY_UNWEIGHTED: RateLimitOptions = { capacity: 3, refillPerSec: 1 / 20 };

/** A card's room from the query string or a body: a page id, or null for the wiki's own room. */
const roomOf = (value: unknown): string | null => (typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : null);

/** A cursor from the query string: a whole number, or undefined. */
const cursor = (value: string | null) => (value !== null && /^\d{1,15}$/.test(value) ? Number(value) : undefined);

/**
 * GET /api/trollbox            the newest page
 * GET /api/trollbox?since=ID   lines after ID
 * GET /api/trollbox?before=ID  the page before ID
 * GET /api/trollbox?head       the newest line's id
 * Each takes `page=PAGE_ID` for an Ideas card's room in place of the wiki's own.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const params = request.nextUrl.searchParams;
    if (params.has('head')) return json({ latest: await latestId() }, { headers: HEAD_CACHE });
    return json(await readRoom({ pageId: roomOf(params.get('page')), since: cursor(params.get('since')), before: cursor(params.get('before')) }), { headers: READ_CACHE });
  }, 'The room could not be read');
}

/** The line as posted: line endings made one kind, blank runs cut to one, control characters dropped. */
function cleanBody(body: unknown): string {
  if (typeof body !== 'string') return '';
  return body.replace(/\r\n?/g, '\n').replace(/[^\P{Cc}\n]/gu, '').replace(/\n{3,}/g, '\n\n').trim();
}

// A picture is one the wiki's own upload stored: the Blob store's host, named by the store's id.
const BLOB_HOST = `${(process.env.BLOB_STORE_ID ?? '').replace(/^store_/, '').toLowerCase()}.public.blob.vercel-storage.com`;
const ownPicture = (image: unknown): image is string => {
  if (typeof image !== 'string' || image.length > 300) return false;
  try {
    const url = new URL(image);
    return url.protocol === 'https:' && url.hostname === BLOB_HOST;
  } catch {
    return false;
  }
};

/**
 * POST /api/trollbox { body, image?, replyTo?, mentions?, page? }
 * `image` is a URL /api/upload answered, `replyTo` a line's id, `mentions` the
 * ids of the accounts the body names as `@name`, `page` the Ideas card whose
 * room the line is for.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;
    const { userId } = auth.session;
    const limited = overBudget(`chat:${userId}`, SAY);
    if (limited) return limited;

    const sent = await request.json().catch(() => ({})) as { body?: unknown; image?: unknown; replyTo?: unknown; mentions?: unknown; page?: unknown };
    // Only an Ideas card has a room of its own.
    const pageId = roomOf(sent.page);
    if (pageId && !await prisma.wikiPage.count({ where: { id: pageId, tagPath: { startsWith: 'ideas' } } })) return errors.badRequest('That page has no room.');
    const body = cleanBody(sent.body);
    const image = sent.image == null ? null : sent.image;
    if (image !== null && !ownPicture(image)) return errors.badRequest('A picture is posted by uploading it here.');
    if (!body && !image) return errors.badRequest('Say something first.');
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

    // A picture is stored and served by the wiki, so it needs a holder's wallet behind it.
    if (image && weight < HOLDER_XRD) {
      return errors.forbidden(`Posting a picture needs a wallet holding ${HOLDER_XRD.toLocaleString('en')} $XRD, staked $XRD included.`);
    }

    const muted = await mutedUntil(userId);
    if (muted) return errors.forbidden(`Holders collapsed three of your lines in a day, so you cannot post until ${muted.toISOString().slice(0, 16).replace('T', ' ')} UTC.`);

    const parent = typeof sent.replyTo === 'number' && Number.isInteger(sent.replyTo)
      ? await prisma.chatMessage.findFirst({ where: { id: sent.replyTo, pageId, deletedAt: null }, select: { id: true, authorId: true } })
      : null;
    const refs = await refsOf(body, sent.mentions);
    const { id } = await prisma.chatMessage.create({
      data: { authorId: userId, body, image, replyToId: parent?.id, refs, authorWeight: weight, pageId },
      select: { id: true },
    });

    // The author of the line answered, then everyone named: one notification each, and none to oneself.
    const told = new Map<string, NotificationType>();
    for (const ref of refs) if (ref.kind === 'user') told.set(ref.id, 'chat_mention');
    if (parent) told.set(parent.authorId, 'chat_reply');
    told.delete(userId);
    if (told.size) {
      after(() => prisma.notification.createMany({
        // A card's line names the card too, so the notification opens it there.
        data: [...told].map(([to, type]) => ({ userId: to, actorId: userId, type, chatMessageId: id, pageId })),
      }).catch(() => { /* a notification is a courtesy: the line is posted either way */ }));
    }
    return json({ message: await readMessage(id) }, 201);
  }, 'Your line was not posted');
}
