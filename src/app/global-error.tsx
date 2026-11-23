'use client';
import '@/styles/globals.css';
import { RouteError } from 'wiki-formant/react';

// Replaces the root layout, so it draws the document and loads the styles itself.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <RouteError retry={retry} buttonClassName="btn btn-primary" />
      </body>
    </html>
  );
}
