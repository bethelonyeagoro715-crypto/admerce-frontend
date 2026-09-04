'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdRefresh,
  MdAutoAwesome,
  MdVisibility,
  MdChat,
  MdShoppingBag,
  MdAttachMoney,
  MdAdd,
  MdGridView,
  MdEdit,
  MdPerson,
  MdAddPhotoAlternate,
  MdPhotoLibrary,
  MdCameraAlt,
  MdClose,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface Store {
  name?: string;
  store_image_url?: string;
  store_id?: string;
}

interface Profile {
  nickname?: string;
  username?: string;
  avatar_url?: string;
}

interface StoreStats {
  views?: number;
  inquiries?: number;
  sold?: number;
  revenue?: number;
}

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}

export default function StorekeeperDashboardPage() {
  const router = useRouter();

  const [store, setStore] = useState<Store | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<StoreStats>({});
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showStoreImageModal, setShowStoreImageModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const storeImageInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Store image preview state
  const [storeImagePreview, setStoreImagePreview] = useState<string | null>(null);
  const [storeImageFile, setStoreImageFile] = useState<File | null>(null);

  // Avatar preview state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [uploadingStoreImage, setUploadingStoreImage] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [storeData, profileData, statsData] = await Promise.all([
        api.getMyStore() as Promise<Store | null>,
        api.getMyProfile() as Promise<Profile>,
        api.getStoreStats() as Promise<StoreStats>,
      ]);
      setStore(storeData);
      setProfile(profileData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openStoreImageModal = () => setShowStoreImageModal(true);
  const closeStoreImageModal = () => {
    setShowStoreImageModal(false);
    setStoreImageFile(null);
    setStoreImagePreview(null);
  };

  const openAvatarModal = () => setShowAvatarModal(true);
  const closeAvatarModal = () => {
    setShowAvatarModal(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleStoreImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoreImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setStoreImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadStoreImage = async () => {
    if (!storeImageFile) return;
    setUploadingStoreImage(true);
    try {
      const formData = new FormData();
      formData.append('image', storeImageFile);
      await api.updateStoreImage(formData);
      await loadDashboardData();
      closeStoreImageModal();
    } catch (error) {
      alert('Failed to update store image');
    } finally {
      setUploadingStoreImage(false);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      await api.uploadAvatar(avatarFile);
      await loadDashboardData();
      closeAvatarModal();
    } catch (error) {
      alert('Failed to update avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const storeImageUrl = storeImagePreview || resolveImageUrl(store?.store_image_url);
  const avatarUrl = avatarPreview || resolveImageUrl(profile?.avatar_url);
  const userName = profile?.nickname || profile?.username || 'Storekeeper';

  if (isLoading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>{store?.name || 'Dashboard'}</h1>
        <button onClick={() => loadDashboardData()} style={styles.iconBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      {/* Floating SEAI button */}
      <button
        onClick={() => router.push('/seai/ask?mode=agent')}
        style={styles.fab}
        title="Ask SEAI"
      >
        <MdAutoAwesome size={24} color="#fff" />
      </button>

      {/* Content */}
      <div style={styles.scrollArea}>
        {/* Store preview */}
        <h2 style={styles.sectionTitle}>Store Preview</h2>
        <div onClick={openStoreImageModal} style={styles.storePreview}>
          {storeImageUrl ? (
            <img src={storeImageUrl} alt="Store" style={styles.storeImage} />
          ) : (
            <div style={styles.storeImagePlaceholder}>
              <MdAddPhotoAlternate size={40} color="#999" />
              <p>No store image yet</p>
            </div>
          )}
        </div>
        <p style={styles.hintText}>Tap to upload or change store image</p>

        {/* Profile header */}
        <div style={styles.profileHeader}>
          <div onClick={openAvatarModal} style={styles.avatarWrapper}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={styles.avatar} />
            ) : (
              <div style={styles.avatarPlaceholder}>
                <MdPerson size={28} color="#0504AA" />
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.profileName}>{userName}</div>
            <div style={styles.profileRole}>Storekeeper</div>
          </div>
          <button
            onClick={() => router.push('/storekeeper/profile')}
            style={styles.editBtn}
            title="Edit profile"
          >
            <MdEdit size={22} color="#0504AA" />
          </button>
        </div>

        {/* Metrics */}
        <div style={styles.metricsRow}>
          <MetricCard icon={<MdVisibility size={20} color="#0504AA" />} label="Views" value={String(stats.views ?? 0)} />
          <MetricCard icon={<MdChat size={20} color="#0504AA" />} label="Inquiries" value={String(stats.inquiries ?? 0)} />
        </div>
        <div style={styles.metricsRow}>
          <MetricCard icon={<MdShoppingBag size={20} color="#0504AA" />} label="Sold" value={String(stats.sold ?? 0)} />
          <MetricCard icon={<MdAttachMoney size={20} color="#0504AA" />} label="Revenue" value={`₦${(stats.revenue ?? 0).toFixed(0)}`} />
        </div>

        {/* Action buttons */}
        <div style={styles.actionRow}>
          <button
            onClick={() => router.push('/storekeeper/add-item')}
            style={{ ...styles.actionButton, backgroundColor: '#0504AA' }}
          >
            <MdAdd size={20} color="#fff" />
            Add Item
          </button>
          <button
            onClick={() => router.push(`/storekeeper/arrange-store?store_id=${store?.store_id || ''}`)}
            style={{ ...styles.actionButton, backgroundColor: 'transparent', border: '1px solid #0504AA', color: '#0504AA' }}
          >
            <MdGridView size={20} color="#0504AA" />
            Arrange Store
          </button>
        </div>
      </div>

      {/* Store image upload modal */}
      {showStoreImageModal && (
        <Modal onClose={closeStoreImageModal}>
          <h3 style={styles.modalTitle}>Update Store Image</h3>
          <div style={styles.modalImagePreview} onClick={() => storeImageInputRef.current?.click()}>
            {storeImageUrl ? (
              <img src={storeImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#888' }}>
                <MdAddPhotoAlternate size={48} />
                <span>Tap to pick image</span>
              </div>
            )}
          </div>
          <input
            ref={storeImageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleStoreImageChange}
          />
          <div style={styles.modalActions}>
            <button
              onClick={() => storeImageInputRef.current?.click()}
              style={styles.secondaryBtn}
            >
              <MdPhotoLibrary size={18} color="#0504AA" />
              Gallery
            </button>
            <button
              onClick={() => storeImageInputRef.current?.click()}
              style={styles.secondaryBtn}
            >
              <MdCameraAlt size={18} color="#0504AA" />
              Camera
            </button>
          </div>
          <button
            onClick={uploadStoreImage}
            disabled={!storeImageFile || uploadingStoreImage}
            style={styles.primaryBtn}
          >
            {uploadingStoreImage ? 'Uploading...' : 'Save Image'}
          </button>
        </Modal>
      )}

      {/* Avatar upload modal */}
      {showAvatarModal && (
        <Modal onClose={closeAvatarModal}>
          <h3 style={styles.modalTitle}>Update Avatar</h3>
          <div style={styles.modalAvatarPreview} onClick={() => avatarInputRef.current?.click()}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#888' }}>
                <MdCameraAlt size={40} />
              </div>
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
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────
function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {icon}
        <span style={styles.metricValue}>{value}</span>
      </div>
      <div style={styles.metricLabel}>{label}</div>
    </div>
  );
}

// ─── Modal Component ─────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onClose}>
          <MdClose size={20} color="#666" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#F7F5F0',
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#fff',
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
  fab: {
    position: 'fixed',
    bottom: 90,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(5, 4, 170, 0.4)',
    cursor: 'pointer',
    zIndex: 50,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
    color: '#1A1A1A',
  },
  storePreview: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer',
  },
  storeImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  storeImagePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
  },
  hintText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    border: '1px solid #eee',
    marginTop: 20,
    marginBottom: 24,
  },
  avatarWrapper: {
    width: 50,
    height: 50,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer',
    marginRight: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1A1A1A',
  },
  profileRole: {
    fontSize: 13,
    color: '#888',
  },
  editBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
  },
  metricsRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0504AA',
  },
  metricLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  actionRow: {
    display: 'flex',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
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
  modalImagePreview: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    margin: '0 auto',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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