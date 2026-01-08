// src/app/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Users, Shield, Zap, ArrowRight, FileText, Clock } from 'lucide-react';
import { WikiLayout } from '@/components/layout/WikiLayout';
import { Button, Card, CardTitle, CardDescription, CardContent, Badge, LoadingScreen } from '@/components/ui';
import { useStore, useIsAuthenticated } from '@/hooks/useStore';
import { formatRelativeTime } from '@/lib/utils';
import { TAG_HIERARCHY, findTagByPath } from '@/lib/tags';
import type { WikiPage } from '@/types';

const features = [
  { icon: <Shield className="text-accent" size={24} />, title: 'Decentralized Auth', description: 'Login securely with your Radix Wallet using ROLA verification.' },
  { icon: <Users className="text-accent" size={24} />, title: 'Collaborative', description: 'Create and edit wiki pages with full revision history.' },
  { icon: <Zap className="text-accent" size={24} />, title: 'Fast & Modern', description: 'Built with Next.js, TipTap editor, and Tailwind CSS.' },
];

function HeroSection({ isAuthenticated, onConnect }: { isAuthenticated: boolean; onConnect: () => void }) {
  return (
    <section className="py-16 lg:py-24">
      <div className="flex flex-col gap-6 max-w-3xl mx-auto text-center">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent text-text-inverted shadow-md">
            <BookOpen size={32} />
          </div>
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
          Welcome to <span className="text-accent">RADIX Wiki</span>
        </h1>
        <p className="text-lg text-text-muted max-w-xl mx-auto">
          A decentralized wiki platform powered by Radix DLT. Create, collaborate, and share knowledge with Web3 authentication.
        </p>
        <div className="flex items-center gap-4 justify-center flex-wrap">
          {isAuthenticated ? (
            <Link href="/new">
              <Button size="lg">Create New Page<ArrowRight size={18} /></Button>
            </Link>
          ) : (
            <Button size="lg" onClick={onConnect}>Connect Radix Wallet<ArrowRight size={18} /></Button>
          )}
          <Link href="/contents"><Button variant="secondary" size="lg">Browse Content</Button></Link>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="bg-surface-1 py-16 -mx-[calc((100vw-100%)/2)] px-[calc((100vw-100%)/2)]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="text-center">
            <CardContent className="flex flex-col items-center gap-4 py-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent-muted">{feature.icon}</div>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CategoriesSection() {
  return (
    <section className="py-16">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold">Browse Categories</h2>
          <p className="text-text-muted">Explore content organized by topic</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {TAG_HIERARCHY.map(category => (
            <Link key={category.slug} href={`/${category.slug}`}>
              <Card interactive className="h-full">
                <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  {category.children && (
                    <p className="text-xs text-text-muted">{category.children.length} subcategories</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentPagesSection({ pages, isLoading, isAuthenticated }: { pages: WikiPage[]; isLoading: boolean; isAuthenticated: boolean }) {
  return (
    <section className="py-16">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold">Recent Pages</h2>
            <p className="text-text-muted">Latest updates from the community</p>
          </div>
          <Link href="/contents"><Button variant="ghost">View All<ArrowRight size={16} /></Button></Link>
        </div>

        {isLoading ? (
          <LoadingScreen message="Loading recent pages..." />
        ) : pages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((page) => {
              const tagSegments = page.tagPath.split('/');
              const leafTag = findTagByPath(tagSegments);
              return (
                <Link key={page.id} href={`/${page.tagPath}/${page.slug}`}>
                  <Card interactive className="h-full">
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <FileText size={18} className="text-accent shrink-0 mt-0.5" />
                        <CardTitle className="line-clamp-1">{page.title}</CardTitle>
                      </div>
                      {page.excerpt && <p className="text-sm text-text-muted line-clamp-2">{page.excerpt}</p>}
                      <div className="flex items-center gap-2 mt-auto pt-2">
                        <div className="flex items-center gap-1 text-text-muted">
                          <Clock size={14} />
                          <span className="text-xs">{formatRelativeTime(page.updatedAt)}</span>
                        </div>
                        {leafTag && <Badge variant="secondary">{leafTag.name}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-surface-2 text-text-muted"><FileText size={24} /></div>
              <p className="text-text-muted">No pages yet. Be the first to create one!</p>
              {isAuthenticated && <Link href="/new"><Button>Create First Page</Button></Link>}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border-muted py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 text-text-muted text-sm">
        <p>© 2024 RADIX Wiki. Powered by Radix DLT.</p>
        <div className="flex items-center gap-4">
          <a href="https://radixdlt.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Radix DLT</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">GitHub</a>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const [recentPages, setRecentPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = useIsAuthenticated();
  const { connect } = useStore();

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/wiki?pageSize=6&published=true');
        if (response.ok) {
          const data = await response.json();
          setRecentPages(data.items);
        }
      } catch (error) {
        console.error('Failed to fetch recent pages:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <WikiLayout>
      <HeroSection isAuthenticated={isAuthenticated} onConnect={connect} />
      <FeaturesSection />
      <CategoriesSection />
      <RecentPagesSection pages={recentPages} isLoading={isLoading} isAuthenticated={isAuthenticated} />
      <Footer />
    </WikiLayout>
  );
}