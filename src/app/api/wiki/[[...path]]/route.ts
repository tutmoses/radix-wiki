// src/app/api/wiki/[[...path]]/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { slugify } from '@/lib/utils';
import { isValidTagPath, isAuthorOnlyPath } from '@/lib/tags';
import { json, errors, handleRoute, requireAuth, type RouteContext } from '@/lib/api';
import type { WikiPageInput } from '@/types';

type PathParams = { path?: string[] };

interface ParsedPath {
  type: 'homepage' | 'list' | 'page' | 'history';
  tagPath: string;
  slug: string;
}

function parsePath(segments: string[] = []): ParsedPath | null {
  if (segments.length === 0) return { type: 'homepage', tagPath: '', slug: '' };
  if (segments.length === 1 && segments[0] === 'history') return { type: 'history', tagPath: '', slug: '' };

  const isHistory = segments[segments.length - 1] === 'history';
  const pathSegments = isHistory ? segments.slice(0, -1) : segments;

  if (pathSegments.length < 2) return null;

  const slug = pathSegments[pathSegments.length - 1];
  const tagPathSegments = pathSegments.slice(0, -1);

  if (!isValidTagPath(tagPathSegments)) return null;

  return {
    type: isHistory ? 'history' : 'page',
    tagPath: tagPathSegments.join('/'),
    slug,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function GET(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const { searchParams } = new URL(request.url);

    // List mode: has pagination/search params and no specific path
    if (!path?.length && (searchParams.has('page') || searchParams.has('pageSize') || searchParams.has('search') || searchParams.has('tagPath') || searchParams.has('sort'))) {
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
      const search = searchParams.get('search') || '';
      const tagPath = searchParams.get('tagPath');
      const sort = searchParams.get('sort') || 'updatedAt';

      const where: Prisma.PageWhereInput = {};
      if (search) where.title = { contains: search, mode: 'insensitive' };
      if (tagPath) where.tagPath = { startsWith: tagPath };

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

    const parsed = parsePath(path);
    if (!parsed) return errors.notFound('Invalid path');

    // History mode
    if (parsed.type === 'history') {
      const page = await prisma.page.findFirst({
        where: { tagPath: parsed.tagPath, slug: parsed.slug },
        select: { id: true },
      });
      if (!page) return errors.notFound('Page not found');

      const revisions = await prisma.revision.findMany({
        where: { pageId: page.id },
        select: {
          id: true,
          title: true,
          message: true,
          createdAt: true,
          author: { select: { id: true, displayName: true, radixAddress: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return json(revisions);
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
    const parsed = parsePath(path);

    // Restore revision
    if (parsed?.type === 'history') {
      const auth = await requireAuth(request);
      if ('error' in auth) return auth.error;

      const page = await prisma.page.findFirst({ where: { tagPath: parsed.tagPath, slug: parsed.slug } });
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

      const content = revision.content as Prisma.InputJsonValue;

      await prisma.page.update({
        where: { id: page.id },
        data: { title: revision.title, content },
      });

      await prisma.revision.create({
        data: {
          pageId: page.id,
          title: revision.title,
          content,
          authorId: auth.session.userId,
          message: `Restored from revision ${formatDate(revision.createdAt)}`,
        },
      });

      return json({ success: true });
    }

    // Create new page
    const body: WikiPageInput = await request.json();
    const { title, content, excerpt, bannerImage, tagPath } = body;

    if (!title || !content) return errors.badRequest('Title and content required');
    if (!tagPath || !isValidTagPath(tagPath.split('/'))) {
      return errors.badRequest('Valid tag path required');
    }

    const auth = await requireAuth(request, { type: 'create', tagPath });
    if ('error' in auth) return auth.error;

    let slug = body.slug || slugify(title);
    const existing = await prisma.page.findFirst({ where: { tagPath, slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const page = await prisma.page.create({
      data: {
        slug,
        title,
        content: content as unknown as Prisma.InputJsonValue,
        excerpt,
        bannerImage,
        tagPath,
        authorId: auth.session.userId,
      },
      include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
    });

    await prisma.revision.create({
      data: {
        pageId: page.id,
        title,
        content: content as unknown as Prisma.InputJsonValue,
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
    const parsed = parsePath(path);

    if (!parsed || parsed.type === 'history') return errors.notFound('Invalid path');

    const isHomepage = parsed.type === 'homepage';
    const auth = await requireAuth(request, isHomepage ? { type: 'editHomepage' } : { type: 'edit', tagPath: parsed.tagPath });
    if ('error' in auth) return auth.error;

    const body: Partial<WikiPageInput> & { revisionMessage?: string } = await request.json();
    const { title, content, excerpt, bannerImage, revisionMessage } = body;

    const existing = await prisma.page.findFirst({ where: { tagPath: parsed.tagPath, slug: parsed.slug } });

    // Homepage creation if it doesn't exist
    if (!existing && isHomepage) {
      const page = await prisma.page.create({
        data: {
          tagPath: '',
          slug: '',
          title: title || 'Homepage',
          content: (content as unknown as Prisma.InputJsonValue) || {},
          bannerImage,
          authorId: auth.session.userId,
        },
      });

      await prisma.revision.create({
        data: {
          pageId: page.id,
          title: title || 'Homepage',
          content: (content as unknown as Prisma.InputJsonValue) || {},
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

    const page = await prisma.page.update({
      where: { id: existing.id },
      data: {
        title: title ?? undefined,
        content: content !== undefined ? (content as unknown as Prisma.InputJsonValue) : undefined,
        excerpt: excerpt ?? undefined,
        bannerImage: bannerImage ?? undefined,
      },
      include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
    });

    if (content || title) {
      await prisma.revision.create({
        data: {
          pageId: page.id,
          title: title || existing.title,
          content: content ? (content as unknown as Prisma.InputJsonValue) : (existing.content as Prisma.InputJsonValue),
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
    const parsed = parsePath(path);

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