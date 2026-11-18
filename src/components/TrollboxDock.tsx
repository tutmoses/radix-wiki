// src/components/TrollboxDock.tsx

'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/hooks';
import { HEAD_POLL_MS, OPEN_KEY, SEEN_KEY } from '@/lib/trollbox';

// Loaded when the room first opens: a reader who never opens it downloads none of it.
const Trollbox = dynamic(() => import('@/components/Trollbox'), { ssr: false });

/** Storage a browser may refuse (private mode, a blocked site): the room works without it. */
const recall = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const remember = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* not kept */ } };

/**
 * Where the trollbox lives beside every page: mounted once in the layout, so
 * the room stays open across navigation. The header's button opens it.
 */
export function TrollboxDock() {
  const open = useStore(s => s.chatOpen);

  // A reader who left the room docked finds it docked. Not on a phone, where the
  // room is the whole screen and would open over the page they came for.
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      if (recall(OPEN_KEY) === '1' && window.matchMedia('(min-width: 1024px)').matches) useStore.setState({ chatOpen: true });
      return;
    }
    remember(OPEN_KEY, open ? '1' : '0');
  }, [open]);

  // A closed room asks only whether there is a line the reader has not seen.
  useEffect(() => {
    if (open) return;
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
  }, [open]);

  return open ? <Trollbox onSeen={id => { remember(SEEN_KEY, String(id)); useStore.setState({ chatUnread: false }); }} /> : null;
}
