'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../../services/api';
import { alertDialog } from '../../components/ui/dialogs';
import {
  MdDashboard,
  MdInventory,
  MdReceipt,
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
    path: '/storekeeper/home',
  },
  { kind: 'icon', Icon: MdInventory,            label: 'Items',  path: '/storekeeper/items'  },
  { kind: 'icon', Icon: MdReceipt,              label: 'Orders', path: '/storekeeper/orders' },
  { kind: 'icon', Icon: MdChatBubbleOutline,    label: 'Inbox',  path: '/storekeeper/inbox'  },
  { kind: 'icon', Icon: MdAccountBalanceWallet, label: 'Wallet', path: '/storekeeper/wallet' },
];

const PROFILE_PATH = '/storekeeper/profile';
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
        color: 'var(--brand-primary)',
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
      className="skl-symbol"
      style={{
        width: size + 4,
        height: size + 4,
        display: 'block',
      }}
    />
  );
}

export default function StorekeeperLayout({
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
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const p = (await api.getMyProfile()) as typeof profile;
      setProfile(p);
    } catch {
      // ignore
    }
  };

  const checkSetup = async () => {
    setIsLoading(true);
    try {
      const store = await api.getMyStore();
      setHasStore(store !== null);
      setIsLoading(false);

      if (store === null) {
        router.replace('/storekeeper/onboarding/personal-info');
      }
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response
          ?.status === 404
      ) {
        setHasStore(false);
        setIsLoading(false);
        router.replace('/storekeeper/onboarding/personal-info');
      } else {
        setIsLoading(false);
        await alertDialog({
          title: 'Could not load store',
          body: 'Please check your connection and try again.',
          kind: 'danger',
        });
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfile();
      void checkSetup();
    }, 0);
    return () => clearTimeout(timer);
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

  const navigate = async (index: number) => {
    if (index === 4 && hasStore !== true) {
      await alertDialog({
        title: 'Complete setup first',
        body: 'Add your store details to unlock your wallet.',
        kind: 'warning',
      });
      return;
    }
    if (index < NAV_ENTRIES.length) {
      router.replace(NAV_ENTRIES[index].path);
    } else {
      router.replace(PROFILE_PATH);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'var(--bg-primary)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '4px solid var(--border-default)',
            borderTopColor: 'var(--brand-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="skl-root">
      <style>{CSS}</style>

      {/* ── Desktop side rail ─────────────────────────────── */}
      <aside className="skl-rail" aria-label="Storekeeper navigation">
        <nav className="skl-rail-nav">
          {NAV_ENTRIES.map((entry, i) => {
            const active = activeIndex === i;
            return (
              <button
                key={entry.path}
                type="button"
                onClick={() => void navigate(i)}
                className={
                  active
                    ? 'skl-rail-item skl-rail-item-active'
                    : 'skl-rail-item'
                }
                aria-current={active ? 'page' : undefined}
                title={entry.label}
              >
                <NavGlyph entry={entry} active={active} size={24} />
                <span className="skl-rail-label">{entry.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => void navigate(NAV_ENTRIES.length)}
          className={
            activeIndex === NAV_ENTRIES.length
              ? 'skl-rail-item skl-rail-profile skl-rail-item-active'
              : 'skl-rail-item skl-rail-profile'
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
          <span className="skl-rail-label">{PROFILE_LABEL}</span>
        </button>
      </aside>

      {/* ── Content ──────────────────────────────────────── */}
      <main className="skl-content">{children}</main>

      {/* ── Mobile bottom nav ────────────────────────────── */}
      {hasStore !== false && (
        <nav className="skl-bottom" aria-label="Storekeeper navigation">
          {NAV_ENTRIES.map((entry, i) => {
            const active = activeIndex === i;
            return (
              <button
                key={entry.path}
                type="button"
                onClick={() => void navigate(i)}
                className={active ? 'skl-tab skl-tab-active' : 'skl-tab'}
                aria-current={active ? 'page' : undefined}
              >
                <NavGlyph entry={entry} active={active} size={26} />
                <span className="skl-tab-label">{entry.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => void navigate(NAV_ENTRIES.length)}
            className={
              activeIndex === NAV_ENTRIES.length
                ? 'skl-tab skl-tab-active'
                : 'skl-tab'
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
            <span className="skl-tab-label">{PROFILE_LABEL}</span>
          </button>
        </nav>
      )}
    </div>
  );
}

const CSS = `
  .skl-root {
    display: flex;
    height: 100dvh;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.18s ease, color 0.18s ease;
  }

  .skl-content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding-bottom: 88px;
    transition: padding 0.18s ease;
  }

  /* ── Brand symbol glyph ────────────────────────────────── */
  .skl-symbol {
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
  .skl-rail {
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
  .skl-rail-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    flex: 1;
    min-height: 0;
  }
  .skl-rail-item {
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
  .skl-rail-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .skl-rail-item:active { transform: scale(0.97); }
  .skl-rail-item-active,
  .skl-rail-item-active:hover {
    background: var(--brand-soft);
    color: var(--brand-primary);
  }
  .skl-rail-item:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 2px;
  }
  .skl-rail-label {
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.2px;
  }
  .skl-rail-profile { margin-top: auto; }

  /* ── Mobile bottom nav (shown by default) ────────────── */
  .skl-bottom {
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
  .skl-tab {
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
  .skl-tab-active { color: var(--brand-primary); }
  .skl-tab-label {
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.1px;
  }
  .skl-tab-active .skl-tab-label { font-weight: 700; }

  @media (min-width: 1024px) {
    .skl-rail { display: flex; }
    .skl-bottom { display: none; }
    .skl-content { padding-bottom: 0; }
  }
`;