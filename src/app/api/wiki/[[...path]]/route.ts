// src/app/api/wiki/[[...path]]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { slugify } from '@/lib/utils';
import { isValidTagPath, isAuthorOnlyPath, getMetadataKeys } from '@/lib/tags';
import { json, errors, handleRoute, requireAuth, type RouteContext } from '@/lib/api';
import { computeRevisionDiff, formatVersion, parseVersion, classifyChanges, incrementVersion, type BlockChange } from '@/lib/versioning';
import { parseApiPath } from '@/lib/wiki';
import { validateBlocks } from '@/lib/blocks';
import { blocksToMdx } from '@/lib/mdx';
import type { WikiPageInput } from '@/types';
import type { Block } from '@/types/blocks';

type PathParams = { path?: string[] };

export async function GET(request: NextRequest, context: RouteContext<PathParams>) {
  const { path } = await context.params;

  // Handle MDX export outside handleRoute (returns raw Response)
  const parsed = parseApiPath(path);
  if (parsed?.type === 'mdx') {
    try {
      const page = await prisma.page.findFirst({
        where: { tagPath: parsed.tagPath, slug: parsed.slug },
        include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
      });
      if (!page) return errors.notFound('Page not found');

      const mdx = blocksToMdx(page);
      const filename = page.slug || 'homepage';

      return new NextResponse(mdx, {
        headers: {
          'Content-Type': 'text/mdx; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.mdx"`,
        },
      });
    } catch (error) {
      console.error('MDX export failed', error);
      return errors.internal('Failed to export MDX');
    }
  }

  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);

    // List mode
    if (!path?.length && (searchParams.has('page') || searchParams.has('pageSize') || searchParams.has('search') || searchParams.has('tagPath') || searchParams.has('sort'))) {
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
      const search = searchParams.get('search') || '';
      const tagPath = searchParams.get('tagPath');
      const sort = searchParams.get('sort') || 'updatedAt';

      const where: Prisma.PageWhereInput = {};
      if (search) where.title = { contains: search, mode: 'insensitive' };
      if (tagPath) where.tagPath = tagPath;

      const orderBy = sort === 'title' ? { title: 'asc' as const } : { updatedAt: 'desc' as const };

      const pages = await prisma.page.findMany({
        where,
        include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const total = await prisma.page.count({ where });

      return json({ items: pages, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    }

    if (!parsed) return errors.notFound('Invalid path');

    // History mode
    if (parsed.type === 'history') {
      const page = await prisma.page.findFirst({
        where: { tagPath: parsed.tagPath, slug: parsed.slug },
        select: { id: true, version: true },
      });
      if (!page) return errors.notFound('Page not found');

      const revisions = await prisma.revision.findMany({
        where: { pageId: page.id },
        select: {
          id: true,
          title: true,
          version: true,
          changeType: true,
          changes: true,
          message: true,
          createdAt: true,
          author: { select: { id: true, displayName: true, radixAddress: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return json({ currentVersion: page.version, revisions });
    }

    // Homepage or specific page
    const page = await prisma.page.findFirst({
      where: { tagPath: parsed.tagPath, slug: parsed.slug },
      include: {
        author: { select: { id: true, displayName: true, radixAddress: true } },
        revisions: { select: { id: true } },
      },
    });

    if (!page && parsed.type === 'homepage') return json(null);
    if (!page) return errors.notFound('Page not found');

    return json(page);
  }, 'Failed to fetch');
}

export async function POST(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parseApiPath(path);

    // Restore revision
    if (parsed?.type === 'history') {
      const auth = await requireAuth(request);
      if ('error' in auth) return auth.error;

      const page = await prisma.page.findFirst({ 
        where: { tagPath: parsed.tagPath, slug: parsed.slug },
        select: { id: true, title: true, content: true, bannerImage: true, version: true, authorId: true, tagPath: true },
      });
      if (!page) return errors.notFound('Page not found');

      if (isAuthorOnlyPath(page.tagPath) && page.authorId !== auth.session.userId) {
        return errors.forbidden('You can only restore your own pages in this category');
      }

      const isHomepage = parsed.tagPath === '' && parsed.slug === '';
      const balanceAuth = await requireAuth(request, isHomepage ? { type: 'editHomepage' } : { type: 'edit', tagPath: parsed.tagPath });
      if ('error' in balanceAuth) return balanceAuth.error;

      const { revisionId } = await request.json();
      if (!revisionId) return errors.badRequest('Revision ID required');

      const revision = await prisma.revision.findFirst({ where: { id: revisionId, pageId: page.id } });
      if (!revision) return errors.notFound('Revision not found');

      // Restores are always major changes - skip expensive diff computation
      const newVersion = incrementVersion(parseVersion(page.version), 'major');
      const content = revision.content as Prisma.InputJsonValue;

      await prisma.page.update({
        where: { id: page.id },
        data: {
          title: revision.title,
          content,
          version: formatVersion(newVersion),
        },
      });

      await prisma.revision.create({
        data: {
          pageId: page.id,
          title: revision.title,
          content,
          version: formatVersion(newVersion),
          changeType: 'major',
          changes: [] as unknown as Prisma.InputJsonValue,
          authorId: auth.session.userId,
          message: `Restored to v${revision.version}`,
        },
      });

      return json({ success: true, version: formatVersion(newVersion) });
    }

    // Create new page
    const body: WikiPageInput = await request.json();
    const { title, content, excerpt, bannerImage, tagPath, metadata } = body;

    if (!title || !content) return errors.badRequest('Title and content required');
    if (!validateBlocks(content)) return errors.badRequest('Invalid block structure');
    if (!tagPath || !isValidTagPath(tagPath.split('/'))) {
      return errors.badRequest('Valid tag path required');
    }

    // Validate required metadata fields
    const metadataKeys = getMetadataKeys(tagPath.split('/'));
    const requiredKeys = metadataKeys.filter(k => k.required);
    const missingKeys = requiredKeys.filter(k => !metadata?.[k.key]?.trim());
    if (missingKeys.length > 0) {
      return errors.badRequest(`Missing required metadata: ${missingKeys.map(k => k.label).join(', ')}`);
    }

    const auth = await requireAuth(request, { type: 'create', tagPath });
    if ('error' in auth) return auth.error;

    let slug = body.slug || slugify(title);
    const existing = await prisma.page.findFirst({ where: { tagPath, slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const initialVersion = '1.0.0';

    const page = await prisma.page.create({
      data: {
        slug,
        title,
        content: content as unknown as Prisma.InputJsonValue,
        excerpt,
        bannerImage,
        tagPath,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        version: initialVersion,
        authorId: auth.session.userId,
      },
      include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
    });

    await prisma.revision.create({
      data: {
        pageId: page.id,
        title,
        content: content as unknown as Prisma.InputJsonValue,
        version: initialVersion,
        changeType: 'major',
        changes: [] as unknown as Prisma.InputJsonValue,
        authorId: auth.session.userId,
        message: 'Initial version',
      },
    });

    return json(page, 201);
  }, 'Failed to create');
}

export async function PUT(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parseApiPath(path);

    if (!parsed || parsed.type === 'history') return errors.notFound('Invalid path');

    const isHomepage = parsed.type === 'homepage';
    const auth = await requireAuth(request, isHomepage ? { type: 'editHomepage' } : { type: 'edit', tagPath: parsed.tagPath });
    if ('error' in auth) return auth.error;

    const body: Partial<WikiPageInput> & { revisionMessage?: string } = await request.json();
    const { title, content, excerpt, bannerImage, metadata, revisionMessage } = body;

    if (content !== undefined && !validateBlocks(content)) {
      return errors.badRequest('Invalid block structure');
    }

    const existing = await prisma.page.findFirst({ where: { tagPath: parsed.tagPath, slug: parsed.slug } });

    // Homepage creation if it doesn't exist
    if (!existing && isHomepage) {
      const initialVersion = '1.0.0';
      
      const page = await prisma.page.create({
        data: {
          tagPath: '',
          slug: '',
          title: title || 'Homepage',
          content: (content as unknown as Prisma.InputJsonValue) || {},
          bannerImage,
          version: initialVersion,
          authorId: auth.session.userId,
        },
      });

      await prisma.revision.create({
        data: {
          pageId: page.id,
          title: title || 'Homepage',
          content: (content as unknown as Prisma.InputJsonValue) || {},
          version: initialVersion,
          changeType: 'major',
          changes: [] as unknown as Prisma.InputJsonValue,
          authorId: auth.session.userId,
          message: 'Initial version',
        },
      });

      return json(page, 201);
    }

    if (!existing) return errors.notFound('Page not found');

    // Author-only check for non-homepage
    if (!isHomepage && isAuthorOnlyPath(existing.tagPath) && existing.authorId !== auth.session.userId) {
      return errors.forbidden('You can only edit your own pages in this category');
    }

    // Compute semantic diff if content changed
    let newVersion = existing.version;
    let changeType: string = 'patch';
    let changes: BlockChange[] = [];

    if (content || title) {
      const oldContent = (existing.content as unknown as Block[]) || [];
      const newContent = (content as unknown as Block[]) || oldContent;
      
      const diff = computeRevisionDiff(
        existing.version,
        oldContent,
        newContent,
        existing.title,
        title || existing.title,
        existing.bannerImage,
        bannerImage ?? existing.bannerImage
      );

      newVersion = formatVersion(diff.version);
      changeType = diff.changeType;
      changes = diff.changes;
    }

    // Validate required metadata if being updated
    if (metadata !== undefined) {
      const metadataKeys = getMetadataKeys(existing.tagPath.split('/'));
      const requiredKeys = metadataKeys.filter(k => k.required);
      const missingKeys = requiredKeys.filter(k => !metadata?.[k.key]?.trim());
      if (missingKeys.length > 0) {
        return errors.badRequest(`Missing required metadata: ${missingKeys.map(k => k.label).join(', ')}`);
      }
    }

    const page = await prisma.page.update({
      where: { id: existing.id },
      data: {
        title: title ?? undefined,
        content: content !== undefined ? (content as unknown as Prisma.InputJsonValue) : undefined,
        excerpt: excerpt ?? undefined,
        bannerImage: bannerImage ?? undefined,
        metadata: metadata !== undefined ? (metadata as unknown as Prisma.InputJsonValue) : undefined,
        version: newVersion,
      },
      include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
    });

    if (content || title) {
      await prisma.revision.create({
        data: {
          pageId: page.id,
          title: title || existing.title,
          content: content ? (content as unknown as Prisma.InputJsonValue) : (existing.content as Prisma.InputJsonValue),
          version: newVersion,
          changeType,
          changes: changes as unknown as Prisma.InputJsonValue,
          authorId: auth.session.userId,
          message: revisionMessage,
        },
      });
    }

    return json(page);
  }, 'Failed to update');
}

export async function DELETE(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parseApiPath(path);

    if (!parsed || parsed.type !== 'page') return errors.notFound('Invalid path');

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const existing = await prisma.page.findFirst({ where: { tagPath: parsed.tagPath, slug: parsed.slug } });
    if (!existing) return errors.notFound('Page not found');
    if (existing.authorId !== auth.session.userId) return errors.forbidden();

    await prisma.page.delete({ where: { id: existing.id } });
    return json({ success: true });
  }, 'Failed to delete');
}