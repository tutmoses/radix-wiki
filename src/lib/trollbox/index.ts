// src/lib/trollbox/index.ts – the trollbox's wire types and limits, shared by its routes and the room.
//
// The trollbox is the wiki's one public room: flat, newest at the foot, open to
// read without an account. Its shape is caper's (`caper/src/domains/trollbox`);
// what differs is the weight behind its moderation, which here is $XRD held.

/**
 * Where a line stands. Only a live line carries its body: a collapsed one is
 * withheld by the server rather than sent and styled away.
 *   hidden:    collapsed by holders' flags. A signed-in reader may ask for it back.
 *   removed:   deleted by an admin, who may restore it.
 *   retracted: deleted by its own author.
 */
type Line =
  | { state: 'live'; body: string; image?: string; refs: Ref[] }
  | { state: 'hidden' }
  | { state: 'removed' }
  | { state: 'retracted' };

/**
 * Something a line's text names, with the text that stands for it: a tagged
 * page, as it was titled when the line was posted, or a mentioned account.
 */
export type Ref =
  | { kind: 'page'; match: string; path: string; title: string }
  | { kind: 'user'; match: string; id: string; name: string };

/**
 * What a poster is to the room: a holder of the $XRD the wiki asks of a
 * page's creator, a wallet below it, or a guest who signed in with a passkey. Never
 * an amount: the mark says which side of one line a wallet is on and no more.
 */
export type Standing = 'holder' | 'wallet' | 'guest';

export interface Message {
  id: number;
  author: { id: string; name: string; avatarUrl: string | null; standing: Standing };
  line: Line;
  /** The line this one answers: who said it and how it began, or no excerpt once it is no longer live. */
  replyTo?: { id: number; name: string; excerpt: string | null };
  /** How many holders have flagged it. A count only, never who. */
  flagCount: number;
  at: string;
}

/** One read of the room. Every reader at the same cursor gets the same one, which is what lets the CDN hold it. */
export interface Read {
  /** Lines past the cursor, oldest first; with no cursor, the newest `PAGE`. */
  messages: Message[];
  /** Lines whose state moved inside `CHANGE_WINDOW_MS`, as they stand now. */
  changed: Message[];
  /** Set on a read that pages back: whether older lines remain. */
  earlier?: boolean;
}

/** What the reader may do, asked once when the room opens. */
export interface Me {
  /** Holds the $XRD that flags and posts pictures. Null when the Gateway did not answer. */
  holder: boolean | null;
  admin: boolean;
  /** When a muted author may post again, as an ISO time. */
  mutedUntil: string | null;
}

export const MAX_BODY = 500;

/** How much of a line a reply to it quotes. */
export const EXCERPT = 80;

/** Lines in one page of scrollback. */
export const PAGE = 50;

/** How often an open room asks for new lines, and a closed one whether there are any. */
export const POLL_MS = 4_000;
export const HEAD_POLL_MS = 60_000;

/**
 * How long a moved line stays in every read. A room that was away for longer
 * (a hidden tab) reloads from the foot instead of trusting what it holds.
 */
export const CHANGE_WINDOW_MS = 10 * 60_000;

/** Where the browser keeps the newest line the reader has seen, and whether they left the room open. */
export const SEEN_KEY = 'trollbox:seen';
export const OPEN_KEY = 'trollbox:open';

/** The room's own page, where it is drawn in place and the dock stands down. */
export const ROOM_PATH = '/trollbox';

/** Storage a browser may refuse (private mode, a blocked site): the room works without it. */
export const recall = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
export const remember = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* not kept */ } };
