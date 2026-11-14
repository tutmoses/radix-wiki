// src/lib/entity-ld.ts
//
// Maps the per-tag-path infobox metadata declared in tags.ts onto schema.org
// entities. Those keys (assets/status/founded/website/github/license/…) are the
// richest structured data on any wiki page, and until now rendered only as an
// untyped <table>: a parser could read the prose but could not tell that
// /ecosystem/radixscan describes an Organization founded in 2023 with a known
// website and X handle.
//
// Two outputs, deliberately separate:
//   articleType() – what the PAGE is (TechArticle for developer docs, …)
//   aboutEntity() – what the page is ABOUT (the Organization, tool, or event)

import { categoryLabel } from '@/lib/utils';
import { isoDate } from 'wiki-formant/freshness';
import { plainText } from 'wiki-formant/text';
import { decodeEntities } from 'wiki-formant/markdown';
import { SITE_REFS, SITE_URL } from '@/lib/site';
import { SERIES_SLUG, RECAP_PREFIX } from '@/lib/week-in-review';

/** The terms the concept and protocol pages define, one set for the wiki. */
const GLOSSARY = {
  '@type': 'DefinedTermSet',
  '@id': `${SITE_URL}/#glossary`,
  name: 'Radix Glossary',
  url: `${SITE_URL}/contents/tech/core-concepts`,
};

const WEEK_IN_REVIEW = {
  '@type': 'CreativeWorkSeries',
  '@id': `${SITE_URL}/blog/${SERIES_SLUG}#series`,
  name: 'Radix Week in Review',
  url: `${SITE_URL}/blog/${SERIES_SLUG}`,
};

const MAX_MENTIONS = 20;

const URL_KEYS = ['website', 'x', 'telegram', 'github', 'discord'] as const;

/** Metadata stores bare hostnames ("radixscan.io") as often as full URLs; sameAs needs absolute. */
function absoluteHttpUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(href).toString();
  } catch {
    return null;
  }
}

/** "30 minutes" -> "PT30M". Returns undefined when the text isn't a simple duration. */
function isoDuration(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = value.trim().match(/^(\d+)\s*(min(ute)?s?|h(ou)?rs?|days?)\b/i);
  if (!m) return undefined;
  const n = m[1];
  const unit = m[2]!.toLowerCase();
  if (unit.startsWith('min')) return `PT${n}M`;
  if (unit.startsWith('h')) return `PT${n}H`;
  return `P${n}D`;
}

/** ISO date, or undefined when the stored value isn't parseable. */
function storedDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : isoDate(d);
}

function sameAs(md: Record<string, string>): string[] {
  return URL_KEYS.map(k => (md[k] ? absoluteHttpUrl(md[k]!) : null)).filter((v): v is string => v !== null);
}

function segments(tagPath: string | null | undefined): string[] {
  return (tagPath ?? '').split('/').filter(Boolean);
}

/**
 * The schema.org type for the page itself. `Article` is correct for the
 * encyclopedic core, but developer documentation and blog essays have more
 * specific types that carry the same properties.
 */
export function articleType(tagPath: string | null | undefined, slug?: string): string {
  if (tagPath === 'contents/resources' && slug === 'about') return 'AboutPage';
  const [root] = segments(tagPath);
  if (root === 'developers') return 'TechArticle';
  if (root === 'blog') return 'BlogPosting';
  return 'Article';
}

/**
 * Extra CreativeWork properties implied by a page's metadata. Tutorial pages
 * declare difficulty and estimated time; both are CreativeWork properties, so
 * they belong on the article rather than in a separate entity. Deliberately not
 * `HowTo` — these are prose tutorials, and HowTo without a step list is invalid.
 * Prerequisites stay out: `competencyRequired` belongs to `LearningResource`, and
 * validators reject it on a `TechArticle`.
 */
export function articleLearningProps(
  tagPath: string | null | undefined,
  metadata: unknown,
): Record<string, unknown> {
  const [root] = segments(tagPath);
  if (root !== 'developers') return {};
  const md = (metadata ?? {}) as Record<string, string>;
  const level = categoryLabel(md.difficulty) || undefined;
  const time = isoDuration(md.estimatedTime);
  if (!level && !time) return {};
  return {
    learningResourceType: 'Tutorial',
    ...(level && { educationalLevel: level }),
    ...(time && { timeRequired: time }),
  };
}

