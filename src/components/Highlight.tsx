// src/components/Highlight.tsx

/** Marks every case-insensitive occurrence of `query` inside `text`. */
export default function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim();
  if (!term) return <>{text}</>;

  // Capturing split: even indices are the gaps, odd indices are the matches.
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return <>{parts.map((part, i) => (i % 2 ? <mark key={i} className="search-mark">{part}</mark> : part))}</>;
}
