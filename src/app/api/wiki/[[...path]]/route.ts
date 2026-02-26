// src/app/api/wiki/[[...path]]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { slugify } from '@/lib/utils';
import { isValidTagPath, isAuthorOnlyPath, getMetadataKeys } from '@/lib/tags';
import { json, errors, handleRoute, requireAuth, parsePagination, paginatedResponse, cachedJson, CACHE, type RouteContext } from '@/lib/api';
import { computeRevisionDiff, formatVersion, parseVersion, incrementVersion, type BlockChange } from '@/lib/versioning';
import { parsePath, AUTHOR_SELECT, PAGE_INCLUDE, PAGE_LIST_SELECT } from '@/lib/wiki';
import { validateBlocks } from '@/lib/blocks';
import { blocksToMdx } from '@/lib/mdx';
import { createNotification } from '@/lib/notifications';
import type { WikiPageInput } from '@/types';
import type { Block } from '@/types/blocks';

type PathParams = { path?: string[] };



export async function GET(request: NextRequest, context: RouteContext<PathParams>) {
  const { path } = await context.params;
  const parsed = parsePath(path, 'api');

  // Handle MDX export outside handleRoute (returns raw Response)
  if (parsed.type === 'mdx') {
    try {
      const page = await prisma.page.findUnique({
        where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } },
        include: { author: AUTHOR_SELECT },
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
      const { page, pageSize } = parsePagination(searchParams);
      const search = searchParams.get('search') || '';
      const tagPath = searchParams.get('tagPath');
      const sort = searchParams.get('sort') || 'updatedAt';

      const where: Prisma.PageWhereInput = {};
      if (search) where.title = { contains: search, mode: 'insensitive' };
      if (tagPath) where.tagPath = tagPath;

      const orderBy = sort === 'title' ? { title: 'asc' as const } : { updatedAt: 'desc' as const };

      const [pages, total] = await Promise.all([
        prisma.page.findMany({
          where,
          select: PAGE_LIST_SELECT,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.page.count({ where }),
      ]);

      return cachedJson(paginatedResponse(pages, total, page, pageSize));
    }

    if (parsed.type === 'invalid') return errors.notFound('Invalid path');

    // History mode
    if (parsed.type === 'history') {
      const page = await prisma.page.findUnique({
        where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } },
        select: { id: true, version: true },
      });
      if (!page) return errors.notFound('Page not found');

      const revisions = await prisma.revision.findMany({
        where: { pageId: page.id },
        select: {
          id: true, title: true, version: true, changeType: true,
          changes: true, message: true, createdAt: true,
          author: AUTHOR_SELECT,
        },
        orderBy: { createdAt: 'desc' },
      });

      return cachedJson({ currentVersion: page.version, revisions });
    }

    // Homepage or specific page
    const page = await prisma.page.findUnique({
      where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } },
      include: PAGE_INCLUDE,
    });

    if (!page && parsed.type === 'homepage') return cachedJson(null);
    if (!page) {
      const res = errors.notFound('Page not found');
      res.headers.set('Cache-Control', CACHE.short['Cache-Control']);
      return res;
    }

    return cachedJson(page);
  }, 'Failed to fetch');
}

export async function POST(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePath(path, 'api');

    // Restore revision
    if (parsed.type === 'history') {
      const auth = await requireAuth(request, { type: 'edit', tagPath: parsed.tagPath });
      if ('error' in auth) return auth.error;

      const page = await prisma.page.findUnique({
        where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } },
        select: { id: true, title: true, content: true, bannerImage: true, version: true, authorId: true, tagPath: true },
      });
      if (!page) return errors.notFound('Page not found');

      if (isAuthorOnlyPath(page.tagPath) && page.authorId !== auth.session.userId) {
        return errors.forbidden('You can only restore your own pages in this category');
      }

      const { revisionId } = await request.json();
      if (!revisionId) return errors.badRequest('Revision ID required');

      const revision = await prisma.revision.findFirst({ where: { id: revisionId, pageId: page.id } });
      if (!revision) return errors.notFound('Revision not found');

      const newVersion = incrementVersion(parseVersion(page.version), 'major');
      const content = revision.content as Prisma.InputJsonValue;

      await prisma.$transaction([
        prisma.page.update({
          where: { id: page.id },
          data: { title: revision.title, content, version: formatVersion(newVersion) },
        }),
        prisma.revision.create({
          data: {
            pageId: page.id, title: revision.title, content,
            version: formatVersion(newVersion), changeType: 'major',
            changes: [] as unknown as Prisma.InputJsonValue,
            authorId: auth.session.userId, message: `Restored to v${revision.version}`,
          },
        }),
      ]);

      revalidateTag('wiki');
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

    const metadataKeys = getMetadataKeys(tagPath.split('/'));
    const requiredKeys = metadataKeys.filter(k => k.required);
    const missingKeys = requiredKeys.filter(k => !metadata?.[k.key]?.trim());
    if (missingKeys.length > 0) {
      return errors.badRequest(`Missing required metadata: ${missingKeys.map(k => k.label).join(', ')}`);
    }

    const auth = await requireAuth(request, { type: 'create', tagPath });
    if ('error' in auth) return auth.error;

    let slug = body.slug || slugify(title);
    const existing = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath, slug } } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const initialVersion = '1.0.0';

    const page = await prisma.$transaction(async (tx) => {
      const p = await tx.page.create({
        data: {
          slug, title,
          content: content as unknown as Prisma.InputJsonValue,
          excerpt, bannerImage, tagPath,
          metadata: metadata as unknown as Prisma.InputJsonValue,
          version: initialVersion, authorId: auth.session.userId,
        },
        include: { author: AUTHOR_SELECT },
      });
      await tx.revision.create({
        data: {
          pageId: p.id, title,
          content: content as unknown as Prisma.InputJsonValue,
          version: initialVersion, changeType: 'major',
          changes: [] as unknown as Prisma.InputJsonValue,
          authorId: auth.session.userId, message: 'Initial version',
        },
      });
      return p;
    });

    const priorRevisions = await prisma.revision.count({ where: { authorId: auth.session.userId } });
    revalidateTag('wiki');
    return json({ ...page, isFirstContribution: priorRevisions === 1 }, 201);
  }, 'Failed to create');
}

