import Link from 'next/link';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';

export default function NotFound() {
  return (
    <EmptyState
      as="h1" title="Page not found"
      description="Nothing lives at this address. The page may have been moved or deleted."
      action={<Link href="/"><Button>Back to homepage</Button></Link>}
    />
  );
}
