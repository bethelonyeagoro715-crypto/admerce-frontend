'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../services/api';
import { clear as clearLocalStorage } from '../../services/localStorage';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { alertDialog, confirmDialog } from '../ui/dialogs';
import {
  MdSettings,
  MdEdit,
  MdCameraAlt,
  MdPhotoLibrary,
  MdClose,
  MdVerified,
  MdEmail,
  MdPhone,
  MdChevronRight,
  MdFavoriteBorder,
  MdSearch,
  MdShoppingBag,
  MdAccountBalanceWallet,
  MdLocationOn,
  MdAdd,
  MdErrorOutline,
  MdRefresh,
  MdArrowForward,
  MdReceiptLong,
  MdSwapHoriz,
  MdLogout,
  MdStorefront,
  MdInventory2,
  MdVisibility,
  MdEventAvailable,
  MdStar,
  MdBuild,
  MdTrendingUp,
} from 'react-icons/md';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type ProfileRole = 'shopper' | 'storekeeper' | 'service_provider';

interface Profile {
  id?: string;
  nickname?: string;
  username?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  role?: string;
  verified?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

interface BaseStats {
  walletBalance: number;
}

interface ShopperStats extends BaseStats {
  savedCount: number;
  wantedCount: number;
  ordersCount: number;
}

interface StorekeeperStats extends BaseStats {
  storeId: string | null;
  listingsCount: number;
  ordersCount: number;
  viewsCount: number;
}

interface ProviderStats extends BaseStats {
  servicesCount: number;
  bookingsCount: number;
  rating: number;
}

type Stats = ShopperStats | StorekeeperStats | ProviderStats;

interface StatTile {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}

interface ActivityRow {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  subtitle?: string;
  onClick?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const ROLE_SLUG: Record<ProfileRole, string> = {
  shopper: 'shopper',
  storekeeper: 'storekeeper',
  service_provider: 'service-provider',
};

const ROLE_LABEL: Record<ProfileRole, string> = {
  shopper: 'Shopper',
  storekeeper: 'Storekeeper',
  service_provider: 'Service Provider',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
    return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function parseAsUtc(iso?: string | null): number {
  if (!iso) return NaN;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const trimmed = iso.replace(/(\.\d{3})\d+/, '$1');
  return new Date(hasTz ? trimmed : `${trimmed}Z`).getTime();
}

function fmtMemberSince(iso?: string): string {
  if (!iso) return '';
  const t = parseAsUtc(iso);
  if (Number.isNaN(t)) return '';
  try {
    return new Date(t).toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function fmtBalance(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '₦0';
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(1)}k`;
  return `₦${Math.round(v).toLocaleString('en-NG')}`;
}

function displayName(p: Profile | null): string {
  if (!p) return 'User';
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return p.nickname || full || p.real_name || p.username || p.phone || 'User';
}

function isNumberArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

// ─────────────────────────────────────────────────────────────
// Role-specific stat loaders
// ─────────────────────────────────────────────────────────────
async function loadShopperStats(): Promise<ShopperStats> {
  const [saved, wanted, orders, balance] = await Promise.allSettled([
    api.getSavedItems(),
    api.getWantedAlerts(),
    api.getWalletOrders(),
    api.getWalletBalance(),
  ]);
  return {
    savedCount:
      saved.status === 'fulfilled' && isNumberArray(saved.value)
        ? saved.value.length
        : 0,
    wantedCount:
      wanted.status === 'fulfilled' && isNumberArray(wanted.value)
        ? wanted.value.length
        : 0,
    ordersCount:
      orders.status === 'fulfilled' && isNumberArray(orders.value)
        ? orders.value.length
        : 0,
    walletBalance:
      balance.status === 'fulfilled'
        ? Number((balance.value as { balance?: number })?.balance ?? 0)
        : 0,
  };
}

async function loadStorekeeperStats(): Promise<StorekeeperStats> {
  let storeId: string | null = null;
  try {
    const store = (await api.getMyStore()) as { store_id?: string } | null;
    storeId = store?.store_id ?? null;
  } catch {
    storeId = null;
  }

  const [items, orders, stats, balance] = await Promise.allSettled([
    storeId ? api.getStoreItems(storeId) : Promise.resolve([]),
    storeId ? api.getStoreOrders(storeId) : Promise.resolve([]),
    storeId ? api.getStoreStats() : Promise.resolve({}),
    api.getWalletBalance(),
  ]);

  return {
    storeId,
    listingsCount:
      items.status === 'fulfilled' && isNumberArray(items.value)
        ? items.value.length
        : 0,
    ordersCount:
      orders.status === 'fulfilled' && isNumberArray(orders.value)
        ? orders.value.length
        : 0,
    viewsCount:
      stats.status === 'fulfilled'
        ? Number((stats.value as { views?: number })?.views ?? 0)
        : 0,
    walletBalance:
      balance.status === 'fulfilled'
        ? Number((balance.value as { balance?: number })?.balance ?? 0)
        : 0,
  };
}

async function loadProviderStats(): Promise<ProviderStats> {
  const [services, bookings, stats, balance] = await Promise.allSettled([
    api.getProviderServices(),
    api.getProviderBookings(),
    api.getProviderStats(),
    api.getWalletBalance(),
  ]);

  return {
    servicesCount:
      services.status === 'fulfilled' && isNumberArray(services.value)
        ? services.value.length
        : 0,
    bookingsCount:
      bookings.status === 'fulfilled' && isNumberArray(bookings.value)
        ? bookings.value.length
        : 0,
    rating:
      stats.status === 'fulfilled'
        ? Number((stats.value as { rating?: number })?.rating ?? 0)
        : 0,
    walletBalance:
      balance.status === 'fulfilled'
        ? Number((balance.value as { balance?: number })?.balance ?? 0)
        : 0,
  };
}

const LOADERS: Record<ProfileRole, () => Promise<Stats>> = {
  shopper: loadShopperStats,
  storekeeper: loadStorekeeperStats,
  service_provider: loadProviderStats,
};

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export function ProfileShell({ role }: { role: ProfileRole }) {
  useAuthGuard();
  const router = useRouter();
  const roleSlug = ROLE_SLUG[role];

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(
    async (showSpinner = true) => {
      const seq = ++reqSeq.current;
      if (showSpinner) setLoading(true);
      setErrored(false);
      try {
        const profileData = (await api.getMyProfile()) as Profile;
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setProfile(profileData);

        const roleStats = await LOADERS[role]();
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setStats(roleStats);
      } catch {
        if (seq === reqSeq.current && isMountedRef.current) setErrored(true);
      } finally {
        if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
      }
    },
    [role],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(t);
  }, [loadData]);

  const handleRefresh = async () => {
    await loadData(false);
  };

    const handleLogout = async () => {
    const ok = await confirmDialog({
      title: 'Log out?',
      body: 'You will need to sign in again to access your account.',
      kind: 'danger',
    });
    if (!ok) return;
    // Tell the server to drop this session row. Fire-and-forget —
    // the api.logout() method swallows network errors.
    await api.logout();
    clearLocalStorage();
    router.replace('/');
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
      await loadData(false);
      closeAvatarModal();
    } catch (err) {
      await alertDialog({
        title: 'Upload failed',
        body: extractErrorDetail(
          err,
          "We couldn't upload your photo. Please try again.",
        ),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setUploadingAvatar(false);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────
  if (loading) {
    return (
      <main style={css.root}>
        <style>{KF}</style>
        <div style={css.hero}>
          <div style={css.topBar}>
            <span style={css.topTitle}>Profile</span>
            <div style={{ width: 38 }} />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 8,
            }}
          >
            <div style={css.avatarSkeleton} />
            <div style={css.skelLine} />
            <div style={{ ...css.skelLine, width: 140, marginTop: 10 }} />
          </div>
        </div>
        <div style={css.sheet}>
          <div style={css.statsSkeleton} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={css.sectionSkeleton} />
          ))}
        </div>
      </main>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (errored || !profile) {
    return (
      <main style={css.errorRoot}>
        <style>{KF}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="#B91C1C" />
        </div>
        <h2 style={css.errorHeading}>Couldn&apos;t load your profile</h2>
        <p style={css.errorBody}>
          Check your connection and try again. If this keeps happening, sign
          out and back in.
        </p>
        <button onClick={handleRefresh} style={css.errorRetry}>
          <MdRefresh size={18} color="#fff" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  const name = displayName(profile);
  const phone = profile.phone || '';
  const email = profile.email || '';
  const avatarUrl = resolveImageUrl(profile.avatar_url);
  const isVerified = profile.verified === true;
  const memberSince = fmtMemberSince(profile.created_at);
  const initial = (name.charAt(0) || '?').toUpperCase();

  const tiles = buildStatTiles(role, stats);
  const activity = buildActivityRows(role, stats);
  const walletTitle =
    role === 'storekeeper'
      ? 'Store revenue'
      : role === 'service_provider'
        ? 'Earnings'
        : 'Available balance';

  return (
    <main style={css.root}>
      <style>{KF}</style>

      {/* HERO */}
      <div style={css.hero}>
        <div style={css.heroGlow} aria-hidden />

        <div style={css.topBar}>
          <span style={css.topTitle}>Profile</span>
          <button
            onClick={() => router.push(`/settings/${roleSlug}`)}
            style={css.ghostBtn}
            aria-label="Settings"
          >
            <MdSettings size={22} color="#fff" />
          </button>
        </div>

        <div style={css.heroBody}>
          <div style={css.avatarContainer}>
            <button
              type="button"
              onClick={openAvatarModal}
              style={css.avatarWrap}
              aria-label="Change profile photo"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" style={css.avatarImg} />
              ) : (
                <div style={css.avatarFallback}>{initial}</div>
              )}
            </button>
            <span style={css.cameraBadge} aria-hidden>
              <MdCameraAlt size={14} color="#0504AA" />
            </span>
          </div>

          <div style={css.nameRow}>
            <h1 style={css.name}>{name}</h1>
            {isVerified && (
              <span title="Verified" style={css.verifiedWrap}>
                <MdVerified size={18} color="#7DD3FC" />
              </span>
            )}
          </div>

          {(phone || email) && (
            <div style={css.contactRow}>
              {phone && (
                <span style={css.contactItem}>
                  <MdPhone size={12} color="rgba(255,255,255,0.7)" />
                  <span>{phone}</span>
                </span>
              )}
              {email && (
                <span style={css.contactItem}>
                  <MdEmail size={12} color="rgba(255,255,255,0.7)" />
                  <span>{email}</span>
                </span>
              )}
            </div>
          )}

          <div style={css.metaRow}>
            <span style={css.roleChip}>{ROLE_LABEL[role].toUpperCase()}</span>
            {memberSince && (
              <>
                <span style={css.metaDot}>·</span>
                <span style={css.metaText}>Since {memberSince}</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push(`/${roleSlug}/profile/edit`)}
            style={css.editBtn}
            className="ps-edit"
          >
            <MdEdit size={16} color="#0504AA" />
            <span>Edit profile</span>
          </button>
        </div>
      </div>

      {/* SHEET */}
      <div style={css.sheet}>
        {/* STATS — role-specific */}
        <div style={css.statsCard}>
          {tiles.map((tile, i) => (
            <div key={i} style={{ display: 'contents' }}>
              {i > 0 && <div style={css.statDivider} />}
              <button
                onClick={tile.onClick}
                style={css.statTile}
                className="ps-stat-tile"
              >
                <div style={css.statIconWrap}>{tile.icon}</div>
                <div style={css.statValue}>{tile.value}</div>
                <div style={css.statLabel}>{tile.label}</div>
              </button>
            </div>
          ))}
        </div>

        {/* ACTIVITY — role-specific */}
        <h3 style={css.sectionLabel}>{activity.title}</h3>
        <div style={css.section}>
          {activity.rows.map((row, i) => (
            <Row key={i} {...row} />
          ))}
        </div>

        {/* WALLET */}
        <h3 style={css.sectionLabel}>{walletTitle}</h3>
        <div style={css.walletCard}>
          <div style={css.walletTop}>
            <div style={css.walletLabelRow}>
              <MdAccountBalanceWallet
                size={16}
                color="rgba(255,255,255,0.75)"
              />
              <span style={css.walletLabel}>Available balance</span>
            </div>
            <div style={css.walletBalance}>
              {fmtBalance(stats?.walletBalance ?? 0)}
            </div>
          </div>
          <div style={css.walletActions}>
            <button
              type="button"
              onClick={() => router.push(`/${roleSlug}/wallet`)}
              style={css.walletPrimary}
              className="ps-wallet-btn"
            >
              {role === 'shopper' ? (
                <>
                  <MdAdd size={16} color="#0504AA" />
                  <span>Top up</span>
                </>
              ) : (
                <span>Withdraw</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/${roleSlug}/wallet`)}
              style={css.walletSecondary}
              className="ps-wallet-btn2"
            >
              <span>View wallet</span>
              <MdArrowForward size={16} color="#fff" />
            </button>
          </div>
        </div>

        {/* ACCOUNT */}
        <h3 style={css.sectionLabel}>Account</h3>
        <div style={css.section}>
          <Row
            icon={<MdSwapHoriz size={18} color="#16A34A" />}
            iconBg="#DCFCE7"
            label="Switch role"
            subtitle={ROLE_LABEL[role]}
            onClick={() => router.push('/onboarding?mode=switch')}
          />
        </div>

        {/* LOG OUT */}
        <button
          onClick={handleLogout}
          style={css.logoutBtn}
          className="ps-logout"
        >
          <MdLogout size={20} color="#DC2626" />
          <span>Log Out</span>
        </button>

        <div style={{ height: 24 }} />
      </div>

      {/* AVATAR MODAL */}
      {showAvatarModal && (
        <div style={css.modalOverlay} onClick={closeAvatarModal}>
          <div style={css.modalCard} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeAvatarModal}
              style={css.modalClose}
              aria-label="Close"
            >
              <MdClose size={20} color="#64748B" />
            </button>
            <h3 style={css.modalTitle}>Update photo</h3>
            <p style={css.modalSub}>Choose a clear photo of yourself</p>

            <div
              style={css.modalAvatarPreview}
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={css.avatarFallbackLarge}>{initial}</div>
              )}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />

