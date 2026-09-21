// The wiki rail's remembered collapse state, and the width at which the rail
// stops being a column beside the article.
//
// Both numbers were literals, written twice each in `layout.tsx` — the pre-paint
// boot script and the `SidebarProvider` that takes over from it. Three places
// have to agree or the rail flashes on load, and the third is not in this file
// at all: the stylesheet lays the rail out from its own copy of the breakpoint,
// because a media query cannot read a constant. `globals.css` declares
// `--rail-floating` inside that query so `wiki-formant`'s hook can check the
// two still match, and say so in development if they ever stop.

export const SIDEBAR_KEY = 'radix-wiki:sidebar';

/**
 * Below this width (px) the rail defaults to closed and floats over the
 * article rather than pushing it.
 *
 * Paired with `@media (max-width: 767px)` in `globals.css`, which must stay at
 * this number minus one. 768 is the width at which an 18rem rail plus the
 * gutters still leaves the article ~42ch; below it the rail has to get out of
 * the way, and at 375px it was leaving the article 87px of 375 until Sep 2026.
 */
export const SIDEBAR_BREAKPOINT = 768;
