// src/lib/utils.ts

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import { createElement, type ReactNode } from 'react';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function truncate(text: string, length: number): string {
  return text.length <= length ? text : text.slice(0, length).trim() + '...';
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...options });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d);
}

export function shortenAddress(address: string, chars: number = 6): string {
  return address.length <= chars * 2 ? address : `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Inline markdown parser - shared between Blocks and Discussion
const INLINE_MD_REGEX = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;

export function parseInlineMarkdown(text: string, withLinks = true): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0, key = 0, match;
  INLINE_MD_REGEX.lastIndex = 0;

  while ((match = INLINE_MD_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [full, , bold, italic, code, linkText, href] = match;
    if (bold) parts.push(createElement('strong', { key: key++ }, bold));
    else if (italic) parts.push(createElement('em', { key: key++ }, italic));
    else if (code) parts.push(createElement('code', { key: key++ }, code));
    else if (withLinks && linkText && href) {
      const isExternal = href.startsWith('http');
      parts.push(isExternal
        ? createElement('a', { key: key++, href, target: '_blank', rel: 'noopener noreferrer', className: 'link' }, linkText)
        : createElement(Link, { key: key++, href, className: 'link' }, linkText)
      );
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}