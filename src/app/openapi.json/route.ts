// src/app/openapi.json/route.ts — serves the OpenAPI 3.1 spec from @/lib/openapi.

import { NextResponse } from 'next/server';
import { SPEC } from '@/lib/openapi';

export const revalidate = 86400;

export async function GET() {
  return NextResponse.json(SPEC, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
