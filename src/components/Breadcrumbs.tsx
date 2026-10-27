// src/components/Breadcrumbs.tsx — this wiki's tag path as a crumb trail.
//
// The trail itself and the `BreadcrumbList` it emits are
// `wiki-formant/react-server`, shared with the other wikis. What stays here is
// the one thing that is this wiki's: turning a tag path into labelled crumbs
// through `findTagByPath`.
//
// One component emits both the visible trail and its JSON-LD, so they cannot
// disagree. Structured data that opens with an item the rendered trail never
// shows is precisely the mismatch Google drops a rich result for.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { History as HistoryIcon, Pencil } from 'lucide-react';
import { Breadcrumbs as SharedBreadcrumbs, BreadcrumbsRow } from 'wiki-formant/react-server';
import { findTagByPath } from '@/lib/tags';
import { SITE_URL } from '@/lib/site';

interface BreadcrumbsProps {
  path: string[];
  /**
   * The final crumb's label, where the path ends in a page slug.
   * `findTagByPath` resolves category segments but returns null for a slug,
   * which left the last crumb showing a de-hyphenated slug ("cerberus
   * consensus") instead of the page title.
   */
  leafTitle?: string;
  /** A trailing mode crumb — Edit, History, Create. Not a destination. */
  suffix?: string;
  /** Right of the trail: `PageActions`. */
  actions?: ReactNode;
}

export function Breadcrumbs({ path, leafTitle, suffix, actions }: BreadcrumbsProps) {
  const items = [
    { label: 'Home', href: '/' },
    ...path.map((segment, i) => {
      const segments = path.slice(0, i + 1);
      const isLeaf = i === path.length - 1;
      return {
        label: findTagByPath(segments)?.name || (isLeaf && leafTitle) || segment.replace(/-/g, ' '),
        href: `/${segments.join('/')}`,
      };
    }),
    // No href: a mode the page is in, not a page you can navigate to. The
    // shared component renders it as text and leaves it out of the JSON-LD.
    ...(suffix ? [{ label: suffix.replace(/-/g, ' ') }] : []),
  ];

  return actions
    ? <BreadcrumbsRow items={items} base={SITE_URL} link={Link} actions={actions} />
    : <SharedBreadcrumbs items={items} base={SITE_URL} link={Link} />;
}

/**
 * History and Edit, beside the trail. The one home for both: they used to be a
 * header pencil, a foot link, a Tools item and the meta line's revision count.
 * Each is passed only where its control applies, so the caller keeps the rule.
 */
export function PageActions({ editHref, historyHref, className }: { editHref?: string; historyHref?: string; className?: string }) {
  if (!editHref && !historyHref) return null;
  return (
    <nav className={className ? `page-actions ${className}` : 'page-actions'} aria-label="Page actions">
      {historyHref && <Link href={historyHref} prefetch={false} className="page-action" aria-label="History" title="History"><HistoryIcon size={16} aria-hidden /></Link>}
      {editHref && <Link href={editHref} prefetch={false} className="page-action" aria-label="Edit" title="Edit"><Pencil size={16} aria-hidden /></Link>}
    </nav>
  );
}
