import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !/goo\.gl|maps\.app\.goo\.gl/.test(url))
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return NextResponse.json({ resolved: res.url });
  } catch {
    return NextResponse.json({ error: 'Failed to resolve' }, { status: 502 });
  }
}
