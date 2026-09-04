'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { clear as clearLocalStorage } from '../../../services/localStorage';
import {
  MdSettings,
  MdSwapHoriz,
  MdLogout,
  MdPerson,
  MdArrowForwardIos,
  MdErrorOutline,
  MdCameraAlt,
  MdPhotoLibrary,
  MdClose,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface Profile {
  nickname?: string;
  username?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  business_name?: string;
  role?: string;
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}

export default function ServiceProviderProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState('service_provider');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = (await api.getMyProfile()) as Profile;
      setProfile(data);
      setActiveRole((data.role as string) || 'service_provider');
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      clearLocalStorage();
      router.replace('/');
    }
  };

  const switchRole = () => {
    router.push('/onboarding?mode=switch');
  };

  const openSettings = () => {
    router.push(`/settings/${activeRole}`);
  };

  const openAvatarModal = () => setShowAvatarModal(true);
  const closeAvatarModal = () => {
    setShowAvatarModal(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      await api.uploadAvatar(avatarFile);
      await loadProfile();
      closeAvatarModal();
    } catch {
      alert('Failed to update avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (isLoading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={styles.center}>
        <MdErrorOutline size={48} color="#ef9a9a" />
        <p style={{ color: '#666', margin: '8px 0 16px' }}>Failed to load profile</p>
        <button onClick={loadProfile} style={styles.retryBtn}>Retry</button>
      </main>
    );
  }

  const name = profile.business_name || profile.nickname || profile.username || 'Service Provider';
  const phone = profile.phone || '';
  const email = profile.email || '';
  const avatarUrl = resolveImageUrl(profile.avatar_url) || avatarPreview;

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Profile</h1>
        <button onClick={openSettings} style={styles.iconBtn} title="Settings">
          <MdSettings size={24} color="#0504AA" />
        </button>
      </div>

      {/* Content */}
      <div style={styles.body}>
        {/* Profile Header Card */}
        <div style={styles.profileCard}>
          <div style={styles.avatarWrapper} onClick={openAvatarModal}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={styles.avatar} />
            ) : (
              <MdPerson size={50} color="#aaa" />
            )}
          </div>
          <h2 style={styles.name}>{name}</h2>
          {phone && <p style={styles.phone}>{phone}</p>}
          {email && <p style={styles.email}>{email}</p>}
          <span style={styles.roleBadge}>SERVICE PROVIDER</span>
        </div>

        {/* Action Cards */}
        <ActionCard
          icon={<MdSettings size={24} color="#0504AA" />}
          title="Settings"
          subtitle="Manage your account preferences"
          onTap={openSettings}
        />
        <ActionCard
          icon={<MdSwapHoriz size={24} color="#0504AA" />}
          title="Switch Role"
          subtitle="Change to a different role"
          onTap={switchRole}
        />
        <ActionCard
          icon={<MdLogout size={24} color="#FF0000" />}
          title="Log Out"
          subtitle="Sign out of your account"
          onTap={handleLogout}
          destructive
        />
      </div>

      {/* Avatar Upload Modal */}
      {showAvatarModal && (
        <div style={styles.modalOverlay} onClick={closeAvatarModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={closeAvatarModal}>
              <MdClose size={20} color="#666" />
            </button>
            <h3 style={styles.modalTitle}>Update Avatar</h3>
            <div style={styles.modalAvatarPreview} onClick={() => avatarInputRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <MdCameraAlt size={40} color="#888" />
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <div style={styles.modalActions}>
              <button
                onClick={() => avatarInputRef.current?.click()}
                style={styles.secondaryBtn}
              >
                <MdPhotoLibrary size={18} color="#0504AA" />
                Gallery
              </button>
              <button
                onClick={() => avatarInputRef.current?.click()}
                style={styles.secondaryBtn}
              >
                <MdCameraAlt size={18} color="#0504AA" />
                Camera
              </button>
            </div>
            <button
              onClick={uploadAvatar}
              disabled={!avatarFile || uploadingAvatar}
              style={styles.primaryBtn}
            >
              {uploadingAvatar ? 'Uploading...' : 'Save Avatar'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Action Card Component ────────────────────────────────────────
function ActionCard({
  icon,
  title,
  subtitle,
  onTap,
  destructive = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onTap: () => void;
  destructive?: boolean;
}) {
  return (
    <div style={styles.actionCard} onClick={onTap}>
      <div style={{ ...styles.actionIcon, backgroundColor: destructive ? '#FF000010' : '#0504AA10' }}>
        {icon}
      </div>
      <div style={styles.actionContent}>
        <div style={{ ...styles.actionTitle, color: destructive ? '#FF0000' : '#1A1A1A' }}>
          {title}
        </div>
        <div style={styles.actionSubtitle}>{subtitle}</div>
      </div>
      <MdArrowForwardIos size={16} color="#999" />
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#fff',
    padding: 16,
    textAlign: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    padding: '8px 20px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    textAlign: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: '50%',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  avatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    margin: 0,
  },
  phone: {
    fontSize: 15,
    color: '#666',
    margin: '4px 0 0',
  },
  email: {
    fontSize: 13,
    color: '#888',
    margin: '2px 0 0',
  },
  roleBadge: {
    display: 'inline-block',
    marginTop: 8,
    padding: '4px 12px',
    backgroundColor: '#0504AA10',
    color: '#0504AA',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    border: '1px solid #eee',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    cursor: 'pointer',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 16,
    color: '#1A1A1A',
  },
  modalAvatarPreview: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    backgroundColor: '#f0f0f0',
    margin: '0 auto',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    display: 'flex',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  secondaryBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px',
    borderRadius: 8,
    border: '1px solid #0504AA',
    background: 'none',
    color: '#0504AA',
    fontWeight: 600,
    cursor: 'pointer',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

// Add spinner keyframes
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}