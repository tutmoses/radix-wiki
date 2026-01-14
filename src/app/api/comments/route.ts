// src/app/api/comments/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, withAuthAndBalance } from '@/lib/api';
import type { CommentInput } from '@/types';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) return errors.badRequest('pageId is required');

    const comments = await prisma.comment.findMany({
      where: { pageId },
      include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return json(comments);
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

    const auth = await withAuthAndBalance(request, { type: 'comment', tagPath: page.tagPath });
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