            <div style={css.modalActions}>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                style={css.modalSecondary}
              >
                <MdPhotoLibrary size={18} color="#0504AA" />
                <span>Choose from gallery</span>
              </button>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                style={css.modalSecondary}
              >
                <MdCameraAlt size={18} color="#0504AA" />
                <span>Take a photo</span>
              </button>
            </div>

            <button
              onClick={uploadAvatar}
              disabled={!avatarFile || uploadingAvatar}
              style={{
                ...css.modalPrimary,
                opacity: !avatarFile || uploadingAvatar ? 0.5 : 1,
                cursor:
                  !avatarFile || uploadingAvatar ? 'not-allowed' : 'pointer',
              }}
            >
              {uploadingAvatar ? 'Uploading…' : 'Save photo'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Role-specific tile + activity builders
// ─────────────────────────────────────────────────────────────
function buildStatTiles(role: ProfileRole, stats: Stats | null): StatTile[] {
  if (role === 'shopper') {
    const s = (stats as ShopperStats | null) ?? {
      savedCount: 0,
      wantedCount: 0,
      ordersCount: 0,
      walletBalance: 0,
    };
    return [
      {
        icon: <MdFavoriteBorder size={20} color="#0504AA" />,
        label: 'Saved',
        value: String(s.savedCount),
        onClick: () => {}, // replaced below by router
      },
      {
        icon: <MdSearch size={20} color="#0891B2" />,
        label: 'Wanted',
        value: String(s.wantedCount),
        onClick: () => {},
      },
      {
        icon: <MdShoppingBag size={20} color="#7E22CE" />,
        label: 'Orders',
        value: String(s.ordersCount),
        onClick: () => {},
      },
      {
        icon: <MdAccountBalanceWallet size={20} color="#16A34A" />,
        label: 'Wallet',
        value: fmtBalance(s.walletBalance),
        onClick: () => {},
      },
    ];
  }

  if (role === 'storekeeper') {
    const s = (stats as StorekeeperStats | null) ?? {
      storeId: null,
      listingsCount: 0,
      ordersCount: 0,
      viewsCount: 0,
      walletBalance: 0,
    };
    return [
      {
        icon: <MdInventory2 size={20} color="#0504AA" />,
        label: 'Listings',
        value: String(s.listingsCount),
        onClick: () => {},
      },
      {
        icon: <MdReceiptLong size={20} color="#0891B2" />,
        label: 'Orders',
        value: String(s.ordersCount),
        onClick: () => {},
      },
      {
        icon: <MdVisibility size={20} color="#7E22CE" />,
        label: 'Views',
        value: s.viewsCount >= 1000 ? `${(s.viewsCount / 1000).toFixed(1)}k` : String(s.viewsCount),
        onClick: () => {},
      },
      {
        icon: <MdAccountBalanceWallet size={20} color="#16A34A" />,
        label: 'Revenue',
        value: fmtBalance(s.walletBalance),
        onClick: () => {},
      },
    ];
  }

  // service_provider
  const s = (stats as ProviderStats | null) ?? {
    servicesCount: 0,
    bookingsCount: 0,
    rating: 0,
    walletBalance: 0,
  };
  return [
    {
      icon: <MdBuild size={20} color="#0504AA" />,
      label: 'Services',
      value: String(s.servicesCount),
      onClick: () => {},
    },
    {
      icon: <MdEventAvailable size={20} color="#0891B2" />,
      label: 'Bookings',
      value: String(s.bookingsCount),
      onClick: () => {},
    },
    {
      icon: <MdStar size={20} color="#D97706" />,
      label: 'Rating',
      value: s.rating > 0 ? s.rating.toFixed(1) : '—',
      onClick: () => {},
    },
    {
      icon: <MdTrendingUp size={20} color="#16A34A" />,
      label: 'Earnings',
      value: fmtBalance(s.walletBalance),
      onClick: () => {},
    },
  ];
}

function buildActivityRows(
  role: ProfileRole,
  stats: Stats | null,
): { title: string; rows: ActivityRow[] } {
  if (role === 'shopper') {
    const s = (stats as ShopperStats | null) ?? {
      savedCount: 0,
      wantedCount: 0,
      ordersCount: 0,
      walletBalance: 0,
    };
    return {
      title: 'Your activity',
      rows: [
        {
          icon: <MdFavoriteBorder size={18} color="#0504AA" />,
          iconBg: '#EEF0FF',
          label: 'Saved items',
          value: String(s.savedCount),
        },
        {
          icon: <MdSearch size={18} color="#0891B2" />,
          iconBg: '#E0F2FE',
          label: 'Wanted alerts',
          value: String(s.wantedCount),
        },
        {
          icon: <MdReceiptLong size={18} color="#7E22CE" />,
          iconBg: '#F3E8FF',
          label: 'Orders',
          value: String(s.ordersCount),
        },
        {
          icon: <MdLocationOn size={18} color="#D97706" />,
          iconBg: '#FEF3C7',
          label: 'Delivery addresses',
        },
      ],
    };
  }

  if (role === 'storekeeper') {
    const s = (stats as StorekeeperStats | null) ?? {
      storeId: null,
      listingsCount: 0,
      ordersCount: 0,
      viewsCount: 0,
      walletBalance: 0,
    };
    return {
      title: 'Your store',
      rows: [
        {
          icon: <MdStorefront size={18} color="#0504AA" />,
          iconBg: '#EEF0FF',
          label: 'Store profile',
        },
        {
          icon: <MdInventory2 size={18} color="#0891B2" />,
          iconBg: '#E0F2FE',
          label: 'Listings',
          value: String(s.listingsCount),
        },
        {
          icon: <MdReceiptLong size={18} color="#7E22CE" />,
          iconBg: '#F3E8FF',
          label: 'Orders received',
          value: String(s.ordersCount),
        },
        {
          icon: <MdVerified size={18} color="#16A34A" />,
          iconBg: '#DCFCE7',
          label: 'Verification',
        },
      ],
    };
  }

  const s = (stats as ProviderStats | null) ?? {
    servicesCount: 0,
    bookingsCount: 0,
    rating: 0,
    walletBalance: 0,
  };
  return {
    title: 'Your work',
    rows: [
      {
        icon: <MdBuild size={18} color="#0504AA" />,
        iconBg: '#EEF0FF',
        label: 'My services',
        value: String(s.servicesCount),
      },
      {
        icon: <MdEventAvailable size={18} color="#0891B2" />,
        iconBg: '#E0F2FE',
        label: 'Bookings',
        value: String(s.bookingsCount),
      },
      {
        icon: <MdStar size={18} color="#D97706" />,
        iconBg: '#FEF3C7',
        label: 'Reviews',
        value: s.rating > 0 ? s.rating.toFixed(1) : '—',
      },
      {
        icon: <MdTrendingUp size={18} color="#16A34A" />,
        iconBg: '#DCFCE7',
        label: 'Availability',
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function Row({
  icon,
  iconBg,
  label,
  subtitle,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  subtitle?: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} style={css.row} className="ps-row">
      <span style={{ ...css.rowIconWrap, backgroundColor: iconBg }}>
        {icon}
      </span>
      <span style={css.rowBody}>
        <span style={css.rowLabel}>{label}</span>
        {subtitle && <span style={css.rowSubtitle}>{subtitle}</span>}
      </span>
      {value && <span style={css.rowValue}>{value}</span>}
      <MdChevronRight size={18} color="#CBD5E1" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Keyframes
// ─────────────────────────────────────────────────────────────
const KF = `
  @keyframes psShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .ps-stat-tile:hover { background-color: #FAFBFF; }
  .ps-stat-tile:active { transform: scale(0.97); }
  .ps-row:hover { background-color: #FAFBFF; }
  .ps-edit:hover { background-color: #F8FAFF; }
  .ps-edit:active { transform: scale(0.98); }
  .ps-wallet-btn:active { transform: scale(0.98); }
  .ps-wallet-btn2:active { transform: scale(0.98); }
  .ps-logout:hover { background-color: #FEF2F2; }
  .ps-logout:active { transform: scale(0.99); }
`;

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    overflowX: 'hidden',
  },
  hero: {
    position: 'relative',
    backgroundColor: '#0504AA',
    backgroundImage:
      'radial-gradient(ellipse at 80% 0%, #1A0FB8 0%, #0504AA 55%, #03037A 100%)',
    padding: '0 20px 56px',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(61,59,255,0.4) 0%, rgba(61,59,255,0) 70%)',
    pointerEvents: 'none',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 4,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    letterSpacing: 0.3,
  },
  ghostBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minWidth: 38,
    minHeight: 38,
  },
  heroBody: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 8,
  },
  avatarContainer: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: -1,
  },
  avatarFallbackLarge: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0504AA',
    fontSize: 44,
    fontWeight: 800,
    backgroundColor: '#EEF0FF',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: '50%',
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
    border: '2px solid #0504AA',
    pointerEvents: 'none',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  verifiedWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  contactItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: 500,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  roleChip: {
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    color: '#0504AA',
    backgroundColor: '#fff',
    padding: '4px 10px',
    borderRadius: 999,
  },
  metaDot: {
    color: 'rgba(255,255,255,0.4)',
  },
  metaText: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 500,
  },
  editBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    padding: '10px 20px',
    borderRadius: 14,
    border: 'none',
    backgroundColor: '#fff',
    color: '#0504AA',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    transition: 'background-color 0.15s, transform 0.12s',
    boxShadow: '0 6px 16px rgba(0,0,0,0.14)',
  },
  sheet: {
    flex: 1,
    marginTop: -40,
    padding: '0 20px 40px',
    position: 'relative',
  },
  statsCard: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    border: '1px solid #EAECF3',
    boxShadow: '0 12px 30px rgba(5,4,170,0.10)',
    padding: '14px 6px',
  },
  statTile: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '6px 4px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    borderRadius: 12,
    transition: 'background-color 0.15s, transform 0.12s',
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.3,
    fontVariantNumeric: 'tabular-nums',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#64748B',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F1F5F9',
    margin: '10px 0',
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '22px 0 8px 4px',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14.5,
    fontWeight: 600,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: 500,
    color: '#94A3B8',
  },
  walletCard: {
    backgroundColor: '#0504AA',
    backgroundImage:
      'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    borderRadius: 20,
    padding: '18px 18px 16px',
    color: '#fff',
    boxShadow: '0 14px 32px rgba(5,4,170,0.28)',
  },
  walletTop: { display: 'flex', flexDirection: 'column', gap: 6 },
  walletLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  walletLabel: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.78)',
    textTransform: 'uppercase',
  },
  walletBalance: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: -0.5,
    fontVariantNumeric: 'tabular-nums',
  },
  walletActions: {
    display: 'flex',
    gap: 10,
    marginTop: 16,
  },
  walletPrimary: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '12px 14px',
    borderRadius: 14,
    border: 'none',
    backgroundColor: '#fff',
    color: '#0504AA',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.12s',
  },
  walletSecondary: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '12px 14px',
    borderRadius: 14,
    border: '1.5px solid rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.12s',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginTop: 22,
    padding: '14px 20px',
    borderRadius: 16,
    border: '1.5px solid #FECACA',
    backgroundColor: '#FFFFFF',
    color: '#DC2626',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    transition: 'background-color 0.15s, transform 0.12s',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.48)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: '24px 24px 0 0',
    padding: '24px 24px calc(28px + env(safe-area-inset-bottom))',
    boxShadow: '0 -8px 40px rgba(5,4,170,0.2)',
    position: 'relative',
    animation: 'sheetUp 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: '0 0 4px',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    margin: '0 0 20px',
  },
  modalAvatarPreview: {
    width: 140,
    height: 140,
    borderRadius: '50%',
    backgroundColor: '#F4F5FB',
    margin: '0 auto 20px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '3px solid #EEF0FF',
  },
  modalActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  modalSecondary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '13px 16px',
    borderRadius: 14,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    color: '#0504AA',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  modalPrimary: {
    width: '100%',
    padding: 16,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 10px 24px rgba(5,4,170,0.24)',
  },
  avatarSkeleton: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 8,
  },
  skelLine: {
    width: 180,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 16,
  },
  statsSkeleton: {
    height: 100,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    animation: 'psShimmer 1.4s ease-in-out infinite',
  },
  sectionSkeleton: {
    height: 120,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 18,
    animation: 'psShimmer 1.4s ease-in-out infinite',
  },
  errorRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    padding: 24,
    textAlign: 'center',
  },
  errorHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  errorHeading: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  errorBody: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    maxWidth: 320,
    lineHeight: 1.5,
  },
  errorRetry: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: '13px 24px',
    borderRadius: 14,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
  },
};