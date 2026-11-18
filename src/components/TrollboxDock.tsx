// src/components/TrollboxDock.tsx

'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useStore, useWikiPathname } from '@/hooks';
import { HEAD_POLL_MS, OPEN_KEY, recall, remember, ROOM_PATH, SEEN_KEY } from '@/lib/trollbox';

// Loaded when the room first opens: a reader who never opens it downloads none of it.
const Trollbox = dynamic(() => import('@/components/Trollbox'), { ssr: false });

/**
 * Where the trollbox lives beside every page: mounted once in the layout, so
 * the room stays open across navigation. The header's button opens it.
 */
export function TrollboxDock() {
  // On the room's own page the room is the page: a docked one beside it would be
  // a second log and a second poll of the same cursor.
  const onRoomPage = useWikiPathname() === ROOM_PATH;
  const open = useStore(s => s.chatOpen) && !onRoomPage;

  // A reader who left the room docked finds it docked. Not on a phone, where the
  // room is the whole screen and would open over the page they came for.
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      if (recall(OPEN_KEY) === '1' && window.matchMedia('(min-width: 1024px)').matches) useStore.setState({ chatOpen: true });
      return;
    }
    // The room's page hides the dock without the reader having closed it.
    if (!onRoomPage) remember(OPEN_KEY, open ? '1' : '0');
  }, [open, onRoomPage]);

  // A closed room asks only whether there is a line the reader has not seen.
  useEffect(() => {
    if (open || onRoomPage) return;
    let live = true;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch('/api/trollbox?head');
        if (!res.ok) return;
        const { latest } = await res.json() as { latest: number };
        if (live) useStore.setState({ chatUnread: latest > Number(recall(SEEN_KEY) ?? 0) });
      } catch {
        // A dropped check is not worth a word: the next one asks again.
      }
    };
    void check();
    const timer = setInterval(check, HEAD_POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, [open, onRoomPage]);

  return open ? <Trollbox docked /> : null;
}
