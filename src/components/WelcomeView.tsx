// src/components/WelcomeView.tsx

'use client';

import Link from 'next/link';
import { Edit, FilePlus, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';

export default function WelcomeView() {
  return (
    <div className="welcome-page">
      <div className="welcome-hero">
        <h1>Welcome to RADIX Wiki</h1>
        <p className="text-text-muted text-lg">Your contributions shape the Radix knowledge base. Here&apos;s how to get started.</p>
      </div>
      <div className="welcome-grid">
        <div className="welcome-card">
          <Edit size={24} className="text-accent" />
          <h3>Edit Pages</h3>
          <p className="text-text-muted text-small">Click the edit icon on any page to improve content. Every edit earns <strong>80 points</strong>.</p>
        </div>
        <div className="welcome-card">
          <FilePlus size={24} className="text-accent" />
          <h3>Create Pages</h3>
          <p className="text-text-muted text-small">Navigate to a category and write new wiki articles. Each page earns <strong>150 points</strong>.</p>
        </div>
        <div className="welcome-card">
          <Trophy size={24} className="text-accent" />
          <h3>Earn Rewards</h3>
          <p className="text-text-muted text-small">Points may be considered in any future <strong>$EMOON airdrop</strong>. Track your rank on the leaderboard.</p>
        </div>
      </div>
      <div className="flex justify-center">
        <Link href="/contents"><Button size="lg">Start Exploring <ArrowRight size={18} /></Button></Link>
      </div>
    </div>
  );
}
