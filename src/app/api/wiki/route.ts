// src/app/api/wiki/route.ts

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { slugify } from '@/lib/utils';
import { isValidTagPath } from '@/lib/tags';
import { json, errors, handleRoute, withAuth, withAuthAndBalance } from '@/lib/api';
import type { WikiPageInput } from '@/types';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const search = searchParams.get('search') || '';
    const published = searchParams.get('published');
    const tagPath = searchParams.get('tagPath');

    if (!search && !published && !tagPath && !searchParams.has('page') && !searchParams.has('pageSize')) {
      const homepage = await prisma.page.findFirst({ where: { tagPath: '', slug: '' } });
      return json(homepage);
    }

    const where: Prisma.PageWhereInput = {};
    if (published === 'true') where.isPublished = true;
    else if (published === 'false') where.isPublished = false;
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (tagPath) where.tagPath = { startsWith: tagPath };

    const [pages, total] = await Promise.all([
      prisma.page.findMany({
        where,
        include: { author: { select: { id: true, displayName: true, radixAddress: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.page.count({ where }),
    ]);

    return json({ items: pages, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  }, 'Failed to fetch pages');
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body: WikiPageInput = await request.json();
    const { title, content, excerpt, isPublished, tagPath } = body;

    if (!title || !content) return errors.badRequest('Title and content required');
    if (!tagPath || !isValidTagPath(tagPath.split('/'))) {
      return errors.badRequest('Valid tag path required');
    }

    const auth = await withAuthAndBalance(request, { type: 'create', tagPath });
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
        isPublished: isPublished ?? false,
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
  }, 'Failed to create page');
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const auth = await withAuthAndBalance(request, { type: 'editHomepage' });
    if ('error' in auth) return auth.error;

    const body: Partial<WikiPageInput> = await request.json();
    const { title, content } = body;

    const existing = await prisma.page.findFirst({ where: { tagPath: '', slug: '' } });

    if (existing) {
      const page = await prisma.page.update({
        where: { id: existing.id },
        data: {
          title: title ?? undefined,
          content: content !== undefined ? (content as unknown as Prisma.InputJsonValue) : undefined,
        },
      });
      return json(page);
    } else {
      const page = await prisma.page.create({
        data: {
          tagPath: '',
          slug: '',
          title: title || 'Homepage',
          content: (content as unknown as Prisma.InputJsonValue) || {},
          isPublished: true,
          authorId: auth.session.userId,
        },
      });
      return json(page, 201);
    }
  }, 'Failed to update homepage');
}