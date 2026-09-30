'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../../services/api';
import { alertDialog } from '../../components/ui/dialogs';
import {
  MdDashboard,
  MdCalendarToday,
  MdDesignServices,
  MdChatBubbleOutline,
  MdAccountBalanceWallet,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

type NavEntry = { Icon: IconType; label: string; path: string };

const NAV_ENTRIES: NavEntry[] = [
  { Icon: MdDashboard,            label: 'Home',     path: '/service-provider/home'     },
  { Icon: MdCalendarToday,        label: 'Bookings', path: '/service-provider/bookings' },
  { Icon: MdDesignServices,       label: 'Services', path: '/service-provider/services' },
  { Icon: MdChatBubbleOutline,    label: 'Inbox',    path: '/service-provider/inbox'    },
  { Icon: MdAccountBalanceWallet, label: 'Wallet',   path: '/service-provider/wallet'   },
];

const PROFILE_PATH = '/service-provider/profile';
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

export default function ServiceProviderLayout({
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
  const [hasSetup, setHasSetup] = useState<boolean | null>(null);
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
      const services = await api.getProviderServices();
      const servicesList = Array.isArray(services) ? services : [];
      const has = servicesList.length > 0;
      setHasSetup(has);

      const onOnboarding = pathname?.startsWith(
        '/service-provider/onboarding',
      );
      if (!has && !onOnboarding) {
        router.replace('/service-provider/onboarding');
        return;
      }
    } catch {
      setHasSetup(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfile();
      void checkSetup();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Block is on Bookings + Services (both need a catalog to be
    // meaningful). Wallet is unlocked — you can receive a top-up or
    // refund even with no services listed.
    if ((index === 1 || index === 2) && hasSetup !== true) {
      await alertDialog({
        title: 'Complete setup first',
        body: 'Add your first service to unlock this section.',
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
    <div className="spl-root">
      <style>{CSS}</style>

      <aside className="spl-rail" aria-label="Service provider navigation">
        <nav className="spl-rail-nav">
          {NAV_ENTRIES.map((entry, i) => {
            const active = activeIndex === i;
            return (
              <button
                key={entry.path}
                type="button"
                onClick={() => void navigate(i)}
                className={
                  active
                    ? 'spl-rail-item spl-rail-item-active'
                    : 'spl-rail-item'
                }
                aria-current={active ? 'page' : undefined}
                title={entry.label}
              >
                <entry.Icon size={22} />
                <span className="spl-rail-label">{entry.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => void navigate(NAV_ENTRIES.length)}
          className={
            activeIndex === NAV_ENTRIES.length
              ? 'spl-rail-item spl-rail-profile spl-rail-item-active'
              : 'spl-rail-item spl-rail-profile'
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
          <span className="spl-rail-label">{PROFILE_LABEL}</span>
        </button>
      </aside>

      <main className="spl-content">{children}</main>

      {hasSetup !== false && (
        <nav className="spl-bottom" aria-label="Service provider navigation">
          {NAV_ENTRIES.map((entry, i) => {
            const active = activeIndex === i;
            return (
              <button
                key={entry.path}
                type="button"
                onClick={() => void navigate(i)}
                className={active ? 'spl-tab spl-tab-active' : 'spl-tab'}
                aria-current={active ? 'page' : undefined}
              >
                <entry.Icon size={22} />
                <span className="spl-tab-label">{entry.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => void navigate(NAV_ENTRIES.length)}
            className={
              activeIndex === NAV_ENTRIES.length
                ? 'spl-tab spl-tab-active'
                : 'spl-tab'
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
            <span className="spl-tab-label">{PROFILE_LABEL}</span>
          </button>
        </nav>
      )}
    </div>
  );
}

const CSS = `
  .spl-root {
    display: flex;
    height: 100dvh;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.18s ease, color 0.18s ease;
  }

  .spl-content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding-bottom: 72px;
    transition: padding 0.18s ease;
  }

  .spl-rail {
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
  .spl-rail-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    flex: 1;
    min-height: 0;
  }
  .spl-rail-item {
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
  .spl-rail-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .spl-rail-item:active { transform: scale(0.97); }
  .spl-rail-item-active,
  .spl-rail-item-active:hover {
    background: var(--brand-soft);
    color: var(--brand-primary);
  }
  .spl-rail-item:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 2px;
  }
  .spl-rail-label {
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.2px;
  }
  .spl-rail-profile { margin-top: auto; }

  .spl-bottom {
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
  .spl-tab {
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
  .spl-tab-active { color: var(--brand-primary); }
  .spl-tab-label {
    font-size: 10px;
    font-weight: 400;
    line-height: 1;
  }
  .spl-tab-active .spl-tab-label { font-weight: 600; }

  @media (min-width: 1024px) {
    .spl-rail { display: flex; }
    .spl-bottom { display: none; }
    .spl-content { padding-bottom: 0; }
  }
`;