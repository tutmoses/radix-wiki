// src/app/api/backup/route.ts — Database backup to Vercel Blob

import { NextResponse } from 'next/server';
import { put, list, del } from '@vercel/blob';
import pg from 'pg';
import { cronRoute, json } from '@/lib/api';

const BACKUP_PREFIX = 'backups/';
const MAX_BACKUPS = 7;

// Tables to skip (ephemeral auth data)
const SKIP_TABLES = ['sessions', 'challenges'];

async function dumpDatabase(): Promise<string> {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();

    // Get all table names
    const { rows: tables } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`
    );

    const dump: Record<string, unknown[]> = {};

    for (const { tablename } of tables) {
      if (SKIP_TABLES.includes(tablename)) continue;
      const { rows } = await client.query(`SELECT * FROM "${tablename}"`);
      dump[tablename] = rows;
    }

    client.release();
    return JSON.stringify(dump);
  } finally {
    await pool.end();
  }
}

async function pruneOldBackups() {
  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  if (blobs.length <= MAX_BACKUPS) return 0;

  // Sort oldest first, delete extras
  const sorted = blobs.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
  const toDelete = sorted.slice(0, sorted.length - MAX_BACKUPS);

  for (const blob of toDelete) {
    await del(blob.url);
  }

  return toDelete.length;
}

export const GET = cronRoute(async () => {
  const data = await dumpDatabase();
  const compressed = Buffer.from(data);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${BACKUP_PREFIX}radix-wiki-${timestamp}.json`;

  const blob = await put(filename, compressed, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });

  const pruned = await pruneOldBackups();

  return json({
    ok: true,
    url: blob.url,
    size: `${(compressed.byteLength / 1024).toFixed(1)} KB`,
    pruned,
  });
}, 'Backup failed');

// List existing backups
export async function POST(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  const sorted = blobs
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .map(b => ({
      name: b.pathname,
      size: `${(b.size / 1024).toFixed(1)} KB`,
      uploaded: b.uploadedAt,
      url: b.url,
    }));

  return NextResponse.json({ backups: sorted, count: sorted.length });
}
