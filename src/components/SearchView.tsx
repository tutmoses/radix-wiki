// src/components/SearchView.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { pagePath } from '@/lib/utils';
import Highlight from '@/components/Highlight';
import type { PageSummary } from '@/lib/wiki';
import { EmptyState } from '@/components/EmptyState';
import { Pager } from 'wiki-formant/react-server';

const PAGE_SIZE = 25;

type Found = { q: string; items: PageSummary[]; total: number };
// A search in flight keeps the results it replaces on screen; a failed one
// says so rather than leaving the last query's count under the new query.
type Results =
  | { kind: 'idle' }
  | { kind: 'searching'; shown: Found | null }
  | { kind: 'found'; found: Found }
  | { kind: 'failed'; q: string };

export default function SearchView({ query: initialQuery }: { query: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Results>({ kind: 'idle' });
  const [page, setPage] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // This page pages its results, so it keeps its own fetch rather than using
  // `useTypeahead` — but it needs the same guard the hook carries: without it a
  // slow response for an abandoned query lands over the results being read.
  const requestId = useRef(0);

  const performSearch = useCallback(async (q: string, p = 1) => {
    const trimmed = q.trim();
    if (!trimmed) { requestId.current++; setResults({ kind: 'idle' }); return; }
    const id = ++requestId.current;
    setResults(r => ({ kind: 'searching', shown: r.kind === 'found' ? r.found : r.kind === 'searching' ? r.shown : null }));
    try {
      const res = await fetch(`/api/wiki?${new URLSearchParams({ q: trimmed, page: String(p), pageSize: String(PAGE_SIZE) })}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      if (id !== requestId.current) return;
      const items: PageSummary[] = data.items || [];
      setResults({ kind: 'found', found: { q: trimmed, items, total: data.total ?? items.length } });
    } catch (e) {
      if (id !== requestId.current) return;
      console.error('Search failed:', e);
      setResults({ kind: 'failed', q: trimmed });
    }
  }, []);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => performSearch(query, 1), 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const isSearching = results.kind === 'searching';
  const found = results.kind === 'found' ? results.found : isSearching ? results.shown : null;
  const totalPages = Math.ceil((found?.total ?? 0) / PAGE_SIZE);
  const goToPage = (p: number) => { setPage(p); performSearch(query, p); window.scrollTo({ top: 0 }); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
    performSearch(query);
  };

  return (
    <div className="stack">
      <h1 id="search">Search</h1>
      <form onSubmit={submit} className="relative">
        <Search className="search-icon-left" size={18} />
        <input
          ref={inputRef}
          type="search"
          placeholder="Search the wiki..."
          className="input pl-10"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {isSearching && <Loader2 className="search-icon-right" size={18} />}
      </form>

      {results.kind === 'failed' && <EmptyState title={`Search failed for “${results.q}”. Try again.`} />}
      {results.kind === 'found' && (results.found.total === 0
        ? <EmptyState title={`No pages found for “${results.found.q}”.`} />
        : <p className="text-text-muted text-small">{results.found.total} result{results.found.total === 1 ? '' : 's'} for &ldquo;{results.found.q}&rdquo;.</p>)}

      {found && found.items.length > 0 && (
        <ul className="stack-sm list-none pl-0">
          {found.items.map(page => (
            <li key={page.url}>
              <Link href={pagePath(page.tagPath, page.slug)} className="search-page-result">
                <div className="font-medium"><Highlight text={page.title} query={found.q} /></div>
                <div className="text-small text-text-muted truncate">{pagePath(page.tagPath, page.slug)}</div>
                {page.snippet && <p className="text-small text-text-muted line-clamp-2 mt-1"><Highlight text={page.snippet} query={found.q} /></p>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pager page={page} total={totalPages} onPage={goToPage} disabled={isSearching} label="Search results pages" />
    </div>
  );
}
