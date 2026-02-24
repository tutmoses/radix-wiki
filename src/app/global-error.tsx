'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#393e50', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: '#ff9da0', color: '#1a1d28', cursor: 'pointer', fontWeight: 600 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
