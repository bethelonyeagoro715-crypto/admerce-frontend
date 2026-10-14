'use client';

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
  MdPersonAdd,
  MdChatBubbleOutline,
  MdShare,
  MdMoreHoriz,
  MdGridOn,
  MdInfoOutline,
  MdStore,
  MdAccessTime,
  MdCheckCircle,
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
  bio?: string;
  residence_address?: string;
  lga?: string;
  state_of_origin?: string;
  business_name?: string;
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

interface HighlightChip {
  id: string;
  label: string;
  emoji: string;
}

interface GridItem {
  id: string;
  title: string;
  imageUrl: string | null;
  price?: string;
  kind: 'listing' | 'service';
}

interface ActivityRow {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  subtitle?: string;
  onClick?: () => void;
}

type Tab = 'content' | 'about' | 'wallet';

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

const ROLE_EMOJI: Record<ProfileRole, string> = {
  shopper: '🛒',
  storekeeper: '🏪',
  service_provider: '🛠️',
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
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
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

function fmtCompact(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}K`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
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
  return (
    p.nickname ||
    p.business_name ||
    full ||
    p.real_name ||
    p.username ||
    p.phone ||
    'User'
  );
}

function buildBio(p: Profile | null, role: ProfileRole): string {
  if (!p) return '';
  if (p.bio && String(p.bio).trim()) return String(p.bio).trim();

  const parts: string[] = [];
  if (role === 'storekeeper') {
    parts.push('🏪 Storekeeper on Admerce');
    if (p.business_name) parts.push(`· ${p.business_name}`);
  } else if (role === 'service_provider') {
    parts.push('🛠️ Service provider on Admerce');
  } else {
    parts.push('🛒 Shopping on Admerce');
  }
  if (p.lga && p.state_of_origin) {
    parts.push(`· ${p.lga}, ${p.state_of_origin}`);
  } else if (p.residence_address) {
    parts.push(`· ${p.residence_address}`);
  }
  return parts.join(' ');
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
    const store = (await api.getMyStore()) as {
      store_id?: string;
    } | null;
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
// Role stats → three-stat row (Instagram-style)
// ─────────────────────────────────────────────────────────────
function statTrio(
  role: ProfileRole,
  stats: Stats | null,
): { value: string; label: string; onClick: () => void }[] {
  if (role === 'shopper') {
    const s = (stats as ShopperStats | null) ?? {
      savedCount: 0,
      wantedCount: 0,
      ordersCount: 0,
      walletBalance: 0,
    };
    return [
      { value: String(s.savedCount), label: 'Saved', onClick: () => {} },
      { value: String(s.wantedCount), label: 'Wanted', onClick: () => {} },
      { value: String(s.ordersCount), label: 'Orders', onClick: () => {} },
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
      { value: String(s.listingsCount), label: 'Listings', onClick: () => {} },
      { value: String(s.ordersCount), label: 'Orders', onClick: () => {} },
      { value: fmtCompact(s.viewsCount), label: 'Views', onClick: () => {} },
    ];
  }
  const s = (stats as ProviderStats | null) ?? {
    servicesCount: 0,
    bookingsCount: 0,
    rating: 0,
    walletBalance: 0,
  };
  return [
    { value: String(s.servicesCount), label: 'Services', onClick: () => {} },
    { value: String(s.bookingsCount), label: 'Bookings', onClick: () => {} },
    {
      value: s.rating > 0 ? s.rating.toFixed(1) : '—',
      label: 'Rating',
      onClick: () => {},
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Role-specific highlights (Instagram story-style chips)
// ─────────────────────────────────────────────────────────────
function roleHighlights(role: ProfileRole): HighlightChip[] {
  if (role === 'storekeeper') {
    return [
      { id: 'new', label: 'New', emoji: '🆕' },
      { id: 'deals', label: 'Deals', emoji: '🔥' },
      { id: 'featured', label: 'Featured', emoji: '⭐' },
      { id: 'reviews', label: 'Reviews', emoji: '💬' },
      { id: 'policies', label: 'Policies', emoji: '📋' },
    ];
  }
  if (role === 'service_provider') {
    return [
      { id: 'portfolio', label: 'Portfolio', emoji: '📸' },
      { id: 'availability', label: 'Availability', emoji: '📅' },
      { id: 'reviews', label: 'Reviews', emoji: '⭐' },
      { id: 'process', label: 'Process', emoji: '📋' },
    ];
  }
  return [
    { id: 'wishlist', label: 'Wishlist', emoji: '❤️' },
    { id: 'wanted', label: 'Wanted', emoji: '🔍' },
    { id: 'orders', label: 'Orders', emoji: '📦' },
  ];
}

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
  const [tab, setTab] = useState<Tab>('content');
  const [following, setFollowing] = useState(false);
  const [followersCount] = useState(0);

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
        if (seq === reqSeq.current && isMountedRef.current)
          setErrored(true);
      } finally {
        if (seq === reqSeq.current && isMountedRef.current)
          setLoading(false);
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

  const handleAvatarChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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

  const handleShare = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/${roleSlug}/profile`
        : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Admerce profile', url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        await alertDialog({
          title: 'Link copied',
          body: 'Profile link copied to clipboard.',
        });
      }
    } catch {
      /* user cancelled */
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────
  if (loading) {
    return (
      <main style={css.root}>
        <style>{KF}</style>
        <style>{CSS}</style>
        <div className="ps-shell">
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
              <div
                style={{ ...css.skelLine, width: 140, marginTop: 10 }}
              />
            </div>
          </div>
          <div style={css.sheet}>
            <div style={css.statsSkeleton} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={css.sectionSkeleton} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (errored || !profile) {
    return (
      <main style={css.errorRoot}>
        <style>{KF}</style>
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="var(--danger-fg)" />
        </div>
        <h2 style={css.errorHeading}>Couldn&apos;t load your profile</h2>
        <p style={css.errorBody}>
          Check your connection and try again. If this keeps happening,
          sign out and back in.
        </p>
        <button onClick={handleRefresh} style={css.errorRetry}>
          <MdRefresh size={18} color="var(--brand-on-gradient)" />
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
  const bio = buildBio(profile, role);
  const trio = statTrio(role, stats);
  const highlights = roleHighlights(role);
  const walletTitle =
    role === 'storekeeper'
      ? 'Store revenue'
      : role === 'service_provider'
        ? 'Earnings'
        : 'Escrow balance';

  return (
    <main style={css.root}>
      <style>{KF}</style>
      <style>{CSS}</style>

      <div className="ps-shell">
        {/* ═════════ HERO ═════════ */}
        <div style={css.hero}>
          <div style={css.heroGlow} aria-hidden />

          <div style={css.topBar}>
            <button
              onClick={() => router.back()}
              style={css.ghostIconBtn}
              aria-label="Back"
            >
              <MdChevronRight
                size={22}
                color="var(--brand-on-gradient)"
                style={{ transform: 'rotate(180deg)' }}
              />
            </button>
            <span style={css.topTitle}>{name.split(' ')[0]}</span>
            <div style={css.topActions}>
              <button
                onClick={handleShare}
                style={css.ghostIconBtn}
                aria-label="Share profile"
              >
                <MdShare size={20} color="var(--brand-on-gradient)" />
              </button>
              <button
                onClick={() => router.push(`/settings/${roleSlug}`)}
                style={css.ghostIconBtn}
                aria-label="Settings"
              >
                <MdMoreHoriz size={22} color="var(--brand-on-gradient)" />
              </button>
            </div>
          </div>

          {/* Identity row — avatar left, stats right */}
          <div style={css.identityRow}>
            <div style={css.avatarRingWrap}>
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
                <MdCameraAlt size={12} color="var(--brand-primary)" />
              </span>
            </div>

            <div style={css.statsRow}>
              {trio.map((s, i) => (
                <button
                  key={i}
                  onClick={s.onClick}
                  style={css.statItem}
                  className="ps-stat-item"
                >
                  <span style={css.statValue}>{s.value}</span>
                  <span style={css.statLabel}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name + verify + role */}
          <div style={css.nameBlock}>
            <div style={css.nameRow}>
              <h1 style={css.name}>{name}</h1>
              {isVerified && (
                <MdVerified
                  size={16}
                  color="#A7F3D0"
                  aria-label="Verified"
                />
              )}
            </div>

            <div style={css.roleRow}>
              <span style={css.rolePill}>
                {ROLE_EMOJI[role]} {ROLE_LABEL[role]}
              </span>
              {memberSince && (
                <span style={css.metaDot}>·</span>
              )}
              {memberSince && (
                <span style={css.metaText}>Since {memberSince}</span>
              )}
            </div>

            {bio && <p style={css.bio}>{bio}</p>}

            {(email || phone) && (
              <div style={css.contactRow}>
                {phone && (
                  <span style={css.contactItem}>
                    <MdPhone
                      size={11}
                      color="color-mix(in srgb, var(--brand-on-gradient) 70%, transparent)"
                    />
                    <span>{phone}</span>
                  </span>
                )}
                {email && (
                  <span style={css.contactItem}>
                    <MdEmail
                      size={11}
                      color="color-mix(in srgb, var(--brand-on-gradient) 70%, transparent)"
                    />
                    <span>{email}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action row — Follow / Message / Edit */}
          <div style={css.actionsRow}>
            <button
              type="button"
              onClick={() => setFollowing((v) => !v)}
              style={{
                ...css.followBtn,
                backgroundColor: following
                  ? 'color-mix(in srgb, var(--brand-on-gradient) 12%, transparent)'
                  : 'var(--bg-secondary)',
                color: following
                  ? 'var(--brand-on-gradient)'
                  : 'var(--brand-primary)',
                borderColor: following
                  ? 'color-mix(in srgb, var(--brand-on-gradient) 40%, transparent)'
                  : 'transparent',
              }}
              className="ps-action"
            >
              {following ? (
                <>
                  <MdCheckCircle size={16} />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <MdPersonAdd size={16} />
                  <span>Follow</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/${roleSlug}/wallet`)}
              style={css.messageBtn}
              className="ps-action"
            >
              <MdChatBubbleOutline
                size={16}
                color="var(--brand-on-gradient)"
              />
              <span>Wallet</span>
            </button>

            <button
              type="button"
              onClick={() => router.push(`/${roleSlug}/profile/edit`)}
              style={css.editIconBtn}
              aria-label="Edit profile"
              className="ps-action"
            >
              <MdEdit size={18} color="var(--brand-on-gradient)" />
            </button>
          </div>
        </div>

        {/* ═════════ HIGHLIGHTS STRIP ═════════ */}
        <div style={css.highlightsSection}>
          <div style={css.highlightsScroll}>
            <button
              type="button"
              style={css.highlightChip}
              onClick={() => router.push(`/${roleSlug}/profile/edit`)}
              className="ps-highlight"
            >
              <span style={css.highlightAddIcon}>
                <MdAdd size={20} color="var(--brand-primary)" />
              </span>
              <span style={css.highlightLabel}>New</span>
            </button>

            {highlights.map((h) => (
              <button
                key={h.id}
                type="button"
                style={css.highlightChip}
                className="ps-highlight"
              >
                <span style={css.highlightRing}>
                  <span style={css.highlightEmoji}>{h.emoji}</span>
                </span>
                <span style={css.highlightLabel}>{h.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═════════ TABS ═════════ */}
        <div style={css.tabBar}>
          <button
            type="button"
            onClick={() => setTab('content')}
            style={{
              ...css.tabBtn,
              color:
                tab === 'content'
                  ? 'var(--brand-primary)'
                  : 'var(--text-muted)',
              borderBottomColor:
                tab === 'content'
                  ? 'var(--brand-primary)'
                  : 'transparent',
            }}
          >
            <MdGridOn size={20} />
            <span>Content</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('about')}
            style={{
              ...css.tabBtn,
              color:
                tab === 'about'
                  ? 'var(--brand-primary)'
                  : 'var(--text-muted)',
              borderBottomColor:
                tab === 'about'
                  ? 'var(--brand-primary)'
                  : 'transparent',
            }}
          >
            <MdInfoOutline size={20} />
            <span>About</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('wallet')}
            style={{
              ...css.tabBtn,
              color:
                tab === 'wallet'
                  ? 'var(--brand-primary)'
                  : 'var(--text-muted)',
              borderBottomColor:
                tab === 'wallet'
                  ? 'var(--brand-primary)'
                  : 'transparent',
            }}
          >
            <MdAccountBalanceWallet size={20} />
            <span>Wallet</span>
          </button>
        </div>

        {/* ═════════ TAB CONTENT ═════════ */}
        <div style={css.tabContent}>
          {tab === 'content' && (
            <ContentTab role={role} stats={stats} />
          )}

          {tab === 'about' && (
            <AboutTab
              profile={profile}
              role={role}
              memberSince={memberSince}
              followersCount={followersCount}
            />
          )}

          {tab === 'wallet' && (
            <WalletTab
              role={role}
              stats={stats}
              roleSlug={roleSlug}
              walletTitle={walletTitle}
              router={router}
            />
          )}
        </div>

        {/* Logout */}
        <div style={css.logoutWrap}>
          <button
            onClick={handleLogout}
            style={css.logoutBtn}
            className="ps-logout"
          >
            <MdLogout size={20} color="var(--danger-fg)" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* AVATAR MODAL — unchanged behaviour */}
      {showAvatarModal && (
        <div
          style={css.modalOverlay}
          className="ps-modal-overlay"
          onClick={closeAvatarModal}
        >
          <div
            style={css.modalCard}
            className="ps-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeAvatarModal}
              style={css.modalClose}
              aria-label="Close"
            >
              <MdClose size={20} color="var(--text-tertiary)" />
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
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
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
                <MdPhotoLibrary
                  size={18}
                  color="var(--brand-primary)"
                />
                <span>Choose from gallery</span>
              </button>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                style={css.modalSecondary}
              >
                <MdCameraAlt size={18} color="var(--brand-primary)" />
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
                  !avatarFile || uploadingAvatar
                    ? 'not-allowed'
                    : 'pointer',
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
// Tab: Content (grid of listings/services)
// ─────────────────────────────────────────────────────────────
function ContentTab({
  role,
  stats,
}: {
  role: ProfileRole;
  stats: Stats | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const collected: GridItem[] = [];
        if (role === 'storekeeper') {
          const s = stats as StorekeeperStats | null;
          if (s?.storeId) {
            const listings = (await api.getStoreItems(
              s.storeId,
            )) as Array<Record<string, unknown>>;
            for (const l of listings || []) {
              collected.push({
                id: String(l.listing_id ?? ''),
                title: String(l.title ?? 'Listing'),
                imageUrl: resolveImageUrl(
                  (l.image_url as string) ?? null,
                ),
                price: l.price ? `₦${Number(l.price).toLocaleString()}` : undefined,
                kind: 'listing',
              });
            }
          }
        } else if (role === 'service_provider') {
          const services = (await api.getProviderServices()) as Array<
            Record<string, unknown>
          >;
          for (const sv of services || []) {
            collected.push({
              id: String(sv.service_id ?? ''),
              title: String(sv.title ?? 'Service'),
              imageUrl: resolveImageUrl(
                (sv.image_url as string) ?? null,
              ),
              price: sv.price
                ? `₦${Number(sv.price).toLocaleString()}`
                : undefined,
              kind: 'service',
            });
          }
        } else {
          // Shopper — show saved items
          const saved = (await api.getSavedItems()) as Array<
            Record<string, unknown>
          >;
          for (const s of saved || []) {
            collected.push({
              id: String(s.listing_id ?? ''),
              title: String(s.title ?? 'Saved item'),
              imageUrl: resolveImageUrl(
                (s.image_url as string) ?? null,
              ),
              price: s.price ? `₦${Number(s.price).toLocaleString()}` : undefined,
              kind: 'listing',
            });
          }
        }
        if (!cancelled) setItems(collected);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, stats]);

  if (loading) {
    return (
      <div style={grid.grid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={grid.cell} className="ps-grid-skel" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={grid.empty}>
        <div style={grid.emptyIcon}>
          <MdStore size={32} color="var(--brand-primary)" />
        </div>
        <h3 style={grid.emptyTitle}>Nothing here yet</h3>
        <p style={grid.emptyBody}>
          {role === 'shopper'
            ? 'Save items you love and they will show up here.'
            : role === 'storekeeper'
              ? 'Add your first listing to start selling.'
              : 'Add your first service to start earning.'}
        </p>
      </div>
    );
  }

  return (
    <div style={grid.grid}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          style={grid.cell}
          className="ps-grid-cell"
          onClick={() =>
            router.push(
              it.kind === 'service'
                ? `/service-detail/${it.id}`
                : `/item-detail/${it.id}`,
            )
          }
        >
          {it.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.imageUrl} alt="" style={grid.img} />
          ) : (
            <div style={grid.imgPlaceholder}>
              <MdStorefront
                size={20}
                color="var(--text-muted)"
              />
            </div>
          )}
          {it.price && (
            <span style={grid.priceTag}>{it.price}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: About
// ─────────────────────────────────────────────────────────────
function AboutTab({
  profile,
  role,
  memberSince,
  followersCount,
}: {
  profile: Profile;
  role: ProfileRole;
  memberSince: string;
  followersCount: number;
}) {
  return (
    <>
      <h3 style={css.sectionLabel}>Trust & activity</h3>
      <div style={css.section}>
        <AboutRow
          icon={<MdVerified size={18} color="var(--success-fg)" />}
          iconBg="var(--success-bg)"
          label="Verification"
          value={profile.verified ? 'Verified' : 'Not verified'}
        />
        <AboutRow
          icon={<MdPersonAdd size={18} color="var(--brand-primary)" />}
          iconBg="var(--brand-soft)"
          label="Followers"
          value={String(followersCount)}
        />
        <AboutRow
          icon={
            <MdAccessTime size={18} color="var(--warning-fg)" />
          }
          iconBg="var(--warning-bg)"
          label="Member since"
          value={memberSince || '—'}
        />
      </div>

      <h3 style={css.sectionLabel}>Details</h3>
      <div style={css.section}>
        <AboutRow
          icon={<MdStorefront size={18} color="var(--brand-primary)" />}
          iconBg="var(--brand-soft)"
          label="Role"
          value={ROLE_LABEL[role]}
        />
        {profile.business_name && (
          <AboutRow
            icon={<MdStore size={18} color="var(--info-fg)" />}
            iconBg="var(--info-bg)"
            label="Business name"
            value={String(profile.business_name)}
          />
        )}
        {(profile.lga || profile.state_of_origin) && (
          <AboutRow
            icon={<MdLocationOn size={18} color="var(--purple-fg)" />}
            iconBg="var(--purple-bg)"
            label="Location"
            value={[profile.lga, profile.state_of_origin]
              .filter(Boolean)
              .join(', ')}
          />
        )}
        {profile.phone && (
          <AboutRow
            icon={<MdPhone size={18} color="var(--info-fg)" />}
            iconBg="var(--info-bg)"
            label="Phone"
            value={String(profile.phone)}
          />
        )}
        {profile.email && (
          <AboutRow
            icon={<MdEmail size={18} color="var(--info-fg)" />}
            iconBg="var(--info-bg)"
            label="Email"
            value={String(profile.email)}
          />
        )}
      </div>

      <h3 style={css.sectionLabel}>Account</h3>
      <div style={css.section}>
        <AboutRow
          icon={<MdSwapHoriz size={18} color="var(--success-fg)" />}
          iconBg="var(--success-bg)"
          label="Switch role"
          value={ROLE_LABEL[role]}
          onClick={() =>
            (window.location.href = '/onboarding?mode=switch')
          }
        />
      </div>
    </>
  );
}

function AboutRow({
  icon,
  iconBg,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={css.row}
      className={onClick ? 'ps-row' : ''}
    >
      <span style={{ ...css.rowIconWrap, backgroundColor: iconBg }}>
        {icon}
      </span>
      <span style={css.rowBody}>
        <span style={css.rowLabel}>{label}</span>
      </span>
      <span style={css.rowValue}>{value}</span>
      {onClick && (
        <MdChevronRight size={18} color="var(--border-strong)" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Wallet
// ─────────────────────────────────────────────────────────────
function WalletTab({
  role,
  stats,
  roleSlug,
  walletTitle,
  router,
}: {
  role: ProfileRole;
  stats: Stats | null;
  roleSlug: string;
  walletTitle: string;
  router: ReturnType<typeof useRouter>;
}) {
  const balance = stats?.walletBalance ?? 0;

  return (
    <>
      <div style={css.walletCard}>
        <div style={css.walletTop}>
          <div style={css.walletLabelRow}>
            <MdAccountBalanceWallet
              size={16}
              color="color-mix(in srgb, var(--brand-on-gradient) 75%, transparent)"
            />
            <span style={css.walletLabel}>{walletTitle}</span>
          </div>
          <div style={css.walletBalance}>{fmtBalance(balance)}</div>
          <div style={css.walletFootnote}>
            Funds held securely in escrow by our licensed partner.
          </div>
        </div>
        <div style={css.walletActions}>
          {role === 'shopper' ? (
            <button
              type="button"
              onClick={() => router.push(`/${roleSlug}/wallet`)}
              style={css.walletPrimary}
              className="ps-action"
            >
              <MdAdd size={16} color="var(--brand-primary)" />
              <span>Add money</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/${roleSlug}/wallet`)}
              style={css.walletPrimary}
              className="ps-action"
            >
              <span>Withdraw</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(`/${roleSlug}/wallet`)}
            style={css.walletSecondary}
            className="ps-action"
          >
            <span>View wallet</span>
            <MdArrowForward
              size={16}
              color="var(--brand-on-gradient)"
            />
          </button>
        </div>
      </div>

      <h3 style={css.sectionLabel}>Recent activity</h3>
      <div style={css.section}>
        <AboutRow
          icon={<MdReceiptLong size={18} color="var(--purple-fg)" />}
          iconBg="var(--purple-bg)"
          label="Transactions"
          value="View all"
          onClick={() => router.push(`/${roleSlug}/wallet`)}
        />
        <AboutRow
          icon={<MdTrendingUp size={18} color="var(--success-fg)" />}
          iconBg="var(--success-bg)"
          label="This week"
          value={fmtBalance(0)}
        />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
  .ps-shell {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding-bottom: 40px;
  }
  .ps-stat-item:hover { opacity: 0.85; }
  .ps-stat-item:active { transform: scale(0.97); }
  .ps-action:active { transform: scale(0.97); }
  .ps-action:hover { opacity: 0.94; }
  .ps-highlight:active { transform: scale(0.95); }
  .ps-highlight:hover { opacity: 0.92; }
  .ps-grid-cell:active { opacity: 0.9; }
  .ps-grid-skel {
    background: var(--skeleton);
    animation: psShimmer 1.4s ease-in-out infinite;
    aspect-ratio: 1 / 1;
  }
  .ps-row:hover { background-color: var(--bg-hover); }
  .ps-logout:hover { background-color: var(--danger-bg); }
  .ps-logout:active { transform: scale(0.99); }

  @media (min-width: 1024px) {
    .ps-modal-overlay {
      align-items: center !important;
      padding: 24px;
    }
    .ps-modal-card {
      border-radius: 24px !important;
      max-height: 80vh;
      overflow-y: auto;
    }
  }
`;

const KF = `
  @keyframes psShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
`;

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    overflowX: 'hidden',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  hero: {
    position: 'relative',
    background: 'var(--brand-gradient)',
    padding: '0 20px 22px',
    overflow: 'hidden',
    transition: 'background 0.18s ease',
  },
  heroGlow: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, color-mix(in srgb, var(--brand-on-gradient) 22%, transparent) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 12,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--brand-on-gradient)',
    letterSpacing: 0.3,
  },
  topActions: {
    display: 'flex',
    gap: 4,
  },
  ghostIconBtn: {
    background:
      'color-mix(in srgb, var(--brand-on-gradient) 10%, transparent)',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minWidth: 36,
    minHeight: 36,
  },
  identityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    paddingTop: 6,
  },
  avatarRingWrap: {
    position: 'relative',
    width: 88,
    height: 88,
    flexShrink: 0,
    padding: 3,
    borderRadius: '50%',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.6) 100%)',
  },
  avatarWrap: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid var(--brand-primary)',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxSizing: 'border-box',
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
    color: 'var(--brand-on-gradient)',
    backgroundColor: 'var(--brand-primary)',
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: -1,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: '50%',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-md)',
    border: '2px solid var(--brand-primary)',
    pointerEvents: 'none',
  },
  statsRow: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 4,
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '4px 6px',
    transition: 'opacity 0.15s, transform 0.12s',
  },
  statValue: {
    fontSize: 17,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    letterSpacing: -0.3,
    fontVariantNumeric: 'tabular-nums',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)',
  },
  nameBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 16,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    margin: 0,
    letterSpacing: -0.3,
  },
  roleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  rolePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.4,
    padding: '3px 10px',
    borderRadius: 999,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 14%, transparent)',
    color: 'var(--brand-on-gradient)',
    textTransform: 'uppercase',
  },
  metaDot: {
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 40%, transparent)',
    fontSize: 12,
  },
  metaText: {
    fontSize: 11.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)',
    fontWeight: 500,
  },
  bio: {
    fontSize: 13,
    lineHeight: 1.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 90%, transparent)',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  contactRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  contactItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 78%, transparent)',
    fontWeight: 500,
  },
  actionsRow: {
    display: 'flex',
    gap: 8,
    marginTop: 18,
  },
  followBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '11px 14px',
    borderRadius: 12,
    border: '1.5px solid',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition:
      'background-color 0.15s, color 0.15s, border-color 0.15s, transform 0.12s',
  },
  messageBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '11px 14px',
    borderRadius: 12,
    border:
      '1.5px solid color-mix(in srgb, var(--brand-on-gradient) 35%, transparent)',
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 8%, transparent)',
    color: 'var(--brand-on-gradient)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.12s, opacity 0.15s',
  },
  editIconBtn: {
    width: 46,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    border:
      '1.5px solid color-mix(in srgb, var(--brand-on-gradient) 35%, transparent)',
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 8%, transparent)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.12s, opacity 0.15s',
  },
  highlightsSection: {
    backgroundColor: 'var(--bg-primary)',
    paddingTop: 16,
    paddingBottom: 4,
  },
  highlightsScroll: {
    display: 'flex',
    gap: 16,
    padding: '0 20px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  highlightChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: 0,
    flexShrink: 0,
    transition: 'transform 0.12s, opacity 0.15s',
  },
  highlightRing: {
    width: 62,
    height: 62,
    borderRadius: '50%',
    padding: 2,
    background:
      'linear-gradient(135deg, var(--brand-primary) 0%, var(--purple-fg, #7C3AED) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightEmoji: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
  },
  highlightAddIcon: {
    width: 62,
    height: 62,
    borderRadius: '50%',
    border:
      '2px dashed color-mix(in srgb, var(--brand-primary) 55%, transparent)',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    maxWidth: 68,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--border-default)',
    marginTop: 12,
    backgroundColor: 'var(--bg-primary)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  tabBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '12px 4px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabContent: {
    padding: '16px 16px 0',
    minHeight: 200,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: 'var(--text-tertiary)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '20px 0 8px 4px',
  },
  section: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 16,
    border: '1px solid var(--border-default)',
    overflow: 'hidden',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
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
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: -0.1,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  walletCard: {
    background: 'var(--brand-gradient)',
    borderRadius: 20,
    padding: '18px 18px 16px',
    color: 'var(--brand-on-gradient)',
    boxShadow: 'var(--shadow-brand)',
    transition: 'background 0.18s ease',
  },
  walletTop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  walletLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  walletLabel: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 78%, transparent)',
    textTransform: 'uppercase',
  },
  walletBalance: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: -0.5,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--brand-on-gradient)',
  },
  walletFootnote: {
    fontSize: 11.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)',
    marginTop: 2,
    lineHeight: 1.4,
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
    borderRadius: 12,
    border: 'none',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--brand-primary)',
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
    borderRadius: 12,
    border:
      '1.5px solid color-mix(in srgb, var(--brand-on-gradient) 40%, transparent)',
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 8%, transparent)',
    color: 'var(--brand-on-gradient)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.12s',
  },
  logoutWrap: {
    padding: '30px 16px 0',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '14px 20px',
    borderRadius: 16,
    border: '1.5px solid var(--danger-strong)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--danger-fg)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    transition:
      'background-color 0.15s, transform 0.12s, border-color 0.18s ease, color 0.18s ease',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--overlay)',
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
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    borderRadius: '24px 24px 0 0',
    padding: '24px 24px calc(28px + env(safe-area-inset-bottom))',
    boxShadow: 'var(--shadow-lg)',
    position: 'relative',
    animation: 'sheetUp 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 10,
    border: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: '0 0 4px',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    margin: '0 0 20px',
  },
  modalAvatarPreview: {
    width: 140,
    height: 140,
    borderRadius: '50%',
    backgroundColor: 'var(--bg-tertiary)',
    margin: '0 auto 20px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '3px solid var(--brand-soft)',
  },
  avatarFallbackLarge: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--brand-primary)',
    fontSize: 44,
    fontWeight: 800,
    backgroundColor: 'var(--brand-soft)',
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
    border: '1.5px solid var(--border-default)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--brand-primary)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  modalPrimary: {
    width: '100%',
    padding: 16,
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  avatarSkeleton: {
    width: 88,
    height: 88,
    borderRadius: '50%',
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 18%, transparent)',
    marginTop: 8,
  },
  skelLine: {
    width: 180,
    height: 14,
    borderRadius: 7,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 22%, transparent)',
    marginTop: 16,
  },
  statsSkeleton: {
    height: 100,
    borderRadius: 20,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    animation: 'psShimmer 1.4s ease-in-out infinite',
  },
  sectionSkeleton: {
    height: 120,
    borderRadius: 18,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    marginTop: 18,
    animation: 'psShimmer 1.4s ease-in-out infinite',
  },
  errorRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: 24,
    textAlign: 'center',
  },
  errorHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  errorHeading: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  errorBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
};

// ─────────────────────────────────────────────────────────────
// Grid styles
// ─────────────────────────────────────────────────────────────
const grid: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 3,
    marginTop: 8,
  },
  cell: {
    position: 'relative',
    aspectRatio: '1 / 1',
    border: 'none',
    padding: 0,
    backgroundColor: 'var(--bg-tertiary)',
    cursor: 'pointer',
    overflow: 'hidden',
    fontFamily: 'inherit',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-tertiary)',
  },
  priceTag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    padding: '3px 8px',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.2,
    backdropFilter: 'blur(4px)',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    gap: 4,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'var(--brand-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 13.5,
    color: 'var(--text-tertiary)',
    margin: '4px 0 0',
    maxWidth: 300,
    lineHeight: 1.5,
  },
};