// src/components/CiteThisPage.tsx — Wikipedia-style "Cite this page" / permalink
// tools for the article foot. Copies a formatted citation or the canonical URL.

'use client';

import { useState } from 'react';
import { Quote, Link2, Check } from 'lucide-react';

export function CiteThisPage({ title, tagPath, slug }: { title: string; tagPath: string; slug: string }) {
  const [copied, setCopied] = useState<'cite' | 'link' | null>(null);

  const pageUrl = () => `${window.location.origin}/${tagPath}/${slug}`;
  const copy = async (kind: 'cite' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="page-tools">
      <button
        className="page-tool-btn"
        onClick={() => copy('cite', `"${title}." RADIX Wiki. Retrieved ${new Date().toISOString().slice(0, 10)}. ${pageUrl()}`)}
      >
        {copied === 'cite' ? <Check size={14} /> : <Quote size={14} />}Cite this page
      </button>
      <button className="page-tool-btn" onClick={() => copy('link', pageUrl())}>
        {copied === 'link' ? <Check size={14} /> : <Link2 size={14} />}Permalink
      </button>
    </div>
  );
}

export default CiteThisPage;
