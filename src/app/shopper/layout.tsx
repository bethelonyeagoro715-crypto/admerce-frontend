'use client';

import { useState, useEffect } from 'react';
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
  | { kind: 'icon'; Icon: IconType; label: string; path: string }
  | { kind: 'symbol'; symbolSrc: string; label: string; path: string };

const NAV_ENTRIES: NavEntry[] = [
  {
    kind: 'symbol',
    symbolSrc: '/admerce_symbol.png',
    label: 'Home',
    path: '/shopper/home',
  },
  { kind: 'icon', Icon: MdLocationOn,           label: 'Map',    path: '/shopper/map'    },
  { kind: 'icon', Icon: MdFavoriteBorder,       label: 'Saved',  path: '/shopper/saved'  },
  { kind: 'icon', Icon: MdChatBubbleOutline,    label: 'Inbox',  path: '/shopper/inbox'  },
  { kind: 'icon', Icon: MdAccountBalanceWallet, label: 'Wallet', path: '/shopper/wallet' },
];

const PROFILE_PATH = '/shopper/profile';
const PROFILE_LABEL = 'Profile';

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
  size = 22,
}: {
  entry: NavEntry;
  active: boolean;
  size?: number;
}) {
  if (entry.kind === 'icon') {
    return <entry.Icon size={size} />;
  }
  // Brand symbol is treated as a mask, not an image, so it inherits the
  // button's `color` exactly like the react-icons do. The PNG's alpha
  // channel becomes the stencil; `currentColor` paints it.
  // Rendered slightly larger to compensate for the transparent padding
  // baked into the 500×500 source.
  return (
    <span
      aria-hidden="true"
      data-active={active}
      className="shl-symbol"
      style={{
        width: size + 4,
        height: size + 4,
        display: 'block',
        // The mask URL is set in CSS so the asset path stays in one place.
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

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getMyProfile();
        setProfile(p as Record<string, unknown> as typeof profile);
      } catch {}
    })();
  }, []);

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

  return (
    <div className="shl-root">
      <style>{CSS}</style>

      {/* ── Desktop side rail ────────────────────────────── */}
      <aside className="shl-rail" aria-label="Shopper navigation">
        <nav className="shl-rail-nav">
          {NAV_ENTRIES.map((entry, i) => {
            const active = activeIndex === i;
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
                title={entry.label}
              >
                <NavGlyph entry={entry} active={active} size={22} />
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
          return (
            <button
              key={entry.path}
              type="button"
              onClick={() => go(entry.path)}
              className={active ? 'shl-tab shl-tab-active' : 'shl-tab'}
              aria-current={active ? 'page' : undefined}
            >
              <NavGlyph entry={entry} active={active} size={22} />
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
    padding-bottom: 72px; /* space for the fixed bottom nav on mobile */
    transition: padding 0.18s ease;
  }

  /* ── Brand symbol glyph ──────────────────────────────────
     Rendered as a mask so it inherits currentColor exactly like
     the react-icons. The PNG's alpha channel is the stencil;
     background-color paints the visible pixels. */
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
    padding: 10px 0 max(8px, env(safe-area-inset-bottom));
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
    gap: 2px;
    padding: 4px 0;
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
    font-size: 10px;
    font-weight: 400;
    line-height: 1;
  }
  .shl-tab-active .shl-tab-label { font-weight: 600; }

  /* ── Desktop breakpoint ─────────────────────────────── */
  @media (min-width: 1024px) {
    .shl-rail { display: flex; }
    .shl-bottom { display: none; }
    .shl-content { padding-bottom: 0; }
  }
`;