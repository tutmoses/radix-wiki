// src/components/Sidebar.tsx

'use client';

import { Home, Trophy, BarChart3, Wrench, MessagesSquare } from 'lucide-react';
import { useMemo } from 'react';
// The rail is wiki-formant's `Rail` on Next's router, drawn by
// `wiki-formant/base.css` in the `wiki-rail__*` classes; globals.css holds only
// this wiki's look. Its "On this page" lists the headings the page on screen
// hands up with `RailHeadings`.
import { Rail } from 'wiki-formant/next';
import type { RailLink } from 'wiki-formant/react';
import { treeRailLinks } from 'wiki-formant/react-server';
import { useAuth } from '@/hooks';
import { getVisibleTags } from '@/lib/tags';
import { ROOM_PATH } from '@/lib/trollbox';

export function Sidebar() {
  const { isAuthenticated } = useAuth();
  // The category tree as rail links: a category stays lit while the reader is on
  // a page inside it, and only the branch the reader is in opens.
  const categories = useMemo(() => treeRailLinks(getVisibleTags()), []);

  const nav: RailLink[] = [
    { href: '/', label: 'Home', icon: <Home size={18} /> },
    { href: '/charts', label: 'Charts', icon: <BarChart3 size={18} />, tree: true },
    { href: '/leaderboard', label: 'Leaderboard', icon: <Trophy size={18} /> },
    { href: ROOM_PATH, label: 'Trollbox', icon: <MessagesSquare size={18} /> },
    // Editorial work queues — reader nav stays free of maintenance machinery.
    ...(isAuthenticated ? [{ href: '/maintenance', label: 'Maintenance', icon: <Wrench size={18} /> }] : []),
  ];

  return <Rail label="Wiki navigation" nav={nav} groups={[{ label: 'Categories', links: categories }]} />;
}
