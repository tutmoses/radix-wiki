// src/lib/site.ts – the canonical origin every absolute URL is built from, named
// and placed as in caper and acuiq2 so one grep finds it in all three.
import { ccBy40 } from 'wiki-formant/license';

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

// The grant, its name and the credit line, from `wiki-formant/license` — the
// same four fields the other two wikis had each written out. Only the site's own
// identity is passed in. Here rather than beside any one surface because every
// surface states it: the markdown twins, the llms exports, the feeds, the agent
// card, the OpenAPI info and the Article JSON-LD.
export const WIKI_LICENSE = ccBy40({ siteName: 'Radix Wiki', siteUrl: SITE_URL });
