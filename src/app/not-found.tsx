import Link from 'next/link';
import { EmptyState } from 'wiki-formant/react-server';

export default function NotFound() {
  return (
    <EmptyState
      as="h1" title="Page not found"
      description="Nothing lives at this address. The page may have been moved or deleted."
      action={<Link href="/" className="btn-primary">Back to homepage</Link>}
    />
  );
}
