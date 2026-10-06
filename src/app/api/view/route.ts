// POST /api/view – a page reporting a view, or an event such as a click out.
// Sent by wiki-formant's <Beacon> to this site's own address, and counted by
// its `collect`, which answers 204 before writing anything.

import { after } from 'next/server';
import { collect } from 'wiki-formant/analytics';
import { sql } from '@/lib/track';

export async function POST(request: Request) {
  // Dev and previews share production's database, so only production counts.
  if (process.env.VERCEL_ENV !== 'production') return new Response(null, { status: 204 });
  return collect(request, { sql, defer: after });
}
