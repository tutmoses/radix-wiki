// src/app/api/trollbox/[id]/route.ts – what is done to one line: flag it, show it, restore it, delete it.

import { NextRequest } from 'next/server';
import { errors, handleRoute, json } from 'wiki-formant/http';
import type { RateLimitOptions } from 'wiki-formant/rate-limit';
import { gate } from '@/lib/admin';
import { overBudget, requireAuth, type RouteContext } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma/client';
import { GatewayUnavailableError } from '@/lib/radix/gateway';
import { flagsCollapse, HOLDER_XRD, readMessage, weightOf } from '@/lib/trollbox/server';

type Ctx = RouteContext<{ id: string }>;

const ACT: RateLimitOptions = { capacity: 30, refillPerSec: 1 };

const lineId = async ({ params }: Ctx) => {
  const { id } = await params;
  return /^\d{1,15}$/.test(id) ? Number(id) : null;
};

/**
 * POST /api/trollbox/ID { action }
 *   flag:    a holder's flag. Answers the count and whether the line collapsed.
 *   reveal:  the body of a collapsed line, for a signed-in reader who asks.
 *   restore: an admin puts back a collapsed or removed line.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    const id = await lineId(ctx);
    if (id === null) return errors.notFound();
    const { action } = await request.json().catch(() => ({})) as { action?: unknown };

    if (action === 'restore') {
      if (!await gate.allows(request)) return errors.forbidden('Only an admin restores a line.');
      const line = await prisma.chatMessage.findUnique({ where: { id }, select: { hiddenAt: true, deletedAt: true, retracted: true } });
      if (!line) return errors.notFound();
      // A line its author took back is theirs to keep back.
      if (line.deletedAt && line.retracted) return errors.forbidden('Its author deleted this line.');
      await prisma.chatMessage.update({
        where: { id },
        data: { deletedAt: null, hiddenAt: null, moderatedAt: new Date(), ...(line.hiddenAt && { clearedAt: new Date() }) },
      });
      return json({ message: await readMessage(id) });
    }

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;
    const { userId } = auth.session;
    const limited = overBudget(`chat-act:${userId}`, ACT);
    if (limited) return limited;
    const line = await prisma.chatMessage.findUnique({ where: { id }, select: { authorId: true, body: true, hiddenAt: true, deletedAt: true, clearedAt: true } });
    if (!line || line.deletedAt) return errors.notFound();

    if (action === 'reveal') return line.hiddenAt ? json({ body: line.body }) : errors.badRequest('This line is not collapsed.');
    if (action !== 'flag') return errors.badRequest('Unknown action');

    if (line.authorId === userId) return errors.badRequest('You cannot flag your own line. Delete it instead.');
    if (line.hiddenAt) return errors.badRequest('This line is already collapsed.');
    if (line.clearedAt) return errors.forbidden('An admin restored this line, so it cannot be flagged again.');

    let weight: number;
    try {
      weight = await weightOf(userId);
    } catch (error) {
      if (!(error instanceof GatewayUnavailableError)) throw error;
      return json({ error: 'Your wallet could not be read just now: the Radix Gateway is not answering. Try again shortly.' }, 503);
    }
    if (weight < HOLDER_XRD) return errors.forbidden(`A flag is weighed by the $XRD behind it, staked $XRD included, and counts from ${HOLDER_XRD.toLocaleString('en')} $XRD.`);

    // One flag a holder a line, with no withdrawal: a second click is the first one again.
    await prisma.chatFlag.upsert({ where: { messageId_userId: { messageId: id, userId } }, create: { messageId: id, userId, weight }, update: {} });
    const hidden = await flagsCollapse(id);
    if (hidden) {
      const now = new Date();
      await prisma.chatMessage.updateMany({ where: { id, hiddenAt: null }, data: { hiddenAt: now, moderatedAt: now } });
    }
    return json({ flagCount: await prisma.chatFlag.count({ where: { messageId: id } }), hidden });
  }, 'That did not go through');
}

/** DELETE /api/trollbox/ID – an author takes their own line back, or an admin removes anyone's. */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return handleRoute(async () => {
    const id = await lineId(ctx);
    if (id === null) return errors.notFound();
    const [session, admin] = await Promise.all([getSession(request), gate.allows(request)]);
    if (!session && !admin) return errors.unauthorized();
    const line = await prisma.chatMessage.findUnique({ where: { id }, select: { authorId: true, deletedAt: true } });
    if (!line || line.deletedAt) return errors.notFound();
    const retracted = line.authorId === session?.userId;
    if (!retracted && !admin) return errors.forbidden('Only its author or an admin deletes a line.');
    const now = new Date();
    await prisma.chatMessage.update({ where: { id }, data: { deletedAt: now, moderatedAt: now, retracted } });
    return json({ message: await readMessage(id) });
  }, 'The line was not deleted');
}
