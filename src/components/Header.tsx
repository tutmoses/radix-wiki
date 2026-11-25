// src/components/Header.tsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, User, FileCode, Bell, Database, MoreVertical, Quote, Check, Eye, EyeOff, Settings, History, KeyRound, MessagesSquare, Wallet } from 'lucide-react';
import { Menu, RailToggle, toast, useCopy } from 'wiki-formant/react';
import { useState, useEffect } from 'react';
import { SESSION_UNREADABLE, useStore, useAuth, usePagePath, useFetch, useWikiPathname } from '@/hooks';
import { ROOM_PATH } from '@/lib/trollbox';
import { cn, shortenAddress, pagePath } from '@/lib/utils';
import { SITE_NAME } from '@/lib/site';
import { AGO } from '@/lib/now';
import { isoDate, relativeTime } from 'wiki-formant/freshness';
import { EmptyState } from 'wiki-formant/react-server';
import { Button } from '@/components/ui';
import { HeaderSearch } from '@/components/HeaderSearch';
import { SignInOptions } from '@/components/SignIn';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiNotification } from '@/types';
import { useTelegram } from '@/components/WebhookSettings';
import { LedgerPanel, backupStanding, useLedgerBackup, type BackupStanding, type LedgerStatus } from '@/components/LedgerBackupView';

// Edit is not here: it sits beside the breadcrumb (`PageActions`). History is
// the view's to offer (`useHistoryLink`).
function usePageContext() {
  const { isHomepage, isPage, sectionPath, isEdit, isHistory, tagPath, slug } = usePagePath();
  const { isAuthenticated } = useAuth();
  const mdxPath = (isHomepage || isPage) ? (isHomepage ? '/api/wiki/mdx' : `/api/wiki/${tagPath}/${slug}/mdx`) : null;

  return {
    // On a category the menu holds one item, Watch, so it is there for signed-in readers only.
    hasTools: ((isHomepage || isPage) && !isHistory) || (!!sectionPath && isAuthenticated),
    hasLedger: isHomepage || isPage,
    sectionPath,
    canExportMdx: (isHomepage || isPage) && !isEdit && !isHistory,
    isPage,
    mdxPath,
    tagPath,
    slug,
  };
}

function notificationText(n: WikiNotification): string {
  const actor = n.actor.displayName || 'Someone';
  const title = n.page?.title ?? '';
  // A line in a card's room names the card; one in the wiki's own room, the trollbox.
  const where = n.page ? `on "${title}"` : 'in the trollbox';
  if (n.type === 'chat_mention') return `${actor} mentioned you ${where}`;
  if (n.type === 'chat_reply') return `${actor} replied to you ${where}`;
  switch (n.type) {
    case 'page_edited': return `${actor} edited "${title}"`;
    // A row written by another deploy can carry a type this one does not know.
    default: return `New activity from ${actor} on "${title}"`;
  }
}

