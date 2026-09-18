// src/lib/now.tsx — the clock a server-rendered "43m ago" is computed against.
//
// Read inside a 'use client' render, `Date.now()` is one value when the HTML is
// rendered and another when the browser hydrates it — and an ISR page is
// hydrated minutes after it was rendered, so "43m ago" met "44m ago" and React
// threw #418 on the homepage for every visitor. The route reads the clock once
// on the server and provides it here; the RSC payload that carries it was made
// in the same render as the HTML, so hydration sees the same value.

'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const NowContext = createContext<number | null>(null);

export function NowProvider({ now, children }: { now: number; children: ReactNode }) {
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

/**
 * The server's render time while hydrating, so the markup matches, then the
 * live clock once mounted, so a cached page does not keep saying "43m ago".
 * Outside a provider it is the browser's clock, which is only safe for
 * something that renders after mount — a comment list, a notification.
 */
export function useNow(): number {
  const rendered = useContext(NowContext);
  const [now, setNow] = useState(() => rendered ?? Date.now());
  useEffect(() => setNow(Date.now()), []);
  return now;
}
