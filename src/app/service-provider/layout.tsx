'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../../services/api';
import {
  MdDashboard,
  MdCalendarToday,
  MdAttachMoney,
  MdChatBubbleOutline,
  MdAccountBalanceWallet,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

// ─── Colors ─────────────────────────────────────────────────────────
const NAV_BG = '#FFFFFF';
const NAV_BORDER = '#E5E5E5';
const ACTIVE_COLOR = '#0504AA';
const INACTIVE_COLOR = 'rgba(26, 26, 26, 0.55)';
const ACTIVE_AVATAR_RING = '#0504AA';

function UserAvatar({
  imageUrl,
  name,
  active,
}: {
  imageUrl?: string;
  name: string;
  active: boolean;
}) {
  const initials = (name || '?')[0].toUpperCase();
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        overflow: 'hidden',
        backgroundColor: '#F0F0F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: '#0504AA',
        border: active ? `2px solid ${ACTIVE_AVATAR_RING}` : '2px solid transparent',
        boxSizing: 'border-box',
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontWeight: 'bold' }}>{initials}</span>
      )}
    </div>
  );
}

export default function ServiceProviderLayout({ children }: { children: React.ReactNode }) {
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
      const services = await api.listServices();
      const servicesList = Array.isArray(services) ? services : [];
      setHasSetup(servicesList.length > 0);
      if (servicesList.length === 0) {
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
      loadProfile();
      checkSetup();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  let currentIndex = 0;
  if (pathname.startsWith('/service-provider/bookings')) currentIndex = 1;
  else if (pathname.startsWith('/service-provider/earnings')) currentIndex = 2;
  else if (pathname.startsWith('/service-provider/inbox')) currentIndex = 3;
  else if (pathname.startsWith('/service-provider/wallet')) currentIndex = 4;
  else if (pathname.startsWith('/service-provider/profile')) currentIndex = 5;

  const navigate = (index: number) => {
    if (index === 4 && hasSetup !== true) {
      alert('Please complete setup first.');
      return;
    }
    switch (index) {
      case 0: router.replace('/service-provider/home'); break;
      case 1: router.replace('/service-provider/bookings'); break;
      case 2: router.replace('/service-provider/earnings'); break;
      case 3: router.replace('/service-provider/inbox'); break;
      case 4: router.replace('/service-provider/wallet'); break;
      case 5: router.replace('/service-provider/profile'); break;
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
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '4px solid #eee',
            borderTopColor: '#0504AA',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const avatarName = profile?.nickname || profile?.phone || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 64 }}>
        {children}
      </div>

      {hasSetup !== false && (
        <nav style={styles.navBar}>
          <NavItem
            Icon={MdDashboard}
            label="Home"
            active={currentIndex === 0}
            onTap={() => navigate(0)}
          />
          <NavItem
            Icon={MdCalendarToday}
            label="Bookings"
            active={currentIndex === 1}
            onTap={() => navigate(1)}
          />
          <NavItem
            Icon={MdAttachMoney}
            label="Earnings"
            active={currentIndex === 2}
            onTap={() => navigate(2)}
          />
          <NavItem
            Icon={MdChatBubbleOutline}
            label="Inbox"
            active={currentIndex === 3}
            onTap={() => navigate(3)}
          />
          <NavItem
            Icon={MdAccountBalanceWallet}
            label="Wallet"
            active={currentIndex === 4}
            onTap={() => navigate(4)}
          />

          <div
            onClick={() => navigate(5)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flex: 1,
              gap: 2,
            }}
          >
            <UserAvatar
              imageUrl={profile?.avatar_url}
              name={avatarName}
              active={currentIndex === 5}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: currentIndex === 5 ? 600 : 400,
                color: currentIndex === 5 ? ACTIVE_COLOR : INACTIVE_COLOR,
                lineHeight: 1,
              }}
            >
              Profile
            </span>
          </div>
        </nav>
      )}
    </div>
  );
}

// ─── NavItem ────────────────────────────────────────────────────────
function NavItem({
  Icon,
  label,
  active,
  onTap,
}: {
  Icon: IconType;
  label: string;
  active: boolean;
  onTap: () => void;
}) {
  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flex: 1,
        gap: 2,
        padding: '4px 0',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon size={22} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />
      <span
        style={{
          fontSize: 10,
          fontWeight: active ? 600 : 400,
          color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = {
  navBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: NAV_BG,
    borderTop: `1px solid ${NAV_BORDER}`,
    paddingTop: 10,
    paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    zIndex: 100,
  } as React.CSSProperties,
};