// src/app/api/charts/activity/route.ts – the /charts daily activity series, as JSON or CSV.
//
// `?from=` and `?to=` (YYYY-MM-DD) narrow it; `?format=csv` downloads it. The rows are the
// ones the chart draws and the MCP `get_network_activity` tool returns, from one reader.

import { cachedJson, CACHE, errors } from '@/lib/api';
import { ACTIVITY_COLUMNS, getLedgerDayRows } from '@/lib/radix/activity';
import { SITE_URL, WIKI_LICENSE } from '@/lib/site';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = params.get('from') ?? undefined;
  const to = params.get('to') ?? undefined;
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) return errors.badRequest('from and to are dates, YYYY-MM-DD');

  const rows = await getLedgerDayRows(from, to);
  if (params.get('format') === 'csv') {
    const lines = [ACTIVITY_COLUMNS.join(','), ...rows.map(r => ACTIVITY_COLUMNS.map(c => r[c]).join(','))];
    return new Response(`${lines.join('\n')}\n`, {
      headers: {
        ...CACHE.long,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="radix-network-activity.csv"',
      },
    });
  }
  return cachedJson({
    description: 'Radix mainnet, one row per UTC day, summed from the Gateway transaction stream. Counts cover user transactions only. feesXrd, burnedXrd and royaltiesXrd are in $XRD.',
    source: `${SITE_URL}/charts`,
    license: WIKI_LICENSE.url,
    rows,
  }, CACHE.long);
}
