'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../services/api';
import {
  MdRefresh,
  MdErrorOutline,
  MdArrowBack,
  MdBlock,
  MdCheckCircle,
  MdDeleteOutline,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface StoreInfo {
  name?: string;
  description?: string;
  category?: string;
  address?: string;
  phone?: string;
  verified?: number | boolean;
  latitude?: number;
  longitude?: number;
  store_image_url?: string;
  [key: string]: unknown;
}

interface CourierInfo {
  vehicle_type?: string;
  is_online?: number | boolean;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

interface AdminUserFull {
  id?: string;
  nickname?: string;
  email?: string;
  phone?: string;
  role?: string;
  avatar_url?: string;
  verified?: number | boolean;
  kyc_verified?: number | boolean;
  suspended?: number | boolean;
  created_at?: string;
  last_ip?: string;
  last_device?: string;
  store?: StoreInfo | null;
  courier?: CourierInfo | null;
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_URL || ''}${url}`;
}

function formatDate(isoString?: string): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [user, setUser] = useState<AdminUserFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await api.adminGetUserFull(userId)) as AdminUserFull;
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [userId]);

  const toggleSuspend = async () => {
    if (!user) return;
    try {
      if (user.suspended) {
        await api.adminUnsuspendUser(userId);
      } else {
        await api.adminSuspendUser(userId);
      }
      await loadData();
    } catch (err) {
      alert('Action failed: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const deleteUser = async () => {
    if (!user) return;
    const name = user.nickname || user.phone || 'this user';
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      await api.adminDeleteUser(userId);
      router.back();
    } catch (err) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : ''));
    }
  };

  if (loading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  if (error || !user) {
    return (
      <main style={styles.center}>
        <MdErrorOutline size={48} color="#ef9a9a" />
        <p style={{ color: '#666', margin: '8px 0 16px' }}>{error || 'User not found'}</p>
        <button onClick={loadData} style={styles.retryBtn}>
          Retry
        </button>
      </main>
    );
  }

  const avatarUrl = resolveImageUrl(user.avatar_url);
  const name = user.nickname || user.phone || 'Unknown';

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <MdArrowBack size={24} color="#1A1A1A" />
        </button>
        <h1 style={styles.pageTitle}>User Details</h1>
        <div style={styles.headerActions}>
          <button
            onClick={toggleSuspend}
            style={styles.iconBtn}
            title={user.suspended ? 'Unsuspend user' : 'Suspend user'}
          >
            {user.suspended ? (
              <MdCheckCircle size={24} color="#4CAF50" />
            ) : (
              <MdBlock size={24} color="#FF9800" />
            )}
          </button>
          <button onClick={deleteUser} style={styles.iconBtn} title="Delete user">
            <MdDeleteOutline size={24} color="#FF0000" />
          </button>
          <button onClick={loadData} style={styles.iconBtn} title="Refresh">
            <MdRefresh size={24} color="#0504AA" />
          </button>
        </div>
      </div>

      <div style={styles.scrollArea}>
        {/* Profile Header */}
        <div style={styles.profileCard}>
          <div style={styles.avatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={styles.avatarImage} />
            ) : (
              <span style={styles.avatarText}>{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={styles.userName}>{name}</h2>
            <p style={styles.userEmail}>{user.email || 'No email'}</p>
            <span style={styles.roleBadge}>{user.role || 'user'}</span>
          </div>
        </div>

        {/* Basic Information */}
        <SectionTitle title="Basic Information" />
        <InfoRow label="Phone" value={user.phone || '—'} />
        <InfoRow label="Email" value={user.email || '—'} />
        <InfoRow label="Nickname" value={user.nickname || '—'} />
        <InfoRow label="Verified" value={user.verified ? 'Yes' : 'No'} />
        <InfoRow label="KYC Verified" value={user.kyc_verified ? 'Yes' : 'No'} />
        <InfoRow label="Suspended" value={user.suspended ? 'Yes' : 'No'} />
        <InfoRow label="Role" value={user.role || 'user'} />
        <InfoRow label="Joined" value={formatDate(user.created_at)} />
        <InfoRow label="Last Login IP" value={user.last_ip || '—'} />
        <InfoRow label="Last Device" value={user.last_device || '—'} />

        {/* Store Details */}
        {user.store && (
          <>
            <SectionTitle title="Store Details" />
            <InfoRow label="Store Name" value={user.store.name || '—'} />
            <InfoRow label="Description" value={user.store.description || '—'} />
            <InfoRow label="Category" value={user.store.category || '—'} />
            <InfoRow label="Address" value={user.store.address || '—'} />
            <InfoRow label="Phone" value={user.store.phone || '—'} />
            <InfoRow label="Verified" value={user.store.verified ? 'Yes' : 'No'} />
            <InfoRow label="Latitude" value={user.store.latitude?.toString() || '—'} />
            <InfoRow label="Longitude" value={user.store.longitude?.toString() || '—'} />

            {user.store.store_image_url && (
              <div style={styles.storeImageWrapper}>
                <img
                  src={resolveImageUrl(user.store.store_image_url) || ''}
                  alt="Store"
                  style={styles.storeImage}
                />
              </div>
            )}
          </>
        )}

        {/* Courier Details */}
        {user.courier && (
          <>
            <SectionTitle title="Courier Details" />
            <InfoRow label="Vehicle Type" value={user.courier.vehicle_type || '—'} />
            <InfoRow label="Online" value={user.courier.is_online ? 'Online' : 'Offline'} />
            <InfoRow label="Latitude" value={user.courier.lat?.toString() || '—'} />
            <InfoRow label="Longitude" value={user.courier.lng?.toString() || '—'} />
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Reusable Components ──────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return <h3 style={styles.sectionTitle}>{title}</h3>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#F8FAFC',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#F8FAFC',
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
    marginTop: 16,
    padding: '8px 20px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #eee',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    flex: 1,
  },
  headerActions: {
    display: 'flex',
    gap: 4,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  profileCard: {
    display: 'flex',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0504AA',
  },
  userName: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1A1A1A',
    margin: 0,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    margin: '4px 0',
  },
  roleBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#0504AA10',
    color: '#0504AA',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0504AA',
    margin: '16px 0 8px',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '4px 0',
  },
  infoLabel: {
    width: 130,
    fontWeight: 500,
    color: '#888',
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontWeight: 400,
    color: '#1A1A1A',
  },
  storeImageWrapper: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  storeImage: {
    width: '100%',
    height: 150,
    objectFit: 'cover',
  },
};