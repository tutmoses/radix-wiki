// src/app/api/comments/[[...path]]/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, requireAuth, type RouteContext } from '@/lib/api';
import type { CommentInput } from '@/types';

type PathParams = { path?: string[] };

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    if (!pageId) return errors.badRequest('pageId is required');

    const where = { pageId };
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.comment.count({ where }),
    ]);

    return json({ items: comments, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  }, 'Failed to fetch comments');
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body: CommentInput & { pageId: string } = await request.json();
    const { content, parentId, pageId } = body;

    if (!pageId) return errors.badRequest('pageId is required');
    if (!content?.trim()) return errors.badRequest('Content is required');
    if (content.length > 5000) return errors.badRequest('Comment too long (max 5000 chars)');

    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { id: true, tagPath: true } });
    if (!page) return errors.notFound('Page not found');

    const auth = await requireAuth(request, { type: 'comment', tagPath: page.tagPath });
    if ('error' in auth) return auth.error;

    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.pageId !== pageId) {
        return errors.badRequest('Parent comment not found');
      }
    }

    const comment = await prisma.comment.create({
      data: {
        pageId,
        parentId: parentId || null,
        content: content.trim(),
        authorId: auth.session.userId,
      },
      include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
    });

    return json(comment, 201);
  }, 'Failed to create comment');
}

export async function DELETE(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const id = path?.[0];

    if (!id) return errors.badRequest('Comment ID required');

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return errors.notFound('Comment not found');
    if (comment.authorId !== auth.session.userId) return errors.forbidden();

    await prisma.comment.delete({ where: { id } });
    return json({ success: true });
  }, 'Failed to delete comment');
}