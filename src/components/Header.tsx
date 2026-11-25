// src/components/Header.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, User, Bell, Settings, KeyRound, MessagesSquare, Wallet } from 'lucide-react';
import { AccountSlot, Menu, toast } from 'wiki-formant/react';
import { useEffect } from 'react';
import { SESSION_UNREADABLE, useStore, useAuth, useWikiPathname } from '@/hooks';
import { ROOM_PATH } from '@/lib/trollbox';
import { cn, shortenAddress, pagePath } from '@/lib/utils';
import { AGO } from '@/lib/now';
import { relativeTime } from 'wiki-formant/freshness';
import { EmptyState } from 'wiki-formant/react-server';
import { Button } from '@/components/ui';
import { HeaderSearch } from '@/components/HeaderSearch';
import { SignInOptions } from '@/components/SignIn';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiNotification } from '@/types';

// What is the whole site's after the shell's rail toggle and logo: search, the
// trollbox, the bell and the account. What belongs to the page being read, Edit, History and the
// page tools, is the view's `PageActions`.

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

export function Header() {
  const { status: authStatus, isAuthenticated, user, walletData } = useAuth();
  const fetchNotifications = useStore(s => s.fetchNotifications);
  // A count, or the read in flight or failed: a failed read is never shown as nothing unread.
  const bell = useStore(s => (s.notifications.status === 'loaded' ? s.notifications.unread : s.notifications.status));
  const chatOpen = useStore(s => s.chatOpen);
  const chatUnread = useStore(s => s.chatUnread);
  const toggleChat = useStore(s => s.toggleChat);
  const pathname = useWikiPathname();

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
      <HeaderSearch />

      {/* Each menu is wiki-formant's `Menu`, a native popover: a click outside, Escape, or opening another shuts it. */}
      <div className="header-actions">
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

        <AccountSlot
          status={authStatus === 'checking' || authStatus === 'connecting' ? 'unknown' : authStatus === 'signed-in' ? 'signedIn' : 'signedOut'}
          pending={<div className="user-pill"><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Connecting...</span></div>}
          avatar={<UserAvatar seed={user?.id || walletData?.accounts?.[0]?.address || ''} size="md" />}
          signIn={
            // Signing in unmounts this menu, which shuts it.
            <Menu label="Sign in" className="signin-menu" triggerClassName="btn btn-primary px-3 py-1.5" trigger="Sign in">
              {authStatus === 'unreadable' && <div className="menu__label">{SESSION_UNREADABLE}</div>}
              <SignInOptions />
            </Menu>
          }
        >
          <AccountItems name={displayName} hasWallet={!!user?.radixAddress} profilePath={userProfilePath} />
        </AccountSlot>
      </div>
    </>
  );
}
