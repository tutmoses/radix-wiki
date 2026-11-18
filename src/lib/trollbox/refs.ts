// src/lib/trollbox/refs.ts – the pages and people a line names, resolved when it is posted.
//
// A line tags a page the way a wiki links one, `[[Radix Engine]]` or
// `[[contents/tech/core-protocols/radix-engine]]`, or by pasting its address. A
// section is tagged the same way, by its name or its path, whether or not it
// has an article of its own: `[[Ideas Pipeline]]` is the board at /ideas. A
// mention is `@name`, with the account it names sent beside the body, because a
// name is not unique and may hold spaces. Each is stored with the text it
// stands for and what it resolved to, so the room draws the line without
// looking anything up, and a page renamed later keeps the title it was called by.

import { prisma } from '@/lib/prisma/client';
import { parsePath } from '@/lib/path';
import { SITE_URL } from '@/lib/site';
import { TAG_TREE } from '@/lib/tags';
import { categoryLabel, pagePath } from '@/lib/utils';
import { getTitleIndex } from '@/lib/wiki';
import type { Ref } from '.';

/** The most pages, and the most people, one line may name. */
const MAX_REFS = 5;

const WIKILINK = /\[\[([^\[\]\n]{1,120})\]\]/g;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The wiki's own addresses, at the canonical origin and at radix.wiki whatever this deployment is.
const WIKI_URL = new RegExp(`(?:${[...new Set([SITE_URL, 'https://radix.wiki'])].map(escape).join('|')})(/[^\\s<>"'\\[\\]]*)`, 'g');

/** The address a path names, as the title index keys it, or null when it is no page's. */
function addressOf(path: string): string | null {
  const segments = path.split(/[?#]/)[0]!.split('/').filter(Boolean);
  const parsed = parsePath(segments);
  return parsed.type === 'page' || parsed.type === 'category' || parsed.type === 'homepage' ? pagePath(parsed.tagPath, parsed.slug) : null;
}

/**
 * What can be tagged, by address: every page under its title, and every section
 * under its article's title or, where it has none, its own name.
 */
async function taggable(): Promise<Record<string, string>> {
  const titles = await getTitleIndex();
  const sections = TAG_TREE.paths().filter(p => p.path && !p.hidden).map(p => [`/${p.path}`, categoryLabel(p.node.name)] as const);
  return { ...Object.fromEntries(sections), ...titles };
}

// A section answers to its name as well as to its article's title.
const SECTION_NAMES = TAG_TREE.paths().filter(p => p.path && !p.hidden).map(p => [categoryLabel(p.node.name).toLowerCase(), `/${p.path}`] as const);

/** The pages a body tags and the accounts in `mentioned` it names, in the order they appear. */
export async function refsOf(body: string, mentioned: unknown): Promise<Ref[]> {
  const refs: Ref[] = [];

  const links = [...body.matchAll(WIKILINK)].map(m => ({ match: m[0], named: m[1]!.trim() }));
  const urls = [...body.matchAll(WIKI_URL)].map(m => ({ match: m[0].replace(/[.,;:!?)]+$/, ''), named: null }));
  if (links.length || urls.length) {
    const titles = await taggable();
    // A page's title wins a name it shares with a section.
    const byTitle = new Map([...SECTION_NAMES, ...Object.entries(titles).map(([path, title]) => [title.toLowerCase(), path] as const)]);
    for (const { match, named } of [...links, ...urls].slice(0, MAX_REFS)) {
      const address = named === null
        ? addressOf(new URL(match).pathname)
        // A wikilink names a page by its address or, failing that, by its title.
        : [addressOf(named), byTitle.get(named.toLowerCase())].find(path => path && path in titles);
      if (address && address in titles && !refs.some(r => r.match === match)) refs.push({ kind: 'page', match, path: address, title: titles[address]! });
    }
  }

  const ids = Array.isArray(mentioned) ? [...new Set(mentioned.filter((id): id is string => typeof id === 'string'))].slice(0, MAX_REFS) : [];
  if (ids.length) {
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, shortAddress: true } });
    for (const user of users) {
      const match = `@${user.displayName || user.shortAddress}`;
      // Only a name still in the line is a mention: one typed over after it was picked is not.
      if (match.length > 1 && body.includes(match)) refs.push({ kind: 'user', match, id: user.id, name: match.slice(1) });
    }
  }
  return refs;
}

/** A line's text with each tag read as what it names: the form a reply quotes. */
export function plainText(body: string, refs: Ref[]): string {
  return refs.reduce((text, ref) => (ref.kind === 'page' ? text.split(ref.match).join(ref.title) : text), body);
}
