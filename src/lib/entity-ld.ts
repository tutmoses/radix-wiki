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

/** Select-typed values carry an emoji prefix ("🟢 Active") that is presentation, not data. */
function plainValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const stripped = value.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  return stripped || undefined;
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
function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
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
export function articleType(tagPath: string | null | undefined): string {
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
 */
export function articleLearningProps(
  tagPath: string | null | undefined,
  metadata: unknown,
): Record<string, unknown> {
  const [root] = segments(tagPath);
  if (root !== 'developers') return {};
  const md = (metadata ?? {}) as Record<string, string>;
  const level = plainValue(md.difficulty);
  const time = isoDuration(md.estimatedTime);
  if (!level && !time && !md.prerequisites) return {};
  return {
    learningResourceType: 'Tutorial',
    ...(level && { educationalLevel: level }),
    ...(time && { timeRequired: time }),
    ...(md.prerequisites && { competencyRequired: md.prerequisites }),
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
): Record<string, unknown> | null {
  const segs = segments(tagPath);
  const [root, child] = segs;
  const md = (metadata ?? {}) as Record<string, string>;
  const links = sameAs(md);
  const founded = isoDate(md.founded);
  const status = plainValue(md.status);

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
    const category = plainValue(md.category);
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

  // Contributor and working-group profiles.
  if (root === 'community') {
    const x = md.X ?? md.x;
    const profile = x ? absoluteHttpUrl(x) : null;
    if (!profile) return null;
    return { '@type': 'Person', name: title, sameAs: [profile] };
  }

  // Conferences, hackathons, and milestones.
  if (root === 'contents' && child === 'history') {
    const date = isoDate(md.date);
    if (!date) return null;
    return {
      '@type': 'Event',
      name: title,
      startDate: date,
      ...(md.location && { location: { '@type': 'Place', name: md.location } }),
      ...(links.length && { sameAs: links }),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    };
  }

  return null;
}
