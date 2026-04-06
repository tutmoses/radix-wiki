// src/lib/webhooks.ts — Webhook delivery

import { createHmac, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma/client';
import { deliverTelegram } from '@/lib/telegram';

export type WebhookEvent = 'page.created' | 'page.updated' | 'page.deleted' | 'comment.created';

export const VALID_EVENTS: WebhookEvent[] = ['page.created', 'page.updated', 'page.deleted', 'comment.created'];

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  page: {
    slug: string;
    title: string;
    tagPath: string;
    version: string;
    url: string;
  };
  revision?: { changeType: string; message?: string | null; version: string };
  actor?: { displayName?: string | null; address: string };
  comment?: { id: string; content: string; parentId?: string | null };
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function deliverWebhooks(
  event: WebhookEvent,
  page: { slug: string; title: string; tagPath: string; version: string },
  revision?: { changeType: string; message?: string | null; version: string } | null,
  actor?: { displayName?: string | null; radixAddress: string } | null,
  comment?: { id: string; content: string; parentId?: string | null } | null,
): void {
  // Fire-and-forget — errors logged, never thrown to caller
  _deliver(event, page, revision, actor, comment).catch((err) => {
    console.error('Webhook delivery error:', err);
  });
  deliverTelegram(event, page, revision, actor, comment);
}

async function _deliver(
  event: WebhookEvent,
  page: { slug: string; title: string; tagPath: string; version: string },
  revision?: { changeType: string; message?: string | null; version: string } | null,
  actor?: { displayName?: string | null; radixAddress: string } | null,
  comment?: { id: string; content: string; parentId?: string | null } | null,
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { active: true, events: { has: event } },
  });

  const matching = webhooks.filter(
    (w) => !w.tagPathFilter || page.tagPath.startsWith(w.tagPathFilter),
  );

  if (matching.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
  const pageUrl = page.tagPath ? `${appUrl}/${page.tagPath}/${page.slug}` : appUrl;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    page: {
      slug: page.slug,
      title: page.title,
      tagPath: page.tagPath,
      version: page.version,
      url: pageUrl,
    },
    ...(revision && { revision }),
    ...(actor && { actor: { displayName: actor.displayName, address: actor.radixAddress } }),
    ...(comment && { comment }),
  };

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    matching.map((webhook) => {
      const signature = signPayload(body, webhook.secret);
      return fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body,
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.error(`Webhook ${webhook.id} delivery failed:`, err);
      });
    }),
  );
}
