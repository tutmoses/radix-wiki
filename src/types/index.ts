// src/types/index.ts

import type { User, Page, Revision } from '@prisma/client';
import type { BlockContent } from '@/lib/blocks';

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

export type WikiAuthor = Pick<User, 'id' | 'displayName' | 'radixAddress'>;

export interface WikiPage extends Omit<Page, 'content'> {
  content: BlockContent;
  author?: WikiAuthor;
  revisions?: Pick<Revision, 'id'>[];
  fullPath?: string;
  tagPath: string;
}

export interface WikiPageInput {
  slug?: string;
  title: string;
  content: BlockContent;
  excerpt?: string;
  isPublished?: boolean;
  tagPath: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}