/**
 * The entity the page documents, for `Article.about`. Returns null where the
 * page is prose about a concept rather than a record of a thing — a
 * `Thing`-typed placeholder would add noise without adding meaning.
 */
export function aboutEntity(
  tagPath: string | null | undefined,
  title: string,
  metadata: unknown,
  page: { description?: string; image: string; url: string },
): Record<string, unknown> | null {
  const segs = segments(tagPath);
  const [root, child, grandchild] = segs;
  const md = (metadata ?? {}) as Record<string, string>;
  const links = sameAs(md);
  const founded = storedDate(md.founded);
  const status = categoryLabel(md.status) || undefined;

  // Third-party developer tools and agent projects.
  if (root === 'developers' && (child === 'tools' || child === 'ai-agents')) {
    const repo = md.github ? absoluteHttpUrl(md.github) : null;
    return {
      '@type': 'SoftwareApplication',
      name: title,
      applicationCategory: 'DeveloperApplication',
      ...(links.length && { sameAs: links }),
      ...(repo && { codeRepository: repo }),
      ...(md.license && { license: md.license }),
      ...(founded && { datePublished: founded }),
      ...(status && { creativeWorkStatus: status }),
      ...(md.team && { author: { '@type': 'Organization', name: md.team } }),
    };
  }

  // Ecosystem projects: the largest typed set on the wiki (140 pages).
  if (root === 'ecosystem') {
    const category = categoryLabel(md.category) || undefined;
    return {
      '@type': 'Organization',
      name: title,
      ...(links.length && { sameAs: links }),
      ...(md.website && absoluteHttpUrl(md.website) && { url: absoluteHttpUrl(md.website)! }),
      ...(founded && { foundingDate: founded }),
      ...(category && { additionalType: category, keywords: category }),
      ...(status && { disambiguatingDescription: `Status: ${status}` }),
      // The on-ledger resource address is the project's canonical machine identifier.
      ...(md.assets && { identifier: md.assets }),
    };
  }

  // Concept and protocol pages each define one Radix term, so the page is about
  // that term: the typed form of "what is X on Radix".
  if (root === 'contents' && child === 'tech' && (grandchild === 'core-concepts' || grandchild === 'core-protocols')) {
    return {
      '@type': 'DefinedTerm',
      name: title,
      url: page.url,
      ...(page.description && { description: page.description }),
      inDefinedTermSet: GLOSSARY,
    };
  }

  // Gatherings only. The same tag path also holds milestones — an exploit, an
  // RFP round, a subsidy sunset — which are records of something that happened
  // rather than something anyone attended: an `Event` for those asserts a venue
  // and an attendance mode that never existed. `location` is required on Event,
  // so a gathering still missing one gets no entity rather than an invalid one.
  // Organizer, performer and offers stay unset: no metadata key records them,
  // and Google lists them as recommended, not required.
  if (root === 'contents' && child === 'history') {
    const date = storedDate(md.date);
    const endDate = storedDate(md.endDate);
    const gathering = ['Conference', 'Hackathon', 'Workshop'].includes(categoryLabel(md.type));
    if (!date || !gathering || !md.location) return null;
    return {
      '@type': 'Event',
      name: title,
      startDate: date,
      ...(endDate && { endDate }),
      eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'Place', name: md.location, address: md.location },
      ...(page.description && { description: page.description }),
      image: page.image,
      ...(links.length && { sameAs: links }),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    };
  }

  return null;
}

