// src/app/api/wiki/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { slugify } from '@/lib/utils';
import { requireAuth } from '@/lib/api/auth';
import { isValidTagPath } from '@/lib/tags';
import type { WikiPageInput } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const search = searchParams.get('search') || '';
    const published = searchParams.get('published');
    const tagPath = searchParams.get('tagPath');

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

    return NextResponse.json({ items: pages, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('Failed to fetch pages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body: WikiPageInput = await request.json();
    const { title, content, excerpt, isPublished, tagPath } = body;

    if (!title || !content) return NextResponse.json({ error: 'Title and content required' }, { status: 400 });
    if (!tagPath || !isValidTagPath(tagPath.split('/'))) {
      return NextResponse.json({ error: 'Valid tag path required' }, { status: 400 });
    }

    let slug = body.slug || slugify(title);
    const existing = await prisma.page.findFirst({ where: { tagPath, slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const page = await prisma.page.create({
      data: {
        slug,
        title,
        content: content as Prisma.InputJsonValue,
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
        content: content as Prisma.InputJsonValue,
        authorId: auth.session.userId,
        message: 'Initial version',
      },
    });

    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    console.error('Failed to create page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}