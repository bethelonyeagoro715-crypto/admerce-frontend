'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../../services/api';
import {
  MdLocationOn,
  MdFavoriteBorder,
  MdChatBubbleOutline,
  MdAccountBalanceWallet,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

// ─── Nav entries (shared by rail and bottom nav) ────────────────────
type NavEntry =
  | { kind: 'icon'; Icon: IconType; label: string; path: string; badgeKey?: 'inbox' }
  | { kind: 'symbol'; symbolSrc: string; label: string; path: string; badgeKey?: 'inbox' };

const NAV_ENTRIES: NavEntry[] = [
  {
    kind: 'symbol',
    symbolSrc: '/admerce_symbol.png',
    label: 'Home',
    path: '/shopper/home',
  },
  { kind: 'icon', Icon: MdLocationOn,           label: 'Map',    path: '/shopper/map'    },
  { kind: 'icon', Icon: MdFavoriteBorder,       label: 'Saved',  path: '/shopper/saved'  },
  { kind: 'icon', Icon: MdChatBubbleOutline,    label: 'Inbox',  path: '/shopper/inbox', badgeKey: 'inbox' },
  { kind: 'icon', Icon: MdAccountBalanceWallet, label: 'Wallet', path: '/shopper/wallet' },
];

const PROFILE_PATH = '/shopper/profile';
const PROFILE_LABEL = 'Profile';

const UNREAD_POLL_MS = 10_000;

// ─── Notification chime (Web Audio, no assets) ──────────────────────
let _audioCtx: AudioContext | null = null;
function playChime() {
  try {
    const Ctx =
      typeof window !== 'undefined'
        ? (window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext)
        : null;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const notes = [
      { freq: 780, start: now, dur: 0.09 },
      { freq: 1040, start: now + 0.09, dur: 0.12 },
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, n.start);
      gain.gain.exponentialRampToValueAtTime(0.12, n.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, n.start + n.dur);
      osc.start(n.start);
      osc.stop(n.start + n.dur + 0.02);
    }
  } catch {
    /* silent — sound is best-effort */
  }
}

function UserAvatar({
  imageUrl,
  name,
  active,
  size = 28,
}: {
  imageUrl?: string;
  name: string;
  active: boolean;
  size?: number;
}) {
  const initials = (name || '?')[0].toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.42),
        color: 'var(--brand-on-soft)',
        border: active
          ? '2px solid var(--brand-primary)'
          : '2px solid transparent',
        boxSizing: 'border-box',
        transition:
          'background-color 0.18s ease, border-color 0.18s ease',
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontWeight: 800 }}>{initials}</span>
      )}
    </div>
  );
}

function NavGlyph({
  entry,
  active,
  size = 26,
}: {
  entry: NavEntry;
  active: boolean;
  size?: number;
}) {
  if (entry.kind === 'icon') {
    return <entry.Icon size={size} />;
  }
  return (
    <span
      aria-hidden="true"
      data-active={active}
      className="shl-symbol"
      style={{
        width: size + 4,
        height: size + 4,
        display: 'block',
      }}
    />
  );
}

