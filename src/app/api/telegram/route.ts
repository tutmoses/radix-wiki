// src/app/api/telegram/route.ts — User-facing Telegram link management

import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, requireAuth } from '@/lib/api';
import { VALID_EVENTS, type WebhookEvent } from '@/lib/webhooks';

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'RadixWikiBot';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const link = await prisma.telegramLink.findUnique({ where: { userId: auth.session.userId } });
    return json(link);
  }, 'Failed to get Telegram link');
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { events, tagPathFilter } = body as { events?: string[]; tagPathFilter?: string };

    // If already linked, just update events/filter
    const existing = await prisma.telegramLink.findUnique({ where: { userId: auth.session.userId } });
    if (existing) {
      if (events) {
        const invalid = events.filter((e) => !VALID_EVENTS.includes(e as WebhookEvent));
        if (invalid.length > 0) return errors.badRequest(`Invalid events: ${invalid.join(', ')}`);

        const updated = await prisma.telegramLink.update({
          where: { userId: auth.session.userId },
          data: { events, tagPathFilter: tagPathFilter ?? existing.tagPathFilter, active: true },
        });
        return json(updated);
      }
      return json(existing);
    }

    // Generate a link token
    const random = randomBytes(8).toString('hex');
    const token = `tg_${auth.session.userId}_${random}`;

    await prisma.challenge.create({
      data: {
        challenge: token,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;
    return json({ deepLink, token }, 201);
  }, 'Failed to manage Telegram link');
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    await prisma.telegramLink.deleteMany({ where: { userId: auth.session.userId } });
    return json({ success: true });
  }, 'Failed to disconnect Telegram');
}
