import Link from 'next/link';
import { NotFound } from 'wiki-formant/react-server';
import { site } from '@/lib/site';

export default function NotFoundPage() {
  return <NotFound site={site} link={Link} />;
}
