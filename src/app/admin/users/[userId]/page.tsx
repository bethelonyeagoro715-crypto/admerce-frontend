'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../services/api';
import {
  MdRefresh,
  MdErrorOutline,
  MdArrowBack,
  MdBlock,
  MdCheckCircle,
  MdDeleteOutline,
  MdMoreVert,
  MdContentCopy,
  MdLocationOn,
  MdStorefront,
  MdLocalShipping,
  MdVerified,
  MdClose,
  MdPerson,
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

// ─── Helpers ────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function roleTheme(role: string | undefined): { color: string; soft: string; label: string } {
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return { color: '#7C3AED', soft: '#EDE9FE', label: 'Admin' };
    case 'storekeeper':
      return { color: '#0F766E', soft: '#CCFBF1', label: 'Storekeeper' };
    case 'courier':
      return { color: '#EA580C', soft: '#FFEDD5', label: 'Courier' };
    case 'flipper':
      return { color: '#DB2777', soft: '#FCE7F3', label: 'Flipper' };
    case 'service_provider':
      return { color: '#0504AA', soft: '#E0E7FF', label: 'Service provider' };
    case 'shopper':
      return { color: '#16A34A', soft: '#DCFCE7', label: 'Shopper' };
    default:
      return { color: '#64748B', soft: '#F1F5F9', label: role || '—' };
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

// ─── Confirm dialog state ───────────────────────────────────────────
type ConfirmKind = 'suspend' | 'unsuspend' | 'delete';

// ─── Component ──────────────────────────────────────────────────────
export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [user, setUser] = useState<AdminUserFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const loadData = useCallback(async () => {
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
  }, [userId]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [loadData]);

  const handleCopy = async (value: string, label: string) => {
    if (!value || value === '—') return;
    try {
      await copyText(value);
      showToast(`${label} copied`);
    } catch {
      showToast('Could not copy');
    }
  };

  const runConfirm = async () => {
    if (!user || !confirm) return;
    setIsActing(true);
    try {
      if (confirm === 'delete') {
        await api.adminDeleteUser(userId);
        router.back();
        return;
      }
      if (confirm === 'suspend') {
        await api.adminSuspendUser(userId);
      } else {
        await api.adminUnsuspendUser(userId);
      }
      setConfirm(null);
      await loadData();
    } catch (err) {
      alert('Action failed: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsActing(false);
    }
  };

  const name = user?.nickname || user?.phone || 'Unknown';
  const avatarUrl = resolveImageUrl(user?.avatar_url);
  const isSuspended = Boolean(user?.suspended);
  const theme = roleTheme(user?.role);

  // ─── Loading skeleton ───────────────────────────────────────────
  if (loading) {
    return (
      <main className="udd-root">
        <style>{CSS}</style>
        <header className="udd-header">
          <button className="udd-backBtn" onClick={() => router.back()} aria-label="Back">
            <MdArrowBack size={22} color="#0B0B1A" />
          </button>
          <span className="udd-headerTitle">User details</span>
          <div style={{ width: 36 }} />
        </header>
        <div className="udd-scroll">
          <div className="udd-hero udd-heroSkeleton">
            <div className="udd-skel udd-skelAvatar" />
            <div className="udd-skel udd-skelLine" style={{ width: '55%' }} />
            <div className="udd-skel udd-skelLineShort" style={{ width: '35%' }} />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="udd-card" style={{ marginBottom: 14 }}>
              <div className="udd-skel udd-skelLineShort" style={{ width: '30%', marginBottom: 14 }} />
              <div className="udd-skel udd-skelLine" />
              <div className="udd-skel udd-skelLine" />
              <div className="udd-skel udd-skelLineShort" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ─── Error state ────────────────────────────────────────────────
  if (error || !user) {
    return (
      <main className="udd-root">
        <style>{CSS}</style>
        <header className="udd-header">
          <button className="udd-backBtn" onClick={() => router.back()} aria-label="Back">
            <MdArrowBack size={22} color="#0B0B1A" />
          </button>
          <span className="udd-headerTitle">User details</span>
          <div style={{ width: 36 }} />
        </header>
        <div className="udd-center">
          <MdErrorOutline size={48} color="#ef9a9a" />
          <p className="udd-centerText">{error || 'User not found'}</p>
          <button className="udd-primaryBtn" onClick={loadData}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="udd-root">
      <style>{CSS}</style>

      {/* Header */}
      <header className="udd-header">
        <button
          className="udd-backBtn"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <MdArrowBack size={22} color="#0B0B1A" />
        </button>
        <span className="udd-headerTitle">User details</span>
        <div className="udd-kebabWrap">
          <button
            className="udd-kebab"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MdMoreVert size={22} color="#0B0B1A" />
          </button>
          {menuOpen && (
            <>
              <div className="udd-menuBackdrop" onClick={() => setMenuOpen(false)} />
              <div className="udd-menu" role="menu">
                <button
                  type="button"
                  className="udd-menuItem"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirm(isSuspended ? 'unsuspend' : 'suspend');
                  }}
                >
                  {isSuspended ? (
                    <>
                      <MdCheckCircle size={16} color="#16A34A" />
                      <span>Unsuspend user</span>
                    </>
                  ) : (
                    <>
                      <MdBlock size={16} color="#EA580C" />
                      <span>Suspend user</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="udd-menuItem"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    loadData();
                  }}
                >
                  <MdRefresh size={16} color="#475569" />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  className="udd-menuItem udd-menuItemDanger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirm('delete');
                  }}
                >
                  <MdDeleteOutline size={16} color="#DC2626" />
                  <span>Delete user</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="udd-scroll">
        {/* Hero */}
        <section
          className="udd-hero"
          style={{
            background: `linear-gradient(135deg, ${theme.soft} 0%, #FFFFFF 65%)`,
          }}
        >
          <div className="udd-avatarOuter" style={{ backgroundColor: theme.soft }}>
            <div className="udd-avatar" style={{ backgroundColor: theme.color }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="udd-avatarImg" />
              ) : (
                <span className="udd-avatarInitials">{initialsOf(name)}</span>
              )}
            </div>
          </div>

          <h1 className="udd-name">
            {name}
            {Boolean(user.verified) && (
              <MdVerified size={18} color={theme.color} className="udd-verified" />
            )}
          </h1>

          <div className="udd-heroMeta">
            <span
              className="udd-rolePill"
              style={{ backgroundColor: theme.color, color: '#fff' }}
            >
              {theme.label}
            </span>
            <span className="udd-status">
              <span
                className="udd-statusDot"
                style={{ backgroundColor: isSuspended ? '#DC2626' : '#16A34A' }}
              />
              {isSuspended ? 'Suspended' : 'Active'}
            </span>
          </div>

          {user.email && (
            <p className="udd-heroContact" title={user.email}>
              {user.email}
            </p>
          )}
          {user.phone && (
            <p className="udd-heroContact udd-heroContactMuted" title={user.phone}>
              {user.phone}
            </p>
          )}

          <div className="udd-heroActions">
            {isSuspended ? (
              <button
                type="button"
                className="udd-heroBtn udd-heroBtnSuccess"
                onClick={() => setConfirm('unsuspend')}
              >
                <MdCheckCircle size={18} />
                <span>Unsuspend</span>
              </button>
            ) : (
              <button
                type="button"
                className="udd-heroBtn udd-heroBtnWarn"
                onClick={() => setConfirm('suspend')}
              >
                <MdBlock size={18} />
                <span>Suspend</span>
              </button>
            )}
          </div>
        </section>

        {/* Verification */}
        <Section title="Verification">
          <div className="udd-verifyGrid">
            <VerifyBadge
              ok={Boolean(user.verified)}
              label="Account"
            />
            <VerifyBadge
              ok={Boolean(user.kyc_verified)}
              label="KYC"
            />
          </div>
        </Section>

        {/* Contact */}
        <Section title="Contact">
          <InfoRow
            label="Phone"
            value={user.phone || '—'}
            onCopy={user.phone ? () => handleCopy(user.phone!, 'Phone') : undefined}
          />
          <InfoRow
            label="Email"
            value={user.email || '—'}
            onCopy={user.email ? () => handleCopy(user.email!, 'Email') : undefined}
          />
          <InfoRow label="Nickname" value={user.nickname || '—'} />
          <InfoRow
            label="User ID"
            value={user.id || '—'}
            mono
            onCopy={user.id ? () => handleCopy(user.id!, 'User ID') : undefined}
          />
        </Section>

        {/* Store — only for storekeepers, and only if the store row exists */}
        {user.store && (
          <Section title="Store">
            {user.store.store_image_url && (
              <div className="udd-storeImageWrap">
                <img
                  src={resolveImageUrl(user.store.store_image_url) || ''}
                  alt="Store"
                  className="udd-storeImage"
                />
              </div>
            )}

            <InfoRow label="Name" value={user.store.name || '—'} />
            {user.store.category && (
              <InfoRow label="Category" value={user.store.category} />
            )}
            {user.store.description && (
              <InfoRow label="Description" value={user.store.description} />
            )}
            <InfoRow label="Address" value={user.store.address || '—'} />
            <InfoRow
              label="Phone"
              value={user.store.phone || '—'}
              onCopy={user.store.phone ? () => handleCopy(user.store!.phone!, 'Store phone') : undefined}
            />
            <InfoRow
              label="Verified"
              value={user.store.verified ? 'Yes' : 'No'}
            />
            {user.store.latitude != null && user.store.longitude != null && (
              <div className="udd-mapRow">
                <MdLocationOn size={16} color="#0504AA" />
                <button
                  type="button"
                  className="udd-mapLink"
                  onClick={() =>
                    router.push(
                      `/shopper/map?lat=${user.store!.latitude}&lng=${user.store!.longitude}&destination=${encodeURIComponent(
                        user.store!.name || 'Store',
                      )}`,
                    )
                  }
                >
                  View on map ({user.store.latitude.toFixed(4)}, {user.store.longitude.toFixed(4)})
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Courier — only for couriers */}
        {user.courier && (
          <Section title="Courier">
            <InfoRow label="Vehicle" value={user.courier.vehicle_type || '—'} />
            <InfoRow
              label="Status"
              value={user.courier.is_online ? 'Online' : 'Offline'}
            />
            {user.courier.lat != null && user.courier.lng != null && (
              <div className="udd-mapRow">
                <MdLocationOn size={16} color="#0504AA" />
                <button
                  type="button"
                  className="udd-mapLink"
                  onClick={() =>
                    router.push(
                      `/shopper/map?lat=${user.courier!.lat}&lng=${user.courier!.lng}&destination=${encodeURIComponent(
                        name,
                      )}`,
                    )
                  }
                >
                  View on map ({user.courier.lat.toFixed(4)}, {user.courier.lng.toFixed(4)})
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Activity */}
        <Section title="Activity">
          <InfoRow label="Joined" value={formatDate(user.created_at)} />
          <InfoRow
            label="Last IP"
            value={user.last_ip || '—'}
            mono
            onCopy={user.last_ip ? () => handleCopy(user.last_ip!, 'IP') : undefined}
          />
          <InfoRow label="Last device" value={user.last_device || '—'} />
        </Section>

        {/* Danger zone */}
        <section className="udd-danger">
          <div className="udd-dangerHead">
            <MdDeleteOutline size={18} color="#B91C1C" />
            <span>Danger zone</span>
          </div>
          <p className="udd-dangerText">
            Deleting removes this user and all associated records permanently.
            This cannot be undone.
          </p>
          <button
            type="button"
            className="udd-dangerBtn"
            onClick={() => setConfirm('delete')}
          >
            <MdDeleteOutline size={16} />
            Delete user
          </button>
        </section>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div
          className="udd-modalOverlay"
          onClick={() => (isActing ? undefined : setConfirm(null))}
        >
          <div className="udd-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="udd-modalTitle">
              {confirm === 'delete'
                ? 'Delete user?'
                : confirm === 'suspend'
                ? 'Suspend user?'
                : 'Unsuspend user?'}
            </h3>
            <p className="udd-modalBody">
              {confirm === 'delete' && (
                <>
                  <strong>{name}</strong> will be permanently deleted. This
                  cannot be undone.
                </>
              )}
              {confirm === 'suspend' && (
                <>
                  <strong>{name}</strong> will be blocked from logging in until
                  unsuspended.
                </>
              )}
              {confirm === 'unsuspend' && (
                <>
                  <strong>{name}</strong> will be able to log in again
                  immediately.
                </>
              )}
            </p>
            <div className="udd-modalActions">
              <button
                type="button"
                className="udd-modalCancel"
                onClick={() => setConfirm(null)}
                disabled={isActing}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  confirm === 'delete'
                    ? 'udd-modalConfirm udd-modalConfirmDanger'
                    : 'udd-modalConfirm'
                }
                onClick={runConfirm}
                disabled={isActing}
              >
                {isActing
                  ? 'Working…'
                  : confirm === 'delete'
                  ? 'Delete'
                  : confirm === 'suspend'
                  ? 'Suspend'
                  : 'Unsuspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy toast */}
      {toast && (
        <div className="udd-toast">
          <MdCheckCircle size={16} color="#fff" />
          <span>{toast}</span>
        </div>
      )}
    </main>
  );
}

// ─── Reusable pieces ────────────────────────────────────────────────
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="udd-card">
      <h2 className="udd-sectionTitle">{title}</h2>
      <div className="udd-sectionBody">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  onCopy,
  mono = false,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  mono?: boolean;
}) {
  const isMissing = value === '—';
  return (
    <div className="udd-infoRow">
      <span className="udd-infoLabel">{label}</span>
      <span className={mono ? 'udd-infoValue udd-infoValueMono' : 'udd-infoValue'}>
        {value}
      </span>
      {onCopy && !isMissing && (
        <button
          type="button"
          className="udd-copyBtn"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
        >
          <MdContentCopy size={14} color="#64748B" />
        </button>
      )}
    </div>
  );
}

function VerifyBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={ok ? 'udd-verifyBadge udd-verifyBadgeOk' : 'udd-verifyBadge udd-verifyBadgeNo'}
    >
      {ok ? (
        <MdCheckCircle size={20} color="#16A34A" />
      ) : (
        <MdClose size={20} color="#94A3B8" />
      )}
      <div className="udd-verifyText">
        <span className="udd-verifyLabel">{label}</span>
        <span className="udd-verifyState">{ok ? 'Verified' : 'Not verified'}</span>
      </div>
    </div>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes udd-fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes udd-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes udd-toastIn {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  .udd-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #F4F5FB;
  }

  /* Header */
  .udd-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fff;
    border-bottom: 1px solid #EAECF3;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .udd-backBtn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .udd-backBtn:hover { background: #F1F3FA; }
  .udd-headerTitle {
    flex: 1;
    font-size: 16px;
    font-weight: 700;
    color: #0B0B1A;
    letter-spacing: -0.01em;
    text-align: center;
  }

  /* Kebab */
  .udd-kebabWrap { position: relative; }
  .udd-kebab {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .udd-kebab:hover { background: #F1F3FA; }
  .udd-menuBackdrop { position: fixed; inset: 0; z-index: 20; }
  .udd-menu {
    position: absolute;
    top: 44px;
    right: 0;
    min-width: 200px;
    background: #fff;
    border: 1px solid #E8EAF0;
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(15, 17, 32, 0.14);
    padding: 6px;
    z-index: 21;
    animation: udd-fadeIn 0.12s ease;
  }
  .udd-menuItem {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 600;
    color: #1F2937;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
  }
  .udd-menuItem:hover { background: #F5F6FB; }
  .udd-menuItemDanger { color: #DC2626; }
  .udd-menuItemDanger:hover { background: #FEF2F2; }

  /* Scroll area */
  .udd-scroll {
    flex: 1;
    padding: 16px 16px 40px;
    overflow-y: auto;
  }

  /* Hero */
  .udd-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 20px 22px;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 20px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(11, 11, 26, 0.03);
  }
  .udd-heroSkeleton { align-items: flex-start; }
  .udd-avatarOuter {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    padding: 6px;
  }
  .udd-avatar {
    width: 84px;
    height: 84px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .udd-avatarImg { width: 100%; height: 100%; object-fit: cover; }
  .udd-avatarInitials {
    color: #fff;
    font-weight: 800;
    font-size: 32px;
    letter-spacing: 0.02em;
  }
  .udd-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 24px;
    font-weight: 800;
    color: #0B0B1A;
    letter-spacing: -0.02em;
    margin: 0 0 10px;
    text-align: center;
    line-height: 1.2;
  }
  .udd-verified { flex: 0 0 auto; }
  .udd-heroMeta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .udd-rolePill {
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .udd-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 700;
    color: #475569;
  }
  .udd-statusDot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .udd-heroContact {
    font-size: 14px;
    color: #334155;
    margin: 2px 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
  }
  .udd-heroContactMuted { color: #64748B; }
  .udd-heroActions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .udd-heroBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 12px;
    border: none;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .udd-heroBtn:hover { opacity: 0.92; }
  .udd-heroBtnWarn {
    background: #FFF7ED;
    color: #C2410C;
    border: 1px solid #FDBA74;
  }
  .udd-heroBtnSuccess {
    background: #ECFDF5;
    color: #166534;
    border: 1px solid #A7F3D0;
  }

  /* Cards */
  .udd-card {
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 16px;
    padding: 18px;
    margin-bottom: 14px;
    box-shadow: 0 1px 3px rgba(11, 11, 26, 0.03);
  }
  .udd-sectionTitle {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #8A8F99;
    text-transform: uppercase;
    margin: 0 0 14px;
  }
  .udd-sectionBody { display: flex; flex-direction: column; gap: 2px; }

  /* Info rows */
  .udd-infoRow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid #F3F4F9;
  }
  .udd-infoRow:last-child { border-bottom: none; }
  .udd-infoLabel {
    flex: 0 0 110px;
    font-size: 12.5px;
    font-weight: 600;
    color: #8A8F99;
    letter-spacing: 0.01em;
  }
  .udd-infoValue {
    flex: 1;
    font-size: 14px;
    color: #1A1A1A;
    font-weight: 500;
    min-width: 0;
    word-break: break-word;
  }
  .udd-infoValueMono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    letter-spacing: 0.01em;
  }
  .udd-copyBtn {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: none;
    background: #F1F3FA;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .udd-copyBtn:hover { background: #E0E3F0; }

  /* Verification grid */
  .udd-verifyGrid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @media (min-width: 480px) {
    .udd-verifyGrid { grid-template-columns: 1fr 1fr; }
  }
  .udd-verifyBadge {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid;
  }
  .udd-verifyBadgeOk {
    background: #F0FDF4;
    border-color: #BBF7D0;
  }
  .udd-verifyBadgeNo {
    background: #F8FAFC;
    border-color: #E2E8F0;
  }
  .udd-verifyText { display: flex; flex-direction: column; }
  .udd-verifyLabel {
    font-size: 14px;
    font-weight: 700;
    color: #1A1A1A;
    line-height: 1.2;
  }
  .udd-verifyState {
    font-size: 12px;
    color: #64748B;
    margin-top: 2px;
    font-weight: 600;
  }

  /* Store image */
  .udd-storeImageWrap {
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 14px;
    background: #F0F0F0;
  }
  .udd-storeImage {
    width: 100%;
    height: 180px;
    object-fit: cover;
    display: block;
  }

  /* Map row */
  .udd-mapRow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 0 2px;
  }
  .udd-mapLink {
    background: none;
    border: none;
    color: #0504AA;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-decoration-color: rgba(5, 4, 170, 0.3);
    text-underline-offset: 2px;
  }
  .udd-mapLink:hover { text-decoration-color: #0504AA; }

  /* Danger zone */
  .udd-danger {
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 16px;
    padding: 18px;
    margin-top: 4px;
  }
  .udd-dangerHead {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #B91C1C;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .udd-dangerText {
    font-size: 13.5px;
    color: #7F1D1D;
    line-height: 1.5;
    margin: 0 0 14px;
  }
  .udd-dangerBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid #DC2626;
    background: #DC2626;
    color: #fff;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .udd-dangerBtn:hover { opacity: 0.92; }

  /* Center / loading */
  .udd-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
  }
  .udd-centerText {
    font-size: 14px;
    color: #64748B;
    margin: 6px 0 12px;
    max-width: 320px;
    text-align: center;
  }
  .udd-primaryBtn {
    padding: 10px 22px;
    background: #0504AA;
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
  }

  /* Skeleton */
  .udd-skel {
    background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
    background-size: 800px 100%;
    animation: udd-shimmer 1.4s infinite linear;
    border-radius: 8px;
    margin-bottom: 8px;
  }
  .udd-skelAvatar { width: 96px; height: 96px; border-radius: 50%; margin-bottom: 16px; }
  .udd-skelLine { height: 14px; width: 100%; }
  .udd-skelLineShort { height: 12px; width: 60%; }

  /* Modal */
  .udd-modalOverlay {
    position: fixed;
    inset: 0;
    background: rgba(11, 11, 26, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: udd-fadeIn 0.15s ease;
  }
  .udd-modal {
    background: #fff;
    border-radius: 18px;
    padding: 22px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 24px 70px rgba(11, 11, 26, 0.35);
  }
  .udd-modalTitle {
    font-size: 18px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }
  .udd-modalBody {
    font-size: 14px;
    color: #475569;
    line-height: 1.55;
    margin: 0 0 22px;
  }
  .udd-modalActions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .udd-modalCancel {
    padding: 10px 18px;
    border-radius: 10px;
    border: 1px solid #E2E8F0;
    background: #fff;
    color: #334155;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .udd-modalCancel:hover:not(:disabled) { background: #F8FAFC; }
  .udd-modalConfirm {
    padding: 10px 18px;
    border-radius: 10px;
    border: none;
    background: #0504AA;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .udd-modalConfirm:hover:not(:disabled) { opacity: 0.9; }
  .udd-modalConfirm:disabled, .udd-modalCancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .udd-modalConfirmDanger { background: #DC2626; }

  /* Toast */
  .udd-toast {
    position: fixed;
    left: 50%;
    bottom: 32px;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 999px;
    background: #0B0B1A;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
    z-index: 2000;
    animation: udd-toastIn 0.2s ease;
  }
`;