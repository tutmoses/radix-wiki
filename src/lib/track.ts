// src/lib/track.ts – server-side events, counted in this wiki's own database:
// wiki-formant/analytics bound to Prisma, so the proxy, the MCP route, the
// search endpoint and the /api/view beacon write through one tracker. The proxy
// imports it dynamically, because it loads Prisma.

import { after } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { prisma } from '@/lib/prisma/client';
import { createTracker, type Sql } from 'wiki-formant/analytics';

export const sql: Sql = (query, ...values) => prisma.$queryRawUnsafe(query, ...values);

export const { trackEvent, trackMcpCall, trackSearch, trackFeedback, viewRoute } =
  createTracker({ sql, defer: after, siteUrl: SITE_URL });
