// src/app/api/comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requireAuth } from '@/lib/radix/session';
import type { CommentInput } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    const comments = await prisma.comment.findMany({
      where: { pageId },
      include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body: CommentInput & { pageId: string } = await request.json();
    const { content, parentId, pageId } = body;

    if (!pageId) {
      return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Comment too long (max 5000 chars)' }, { status: 400 });
    }

    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { id: true } });
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.pageId !== pageId) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 400 });
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

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}