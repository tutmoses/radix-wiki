// src/components/SearchView.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2, FileText } from 'lucide-react';
import { getContentSnippet } from '@/lib/utils';
import type { WikiPage } from '@/types';

const PAGE_SIZE = 25;

export default function SearchView({ query: initialQuery }: { query: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<WikiPage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const performSearch = useCallback(async (q: string, p = 1) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); setTotal(0); setSearched(''); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/wiki?${new URLSearchParams({ search: trimmed, page: String(p), pageSize: String(PAGE_SIZE) })}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.items || []);
        setTotal(data.total ?? (data.items || []).length);
      }
    } catch (e) { console.error('Search failed:', e); }
    finally { setIsSearching(false); setSearched(trimmed); }
  }, []);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => performSearch(query, 1), 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const goToPage = (p: number) => { setPage(p); performSearch(query, p); window.scrollTo({ top: 0 }); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
    performSearch(query);
  };

  return (
    <div className="stack">
      <h1>Search</h1>
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

      {searched && !isSearching && (
        <p className="text-text-muted text-small">
          {total === 0
            ? <>No pages found for &ldquo;{searched}&rdquo;.</>
            : <>{total} result{total === 1 ? '' : 's'} for &ldquo;{searched}&rdquo;.</>}
        </p>
      )}

      {results.length > 0 && (
        <ul className="stack-sm">
          {results.map(page => {
            const snippet = getContentSnippet(page.content, 160);
            return (
              <li key={page.id}>
                <Link href={`/${page.tagPath}/${page.slug}`} className="search-page-result">
                  <FileText size={18} className="text-accent shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{page.title}</div>
                    <div className="text-small text-text-muted truncate">/{page.tagPath}/{page.slug}</div>
                    {snippet && <p className="text-small text-text-muted line-clamp-2 mt-1">{snippet}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="row justify-center gap-4" aria-label="Search results pages">
          <button className="link disabled:opacity-40" disabled={page <= 1 || isSearching} onClick={() => goToPage(page - 1)}>← Previous</button>
          <span className="text-text-muted text-small">Page {page} of {totalPages}</span>
          <button className="link disabled:opacity-40" disabled={page >= totalPages || isSearching} onClick={() => goToPage(page + 1)}>Next →</button>
        </nav>
      )}
    </div>
  );
}
