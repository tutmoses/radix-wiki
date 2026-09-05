// src/types/index.ts

import type { User, Page, Revision, Comment, Notification, Prisma } from '@prisma/client';

// Auth types. The session and the wallet proof are shaped by the stack that
// produces them, which is now `wiki-formant/rola`; re-exported here so the rest
// of the app keeps importing its types from one place.
export type { AuthSession, SignedChallenge } from 'wiki-formant/rola';

export interface RadixPersona {
  identityAddress: string;
  label?: string;
}

export interface RadixAccount {
  address: string;
  label?: string;
  appearanceId?: number;
}

export interface RadixWalletData {
  persona?: RadixPersona;
  accounts: RadixAccount[];
}

// Wiki types - derive from Prisma. `shortAddress` is the computed display-safe
// truncation from the Prisma client extension; full addresses never reach clients.
type WikiAuthor = Pick<User, 'id' | 'displayName' | 'avatarUrl'> & { shortAddress: string };

export type PageMetadata = Record<string, string>;

export type WikiPage = Omit<Page, 'content' | 'metadata'> & {
  content: Prisma.JsonValue;
  metadata?: PageMetadata | null;
  bannerImage?: string | null;
  version: string;
  author?: WikiAuthor;
  _count?: { revisions: number };
  /** Set on list rows, where it stands in for `content` (which they null out). */
  snippet?: string | null;
};

export type WikiPageInput = {
  slug?: string;
  title: string;
  content: Prisma.JsonValue;
  bannerImage?: string;
  tagPath: string;
  metadata?: PageMetadata;
};

export type WikiComment = Comment & {
  author?: WikiAuthor;
  replies?: WikiComment[];
};

export type CommentInput = {
  content: string;
  parentId?: string;
};

export type IdeasPage = WikiPage & {
  replyCount: number;
  lastActivity: Date;
};


export type WikiNotification = Notification & {
  actor: WikiAuthor;
  page: Pick<Page, 'id' | 'title' | 'tagPath' | 'slug'>;
};