export async function PUT(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePath(path, 'api');

    if (parsed.type === 'invalid' || parsed.type === 'history') return errors.notFound('Invalid path');

    const auth = await requireAuth(request, { type: 'edit', tagPath: parsed.tagPath });
    if ('error' in auth) return auth.error;

    const body: Partial<WikiPageInput> & { revisionMessage?: string; newSlug?: string } = await request.json();
    const { title, content, excerpt, bannerImage, metadata, revisionMessage, newSlug } = body;

    if (content !== undefined && !validateBlocks(content)) {
      return errors.badRequest('Invalid block structure');
    }

    const existing = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } } });

    // Homepage creation if it doesn't exist
    if (!existing && parsed.type === 'homepage') {
      const initialVersion = '1.0.0';

      const page = await prisma.$transaction(async (tx) => {
        const p = await tx.page.create({
          data: {
            tagPath: '', slug: '',
            title: title || 'Homepage',
            content: (content as unknown as Prisma.InputJsonValue) || {},
            bannerImage, version: initialVersion, authorId: auth.session.userId,
          },
        });
        await tx.revision.create({
          data: {
            pageId: p.id, title: title || 'Homepage',
            content: (content as unknown as Prisma.InputJsonValue) || {},
            version: initialVersion, changeType: 'major',
            changes: [] as unknown as Prisma.InputJsonValue,
            authorId: auth.session.userId, message: 'Initial version',
          },
        });
        return p;
      });

      revalidateTag('wiki');
      return json(page, 201);
    }

    if (!existing) return errors.notFound('Page not found');

    const slugUpdate = newSlug && newSlug !== existing.slug ? slugify(newSlug) : undefined;
    if (slugUpdate) {
      const conflict = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath: existing.tagPath, slug: slugUpdate } } });
      if (conflict) return errors.badRequest('A page with that slug already exists in this category');
    }

    if (parsed.type !== 'homepage' && isAuthorOnlyPath(existing.tagPath) && existing.authorId !== auth.session.userId) {
      return errors.forbidden('You can only edit your own pages in this category');
    }

    let newVersion = existing.version;
    let changeType: string = 'patch';
    let changes: BlockChange[] = [];

    if (content || title) {
      const oldContent = (existing.content as unknown as Block[]) || [];
      const newContent = (content as unknown as Block[]) || oldContent;

      const diff = computeRevisionDiff(
        existing.version, oldContent, newContent,
        existing.title, title || existing.title,
        existing.bannerImage, bannerImage ?? existing.bannerImage
      );

      newVersion = formatVersion(diff.version);
      changeType = diff.changeType;
      changes = diff.changes;
    }

    if (metadata !== undefined) {
      const metadataKeys = getMetadataKeys(existing.tagPath.split('/'));
      const requiredKeys = metadataKeys.filter(k => k.required);
      const missingKeys = requiredKeys.filter(k => !metadata?.[k.key]?.trim());
      if (missingKeys.length > 0) {
        return errors.badRequest(`Missing required metadata: ${missingKeys.map(k => k.label).join(', ')}`);
      }
    }

    const page = await prisma.$transaction(async (tx) => {
      const p = await tx.page.update({
        where: { id: existing.id },
        data: {
          title: title ?? undefined, slug: slugUpdate ?? undefined,
          content: content !== undefined ? (content as unknown as Prisma.InputJsonValue) : undefined,
          excerpt: excerpt ?? undefined, bannerImage: bannerImage ?? undefined,
          metadata: metadata !== undefined ? (metadata as unknown as Prisma.InputJsonValue) : undefined,
          version: newVersion,
        },
        include: { author: AUTHOR_SELECT },
      });

      if (content || title) {
        await tx.revision.create({
          data: {
            pageId: p.id, title: title || existing.title,
            content: content ? (content as unknown as Prisma.InputJsonValue) : (existing.content as Prisma.InputJsonValue),
            version: newVersion, changeType,
            changes: changes as unknown as Prisma.InputJsonValue,
            authorId: auth.session.userId, message: revisionMessage,
          },
        });
      }

      return p;
    });

    if (existing.authorId !== auth.session.userId) {
      createNotification({ userId: existing.authorId, actorId: auth.session.userId, type: 'page_edited', pageId: existing.id }).catch(() => {});
    }
    const totalRevisions = await prisma.revision.count({ where: { authorId: auth.session.userId } });
    revalidateTag('wiki');
    return json({ ...page, isFirstContribution: totalRevisions === 1 });
  }, 'Failed to update');
}

export async function DELETE(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePath(path, 'api');

    if (parsed.type !== 'page') return errors.notFound('Invalid path');

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const existing = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } } });
    if (!existing) return errors.notFound('Page not found');
    if (existing.authorId !== auth.session.userId) return errors.forbidden();

    await prisma.page.delete({ where: { id: existing.id } });
    revalidateTag('wiki');
    return json({ success: true });
  }, 'Failed to delete');
}