export default function ShopperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{
    avatar_url?: string;
    nickname?: string;
    phone?: string;
  } | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef<number | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getMyProfile();
        setProfile(p as Record<string, unknown> as typeof profile);
      } catch {}
    })();
  }, []);

  // ── Poll conversations for unread count ───────────────────────
  const checkUnread = useCallback(async () => {
    try {
      const convs = (await api.getConversations()) as Array<{
        conversation_id?: string;
        unread_count?: number;
      }>;

      // Exclude the SEAI system conversation from the badge
      const total = (convs || []).reduce((sum, c) => {
        const cid = String(c.conversation_id || '');
        if (cid.endsWith('_seai')) return sum;
        return sum + (c.unread_count ?? 0);
      }, 0);

      // First successful check: seed, don't chime
      if (!seededRef.current) {
        seededRef.current = true;
        prevUnreadRef.current = total;
        setUnreadCount(total);
        return;
      }

      // Only chime if the count went UP and we aren't already on the chat page
      const prev = prevUnreadRef.current ?? 0;
      if (total > prev) {
        const onChatPage = pathname.startsWith('/chat');
        const onInbox = pathname.startsWith('/shopper/inbox');
        if (!onChatPage && !onInbox) {
          playChime();
        }
      }
      prevUnreadRef.current = total;
      setUnreadCount(total);
    } catch {
      /* silent — badge is best-effort */
    }
  }, [pathname]);

  useEffect(() => {
    const runCheck = () => {
      window.setTimeout(() => {
        void checkUnread();
      }, 0);
    };

    runCheck();
    const t = setInterval(() => {
      if (document.hidden) return;
      runCheck();
    }, UNREAD_POLL_MS);

    const onVisible = () => {
      if (!document.hidden) runCheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkUnread]);

  let activeIndex = 0;
  for (let i = 0; i < NAV_ENTRIES.length; i++) {
    if (pathname.startsWith(NAV_ENTRIES[i].path)) {
      activeIndex = i;
      break;
    }
  }
  if (pathname.startsWith(PROFILE_PATH)) activeIndex = NAV_ENTRIES.length;

  const avatarName = profile?.nickname || profile?.phone || '';
  const go = (path: string) => router.replace(path);
  const hasUnread = unreadCount > 0;

  return (
    <div className="shl-root">
      <style>{CSS}</style>

      {/* ── Desktop side rail ────────────────────────────── */}
      <aside className="shl-rail" aria-label="Shopper navigation">
        <nav className="shl-rail-nav">
          {NAV_ENTRIES.map((entry, i) => {
            const active = activeIndex === i;
            const showBadge = entry.badgeKey === 'inbox' && hasUnread;
            return (
              <button
                key={entry.path}
                type="button"
                onClick={() => go(entry.path)}
                className={
                  active
                    ? 'shl-rail-item shl-rail-item-active'
                    : 'shl-rail-item'
                }
                aria-current={active ? 'page' : undefined}
                aria-label={
                  showBadge
                    ? `${entry.label}, ${unreadCount} unread`
                    : entry.label
                }
                title={entry.label}
              >
                <span className="shl-glyph-wrap">
                  <NavGlyph entry={entry} active={active} size={24} />
                  {showBadge && (
                    <span className="shl-dot" aria-hidden="true" />
                  )}
                </span>
                <span className="shl-rail-label">{entry.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => go(PROFILE_PATH)}
          className={
            activeIndex === NAV_ENTRIES.length
              ? 'shl-rail-item shl-rail-profile shl-rail-item-active'
              : 'shl-rail-item shl-rail-profile'
          }
          aria-current={
            activeIndex === NAV_ENTRIES.length ? 'page' : undefined
          }
          title={PROFILE_LABEL}
        >
          <UserAvatar
            imageUrl={profile?.avatar_url}
            name={avatarName}
            active={activeIndex === NAV_ENTRIES.length}
            size={24}
          />
          <span className="shl-rail-label">{PROFILE_LABEL}</span>
        </button>
      </aside>

      {/* ── Content ──────────────────────────────────────── */}
      <main className="shl-content">{children}</main>

      {/* ── Mobile bottom nav ────────────────────────────── */}
      <nav className="shl-bottom" aria-label="Shopper navigation">
        {NAV_ENTRIES.map((entry, i) => {
          const active = activeIndex === i;
          const showBadge = entry.badgeKey === 'inbox' && hasUnread;
          return (
            <button
              key={entry.path}
              type="button"
              onClick={() => go(entry.path)}
              className={active ? 'shl-tab shl-tab-active' : 'shl-tab'}
              aria-current={active ? 'page' : undefined}
              aria-label={
                showBadge
                  ? `${entry.label}, ${unreadCount} unread`
                  : entry.label
              }
            >
              <span className="shl-glyph-wrap">
                <NavGlyph entry={entry} active={active} size={26} />
                {showBadge && (
                  <span className="shl-dot" aria-hidden="true" />
                )}
              </span>
              <span className="shl-tab-label">{entry.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => go(PROFILE_PATH)}
          className={
            activeIndex === NAV_ENTRIES.length
              ? 'shl-tab shl-tab-active'
              : 'shl-tab'
          }
          aria-current={
            activeIndex === NAV_ENTRIES.length ? 'page' : undefined
          }
        >
          <UserAvatar
            imageUrl={profile?.avatar_url}
            name={avatarName}
            active={activeIndex === NAV_ENTRIES.length}
            size={26}
          />
          <span className="shl-tab-label">{PROFILE_LABEL}</span>
        </button>
      </nav>
    </div>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  .shl-root {
    display: flex;
    height: 100dvh;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.18s ease, color 0.18s ease;
  }

  .shl-content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding-bottom: 88px;
    transition: padding 0.18s ease;
  }

  .shl-symbol {
    background-color: currentColor;
    -webkit-mask-image: url('/admerce_symbol.png');
    mask-image: url('/admerce_symbol.png');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-user-drag: none;
    user-select: none;
  }

  /* ── Glyph wrapper holds the icon + the red dot ───────── */
  .shl-glyph-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }
  .shl-dot {
    position: absolute;
    top: -2px;
    right: -3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #EF4444;
    box-shadow:
      0 0 0 2px var(--bg-secondary),
      0 0 6px rgba(239, 68, 68, 0.5);
    animation: shlDotPulse 2s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes shlDotPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.08); opacity: 0.9; }
  }

  /* ── Desktop side rail (hidden by default) ───────────── */
  .shl-rail {
    display: none;
    flex-direction: column;
    align-items: center;
    width: 88px;
    flex: 0 0 88px;
    padding: 16px 8px 18px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-default);
    transition: background-color 0.18s ease, border-color 0.18s ease;
  }
  .shl-rail-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    flex: 1;
    min-height: 0;
  }
  .shl-rail-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 68px;
    padding: 10px 4px;
    border: none;
    border-radius: 14px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, color 0.15s, transform 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .shl-rail-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .shl-rail-item:active { transform: scale(0.97); }
  .shl-rail-item-active,
  .shl-rail-item-active:hover {
    background: var(--brand-soft);
    color: var(--brand-primary);
  }
  .shl-rail-item:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 2px;
  }
  .shl-rail-label {
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.2px;
  }
  .shl-rail-profile { margin-top: auto; }

  /* ── Mobile bottom nav (shown by default) ────────────── */
  .shl-bottom {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-default);
    padding: 12px 0 max(10px, env(safe-area-inset-bottom));
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    z-index: 100;
    transition: background-color 0.18s ease, border-color 0.18s ease;
  }
  .shl-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 4px;
    padding: 8px 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s;
  }
  .shl-tab-active { color: var(--brand-primary); }
  .shl-tab-label {
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.1px;
  }
  .shl-tab-active .shl-tab-label { font-weight: 700; }

  /* ── Desktop breakpoint ─────────────────────────────── */
  @media (min-width: 1024px) {
    .shl-rail { display: flex; }
    .shl-bottom { display: none; }
    .shl-content { padding-bottom: 0; }
  }
`;