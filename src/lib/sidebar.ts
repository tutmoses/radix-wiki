// The wiki rail's remembered collapse state, read by the pre-paint boot script
// and the `SidebarProvider` that takes over from it in `layout.tsx`; the two
// must agree or the rail flashes on load. The width at which the rail stops
// being a column is wiki-formant's default breakpoint, which `base.css` lays
// the rail out at, so neither passes one.

export const SIDEBAR_KEY = 'radix-wiki:sidebar';
