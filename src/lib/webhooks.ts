// src/lib/webhooks.ts — notification fan-out: HTTP webhooks and Telegram
//
// Both channels answer the same question ("what changed, on which page, by whom")
// and were answering it twice, through two entry points and five copies of the
// same parameter list. One `Notification` is built per change and handed to each.

import { createHmac, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma/client';
import { BASE_URL, pageUrl, shortenAddress } from '@/lib/utils';

export type WebhookEvent = 'page.created' | 'page.updated' | 'page.deleted' | 'comment.created';

/** Every event, with the icon and label a Telegram message leads with. */
const EVENTS: Record<WebhookEvent, [icon: string, label: string]> = {
  'page.created': ['📄', 'New Page'],
  'page.updated': ['📝', 'Page Updated'],
  'page.deleted': ['🗑', 'Page Deleted'],
  'comment.created': ['💬', 'New Comment'],
};

/** Subscribable events, derived so the accepted list cannot drift from the table. */
export const VALID_EVENTS = Object.keys(EVENTS) as WebhookEvent[];

const BOT_TOKEN = process.env.TELEGRAM_SUB_BOT_TOKEN;

interface Notification {
  event: WebhookEvent;
  page: { slug: string; title: string; tagPath: string; version: string };
  revision?: { changeType: string; message?: string | null; version: string } | null;
  actor?: { displayName?: string | null; radixAddress: string } | null;
  comment?: { id: string; content: string; parentId?: string | null } | null;
}

/** The homepage row carries no tag path, and its URL is the site root, not a path. */
const notificationUrl = (page: Notification['page']): string =>
  page.tagPath ? pageUrl(page.tagPath, page.slug) : BASE_URL;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * The one entry point for a notified change. Fire-and-forget on both channels —
 * errors are logged, never thrown to the caller, so a dead subscriber can never
 * fail a wiki write.
 */
export function deliverWebhooks(
  event: WebhookEvent,
  page: Notification['page'],
  revision?: Notification['revision'],
  actor?: Notification['actor'],
  comment?: Notification['comment'],
): void {
  const notification: Notification = { event, page, revision, actor, comment };
  deliverHttp(notification).catch((err) => console.error('Webhook delivery error:', err));
  if (BOT_TOKEN) deliverTelegram(notification).catch((err) => console.error('Telegram delivery error:', err));
}

// ---- HTTP webhooks ----

async function deliverHttp({ event, page, revision, actor, comment }: Notification): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { active: true, events: { has: event } },
  });

  const matching = webhooks.filter(
    (w) => !w.tagPathFilter || page.tagPath.startsWith(w.tagPathFilter),
  );

  if (matching.length === 0) return;

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    page: {
      slug: page.slug,
      title: page.title,
      tagPath: page.tagPath,
      version: page.version,
      url: notificationUrl(page),
    },
    ...(revision && { revision }),
    // External subscribers get the same truncated address the site shows.
    ...(actor && { actor: { displayName: actor.displayName, address: shortenAddress(actor.radixAddress) } }),
    ...(comment && { comment }),
  });

  await Promise.allSettled(
    matching.map((webhook) =>
      fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': createHmac('sha256', webhook.secret).update(body).digest('hex'),
          'X-Webhook-Event': event,
        },
        body,
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.error(`Webhook ${webhook.id} delivery failed:`, err);
      }),
    ),
  );
}

// ---- Telegram ----

async function telegramApi(method: string, body: Record<string, unknown>): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err) {
    console.error(`Telegram API ${method} failed:`, err);
    return false;
  }
}

export function sendMessage(chatId: string, text: string): Promise<boolean> {
  return telegramApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false });
}

function formatMessage({ event, page, revision, actor, comment }: Notification): string {
  const [icon, label] = EVENTS[event];
  const excerpt = comment
    ? `"${escapeHtml(comment.content.slice(0, 200))}${comment.content.length > 200 ? '…' : ''}"`
    : null;

  // Blank strings are the message's own spacing, so only nulls are dropped.
  return [
    `${icon} <b>${label}: ${escapeHtml(page.title)}</b>`,
    '',
    page.tagPath ? `Section: ${page.tagPath}` : null,
    revision ? `Version: ${revision.version}` : null,
    `By: ${escapeHtml(actor?.displayName || (actor && shortenAddress(actor.radixAddress)) || 'Someone')}`,
    ...(excerpt ? ['', excerpt] : []),
    '',
    `🔗 ${notificationUrl(page)}`,
  ].filter((line) => line !== null).join('\n');
}

/** A connection-only record (empty tagPath) matches nothing; a page subscription
 *  matches that page alone; a section subscription matches the tag path below it. */
function matchesSubscription(
  sub: { tagPath: string; pageSlug: string },
  page: { tagPath: string; slug: string },
): boolean {
  if (!sub.tagPath) return false;
  if (sub.pageSlug) return sub.tagPath === page.tagPath && sub.pageSlug === page.slug;
  return page.tagPath === sub.tagPath || page.tagPath.startsWith(sub.tagPath + '/');
}

async function deliverTelegram(notification: Notification): Promise<void> {
  const links = await prisma.telegramLink.findMany({
    where: { active: true, events: { has: notification.event } },
  });

  const matching = links.filter((l) => matchesSubscription(l, notification.page));
  if (matching.length === 0) return;

  const text = formatMessage(notification);
  // Deduplicate by chatId — a user may have multiple matching subs (page + section)
  await Promise.allSettled(
    [...new Set(matching.map((l) => l.chatId))].map((chatId) => sendMessage(chatId, text)),
  );
}

// ---- announcements ----

/**
 * An issue announcement, not a page-changed ping. Subscribers to `blog` were being
 * told "Page Updated: Radix Week in Review" with no excerpt and no reason to open
 * it; a publication announcement leads with what the issue says.
 */
export function formatAnnouncement(a: {
  title: string; url: string; excerpt?: string; kicker?: string; footer?: string;
}): string {
  const lines = [
    a.kicker ? `<b>${escapeHtml(a.kicker)}</b>` : null,
    `📰 <b>${escapeHtml(a.title)}</b>`,
    a.excerpt ? `\n${escapeHtml(a.excerpt)}` : null,
    a.footer ? `\n<i>${escapeHtml(a.footer)}</i>` : null,
    `\n🔗 ${a.url}`,
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Push one message to explicitly configured chats. Community channels are not
 * subscribers and never opt in through the bot, so the destinations are an env
 * allowlist and the bot has to already be a member with permission to post.
 */
export async function broadcast(chatIds: string[], text: string): Promise<{ chatId: string; ok: boolean }[]> {
  if (!BOT_TOKEN) return chatIds.map(chatId => ({ chatId, ok: false }));
  return Promise.all(chatIds.map(async chatId => ({ chatId, ok: await sendMessage(chatId, text) })));
}

/** Destinations for `broadcast`, comma-separated. Unset means the site announces
 *  to its own subscribers only, which is the safe default. */
export function broadcastChatIds(): string[] {
  return (process.env.TELEGRAM_BROADCAST_CHAT_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}
