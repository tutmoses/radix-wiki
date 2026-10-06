// src/lib/track.ts – server-side events, counted in this wiki's own database and
// shared by the proxy ("AI Bot Visit"), the MCP route ("MCP Call"), the wiki
// search endpoint ("Search Query") and the page-view beacon (POST /api/view),
// so the four never drift.
//
// `wiki-formant/analytics` owns the tables' SQL, the visitor hash, the props
// extraction, the production gate (dev and previews share production's
// database) and the deferral; this binds it to Prisma and `after`. The proxy
// reaches it through a dynamic import, because this module pulls in Prisma.

import { after } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { prisma } from '@/lib/prisma/client';
import { createTracker, type Sql } from 'wiki-formant/analytics';

const sql: Sql = (query, ...values) => prisma.$queryRawUnsafe(query, ...values);

// A search is filed against the page the reader searched from, else the site.
// `total` at the call site is the match count before pagination, so the
// zero-result filter is not confused by a deep page.
export const { trackEvent, trackMcpCall, trackSearch, viewRoute } =
  createTracker({ sql, defer: after, siteUrl: SITE_URL });