/** An anchor's href and inner HTML, for every `<a>` in the HTML. */
const ANCHOR = /<a\s[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

/** A site-relative path for an internal href, without query or fragment; null for anything off-site. */
function internalPath(href: string): string | null {
  const h = href.startsWith(SITE_URL) ? href.slice(SITE_URL.length) || '/' : href;
  if (!h.startsWith('/') || h.startsWith('//') || h.startsWith('/api/')) return null;
  const path = h.split(/[?#]/)[0]!.replace(/\/+$/, '');
  return path || null;
}

/** The wiki pages a page links to, named by their titles, in the order first linked. Links to anything but a page are left out. */
function mentions(html: string, self: string, titles: Record<string, string>): Record<string, unknown>[] {
  const seen = new Map<string, string>();
  for (const [, href = ''] of html.matchAll(ANCHOR)) {
    const path = internalPath(href);
    const title = path && titles[path];
    if (!title || path === self || seen.has(path)) continue;
    seen.set(path, title);
    if (seen.size === MAX_MENTIONS) break;
  }
  return [...seen].map(([path, name]) => ({ '@type': 'Thing', name, url: `${SITE_URL}${path}` }));
}

/** The first off-site href in a metadata field's HTML. */
function externalHref(html: string | undefined): string | undefined {
  for (const [, href = ''] of (html ?? '').matchAll(ANCHOR)) {
    if (/^https?:\/\//i.test(href) && !href.startsWith(SITE_URL)) return href;
  }
  return undefined;
}

/** Source text from a code tab, which the page render has already highlighted into markup. */
function sourceText(code: string): string {
  return code.includes('<') ? decodeEntities(code.replace(/<[^>]+>/g, '')).trim() : code.trim();
}

/** A `<pre>` code block, raw or already highlighted: its language and its markup. */
const PRE = /<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi;

/** The code a page shows in its prose, as the label-less tabs `codeTabs` would give. */
function preBlocks(html: string): { language?: string; code: string }[] {
  return [...html.matchAll(PRE)].map(([, attrs = '', inner = '']) => {
    const language = (attrs + inner.slice(0, 200)).match(/(?:data-language="|language-)([\w+-]+)/)?.[1];
    return { ...(language && { language }), code: inner };
  });
}

/**
 * The Article properties read from the page's own content and record rather than
 * its tag's metadata keys: when it was last checked, which wiki pages it
 * mentions, the official docs a guide carries forward, its code samples, an idea
 * card's status, and the series a recap belongs to.
 */
export function articleGraphProps(p: {
  tagPath: string;
  slug: string;
  url: string;
  metadata: unknown;
  html: string;
  codeTabs: { label?: string; language?: string; code: string }[];
  lastVerifiedAt?: Date | string | null;
  titles: Record<string, string>;
}): Record<string, unknown> {
  const [root] = segments(p.tagPath);
  const md = (p.metadata ?? {}) as Record<string, string>;
  const self = new URL(p.url).pathname;
  const reviewed = p.lastVerifiedAt ? isoDate(new Date(p.lastVerifiedAt)) : undefined;
  const linked = mentions(p.html.replace(PRE, ''), self, p.titles);
  const out: Record<string, unknown> = {
    // `lastReviewed` is a WebPage property, so it rides on the page the article is the main entity of.
    ...(reviewed && { mainEntityOfPage: { '@type': 'WebPage', '@id': p.url, lastReviewed: reviewed } }),
    ...(linked.length && { mentions: linked }),
  };

  if (root === 'developers') {
    const basedOn = externalHref(md.officialDocs);
    const prerequisites = md.prerequisites ? plainText(md.prerequisites).trim() : '';
    const samples = [...p.codeTabs, ...preBlocks(p.html)].filter(t => t.code).map(t => ({
      '@type': 'SoftwareSourceCode',
      ...('label' in t && t.label ? { name: t.label } : {}),
      ...(t.language && { programmingLanguage: t.language }),
      codeSampleType: 'code snippet',
      text: sourceText(t.code),
    }));
    Object.assign(out, {
      ...(basedOn && { isBasedOn: basedOn }),
      ...(prerequisites && !/^none$/i.test(prerequisites) && { dependencies: prerequisites }),
      ...(samples.length && { hasPart: samples }),
    });
  }

  if (root === 'ideas') {
    const status = categoryLabel(md.status) || undefined;
    Object.assign(out, {
      ...(status && { creativeWorkStatus: status }),
      ...(md.assignee && { contributor: { '@type': 'Person', name: md.assignee } }),
    });
  }

  if (root === 'blog' && p.slug.startsWith(RECAP_PREFIX)) {
    out.isPartOf = [SITE_REFS.website, WEEK_IN_REVIEW];
  }

  return out;
}
