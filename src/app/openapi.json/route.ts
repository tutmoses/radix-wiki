// src/app/openapi.json/route.ts — serves the OpenAPI 3.1 spec from @/lib/openapi.

import { NextResponse } from 'next/server';
import { SPEC } from '@/lib/openapi';
import { AGENT_CARD_CACHE_CONTROL } from 'wiki-formant/well-known';

export const revalidate = 86400;

export async function GET() {
  return NextResponse.json(SPEC, {
    headers: { 'Cache-Control': AGENT_CARD_CACHE_CONTROL },
  });
}
