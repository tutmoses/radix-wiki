// src/components/HeaderSearch.tsx

'use client';

import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { SearchField } from 'wiki-formant/react';
import { Highlight } from 'wiki-formant/react-server';
import { pagePath } from '@/lib/utils';
import type { PageSummary } from '@/lib/wiki';

// The snippet is the passage the query matched (computed server-side by the
// shared summarizer), so a body-text hit doesn't read as an unrelated title.
const pageHref = (page: PageSummary) => pagePath(page.tagPath, page.slug);
const searchRow = (page: PageSummary, query: string) => (
  <>
    <div className="font-medium truncate"><Highlight text={page.title} query={query} /></div>
    <div className="subtext truncate">{pageHref(page)}</div>
    {page.snippet && <p className="subtext line-clamp-1 mt-0.5"><Highlight text={page.snippet} query={query} lead={24} /></p>}
  </>
);

// Module scope, so the reference is stable: `useTypeahead` runs it from an
// effect, and an inline arrow would re-search on every render. A refusal (a 429,
// say) rejects, which the typeahead does not cache as the query's answer.
async function searchPages(q: string, signal: AbortSignal): Promise<PageSummary[]> {
  const res = await fetch(`/api/wiki?${new URLSearchParams({ q, pageSize: '5' })}`, { signal });
  if (!res.ok) throw new Error(res.statusText || `Failed (${res.status})`);
  return (await res.json()).items || [];
}

/**
 * One field for both breakpoints, a magnifier until opened: inline in the bar
 * above `sm`, its own row below it. The dropdown is base.css's `search-field__*`.
 */
export function HeaderSearch() {
  const router = useRouter();
  return (
    <SearchField
      fetch={searchPages}
      action="/search"
      hrefOf={pageHref}
      renderRow={searchRow}
      navigate={href => router.push(href)}
      label="Search the wiki"
      placeholder="Search the wiki..."
      icon={<Search size={20} />}
      before={<Search className="search-icon-left" size={18} />}
      spinner={<Loader2 className="search-icon-right" size={18} />}
      classNames={{ input: 'input pl-10', toggle: 'header-btn' }}
      all={q => <>See all results for &ldquo;{q}&rdquo;</>}
      empty={q => <>No pages found for &ldquo;{q}&rdquo;</>}
      failed="Search did not answer. Press Enter for the full results page."
    />
  );
}
