// src/types/index.ts

import type { User, Page, Revision, Comment, Prisma } from '@prisma/client';

// Auth types
export interface AuthSession {
  userId: string;
  radixAddress: string;
  personaAddress?: string;
  displayName?: string;
  expiresAt: Date;
}

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

export interface SignedChallenge {
  challenge: string;
  address: string;
  proof: {
    publicKey: string;
    signature: string;
    curve: 'curve25519' | 'secp256k1';
  };
}

// Wiki types - derive from Prisma
export type WikiAuthor = Pick<User, 'id' | 'displayName' | 'radixAddress' | 'avatarUrl'>;

export type PageMetadata = Record<string, string>;

export type WikiPage = Omit<Page, 'content' | 'metadata'> & {
  content: Prisma.JsonValue;
  metadata?: PageMetadata | null;
  bannerImage?: string | null;
  version: string;
  author?: WikiAuthor;
  _count?: { revisions: number };
};

export type WikiPageInput = {
  slug?: string;
  title: string;
  content: Prisma.JsonValue;
  excerpt?: string;
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

export type AdjacentPage = { tagPath: string; slug: string; title: string } | null;
export type AdjacentPages = { prev: AdjacentPage; next: AdjacentPage };