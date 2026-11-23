// src/lib/trollbox/server.ts – the trollbox's reads, and the weighted flags that moderate it.

import { prisma } from '@/lib/prisma/client';
import { xrdWeight } from '@/lib/radix/weight';
import { getXrdRequired } from '@/lib/tags';
import { CHANGE_WINDOW_MS, EXCERPT, PAGE, type Message, type Read, type Ref, type Standing } from '.';
import { plainText } from './refs';

/**
 * The $XRD, liquid and staked, that makes a wallet a holder in a room: the
 * same the wiki asks of someone creating a page. A holder's flag counts, their
 * name carries the mark and they post at the room's pace. Below it a wallet is
 * as free to make as a passkey account, and is treated as one.
 */
export const HOLDER_XRD = getXrdRequired('create', '');

// --- Weighted moderation ---
//
// Nobody staffs the room. Holders collapse a line with what they hold, and what
// its author holds resists: a line falls only when the room outweighs the
// person who wrote it.

/**
 * The flag weight that collapses a line, and the ceiling on the shield a
 * poster's own weight gives them: a poster's $XRD raises the bar against them,
 * up to double.
 *
 * Measured across the wiki's 59 readable wallet accounts on 18 November 2026:
 * 34 held 10,000 $XRD or more, the median among those was 534,000, and 29 held
 * 100,000 or more. So about half the holders can supply this bar alone beside
 * two others, three holders at the minimum cannot take down a line between
 * them, and nobody's weight puts a line out of the room's reach. Measure again
 * rather than inheriting it: it is a fact about who has signed in.
 */
const FLAG_HIDE = 100_000;

/** Holders required whatever the weight behind them, so no single holder collapses a line alone. */
const FLAG_FLOOR = 3;

/** Collapsed lines inside the window that cost an author their voice. */
const MUTE_AFTER = 3;

/** How far back that count looks, and so how long a mute lasts: the oldest collapse ages out. */
const MUTE_WINDOW_MS = 24 * 60 * 60 * 1000;

const ROW = {
  select: {
    id: true,
    body: true,
    image: true,
    refs: true,
    authorWeight: true,
    hiddenAt: true,
    deletedAt: true,
    retracted: true,
    createdAt: true,
    author: { select: { id: true, displayName: true, shortAddress: true, avatarUrl: true } },
    replyTo: {
      select: { id: true, body: true, image: true, refs: true, hiddenAt: true, deletedAt: true, author: { select: { displayName: true, shortAddress: true } } },
    },
    _count: { select: { flags: true } },
  },
} as const;

type Row = Awaited<ReturnType<typeof prisma.chatMessage.findMany<typeof ROW>>>[number];

/** A row's stored refs. The column is JSON, and a row written before refs existed holds `{}`. */
const refsIn = (stored: unknown): Ref[] => (Array.isArray(stored) ? stored as Ref[] : []);

function toMessage(row: Row): Message {
  const standing: Standing = !row.author.shortAddress ? 'guest' : row.authorWeight >= HOLDER_XRD ? 'holder' : 'wallet';
  const parent = row.replyTo;
  return {
    id: row.id,
    author: { id: row.author.id, name: row.author.displayName || row.author.shortAddress, avatarUrl: row.author.avatarUrl, standing },
    line: row.deletedAt ? { state: row.retracted ? 'retracted' : 'removed' }
      : row.hiddenAt ? { state: 'hidden' }
      : { state: 'live', body: row.body, ...(row.image && { image: row.image }), refs: refsIn(row.refs) },
    ...(parent && {
      replyTo: {
        id: parent.id,
        name: parent.author.displayName || parent.author.shortAddress,
        // A collapsed or deleted line is quoted by nobody: its body is withheld here as everywhere.
        excerpt: parent.hiddenAt || parent.deletedAt ? null : plainText(parent.body, refsIn(parent.refs)).slice(0, EXCERPT) || (parent.image ? 'a picture' : ''),
      },
    }),
    flagCount: row._count.flags,
    at: row.createdAt.toISOString(),
  };
}

/** One line as it stands, or null. */
export async function readMessage(id: number): Promise<Message | null> {
  const row = await prisma.chatMessage.findUnique({ where: { id }, ...ROW });
  return row && toMessage(row);
}

