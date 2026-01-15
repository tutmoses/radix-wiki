// src/app/api/comments/[id]/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, requireAuth, type RouteContext } from '@/lib/api';

export async function DELETE(request: NextRequest, context: RouteContext<{ id: string }>) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return errors.notFound('Comment not found');
    if (comment.authorId !== auth.session.userId) return errors.forbidden();

    await prisma.comment.delete({ where: { id } });
    return json({ success: true });
  }, 'Failed to delete comment');
}