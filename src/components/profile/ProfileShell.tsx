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
  MdAccountBalanceWallet,
  MdLocationOn,
  MdErrorOutline,
  MdRefresh,
  MdArrowForward,
  MdReceiptLong,
  MdSwapHoriz,
  MdLogout,
  MdStorefront,
  MdInventory2,
  MdEventAvailable,
  MdStar,
  MdBuild,
  MdTrendingUp,
  MdAdd,
  MdImage,
  MdGridOn,
  MdInfoOutline,
} from 'react-icons/md';

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

interface ActivityRow {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  subtitle?: string;
  onClick?: () => void;
}

interface Highlight {
  id: string;
  emoji: string;
  label: string;
  route: string;
}

interface ContentItem {
  id: string;
  title: string;
  price?: string;
  imageUrl: string | null;
  kind: 'listing' | 'service';
  routeTo: string;
}

type Tab = 'content' | 'about' | 'wallet';

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

const HIGHLIGHT_PRESETS: Array<{
  emoji: string;
  label: string;
  route: string;
}> = [
  { emoji: '🔖', label: 'Saved',     route: '/shopper/saved?tab=Items' },
  { emoji: '📦', label: 'Orders',    route: '/shopper/saved?tab=History' },
  { emoji: '🔍', label: 'Wanted',    route: '/shopper/saved?tab=Wanted' },
  { emoji: '🧺', label: 'Basket',    route: '/basket' },
  { emoji: '💬', label: 'Community', route: '/community' },
  { emoji: '💰', label: 'Wallet',    route: '/shopper/wallet' },
  { emoji: '🏪', label: 'Store',     route: '/storekeeper/store' },
  { emoji: '🛠️', label: 'Services',  route: '/service-provider/services' },
];

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

