import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="badge badge-warning">404</span>
      <h1>Page not found</h1>
      <p className="text-text-muted">The page you're looking for doesn't exist or has been moved.</p>
      <Link href="/" className="btn">Back to homepage</Link>
    </div>
  );
}
