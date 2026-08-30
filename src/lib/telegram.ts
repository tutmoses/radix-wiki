// src/lib/telegram.ts — Telegram Bot API + delivery

import { prisma } from '@/lib/prisma/client';
import type { WebhookEvent } from '@/lib/webhooks';
import { pagePath, shortenAddress } from '@/lib/utils';

const BOT_TOKEN = process.env.TELEGRAM_SUB_BOT_TOKEN;

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

function formatMessage(
  event: WebhookEvent,
  page: { slug: string; title: string; tagPath: string; version: string },
  revision?: { changeType: string; message?: string | null; version: string } | null,
  actor?: { displayName?: string | null; address: string } | null,
  comment?: { id: string; content: string } | null,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
  const pageUrl = page.tagPath ? `${appUrl}${pagePath(page.tagPath, page.slug)}` : appUrl;
  const actorName = actor?.displayName || actor?.address?.slice(0, 16) || 'Someone';

  const icons: Record<WebhookEvent, string> = {
    'page.created': '📄',
    'page.updated': '📝',
    'page.deleted': '🗑',
    'comment.created': '💬',
  };
  const labels: Record<WebhookEvent, string> = {
    'page.created': 'New Page',
    'page.updated': 'Page Updated',
    'page.deleted': 'Page Deleted',
    'comment.created': 'New Comment',
  };

  const lines: string[] = [
    `${icons[event]} <b>${labels[event]}: ${escapeHtml(page.title)}</b>`,
    '',
  ];

  if (page.tagPath) lines.push(`Section: ${page.tagPath}`);
  if (revision) lines.push(`Version: ${revision.version}`);
  lines.push(`By: ${escapeHtml(actorName)}`);

  if (comment) {
    lines.push('');
    lines.push(`"${escapeHtml(comment.content.slice(0, 200))}${comment.content.length > 200 ? '…' : ''}"`);
  }

  lines.push('');
  lines.push(`🔗 ${pageUrl}`);

  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

/** Check if a subscription matches the given page */
function matchesSubscription(
  sub: { tagPath: string; pageSlug: string },
  page: { tagPath: string; slug: string },
): boolean {
  // Connection-only record (empty tagPath) — don't match any pages
  if (!sub.tagPath) return false;
  // Page-specific subscription: match exact tagPath + slug
  if (sub.pageSlug) {
    return sub.tagPath === page.tagPath && sub.pageSlug === page.slug;
  }
  // Section subscription: match tagPath prefix (includes exact match)
  return page.tagPath === sub.tagPath || page.tagPath.startsWith(sub.tagPath + '/');
}

export function deliverTelegram(
  event: WebhookEvent,
  page: { slug: string; title: string; tagPath: string; version: string },
  revision?: { changeType: string; message?: string | null; version: string } | null,
  actor?: { displayName?: string | null; radixAddress: string } | null,
  comment?: { id: string; content: string; parentId?: string | null } | null,
): void {
  if (!BOT_TOKEN) return;
  _deliverTelegram(event, page, revision, actor, comment).catch((err) => {
    console.error('Telegram delivery error:', err);
  });
}

async function _deliverTelegram(
  event: WebhookEvent,
  page: { slug: string; title: string; tagPath: string; version: string },
  revision?: { changeType: string; message?: string | null; version: string } | null,
  actor?: { displayName?: string | null; radixAddress: string } | null,
  comment?: { id: string; content: string; parentId?: string | null } | null,
): Promise<void> {
  const links = await prisma.telegramLink.findMany({
    where: { active: true, events: { has: event } },
  });

  const matching = links.filter((l) => matchesSubscription(l, page));

  if (matching.length === 0) return;

  // Deduplicate by chatId — a user may have multiple matching subs (page + section)
  const uniqueChats = [...new Set(matching.map((l) => l.chatId))];

  const actorForFormat = actor ? { displayName: actor.displayName, address: shortenAddress(actor.radixAddress) } : null;
  const text = formatMessage(event, page, revision, actorForFormat, comment);

  await Promise.allSettled(
    uniqueChats.map((chatId) => sendMessage(chatId, text)),
  );
}
