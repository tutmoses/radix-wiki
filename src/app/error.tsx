'use client';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      as="h1" title="Something went wrong"
      description={error.message || 'The page failed to render.'}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
