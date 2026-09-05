// src/components/Breadcrumbs.tsx

import Link from 'next/link';
import { findTagByPath } from '@/lib/tags';

interface BreadcrumbsProps {
  path: string[];
  suffix?: string;
}

export function Breadcrumbs({ path, suffix }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs">
      {path.map((segment, i) => {
        const href = '/' + path.slice(0, i + 1).join('/');
        const tag = findTagByPath(path.slice(0, i + 1));
        const label = tag?.name || segment.replace(/-/g, ' ');
        const isLast = i === path.length - 1 && !suffix;
        return (
          <span key={href} className="row">
            {i > 0 && <span>/</span>}
            {isLast ? <span className="breadcrumb-current">{label}</span>
              : <Link href={href} className="breadcrumb-link">{label}</Link>}
          </span>
        );
      })}
      {suffix && <><span>/</span><span className="breadcrumb-current">{suffix.replace(/-/g, ' ')}</span></>}
    </nav>
  );
}
