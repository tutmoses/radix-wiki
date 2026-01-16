// src/app/api/wiki/[...path]/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { isValidTagPath, isAuthorOnlyPath } from '@/lib/tags';
import { json, errors, handleRoute, requireAuth, type RouteContext } from '@/lib/api';
import type { WikiPageInput } from '@/types';

function parsePathParams(segments: string[]): { tagPath: string; slug: string; isHistory: boolean } | null {
  if (segments.length < 2) return null;
  
  const isHistory = segments[segments.length - 1] === 'history';
  const pathSegments = isHistory ? segments.slice(0, -1) : segments;
  
  if (pathSegments.length < 2) return null;
  
  const slug = pathSegments[pathSegments.length - 1];
  const tagPathSegments = pathSegments.slice(0, -1);
  if (!isValidTagPath(tagPathSegments)) return null;
  return { tagPath: tagPathSegments.join('/'), slug, isHistory };
}

export async function GET(_request: NextRequest, context: RouteContext<{ path: string[] }>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePathParams(path);
    if (!parsed) return errors.notFound('Page not found');

    if (parsed.isHistory) {
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

    const page = await prisma.page.findFirst({
      where: { tagPath: parsed.tagPath, slug: parsed.slug },
      include: {
        author: { select: { id: true, displayName: true, radixAddress: true } },
        revisions: { select: { id: true } },
      },
    });

    if (!page) return errors.notFound('Page not found');
    return json(page);
  }, 'Failed to fetch page');
}

export async function PUT(request: NextRequest, context: RouteContext<{ path: string[] }>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePathParams(path);
    if (!parsed || parsed.isHistory) return errors.notFound('Page not found');

    const existingPage = await prisma.page.findFirst({ where: { tagPath: parsed.tagPath, slug: parsed.slug } });
    if (!existingPage) return errors.notFound('Page not found');

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    // Author-only pages can only be edited by their owner
    if (isAuthorOnlyPath(existingPage.tagPath) && existingPage.authorId !== auth.session.userId) {
      return errors.forbidden('You can only edit your own pages in this category');
    }

    const balanceAuth = await requireAuth(request, { type: 'edit', tagPath: parsed.tagPath });
    if ('error' in balanceAuth) return balanceAuth.error;

    const body: Partial<WikiPageInput> & { revisionMessage?: string } = await request.json();
    const { title, content, excerpt, isPublished, revisionMessage } = body;

    const page = await prisma.page.update({
      where: { id: existingPage.id },
      data: {
        title: title ?? undefined,
        content: content !== undefined ? (content as unknown as Prisma.InputJsonValue) : undefined,
        excerpt: excerpt ?? undefined,
        isPublished: isPublished ?? undefined,
      },
      include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
    });

    if (content || title) {
      await prisma.revision.create({
        data: {
          pageId: page.id,
          title: title || existingPage.title,
          content: content ? (content as unknown as Prisma.InputJsonValue) : (existingPage.content as Prisma.InputJsonValue),
          authorId: auth.session.userId,
          message: revisionMessage,
        },
      });
    }

    return json(page);
  }, 'Failed to update page');
}

export async function DELETE(request: NextRequest, context: RouteContext<{ path: string[] }>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePathParams(path);
    if (!parsed || parsed.isHistory) return errors.notFound('Page not found');

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const existingPage = await prisma.page.findFirst({ where: { tagPath: parsed.tagPath, slug: parsed.slug } });
    if (!existingPage) return errors.notFound('Page not found');
    if (existingPage.authorId !== auth.session.userId) return errors.forbidden();

    await prisma.page.delete({ where: { id: existingPage.id } });
    return json({ success: true });
  }, 'Failed to delete page');
}