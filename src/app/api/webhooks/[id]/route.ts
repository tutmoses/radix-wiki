// src/app/api/webhooks/[id]/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { json, errors, handleRoute, requireAuth, type RouteContext } from '@/lib/api';

type Params = { id: string };

export async function DELETE(request: NextRequest, context: RouteContext<Params>) {
  return handleRoute(async () => {
    const { id } = await context.params;
    if (!id) return errors.badRequest('Webhook ID required');

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) return errors.notFound('Webhook not found');
    if (webhook.userId !== auth.session.userId) return errors.forbidden();

    await prisma.webhook.delete({ where: { id } });
    return json({ success: true });
  }, 'Failed to delete webhook');
}
