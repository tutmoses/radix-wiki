// src/components/PageHeading.tsx – a view's title: its icon, its h1 and the line under it.
//
// No 'use client', so the server chart views and the client leaderboard draw the same markup.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

export function PageHeading({ icon: Icon, id, title, back, description, children }: {
  icon: LucideIcon;
  id: string;
  title: string;
  /** The view this one sits under. */
  back?: { href: string; label: string };
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="stack-sm">
      {back && (
        <Link href={back.href} className="charts-section-link">
          <ArrowLeft size={14} /> {back.label}
        </Link>
      )}
      <div className="row">
        <Icon size={24} className="text-accent" />
        <h1 id={id}>{title}</h1>
      </div>
      {description && <p className="text-text-muted">{description}</p>}
      {children}
    </div>
  );
}