// The bell carries notifications and nothing else; their settings are /settings.
// The menu stays mounted while shut, so "3h ago" reads the clock at each render
// (the minute's poll re-renders it), not at mount; it renders only once a
// session is read, after hydration, so the browser's clock is safe (`useNow`).
function Notifications() {
  const router = useRouter();
  const notifications = useStore(s => s.notifications);
  const fetchNotifications = useStore(s => s.fetchNotifications);
  const markNotificationsRead = useStore(s => s.markNotificationsRead);

  if (notifications.status !== 'loaded') {
    return notifications.status === 'loading'
      ? <div className="center p-4"><Loader2 size={16} className="animate-spin text-text-muted" /></div>
      : <EmptyState title="Your notifications could not be loaded." action={<Button variant="ghost" size="sm" data-keep-open onClick={() => fetchNotifications()}>Try again</Button>} />;
  }

  const now = Date.now();
  return (
    <>
      {notifications.unread > 0 && (
        <div className="notification-header">
          <button data-keep-open onClick={() => markNotificationsRead()} className="notification-mark-read">Mark all read</button>
        </div>
      )}
      {notifications.items.length === 0 ? (
        <EmptyState title="No notifications yet." />
      ) : notifications.items.map(n => (
        <button key={n.id} className={cn('menu__item notification-item', !n.read && 'notification-unread')}
          onClick={() => {
            markNotificationsRead([n.id]);
            // One from the trollbox opens the room at its line; any other, its page, a card's room included.
            if (n.page) router.push(pagePath(n.page.tagPath, n.page.slug));
            else if (n.chatMessageId) useStore.setState({ chatOpen: true, chatLine: n.chatMessageId });
          }}>
          <UserAvatar seed={n.actor.id} avatarUrl={n.actor.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-small truncate">{notificationText(n)}</div>
            <div className="text-xs text-text-muted">{relativeTime(n.createdAt, now, AGO)}</div>
          </div>
          {!n.read && <span className="notification-dot" />}
        </button>
      ))}
    </>
  );
}

/** One menu for the account: who is signed in, their profile, their notification settings, their ways in, the ways out. */
function AccountItems({ name, hasWallet, profilePath }: { name: string; hasWallet: boolean; profilePath: string | null }) {
  const connect = useStore(s => s.connect);
  const passkey = useStore(s => s.passkey);
  const logout = useStore(s => s.logout);
  return (
    <>
      <div className="menu__label">{name}</div>
      <hr className="menu__rule" />
      {profilePath && <Link href={profilePath} className="menu__item"><User size={16} />Profile</Link>}
      <Link href="/settings" className="menu__item"><Settings size={16} />Notification settings</Link>
      {!hasWallet && <button className="menu__item" onClick={() => connect()}><Wallet size={16} />Connect a wallet</button>}
      <button className="menu__item" onClick={async () => { if (await passkey('register')) toast.success('Passkey saved. It signs this account in on this device.'); }}>
        <KeyRound size={16} />Save a passkey
      </button>
      <button onClick={() => logout()} className="menu__item menu__item--danger">
        <LogOut size={16} />{hasWallet ? 'Disconnect' : 'Sign out'}
      </button>
      <button
        onClick={() => { if (confirm('Sign out every browser and agent signed in with this account?')) logout(true); }}
        className="menu__item menu__item--danger"
      >
        <LogOut size={16} />Sign out everywhere
      </button>
    </>
  );
}

// ===== Page tools =====
// One home for page-scoped actions (Wikipedia's Tools menu): watch, export,
// cite, ledger backup – instead of a row of header icons. History has its own
// icon beside it; Edit sits beside the breadcrumb. Watch and Cite answer in
// place, so the menu stays open for them.
function PageTools({ mdxPath, tagPath, slug, isPage, sectionPath, ledgerColor, ledgerMenu }: {
  mdxPath: string | null;
  tagPath?: string; slug?: string; isPage: boolean;
  /** Set on a category page: Watch then watches the whole section. */
  sectionPath: string | null;
  /** The ledger menu's id, which the Ledger backup row opens in place of this one. */
  ledgerColor: string | null; ledgerMenu: string | null;
}) {
  const { isAuthenticated } = useAuth();
  const pageTitle = useStore(s => s.pageTitle);
  // `useCopy` from `wiki-formant/react`.
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

  const title = isPage && slug ? pageTitle ?? slug.replace(/-/g, ' ') : SITE_NAME;

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
        <button className="menu__item" data-keep-open onClick={() => copy(`"${title}." RADIX Wiki. Retrieved ${isoDate(new Date())}. ${pageUrl()}`)}>
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

export function Header() {
  const { status: authStatus, isAuthenticated, user, walletData } = useAuth();
  const fetchNotifications = useStore(s => s.fetchNotifications);
  // A count, or the read in flight or failed: a failed read is never shown as nothing unread.
  const bell = useStore(s => (s.notifications.status === 'loaded' ? s.notifications.unread : s.notifications.status));
  const historyHref = useStore(s => s.historyHref);
  const chatOpen = useStore(s => s.chatOpen);
  const chatUnread = useStore(s => s.chatUnread);
  const toggleChat = useStore(s => s.toggleChat);
  const pathname = useWikiPathname();
  const { hasTools, hasLedger, sectionPath, canExportMdx, isPage, mdxPath, tagPath, slug } = usePageContext();

  // The ledger backup status: the tools item's colour, and the ledger menu's status row.
  const accountAddress = user?.radixAddress ?? null;
  const ledgerStatusUrl = accountAddress && tagPath && slug
    ? `/api/ledger/status?address=${accountAddress}&tagPath=${encodeURIComponent(tagPath)}&slug=${encodeURIComponent(slug)}`
    : accountAddress ? `/api/ledger/status?address=${accountAddress}` : null;
  const ledgerStatus = useFetch<LedgerStatus>(ledgerStatusUrl);
  // A backup made from the menu, which outlives the menu, so the colour reads it too.
  const ledgerBackup = useLedgerBackup(accountAddress, tagPath ?? null, slug ?? null);
  const ledger = isAuthenticated && hasLedger;

  const displayName = user?.displayName || walletData?.persona?.label ||
    (walletData?.accounts?.[0]?.address ? shortenAddress(walletData.accounts[0].address) : null) ||
    (user?.radixAddress ? shortenAddress(user.radixAddress) : 'Connected');

  // The leaderboard lists editors, and editing needs a wallet.
  const userProfilePath = user?.radixAddress ? `/leaderboard#u-${user.id}` : null;

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [isAuthenticated, fetchNotifications]);

  return (
    <>
      <RailToggle />

      <Link href="/" className="row shrink-0">
        <Image src="/logo.png" alt={SITE_NAME} width={240} height={240} className="size-8 object-contain" priority />
        <span className="logo-text">{SITE_NAME}</span>
      </Link>

      <HeaderSearch />

      {/* Each menu is wiki-formant's `Menu`, a native popover: a click outside, Escape, or opening another shuts it. */}
      <div className="header-actions">
        {historyHref && (
          <Link href={historyHref} prefetch={false} className="header-btn" title="History" aria-label="History"><History size={20} /></Link>
        )}

        {hasTools && (
          <div className="page-tools">
            <Menu label="Page tools" trigger={<MoreVertical size={20} />}>
              <PageTools
                mdxPath={canExportMdx ? mdxPath : null}
                tagPath={tagPath ?? undefined} slug={slug ?? undefined} isPage={isPage} sectionPath={sectionPath}
                ledgerColor={LEDGER_COLOR[backupStanding(ledgerStatus, slug ?? null, ledgerBackup)]}
                ledgerMenu={ledger ? LEDGER_MENU : null}
              />
            </Menu>
            {ledger && (
              <div id={LEDGER_MENU} popover="auto" role="group" aria-label="Ledger backup" className="menu ledger-menu">
                <LedgerPanel tagPath={tagPath ?? null} slug={slug ?? null} status={ledgerStatus} />
              </div>
            )}
          </div>
        )}

        {/* On the room's own page the room is on screen, and there is nothing for the button to open. */}
        {pathname !== ROOM_PATH && (
          <button onClick={toggleChat} className="header-btn relative" title="Trollbox" aria-label="Trollbox" aria-expanded={chatOpen}>
            <MessagesSquare size={20} />
            {chatUnread && !chatOpen && <span className="trollbox-unread" title="New lines in the trollbox" />}
          </button>
        )}

        {isAuthenticated && (
          <Menu label="Notifications" className="notification-menu" triggerClassName="header-btn relative" trigger={<>
            <Bell size={20} />
            {bell === 'failed'
              ? <span className="notification-badge notification-badge-failed" title="Your notifications could not be loaded">!</span>
              : typeof bell === 'number' && bell > 0 && <span className="notification-badge">{bell > 9 ? '9+' : bell}</span>}
          </>}>
            <Notifications />
          </Menu>
        )}

        {authStatus === 'checking' || authStatus === 'connecting' ? (
          <div className="user-pill"><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Connecting...</span></div>
        ) : authStatus === 'signed-in' ? (
          <Menu label="Account menu" trigger={<UserAvatar seed={user?.id || walletData?.accounts?.[0]?.address || ''} size="md" />}>
            <AccountItems name={displayName} hasWallet={!!user?.radixAddress} profilePath={userProfilePath} />
          </Menu>
        ) : (
          // Signing in unmounts this menu, which shuts it.
          <Menu label="Sign in" className="signin-menu" triggerClassName="btn btn-primary px-3 py-1.5" trigger="Sign in">
            {authStatus === 'unreadable' && <div className="menu__label">{SESSION_UNREADABLE}</div>}
            <SignInOptions />
          </Menu>
        )}
      </div>
    </>
  );
}
