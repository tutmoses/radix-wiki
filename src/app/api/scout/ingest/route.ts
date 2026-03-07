// src/app/api/scout/ingest/route.ts — Ingest external intel (e.g. Telegram scrapes)
//
// POST: Accepts IntelItem[] array, deduplicates, stores, and triages via LLM.
// Called from scripts/scout-telegram.mjs during Claude Code sessions.

import { json, handleRoute, requireCron } from '@/lib/api';
import { triageIntel, type IntelItem } from '@/lib/scout';

export const maxDuration = 120;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const cronErr = requireCron(request);
    if (cronErr) return cronErr;

    const body = await request.json() as IntelItem[];
    if (!Array.isArray(body) || body.length === 0) {
      return json({ status: 'empty', items: 0 });
    }

    const { newCount, flagged } = await triageIntel(body);
    if (newCount === 0) return json({ status: 'no_new_intel', items: 0 });

    return json({
      status: 'completed',
      ingested: newCount,
      flagged: flagged.length,
      items: flagged,
    });
  }, 'Scout ingest: failed');
}