/**
 * The room past `since`, or, with no cursor, its newest page; `before` pages
 * back from a line. Every read carries the lines whose state lately moved.
 * `pageId` names an Ideas card's room; null is the wiki's own.
 */
export async function readRoom({ pageId, since, before }: { pageId: string | null; since?: number; before?: number }): Promise<Read> {
  const changed = prisma.chatMessage.findMany({
    where: { pageId, moderatedAt: { gte: new Date(Date.now() - CHANGE_WINDOW_MS) } },
    orderBy: { id: 'asc' },
    take: 200,
    ...ROW,
  });
  if (since !== undefined) {
    const [rows, moved] = await Promise.all([
      prisma.chatMessage.findMany({ where: { pageId, id: { gt: since } }, orderBy: { id: 'asc' }, take: 200, ...ROW }),
      changed,
    ]);
    return { messages: rows.map(toMessage), changed: moved.map(toMessage) };
  }
  const [rows, moved] = await Promise.all([
    prisma.chatMessage.findMany({ where: before === undefined ? { pageId } : { pageId, id: { lt: before } }, orderBy: { id: 'desc' }, take: PAGE + 1, ...ROW }),
    changed,
  ]);
  return { messages: rows.slice(0, PAGE).reverse().map(toMessage), changed: moved.map(toMessage), earlier: rows.length > PAGE };
}

/** The newest line's id in the wiki's own room, 0 for an empty one: what a closed room polls to know there is something new. */
export async function latestId(): Promise<number> {
  return (await prisma.chatMessage.aggregate({ where: { pageId: null }, _max: { id: true } }))._max.id ?? 0;
}

/**
 * What an account weighs in the room: its wallet's $XRD, or 0 with no wallet.
 * Throws `GatewayUnavailableError` when a wallet could not be read.
 */
export async function weightOf(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { radixAddress: true } });
  return user?.radixAddress ? xrdWeight(user.radixAddress) : 0;
}

/**
 * Whether a line's flags now collapse it, with each flag weighed against what
 * its holder has left.
 *
 * A flag counts for the lesser of its holder's $XRD when they flagged and now,
 * so $XRD moved on to a second wallet does not flag twice, and one that falls
 * below the holder's bar stops counting toward the floor. The shield clamps the
 * same way: flag counts are public, so an author can watch a collapse coming,
 * and can neither buy a shield after the fact nor keep one after the $XRD that
 * earned it has left.
 *
 * Any read the Gateway does not answer leaves the line up: a line taken down on
 * an unread weight is taken down by an outage. The next flag folds again.
 */
export async function flagsCollapse(messageId: number): Promise<boolean> {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { authorId: true, authorWeight: true, clearedAt: true, flags: { select: { userId: true, weight: true } } },
  });
  // An admin's restore is final, and the flags that carried the line over the bar outlive it.
  if (!message || message.clearedAt || message.flags.length < FLAG_FLOOR) return false;

  let author: number;
  let now: number[];
  try {
    [author, ...now] = await Promise.all([weightOf(message.authorId), ...message.flags.map(f => weightOf(f.userId))]);
  } catch {
    return false;
  }
  const counted = message.flags.map((f, i) => Math.min(f.weight, now[i]!)).filter(w => w >= HOLDER_XRD);
  const shield = Math.min(message.authorWeight, author, FLAG_HIDE);
  return counted.length >= FLAG_FLOOR && counted.reduce((sum, w) => sum + w, 0) >= FLAG_HIDE + shield;
}

/**
 * When an author may post again, or null when they may now. Derived from the
 * rows: no column to expire, and an admin's restore un-counts a collapse for free.
 */
export async function mutedUntil(authorId: string): Promise<Date | null> {
  const hidden = await prisma.chatMessage.findMany({
    where: { authorId, hiddenAt: { gte: new Date(Date.now() - MUTE_WINDOW_MS) } },
    orderBy: { hiddenAt: 'asc' },
    select: { hiddenAt: true },
  });
  // The collapse whose ageing out drops the count back under the bar.
  const releases = hidden.length < MUTE_AFTER ? null : hidden[hidden.length - MUTE_AFTER]?.hiddenAt;
  return releases ? new Date(releases.getTime() + MUTE_WINDOW_MS) : null;
}
