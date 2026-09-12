// src/lib/site.ts – the canonical origin every absolute URL is built from, named
// and placed as in caper and acuiq2 so one grep finds it in all three.
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
