// src/app/api/ledger/[action]/route.ts — On-chain wiki backup: prepare, confirm, status, recover

import { prisma } from '@/lib/prisma/client';
import { requireAuth, handleRoute, json, cachedJson, errors, CACHE, type RouteContext } from '@/lib/api';
import { buildPageBackupManifest, readAnchorFromLedger, readLedgerBackup } from '@/lib/radix/ledger';
import { blocksToMdx } from '@/lib/mdx';
import type { NextRequest } from 'next/server';

type Ctx = RouteContext<{ action: string }>;
type Body = { tagPath?: string; slug?: string; txHash?: string };

async function prepare(radixAddress: string, { tagPath, slug }: Body) {
  if (!tagPath || !slug) return errors.badRequest('tagPath and slug are required');

  const page = await prisma.page.findFirst({
    where: { tagPath, slug },
    select: {
      slug: true, tagPath: true, title: true, content: true, version: true,
      updatedAt: true, createdAt: true, bannerImage: true,
      author: { select: { displayName: true, shortAddress: true } },
    },
  });
  if (!page) return errors.notFound('Page not found');

  const mdx = blocksToMdx(page);
  return json({
    manifest: buildPageBackupManifest(radixAddress, { slug: page.slug, pageVersion: page.version }, mdx),
    title: page.title,
    sizeKB: Math.round(mdx.length / 1024),
    timestamp: new Date().toISOString(),
  });
}

async function confirm({ tagPath, slug, txHash }: Body) {
  if (!tagPath || !slug || !txHash) return errors.badRequest('tagPath, slug, and txHash are required');

  await prisma.page.update({
    where: { tagPath_slug: { tagPath, slug } },
    data: { backupTxHash: txHash },
  });

  return json({ ok: true });
}

async function status(address: string, params: URLSearchParams) {
  const anchor = await readAnchorFromLedger(address);
  const hours = anchor ? (Date.now() - new Date(anchor.timestamp).getTime()) / 3_600_000 : null;

  // Current page version + backup tx hash, when the caller names a page.
  const tagPath = params.get('tagPath');
  const slug = params.get('slug');
  const page = tagPath && slug
    ? await prisma.page.findUnique({
        where: { tagPath_slug: { tagPath, slug } },
        select: { version: true, backupTxHash: true },
      })
    : null;

  return cachedJson({
    anchor,
    hoursSinceAnchor: hours ? Math.round(hours * 10) / 10 : null,
    currentPageVersion: page?.version ?? null,
    backupTxHash: page?.backupTxHash ?? null,
  }, CACHE.short);
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { action } = await params;
  if (action !== 'status' && action !== 'recover') return errors.notFound();

  return handleRoute(async () => {
    const address = request.nextUrl.searchParams.get('address');
    if (!address) return errors.badRequest('address query parameter required');
    if (action === 'status') return status(address, request.nextUrl.searchParams);

    const { anchor, pages } = await readLedgerBackup(address);
    return json({ anchor, pages, recoveredCount: pages.length });
  }, action === 'status' ? 'Failed to read ledger status' : 'Failed to recover from ledger');
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { action } = await params;
  if (action !== 'prepare' && action !== 'confirm') return errors.notFound();

  return handleRoute(async () => {
    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;
    const body = await request.json() as Body;
    return action === 'prepare' ? prepare(auth.session.radixAddress, body) : confirm(body);
  }, action === 'prepare' ? 'Failed to prepare ledger backup' : 'Failed to confirm backup');
}
