// src/components/Footer.tsx

import Link from 'next/link';

// Home, Contents, Charts and Leaderboard are the sidebar's; the footer keeps
// what nothing else on the page links to.
export function Footer() {
  return (
    <footer className="footer">
      <nav className="footer-links" aria-label="Footer">
        <a href="/llms.txt">llms.txt</a>
        <Link href="/contents/resources/legal/terms-of-use">Terms</Link>
        <Link href="/contents/resources/legal/privacy-policy">Privacy</Link>
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
