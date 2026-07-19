// src/components/SearchView.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2, FileText } from 'lucide-react';
import { getContentSnippet } from '@/lib/utils';
import type { WikiPage } from '@/types';

export default function SearchView({ query: initialQuery }: { query: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<WikiPage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const performSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); setSearched(''); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/wiki?${new URLSearchParams({ search: trimmed, pageSize: '25' })}`);
      if (res.ok) setResults((await res.json()).items || []);
    } catch (e) { console.error('Search failed:', e); }
    finally { setIsSearching(false); setSearched(trimmed); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

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
          {results.length === 0
            ? <>No pages found for &ldquo;{searched}&rdquo;.</>
            : <>{results.length} result{results.length === 1 ? '' : 's'} for &ldquo;{searched}&rdquo;.</>}
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
    </div>
  );
}
