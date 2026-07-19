// src/components/Footer.tsx

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <nav className="footer-links" aria-label="Footer">
        <Link href="/">Home</Link>
        <Link href="/contents">Contents</Link>
        <Link href="/charts">Charts</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <a href="/llms.txt">llms.txt</a>
      </nav>
      <p>
        © 2026 RADIX Wiki. Content licensed under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
          CC BY 4.0
        </a>
        . Powered by Radix DLT.
      </p>
    </footer>
  );
}

export default Footer;
