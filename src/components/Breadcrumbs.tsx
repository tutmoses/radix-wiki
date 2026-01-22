// src/components/Breadcrumbs.tsx

'use client';

import Link from 'next/link';
import { findTagByPath } from '@/lib/tags';

interface BreadcrumbsProps {
  path: string[];
  suffix?: string;
}

export function Breadcrumbs({ path, suffix }: BreadcrumbsProps) {
  return (
    <nav className="row wrap text-muted">
      <Link href="/">Home</Link>
      {path.map((segment, i) => {
        const href = '/' + path.slice(0, i + 1).join('/');
        const tag = findTagByPath(path.slice(0, i + 1));
        const label = tag?.name || segment.replace(/-/g, ' ');
        const isLast = i === path.length - 1 && !suffix;
        return (
          <span key={href} className="row">
            <span>/</span>
            {isLast ? <span className="text-text capitalize">{label}</span> 
              : <Link href={href} className="capitalize">{label}</Link>}
          </span>
        );
      })}
      {suffix && <><span>/</span><span className="text-text capitalize">{suffix.replace(/-/g, ' ')}</span></>}
    </nav>
  );
}

export default Breadcrumbs;