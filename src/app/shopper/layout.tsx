'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../../services/api';
import {
  MdStorefront,
  MdLocationOn,
  MdFavoriteBorder,
  MdChatBubbleOutline,
  MdAccountBalanceWallet,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

function UserAvatar({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const initials = (name || '?')[0].toUpperCase();
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        overflow: 'hidden',
        backgroundColor: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        color: '#0504AA',
      }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontWeight: 'bold' }}>{initials}</span>
      )}
    </div>
  );
}

export default function ShopperLayout({ children }: { children: React.ReactNode }) {
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

  let currentIndex = 0;
  if (pathname.startsWith('/shopper/map')) currentIndex = 1;
  else if (pathname.startsWith('/shopper/saved')) currentIndex = 2;
  else if (pathname.startsWith('/shopper/inbox')) currentIndex = 3;
  else if (pathname.startsWith('/shopper/wallet')) currentIndex = 4;
  else if (pathname.startsWith('/shopper/profile')) currentIndex = 5;

  const navigate = (index: number) => {
    switch (index) {
      case 0: router.replace('/shopper/home'); break;
      case 1: router.replace('/shopper/map'); break;
      case 2: router.replace('/shopper/saved'); break;
      case 3: router.replace('/shopper/inbox'); break;
      case 4: router.replace('/shopper/wallet'); break;
      case 5: router.replace('/shopper/profile'); break;
    }
  };

  const avatarName = profile?.nickname || profile?.phone || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>

      <div style={styles.navBar}>
        <NavItem Icon={MdStorefront} label="Home" active={currentIndex === 0} onTap={() => navigate(0)} />
        <NavItem Icon={MdLocationOn} label="Map" active={currentIndex === 1} onTap={() => navigate(1)} />
        <NavItem Icon={MdFavoriteBorder} label="Saved" active={currentIndex === 2} onTap={() => navigate(2)} />
        <NavItem Icon={MdChatBubbleOutline} label="Inbox" active={currentIndex === 3} onTap={() => navigate(3)} />
        <NavItem Icon={MdAccountBalanceWallet} label="Wallet" active={currentIndex === 4} onTap={() => navigate(4)} />
        {/* Profile Avatar Tab */}
        <div
          onClick={() => navigate(5)}
          style={{
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            cursor: 'pointer',
            minWidth: 60,
          }}
        >
          <div
            style={{
              borderRadius: '50%',
              border: currentIndex === 5 ? '2px solid #0504AA' : '2px solid transparent',
              padding: 2,
            }}
          >
            <UserAvatar imageUrl={profile?.avatar_url} name={avatarName} />
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: currentIndex === 5 ? 'bold' : 'normal',
              color: currentIndex === 5 ? '#0504AA' : 'rgba(26,26,26,0.6)',
              marginTop: 2,
            }}
          >
            Profile
          </span>
        </div>
      </div>
    </div>
  );
}

// NavItem with properly typed Icon
function NavItem({ Icon, label, active, onTap }: { Icon: IconType; label: string; active: boolean; onTap: () => void }) {
  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        cursor: 'pointer',
        padding: '8px 12px',
        borderRadius: 20,
        backgroundColor: active ? 'rgba(5,4,170,0.1)' : 'transparent',
        transition: 'background-color 0.3s',
      }}
    >
      <Icon size={24} color={active ? '#0504AA' : 'rgba(26,26,26,0.6)'} />
      <span
        style={{
          fontSize: 10,
          fontWeight: active ? 'bold' : 'normal',
          color: active ? '#0504AA' : 'rgba(26,26,26,0.6)',
          marginTop: 2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

const styles = {
  navBar: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '8px 16px',
    margin: '0 16px 8px',
    height: 64,
    backgroundColor: '#fff',
    borderRadius: 24,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    position: 'sticky',
    bottom: 0,
    zIndex: 10,
  } as React.CSSProperties,
};