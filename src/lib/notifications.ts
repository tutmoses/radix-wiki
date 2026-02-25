// src/lib/notifications.ts

import { prisma } from '@/lib/prisma/client';
import type { NotificationType } from '@/types';

export async function createNotification(params: {
  userId: string;
  actorId: string;
  type: NotificationType;
  pageId: string;
  commentId?: string;
}) {
  if (params.userId === params.actorId) return;
  await prisma.notification.create({ data: params });
}
