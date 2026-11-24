import Link from 'next/link';
import { EmptyState } from 'wiki-formant/react-server';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <EmptyState
      as="h1" title="Page not found"
      description="Nothing lives at this address. The page may have been moved or deleted."
      action={<Link href="/"><Button>Back to homepage</Button></Link>}
    />
  );
}
