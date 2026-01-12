// src/app/api/wiki/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/radix/session';
import { isValidTagPath } from '@/lib/tags';
import { requireBalance } from '@/lib/radix/balance';
import type { WikiPageInput } from '@/types';

type RouteContext = { params: Promise<{ path: string[] }> };

function parsePathParams(segments: string[]): { tagPath: string; slug: string } | null {
  if (segments.length < 2) return null;
  const slug = segments[segments.length - 1];
  const tagPathSegments = segments.slice(0, -1);
  if (!isValidTagPath(tagPathSegments)) return null;
  return { tagPath: tagPathSegments.join('/'), slug };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const parsed = parsePathParams(path);
    if (!parsed) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    const page = await prisma.page.findFirst({
      where: { tagPath: parsed.tagPath, slug: parsed.slug },
      include: {
        author: { select: { id: true, displayName: true, radixAddress: true } },
        revisions: { select: { id: true } },
      },
    });

    if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    return NextResponse.json(page);
  } catch (error) {
    console.error('Failed to fetch page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const parsed = parsePathParams(path);
    if (!parsed) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    const auth = await requireAuth(request);
    if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existingPage = await prisma.page.findFirst({ where: { tagPath: parsed.tagPath, slug: parsed.slug } });
    if (!existingPage) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    if (existingPage.authorId !== auth.session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const balanceCheck = await requireBalance(auth.session, { type: 'edit', tagPath: parsed.tagPath });
    if (!balanceCheck.ok) return balanceCheck.response;

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

    return NextResponse.json(page);
  } catch (error) {
    console.error('Failed to update page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const parsed = parsePathParams(path);
    if (!parsed) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    const auth = await requireAuth(request);
    if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existingPage = await prisma.page.findFirst({ where: { tagPath: parsed.tagPath, slug: parsed.slug } });
    if (!existingPage) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    if (existingPage.authorId !== auth.session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.page.delete({ where: { id: existingPage.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}