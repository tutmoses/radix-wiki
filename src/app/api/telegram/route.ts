// src/app/api/telegram/route.ts — Telegram link + subscription management

import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute } from 'wiki-formant/http';
import { clientKey } from 'wiki-formant/rate-limit';
import { IP_LIMITS, overBudget, requireAuth } from '@/lib/api';
import { VALID_EVENTS, type WebhookEvent } from '@/lib/webhooks';

const BOT_USERNAME = process.env.TELEGRAM_SUB_BOT_USERNAME;

// GET: return connection status + all subscriptions, each with `active` (false once /stop paused it)
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const links = await prisma.telegramLink.findMany({
      where: { userId: auth.session.userId },
      orderBy: { createdAt: 'desc' },
    });

    const connected = links.length > 0;
    const chatId = links[0]?.chatId ?? null;

    return json({ connected, chatId, subscriptions: links });
  }, 'Failed to get Telegram subscriptions');
}

// POST: an empty body asks for a connect link; a body naming `tagPath` adds a
// subscription, which needs the chat a connect link binds.
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;
    // Each call writes a link token or a subscription, for a wallet that costs nothing.
    const limited = overBudget(clientKey('telegram', request.headers), IP_LIMITS.settings);
    if (limited) return limited;

    const body = await request.json();
    const { tagPath, pageSlug, events } = body as {
      tagPath?: string;
      pageSlug?: string;
      events?: string[];
    };

    // Check if already connected (has any TelegramLink)
    const existing = await prisma.telegramLink.findFirst({
      where: { userId: auth.session.userId },
      select: { chatId: true },
    });

    // A subscription before a chat exists is refused, not answered with a connect
    // link: the caller asked to watch something and must not read a 201 as done.
    if (!existing && tagPath) {
      return json({ error: 'Telegram is not connected. POST an empty body for a connect link, then press Start in Telegram.', conflict: 'not-connected' }, 409);
    }

    // Not connected yet — generate deep link
    if (!existing) {
      const random = randomBytes(8).toString('hex');
      const token = `tg_${auth.session.userId}_${random}`;

      await prisma.challenge.create({
        data: {
          challenge: token,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;
      return json({ deepLink, token }, 201);
    }

    // Already connected — add a new subscription
    if (!tagPath) return errors.badRequest('tagPath is required for subscriptions');

    if (events) {
      const invalid = events.filter((e) => !VALID_EVENTS.includes(e as WebhookEvent));
      if (invalid.length > 0) return errors.badRequest(`Invalid events: ${invalid.join(', ')}`);
    }

    // The bot's /stop pauses every row of the chat and promises that subscribing
    // from any page resumes them, so a subscription resumes them all.
    await prisma.telegramLink.updateMany({ where: { userId: auth.session.userId, active: false }, data: { active: true } });
    const sub = await prisma.telegramLink.upsert({
      where: {
        userId_tagPath_pageSlug: {
          userId: auth.session.userId,
          tagPath,
          pageSlug: pageSlug || '',
        },
      },
      create: {
        userId: auth.session.userId,
        chatId: existing.chatId,
        tagPath,
        pageSlug: pageSlug || '',
        events: events ?? ['page.updated', 'comment.created'],
        active: true,
      },
      update: {
        events: events ?? undefined,
        active: true,
      },
    });

    return json(sub, 201);
  }, 'Failed to manage Telegram subscription');
}

// DELETE: disconnect entirely (remove all) or remove one subscription
export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const subId = searchParams.get('id');

    await prisma.telegramLink.deleteMany({ where: { userId: auth.session.userId, ...(subId ? { id: subId } : {}) } });

    return json({ success: true });
  }, 'Failed to delete Telegram subscription');
}
