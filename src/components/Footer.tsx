// src/components/Footer.tsx

'use client';

export function Footer() {
  return (
    <footer className="spread border-t border-border-muted py-8 mt-8 text-muted">
      <p>© 2024 RADIX Wiki. Powered by Radix DLT.</p>
      <div className="row-4">
        <a href="https://radixdlt.com" target="_blank" rel="noopener noreferrer" className="link-muted">Radix DLT</a>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="link-muted">GitHub</a>
      </div>
    </footer>
  );
}

export default Footer;