function fmtBalance(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '₦0';
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(1)}k`;
  return `₦${Math.round(v).toLocaleString('en-NG')}`;
}

function fmtPrice(raw: unknown): string {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

/**
 * Person's own name — never prefers business_name. Business name is
 * rendered separately so the profile can show both side by side.
 */
function personName(p: Profile | null): string {
  if (!p) return 'User';
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return (
    p.nickname ||
    full ||
    p.real_name ||
    p.username ||
    p.phone ||
    'User'
  );
}

function businessName(p: Profile | null): string {
  if (!p) return '';
  return (p.business_name || '').trim();
}

function buildBio(p: Profile | null, role: ProfileRole): string {
  if (!p) return '';
  if (p.bio && String(p.bio).trim()) return String(p.bio).trim();
  const parts: string[] = [];
  if (role === 'storekeeper') {
    parts.push('🏪 Storekeeper on Admerce');
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

async function loadContentItems(
  role: ProfileRole,
  stats: Stats | null,
): Promise<ContentItem[]> {
  try {
    if (role === 'storekeeper') {
      const s = stats as StorekeeperStats | null;
      if (!s?.storeId) return [];
      const rows = (await api.getStoreItems(s.storeId)) as Array<
        Record<string, unknown>
      >;
      return rows
        .filter((r) => r?.listing_id)
        .map((r) => ({
          id: String(r.listing_id),
          title: String(r.title ?? 'Listing'),
          price: fmtPrice(r.price),
          imageUrl: resolveImageUrl((r.image_url as string) ?? null),
          kind: 'listing' as const,
          routeTo: `/item-detail/${r.listing_id}`,
        }));
    }
    if (role === 'service_provider') {
      const rows = (await api.getProviderServices()) as Array<
        Record<string, unknown>
      >;
      return rows
        .filter((r) => r?.service_id)
        .map((r) => ({
          id: String(r.service_id),
          title: String(r.title ?? 'Service'),
          price: fmtPrice(r.price),
          imageUrl: resolveImageUrl((r.image_url as string) ?? null),
          kind: 'service' as const,
          routeTo: `/service-detail/${r.service_id}`,
        }));
    }
    const rows = (await api.getSavedItems()) as Array<Record<string, unknown>>;
    return rows
      .filter((r) => r?.listing_id)
      .map((r) => ({
        id: String(r.listing_id),
        title: String(r.title ?? 'Saved item'),
        price: fmtPrice(r.price),
        imageUrl: resolveImageUrl((r.image_url as string) ?? null),
        kind: 'listing' as const,
        routeTo: `/item-detail/${r.listing_id}`,
      }));
  } catch {
    return [];
  }
}

/**
 * Role-aware stat trio.
 *   shopper     → Saved / Wanted / Orders (private activity)
 *   storekeeper → Listings / Patronizers / Followers (public social proof)
 *   provider    → Services / Patronizers / Followers
 */
function statTrio(
  role: ProfileRole,
  stats: Stats | null,
  followersCount: number,
  patronizerCount: number,
): { value: string; label: string; onClick: () => void }[] {
  if (role === 'shopper') {
    const s = (stats as ShopperStats | null) ?? {
      savedCount: 0,
      wantedCount: 0,
      ordersCount: 0,
      walletBalance: 0,
    };
    return [
      { value: String(s.savedCount),  label: 'Saved',  onClick: () => {} },
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
      { value: String(s.listingsCount), label: 'Listings',    onClick: () => {} },
      { value: String(patronizerCount), label: 'Patronizers', onClick: () => {} },
      { value: String(followersCount),  label: 'Followers',   onClick: () => {} },
    ];
  }
  const s = (stats as ProviderStats | null) ?? {
    servicesCount: 0,
    bookingsCount: 0,
    rating: 0,
    walletBalance: 0,
  };
  return [
    { value: String(s.servicesCount), label: 'Services',    onClick: () => {} },
    { value: String(patronizerCount), label: 'Patronizers', onClick: () => {} },
    { value: String(followersCount),  label: 'Followers',   onClick: () => {} },
  ];
}

export function ProfileShell({ role }: { role: ProfileRole }) {
  useAuthGuard();
  const router = useRouter();
  const roleSlug = ROLE_SLUG[role];

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [patronizerCount, setPatronizerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [tab, setTab] = useState<Tab>('content');

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [highlightSaving, setHighlightSaving] = useState(false);

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

        // Followers only matter for public profiles. Shopper skips the call.
        const wantsFollowers =
          role === 'storekeeper' || role === 'service_provider';

        const [roleStats, hi, follow] = await Promise.all([
          LOADERS[role](),
          api.getMyHighlights().catch(() => [] as Highlight[]),
          wantsFollowers && profileData.id
            ? api
                .getUserFollowStatus(profileData.id)
                .catch(() => ({
                  is_following: false,
                  followers_count: 0,
                  following_count: 0,
                  is_self: true,
                }))
            : Promise.resolve({
                is_following: false,
                followers_count: 0,
                following_count: 0,
                is_self: true,
              }),
        ]);

        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setStats(roleStats);
        setHighlights(Array.isArray(hi) ? hi : []);
        setFollowersCount(follow.followers_count || 0);

        // Patronizer count — only meaningful for public roles.
        let patrons = 0;
        if (role === 'storekeeper') {
          const s = roleStats as StorekeeperStats;
          if (s?.storeId) {
            try {
              const store = (await api.getStoreById(s.storeId)) as {
                patronizer_count?: number;
              };
              patrons = Number(store?.patronizer_count) || 0;
            } catch {
              patrons = 0;
            }
          }
        } else if (role === 'service_provider' && profileData.id) {
          try {
            const res = await api.getProviderPatronizerCount(profileData.id);
            patrons = Number(res?.patronizer_count) || 0;
          } catch {
            patrons = 0;
          }
        }
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setPatronizerCount(patrons);

        const items = await loadContentItems(role, roleStats);
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setContentItems(items);
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

  const addHighlight = async (preset: {
    emoji: string;
    label: string;
    route: string;
  }) => {
    setHighlightSaving(true);
    try {
      const created = await api.createHighlight(preset);
      setHighlights((prev) => [...prev, created]);
      setShowHighlightModal(false);
    } catch (err) {
      await alertDialog({
        title: 'Could not add highlight',
        body: extractErrorDetail(err, 'Try again later.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setHighlightSaving(false);
    }
  };

  const removeHighlight = async (id: string) => {
    const ok = await confirmDialog({
      title: 'Remove highlight?',
      body: 'This only removes the shortcut from your profile. Nothing is deleted.',
      kind: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteHighlight(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      await alertDialog({
        title: 'Could not remove',
        body: extractErrorDetail(err, 'Try again later.'),
        kind: 'danger',
      });
    }
  };

  if (loading) {
    return (
      <main style={css.root} className="ps-root">
        <style>{KF}</style>
        <style>{CSS}</style>
        <div className="ps-shell">
          <div className="ps-topbar">
            <span className="ps-topbar-title">Profile</span>
            <div style={{ width: 38 }} />
          </div>
        </div>
      </main>
    );
  }

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

  const name = personName(profile);
  const bizName = businessName(profile);
  const showBiz = Boolean(bizName) && bizName.toLowerCase() !== name.toLowerCase();
  const phone = profile.phone || '';
  const email = profile.email || '';
  const avatarUrl = resolveImageUrl(profile.avatar_url);
  const isVerified = profile.verified === true;
  const memberSince = fmtMemberSince(profile.created_at);
  const initial = (name.charAt(0) || '?').toUpperCase();
  const bio = buildBio(profile, role);
  const trio = statTrio(role, stats, followersCount, patronizerCount);

  const walletTitle =
    role === 'storekeeper'
      ? 'Store revenue'
      : role === 'service_provider'
        ? 'Earnings'
        : 'Escrow balance';

  const activity = buildActivityRows(role, stats);

  return (
    <main style={css.root} className="ps-root">
      <style>{KF}</style>
      <style>{CSS}</style>

      <div className="ps-shell">
        {/* ═══ TOP BAR ═════════════════════════════════════════ */}
        <header className="ps-topbar">
          <span className="ps-topbar-title">Profile</span>
          <button
            onClick={() => router.push(`/settings/${roleSlug}`)}
            style={css.ghostBtn}
            aria-label="Settings"
          >
            <MdSettings size={22} color="var(--brand-on-gradient)" />
          </button>
        </header>

        <div className="ps-body">
          {/* ═══ LEFT COLUMN ════════════════════════════════════ */}
          <aside className="ps-left">
            <div className="ps-hero">
              <div style={css.heroGlow} aria-hidden />

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

              <div style={css.nameBlock}>
                <div style={css.nameRow}>
                  <h1 style={css.name}>{name}</h1>
                  {showBiz && (
                    <span style={css.nameBiz}>· {bizName}</span>
                  )}
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
                    <>
                      <span style={css.metaDot}>·</span>
                      <span style={css.metaText}>Since {memberSince}</span>
                    </>
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

              <div style={css.actionsRow}>
                <button
                  type="button"
                  onClick={() => router.push(`/${roleSlug}/wallet`)}
                  style={css.messageBtn}
                  className="ps-action"
                >
                  <MdAccountBalanceWallet
                    size={16}
                    color="var(--brand-on-gradient)"
                  />
                  <span>Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/${roleSlug}/profile/edit`)}
                  style={css.editBtn}
                  className="ps-action"
                >
                  <MdEdit size={16} color="var(--brand-on-gradient)" />
                  <span>Edit profile</span>
                </button>
              </div>
            </div>

            {/* Highlights */}
            <div className="ps-highlights-block">
              <div className="ps-highlights">
                <button
                  type="button"
                  onClick={() => setShowHighlightModal(true)}
                  style={css.highlightChip}
                  className="ps-highlight"
                  aria-label="Add highlight"
                >
                  <span style={css.highlightAddIcon}>
                    <MdAdd size={20} color="var(--brand-primary)" />
                  </span>
                  <span style={css.highlightLabel}>New</span>
                </button>

                {highlights.map((h) => (
                  <div key={h.id} style={css.highlightChipWrap}>
                    <button
                      type="button"
                      onClick={() => router.push(h.route)}
                      style={css.highlightChip}
                      className="ps-highlight"
                      aria-label={h.label}
                    >
                      <span style={css.highlightRing}>
                        <span style={css.highlightEmoji}>{h.emoji}</span>
                      </span>
                      <span style={css.highlightLabel}>{h.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHighlight(h.id)}
                      style={css.highlightDelete}
                      aria-label={`Remove ${h.label}`}
                      className="ps-highlight-del"
                    >
                      <MdClose size={11} color="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ═══ RIGHT COLUMN ══════════════════════════════════ */}
          <section className="ps-right">
            <div style={css.tabBar} className="ps-tabbar">
              <button
                type="button"
                onClick={() => setTab('content')}
                className="ps-tab"
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
                <MdGridOn size={18} />
                <span>Content</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('about')}
                className="ps-tab"
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
                <MdInfoOutline size={18} />
                <span>About</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('wallet')}
                className="ps-tab"
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
                <MdAccountBalanceWallet size={18} />
                <span>Wallet</span>
              </button>
            </div>

            <div style={css.tabContent} className="ps-tabcontent">
              {tab === 'content' && (
                <>
                  {contentItems.length === 0 ? (
                    <div style={css.empty}>
                      <div style={css.emptyIcon}>
                        <MdStorefront
                          size={28}
                          color="var(--brand-primary)"
                        />
                      </div>
                      <h3 style={css.emptyTitle}>Nothing here yet</h3>
                      <p style={css.emptyBody}>
                        {role === 'shopper'
                          ? 'Save items you love and they will show up here.'
                          : role === 'storekeeper'
                            ? 'Add your first listing to start selling.'
                            : 'Add your first service to start earning.'}
                      </p>
                    </div>
                  ) : (
                    <div className="ps-grid">
                      {contentItems.map((it) => (
                        <button
                          key={`${it.kind}-${it.id}`}
                          type="button"
                          className="ps-grid-cell"
                          onClick={() => router.push(it.routeTo)}
                          aria-label={it.title}
                        >
                          {it.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.imageUrl}
                              alt=""
                              loading="lazy"
                              className="ps-grid-img"
                            />
                          ) : (
                            <div className="ps-grid-fallback">
                              <MdImage
                                size={28}
                                color="var(--text-muted)"
                              />
                            </div>
                          )}
                          <div className="ps-grid-overlay">
                            <span className="ps-grid-price">
                              {it.price || '—'}
                            </span>
                          </div>
                          <div className="ps-grid-meta">
                            <div className="ps-grid-title">{it.title}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'about' && (
                <>
                  <h3 style={css.sectionLabel}>Details</h3>
                  <div style={css.section}>
                    {activity.map((row, i) => (
                      <Row key={i} {...row} />
                    ))}
                  </div>

                  <h3 style={css.sectionLabel}>Account</h3>
                  <div style={css.section}>
                    <Row
                      icon={
                        <MdSwapHoriz
                          size={18}
                          color="var(--success-fg)"
                        />
                      }
                      iconBg="var(--success-bg)"
                      label="Switch role"
                      subtitle={ROLE_LABEL[role]}
                      onClick={() =>
                        router.push('/onboarding?mode=switch')
                      }
                    />
                  </div>
                </>
              )}

              {tab === 'wallet' && (
                <div style={css.walletCard}>
                  <div style={css.walletTop}>
                    <div style={css.walletLabelRow}>
                      <MdAccountBalanceWallet
                        size={16}
                        color="color-mix(in srgb, var(--brand-on-gradient) 75%, transparent)"
                      />
                      <span style={css.walletLabel}>{walletTitle}</span>
                    </div>
                    <div style={css.walletBalance}>
                      {fmtBalance(stats?.walletBalance ?? 0)}
                    </div>
                    <div style={css.walletFootnote}>
                      Funds held securely in escrow by our licensed
                      partner.
                    </div>
                  </div>
                  <div style={css.walletActions}>
                    <button
                      type="button"
                      onClick={() => router.push(`/${roleSlug}/wallet`)}
                      style={css.walletPrimary}
                      className="ps-action"
                    >
                      <span>
                        {role === 'shopper' ? 'Add money' : 'Withdraw'}
                      </span>
                    </button>
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
              )}
            </div>
          </section>
        </div>

        <div className="ps-footer">
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

      {/* Avatar modal */}
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

      {/* Highlights modal */}
      {showHighlightModal && (
        <div
          style={css.modalOverlay}
          className="ps-modal-overlay"
          onClick={() => !highlightSaving && setShowHighlightModal(false)}
        >
          <div
            style={css.modalCard}
            className="ps-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHighlightModal(false)}
              style={css.modalClose}
              aria-label="Close"
              disabled={highlightSaving}
            >
              <MdClose size={20} color="var(--text-tertiary)" />
            </button>
            <h3 style={css.modalTitle}>Add a highlight</h3>
            <p style={css.modalSub}>
              Shortcuts that live on your profile.
            </p>

            <div style={css.presetList}>
              {HIGHLIGHT_PRESETS.map((p) => (
                <button
                  key={`${p.emoji}-${p.label}`}
                  type="button"
                  onClick={() => addHighlight(p)}
                  disabled={highlightSaving}
                  style={css.presetRow}
                >
                  <span style={css.presetEmoji}>{p.emoji}</span>
                  <span style={css.presetLabel}>{p.label}</span>
                  <MdChevronRight
                    size={18}
                    color="var(--text-tertiary)"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function buildActivityRows(
  role: ProfileRole,
  stats: Stats | null,
): ActivityRow[] {
  if (role === 'shopper') {
    const s = (stats as ShopperStats | null) ?? {
      savedCount: 0,
      wantedCount: 0,
      ordersCount: 0,
      walletBalance: 0,
    };
    return [
      {
        icon: (
          <MdFavoriteBorder size={18} color="var(--brand-primary)" />
        ),
        iconBg: 'var(--brand-soft)',
        label: 'Saved items',
        value: String(s.savedCount),
      },
      {
        icon: <MdSearch size={18} color="var(--info-fg)" />,
        iconBg: 'var(--info-bg)',
        label: 'Wanted alerts',
        value: String(s.wantedCount),
      },
      {
        icon: <MdReceiptLong size={18} color="var(--purple-fg)" />,
        iconBg: 'var(--purple-bg)',
        label: 'Orders',
        value: String(s.ordersCount),
      },
      {
        icon: <MdLocationOn size={18} color="var(--warning-fg)" />,
        iconBg: 'var(--warning-bg)',
        label: 'Delivery addresses',
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
        icon: (
          <MdStorefront size={18} color="var(--brand-primary)" />
        ),
        iconBg: 'var(--brand-soft)',
        label: 'Store profile',
      },
      {
        icon: <MdInventory2 size={18} color="var(--info-fg)" />,
        iconBg: 'var(--info-bg)',
        label: 'Listings',
        value: String(s.listingsCount),
      },
      {
        icon: <MdReceiptLong size={18} color="var(--purple-fg)" />,
        iconBg: 'var(--purple-bg)',
        label: 'Orders received',
        value: String(s.ordersCount),
      },
      {
        icon: <MdVerified size={18} color="var(--success-fg)" />,
        iconBg: 'var(--success-bg)',
        label: 'Verification',
      },
    ];
  }

  const s = (stats as ProviderStats | null) ?? {
    servicesCount: 0,
    bookingsCount: 0,
    rating: 0,
    walletBalance: 0,
  };
  return [
    {
      icon: <MdBuild size={18} color="var(--brand-primary)" />,
      iconBg: 'var(--brand-soft)',
      label: 'My services',
      value: String(s.servicesCount),
    },
    {
      icon: <MdEventAvailable size={18} color="var(--info-fg)" />,
      iconBg: 'var(--info-bg)',
      label: 'Bookings',
      value: String(s.bookingsCount),
    },
    {
      icon: <MdStar size={18} color="var(--warning-fg)" />,
      iconBg: 'var(--warning-bg)',
      label: 'Reviews',
      value: s.rating > 0 ? s.rating.toFixed(1) : '—',
    },
    {
      icon: <MdTrendingUp size={18} color="var(--success-fg)" />,
      iconBg: 'var(--success-bg)',
      label: 'Availability',
    },
  ];
}

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
      <MdChevronRight size={18} color="var(--border-strong)" />
    </button>
  );
}

/* ─── Layout CSS (media queries) ──────────────────────────────── */
const CSS = `
  .ps-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    overflow-x: hidden;
    transition: background-color 0.18s ease, color 0.18s ease;
  }

  .ps-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0 auto;
    flex: 1;
    min-height: 0;
  }

  /* Top bar — full-bleed gradient on mobile */
  .ps-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px 12px;
    background: var(--brand-gradient);
    transition: background 0.18s ease;
  }
  .ps-topbar-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--brand-on-gradient);
    letter-spacing: 0.3px;
  }

  .ps-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .ps-left {
    display: flex;
    flex-direction: column;
  }
  .ps-right {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Highlights strip — horizontal scroll */
  .ps-highlights-block {
    padding-top: 18px;
    padding-bottom: 4px;
  }
  .ps-highlights {
    display: flex;
    gap: 14px;
    padding: 0 20px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .ps-highlights::-webkit-scrollbar { display: none; }

  /* Content grid — responsive via container */
  .ps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 3px;
  }
  .ps-grid-cell {
    position: relative;
    aspect-ratio: 1 / 1;
    padding: 0;
    border: none;
    background: var(--bg-tertiary);
    cursor: pointer;
    overflow: hidden;
    font-family: inherit;
    text-align: left;
  }
  .ps-grid-cell:active { opacity: 0.85; }
  .ps-grid-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ps-grid-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
  }
  .ps-grid-overlay {
    position: absolute;
    inset: auto 0 0 0;
    padding: 24px 8px 30px;
    background: linear-gradient(
      to top,
      rgba(0,0,0,0.72) 0%,
      transparent 90%
    );
    pointer-events: none;
  }
  .ps-grid-price {
    position: absolute;
    top: -18px;
    right: 6px;
    font-size: 11px;
    font-weight: 800;
    color: #fff;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(4px);
    font-variant-numeric: tabular-nums;
  }
  .ps-grid-meta {
    position: absolute;
    inset: auto 0 0 0;
    padding: 8px 8px 10px;
    color: #fff;
    pointer-events: none;
  }
  .ps-grid-title {
    font-size: 11px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
  }

  /* Rounded corners on the hero — only on desktop */
  .ps-hero {
    position: relative;
    background: var(--brand-gradient);
    padding: 0 20px 22px;
    overflow: hidden;
    transition: background 0.18s ease;
  }

  /* Tab content padding */
  .ps-tabcontent {
    padding: 16px 16px 40px;
  }

  /* Footer */
  .ps-footer {
    padding: 8px 20px 40px;
  }

  /* ─── Micro-interactions ─────────────────────────────── */
  .ps-stat-item:hover { opacity: 0.85; }
  .ps-stat-item:active { transform: scale(0.97); }
  .ps-action:active { transform: scale(0.97); }
  .ps-action:hover { opacity: 0.94; }
  .ps-row:hover { background-color: var(--bg-hover); }
  .ps-logout:hover { background-color: var(--danger-bg); }
  .ps-logout:active { transform: scale(0.99); }
  .ps-highlight:active { transform: scale(0.95); }
  .ps-highlight:hover { opacity: 0.92; }
  .ps-highlight-del:hover { opacity: 1; }
  .ps-tab:hover { color: var(--text-primary) !important; }

  /* ═══════════════════════════════════════════════════════════
     Desktop: single-column full-width
     ═══════════════════════════════════════════════════════════ */
  @media (min-width: 1024px) {
    .ps-shell {
      max-width: 960px;
      padding: 24px 32px 48px;
      gap: 20px;
    }
    .ps-topbar {
      background: transparent;
      padding: 0 0 8px;
      border-bottom: none;
    }
    .ps-topbar-title {
      color: var(--text-primary);
      font-size: 24px;
      font-weight: 850;
      letter-spacing: -0.03em;
    }
    .ps-body {
      display: flex;
      flex-direction: column;
      gap: 20px;
      align-items: stretch;
    }
    .ps-left {
      position: static;
      gap: 20px;
    }
    .ps-hero {
      border-radius: 22px;
      padding: 24px 22px 22px;
      box-shadow: var(--shadow-sm);
    }
    .ps-highlights-block {
      padding: 18px 4px 16px;
      border-radius: 22px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
    }
    .ps-highlights { padding: 0 14px; }
    .ps-right {
      gap: 0;
      border-radius: 22px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      overflow: hidden;
      min-width: 0;
    }
    .ps-tabbar {
      padding: 4px 8px 0;
      border-bottom: 1px solid var(--border-default);
      margin-top: 0;
    }
    .ps-tab {
      padding: 16px 12px;
      font-size: 13px;
    }
    .ps-tabcontent {
      padding: 20px 20px 24px;
    }
    .ps-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 8px;
    }
    .ps-footer { padding: 0; }
  }

  @media (min-width: 1440px) {
    .ps-shell { max-width: 1100px; }
    .ps-grid {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
  }
`;

const KF = `
  @keyframes psShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
`;

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
  ghostBtn: {
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
    flexWrap: 'wrap',
    minWidth: 0,
  },
  name: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    margin: 0,
    letterSpacing: -0.3,
  },
  nameBiz: {
    fontSize: 15,
    fontWeight: 700,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 78%, transparent)',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
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
  editBtn: {
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
  highlightChipWrap: {
    position: 'relative',
    flexShrink: 0,
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
  highlightDelete: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.65)',
    border: '2px solid var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    opacity: 0.85,
    transition: 'opacity 0.15s',
    boxSizing: 'border-box',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--border-default)',
    marginTop: 0,
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
    paddingBottom: 40,
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
  rowSubtitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-muted)',
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
  walletCard: {
    background: 'var(--brand-gradient)',
    borderRadius: 20,
    padding: '18px 18px 16px',
    color: 'var(--brand-on-gradient)',
    boxShadow: 'var(--shadow-brand)',
    transition: 'background 0.18s ease',
    marginTop: 6,
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
  presetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  presetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '14px 16px',
    border: '1px solid var(--border-default)',
    borderRadius: 14,
    backgroundColor: 'var(--bg-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  presetEmoji: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
    flexShrink: 0,
  },
  presetLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: 700,
    color: 'var(--text-primary)',
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