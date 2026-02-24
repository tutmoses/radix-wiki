'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty-state">
      <span className="badge badge-danger">Error</span>
      <h1>Something went wrong</h1>
      <p className="text-text-muted">{error.message || 'An unexpected error occurred.'}</p>
      <button onClick={reset} className="btn">Try again</button>
    </div>
  );
}
