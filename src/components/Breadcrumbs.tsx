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
import { Breadcrumbs as SharedBreadcrumbs } from 'wiki-formant/react-server';
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
}

export function Breadcrumbs({ path, leafTitle, suffix }: BreadcrumbsProps) {
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

  return <SharedBreadcrumbs items={items} base={SITE_URL} link={Link} />;
}
