// src/app/api/comments/[[...path]]/route.ts

import { NextRequest, after } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute } from 'wiki-formant/http';
import { parsePagination, paginatedResponse } from 'wiki-formant/pagination';
import { requireAuth, CACHE, type RouteContext } from '@/lib/api';
import { AUTHOR_SELECT, isIdeasPath, pageTag, revalidatePage } from '@/lib/wiki';
import type { CommentInput } from '@/types';
import { deliverWebhooks } from '@/lib/webhooks';

type PathParams = { path?: string[] };

/** A comment changes its page, and on the ideas board the listing's reply count and last activity too. */
function revalidateDiscussion({ tagPath, slug }: { tagPath: string; slug: string }) {
  if (isIdeasPath(tagPath)) revalidatePage(tagPath, slug);
  else revalidateTag(pageTag(tagPath, slug), { expire: 0 });
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const { page, pageSize } = parsePagination(searchParams, { pageSize: 50 });

    if (!pageId) return errors.badRequest('pageId is required');

    const where = { pageId };
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: { author: AUTHOR_SELECT },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.comment.count({ where }),
    ]);

    const res = json(paginatedResponse(comments, total, page, pageSize));
    res.headers.set('Cache-Control', CACHE.medium['Cache-Control']);
    return res;
  }, 'Failed to fetch comments');
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body: CommentInput & { pageId: string } = await request.json();
    const { content, parentId, pageId } = body;

    if (!pageId) return errors.badRequest('pageId is required');
    if (!content?.trim()) return errors.badRequest('Content is required');
    if (content.length > 5000) return errors.badRequest('Comment too long (max 5000 chars)');

    const page = await prisma.wikiPage.findUnique({ where: { id: pageId }, select: { id: true, slug: true, title: true, tagPath: true, version: true, authorId: true } });
    if (!page) return errors.notFound('Page not found');

    const auth = await requireAuth(request, { type: 'comment', tagPath: page.tagPath });
    if ('error' in auth) return auth.error;

    let parentComment: { id: string; authorId: string; pageId: string } | null = null;
    if (parentId) {
      parentComment = await prisma.comment.findUnique({ where: { id: parentId }, select: { id: true, authorId: true, pageId: true } });
      if (!parentComment || parentComment.pageId !== pageId) {
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
      include: { author: AUTHOR_SELECT },
    });
    revalidateDiscussion(page);

    // Notifications are written after the response, never failing the comment.
    const notify = (userId: string, type: string) => after(() =>
      prisma.notification.create({ data: { userId, actorId: auth.session.userId, type, pageId, commentId: comment.id } }).catch(() => {}));
    if (page.authorId && page.authorId !== auth.session.userId) notify(page.authorId, 'comment_on_page');
    if (parentComment && parentComment.authorId !== auth.session.userId) notify(parentComment.authorId, 'comment_reply');

    deliverWebhooks('comment.created', page, null, { displayName: auth.session.displayName ?? null, radixAddress: auth.session.radixAddress }, { id: comment.id, content: comment.content, parentId: parentId || null });
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

    // The delete cascades to the replies, at any depth; the notifications naming any
    // of them go too, rather than pointing at a comment that is gone.
    const ids = [id];
    for (let level = [id]; level.length; ids.push(...level)) {
      level = (await prisma.comment.findMany({ where: { parentId: { in: level } }, select: { id: true } })).map(c => c.id);
    }
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { commentId: { in: ids } } }),
      prisma.comment.delete({ where: { id } }),
    ]);
    const page = await prisma.wikiPage.findUnique({ where: { id: comment.pageId }, select: { tagPath: true, slug: true } });
    if (page) revalidateDiscussion(page);
    return json({ success: true });
  }, 'Failed to delete comment');
}