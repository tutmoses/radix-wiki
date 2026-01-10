// src/components/Footer.tsx

'use client';

export function Footer() {
  return (
    <footer className="border-t border-border-muted py-8 mt-8">
      <div className="flex items-center justify-between flex-wrap gap-4 text-text-muted text-sm">
        <p>© 2024 RADIX Wiki. Powered by Radix DLT.</p>
        <div className="flex items-center gap-4">
          <a href="https://radixdlt.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Radix DLT</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">GitHub</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;