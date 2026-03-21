// src/app/api/webhooks/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, requireAuth } from '@/lib/api';
import { generateWebhookSecret, VALID_EVENTS, type WebhookEvent } from '@/lib/webhooks';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const webhooks = await prisma.webhook.findMany({
      where: { userId: auth.session.userId },
      orderBy: { createdAt: 'desc' },
    });

    return json(
      webhooks.map((w) => ({
        ...w,
        secret: `...${w.secret.slice(-8)}`,
      })),
    );
  }, 'Failed to list webhooks');
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { url, events, tagPathFilter } = body as {
      url?: string;
      events?: string[];
      tagPathFilter?: string;
    };

    if (!url || !url.startsWith('https://')) {
      return errors.badRequest('url must be a valid HTTPS URL');
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return errors.badRequest('events must be a non-empty array');
    }

    const invalidEvents = events.filter((e) => !VALID_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return errors.badRequest(`Invalid events: ${invalidEvents.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`);
    }

    const count = await prisma.webhook.count({ where: { userId: auth.session.userId } });
    if (count >= 10) {
      return errors.badRequest('Maximum 10 webhooks per user');
    }

    const webhook = await prisma.webhook.create({
      data: {
        userId: auth.session.userId,
        url,
        secret: generateWebhookSecret(),
        events,
        tagPathFilter: tagPathFilter || null,
      },
    });

    return json(webhook, 201);
  }, 'Failed to create webhook');
}
