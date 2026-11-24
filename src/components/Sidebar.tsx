// src/components/Sidebar.tsx

'use client';

import Link from 'next/link';
import { Home, Trophy, BarChart3, Wrench, MessagesSquare } from 'lucide-react';
import { useMemo } from 'react';
// The rail is wiki-formant's `Rail`, drawn by `wiki-formant/base.css` in the
// `wiki-rail__*` classes, as on caper, acuiq2 and miow; globals.css holds only
// this wiki's look. Its "On this page" lists the headings the page on screen
// hands up with `RailHeadings`.
import { Rail, type RailLink } from 'wiki-formant/react';
import { useAuth, useWikiPathname } from '@/hooks';
import { getVisibleTags, type TagNode } from '@/lib/tags';
import { ROOM_PATH } from '@/lib/trollbox';

/**
 * The category tree as rail links. A category stays lit while the reader is on a
 * page inside it, and only the branch the reader is in opens, so the rail shows
 * one section's children rather than the whole hierarchy.
 */
const categoryLinks = (nodes: TagNode[], parent = ''): RailLink[] =>
  nodes
    .filter(node => !node.hidden)
    .map(node => {
      const path = parent ? `${parent}/${node.slug}` : node.slug;
      return { href: `/${path}`, label: node.name, title: node.name, tree: true, children: categoryLinks(node.children ?? [], path) };
    });

export function Sidebar() {
  const pathname = useWikiPathname();
  const { isAuthenticated } = useAuth();
  const categories = useMemo(() => categoryLinks(getVisibleTags()), []);

  const nav: RailLink[] = [
    { href: '/', label: 'Home', icon: <Home size={18} /> },
    { href: '/charts', label: 'Charts', icon: <BarChart3 size={18} />, tree: true },
    { href: '/leaderboard', label: 'Leaderboard', icon: <Trophy size={18} /> },
    { href: ROOM_PATH, label: 'Trollbox', icon: <MessagesSquare size={18} /> },
    // Editorial work queues — reader nav stays free of maintenance machinery.
    ...(isAuthenticated ? [{ href: '/maintenance', label: 'Maintenance', icon: <Wrench size={18} /> }] : []),
  ];

  return <Rail label="Wiki navigation" nav={nav} groups={[{ label: 'Categories', links: categories }]} pathname={pathname} link={Link} />;
}
