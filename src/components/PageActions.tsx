// src/components/PageActions.tsx — what a reader can do with the page on
// screen, in one place beside its trail or banner: Edit, History, and the page
// tools (Wikipedia's Tools menu: watch, export, cite, ledger backup). The view
// passes Edit and History, since only it knows whether the page exists, is a
// hub, or is being created; the tools follow the URL. The header holds only
// what is the whole site's.

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Database, Eye, EyeOff, FileCode, History, MoreVertical, Pencil, Quote } from 'lucide-react';
import { Menu, toast, useCopy } from 'wiki-formant/react';
import { isoDate } from 'wiki-formant/freshness';
import { useAuth, useFetch, usePagePath } from '@/hooks';
import { pagePath } from '@/lib/utils';
import { SITE_NAME } from '@/lib/site';
import { useTelegram } from '@/components/WebhookSettings';
import { LedgerPanel, backupStanding, useLedgerBackup, type BackupStanding, type LedgerStatus } from '@/components/LedgerBackupView';

// Watch and Cite answer in place, so the menu stays open for them.
function PageTools({ mdxPath, tagPath, slug, isPage, sectionPath, title, ledgerColor, ledgerMenu }: {
  mdxPath: string | null;
  tagPath: string | null; slug: string | null; isPage: boolean;
  /** Set on a category page: Watch then watches the whole section. */
  sectionPath: string | null;
  /** The article's title, which the citation names. */
  title?: string;
  /** The ledger menu's id, which the Ledger backup row opens in place of this one. */
  ledgerColor: string | null; ledgerMenu: string | null;
}) {
  const { isAuthenticated } = useAuth();
  const { copied, copy } = useCopy(1500);
  // What Watch watches: this page, or on a category page the whole section.
  // Which events each gets is the API's `subscriptionEvents`.
  const target = isPage && tagPath && slug
    ? { tagPath, slug, noun: 'page' }
    : sectionPath ? { tagPath: sectionPath, slug: '', noun: 'section' } : null;
  // The same `/api/telegram` client /settings uses, asked only when there is
  // something to watch and someone to watch it with.
  const { telegram, paused, subscribe, unsubscribe } = useTelegram(isAuthenticated && !!target);
  const [watchBusy, setWatchBusy] = useState(false);

  const watching = (target && telegram.status === 'ready' && telegram.subscriptions.find(s => s.tagPath === target.tagPath && s.pageSlug === target.slug)) || null;
  // Paused by the bot's /stop: Watch then resumes every subscription, this one included.
  const live = !!watching && !paused;

  const pageUrl = () => `${window.location.origin}${pagePath(tagPath ?? '', slug ?? '')}`;

  const toggleWatch = async () => {
    if (!target || telegram.status === 'loading' || watchBusy) return;
    if (telegram.status === 'failed') { toast.error('Your Telegram settings could not be loaded. Reload to try again.'); return; }
    setWatchBusy(true);
    try {
      if (live) {
        if (await unsubscribe(watching.id)) toast.success(`No longer watching this ${target.noun}`);
        else toast.error(`This ${target.noun} could not be unwatched. Try again.`);
      } else if (await subscribe(target.tagPath, target.slug || null)) {
        toast.success(paused ? `Watching this ${target.noun}; notifications resumed` : `Watching this ${target.noun}`);
      } else toast.error(`This ${target.noun} could not be watched. Try again.`);
    } finally { setWatchBusy(false); }
  };

  const cited = isPage && slug ? title ?? slug.replace(/-/g, ' ') : SITE_NAME;

  return (
    <>
      {isAuthenticated && target && (telegram.status === 'ready' && !telegram.connected ? (
        // Telegram is connected on /settings, which then offers this page or section.
        <Link href={`/settings?watch=${encodeURIComponent(pagePath(target.tagPath, target.slug).slice(1))}`} className="menu__item">
          <Eye size={16} />Watch this {target.noun}
        </Link>
      ) : (
        <button className="menu__item" data-keep-open onClick={toggleWatch} disabled={watchBusy || telegram.status === 'loading'}>
          {live ? <EyeOff size={16} /> : <Eye size={16} />}
          {live ? `Unwatch this ${target.noun}` : watching ? `Resume watching this ${target.noun}` : `Watch this ${target.noun}`}
        </button>
      ))}
      {mdxPath && <a href={mdxPath} className="menu__item" download><FileCode size={16} />Download MDX</a>}
      {/* The citation ends in the page's URL, so it is the copy-link item too. */}
      {isPage && (
        <button className="menu__item" data-keep-open onClick={() => copy(`"${cited}." RADIX Wiki. Retrieved ${isoDate(new Date())}. ${pageUrl()}`)}>
          {copied ? <Check size={16} /> : <Quote size={16} />}Cite this page
        </button>
      )}
      {ledgerMenu && (
        <button className="menu__item" popoverTarget={ledgerMenu}>
          <Database size={16} className={ledgerColor ?? undefined} />Ledger backup
        </button>
      )}
    </>
  );
}

const LEDGER_COLOR: Record<BackupStanding, string | null> = { unknown: null, none: 'text-error', stale: 'text-warning', current: 'text-success' };
const LEDGER_MENU = 'ledger-menu';

/** Edit and History where the view passes them; the page tools wherever the page has any. */
export function PageActions({ editHref, historyHref, title, className }: {
  editHref?: string;
  historyHref?: string;
  /** The article's title, for the citation; a slug is not a title. */
  title?: string;
  className?: string;
}) {
  const { isAuthenticated, user } = useAuth();
  const { isHomepage, isPage, sectionPath, isEdit, isHistory, tagPath, slug } = usePagePath();
  // On a category the menu holds one item, Watch, so it is there for signed-in readers only.
  const hasTools = ((isHomepage || isPage) && !isHistory) || (!!sectionPath && isAuthenticated);
  const mdxPath = (isHomepage || isPage) && !isEdit && !isHistory ? (isHomepage ? '/api/wiki/mdx' : `/api/wiki/${tagPath}/${slug}/mdx`) : null;
  const ledger = isAuthenticated && (isHomepage || isPage);

  // The ledger backup status: the tools item's colour, and the ledger menu's status row.
  const accountAddress = user?.radixAddress ?? null;
  const ledgerStatus = useFetch<LedgerStatus>(!ledger || !accountAddress ? null : tagPath && slug
    ? `/api/ledger/status?address=${accountAddress}&tagPath=${encodeURIComponent(tagPath)}&slug=${encodeURIComponent(slug)}`
    : `/api/ledger/status?address=${accountAddress}`);
  // A backup made from the menu, which outlives the menu, so the colour reads it too.
  const ledgerBackup = useLedgerBackup(accountAddress, tagPath, slug);

  if (!editHref && !historyHref && !hasTools) return null;
  return (
    <nav className={className ? `page-actions ${className}` : 'page-actions'} aria-label="Page actions">
      {editHref && <Link href={editHref} prefetch={false} className="page-action" aria-label="Edit" title="Edit"><Pencil size={16} aria-hidden /></Link>}
      {historyHref && <Link href={historyHref} prefetch={false} className="page-action" aria-label="History" title="History"><History size={16} aria-hidden /></Link>}
      {hasTools && (
        <div className="page-tools">
          <Menu label="Page tools" triggerClassName="page-action" trigger={<MoreVertical size={16} aria-hidden />}>
            <PageTools
              mdxPath={mdxPath} tagPath={tagPath} slug={slug} isPage={isPage} sectionPath={sectionPath} title={title}
              ledgerColor={LEDGER_COLOR[backupStanding(ledgerStatus, slug, ledgerBackup)]}
              ledgerMenu={ledger ? LEDGER_MENU : null}
            />
          </Menu>
          {ledger && (
            <div id={LEDGER_MENU} popover="auto" role="group" aria-label="Ledger backup" className="menu ledger-menu">
              <LedgerPanel tagPath={tagPath} slug={slug} status={ledgerStatus} />
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
