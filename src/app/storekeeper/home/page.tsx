'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { alertDialog } from '../../../components/ui/dialogs';
import {
  MdRefresh,
  MdAutoAwesome,
  MdVisibility,
  MdChat,
  MdShoppingBag,
  MdAdd,
  MdGridView,
  MdAddPhotoAlternate,
  MdPhotoLibrary,
  MdCameraAlt,
  MdClose,
  MdVerified,
  MdHourglassEmpty,
  MdErrorOutline,
  MdInfoOutline,
  MdChevronRight,
  MdGroups,
  MdStorefront,
  MdImage,
  MdAccountBalanceWallet,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface Store {
  name?: string;
  store_image_url?: string;
  store_id?: string;
  verification_status?: string;
  verified?: boolean;
  verified_at?: string | null;
  created_at?: string;
}

interface Profile {
  nickname?: string;
  username?: string;
  avatar_url?: string;
  avatar_width?: number | null;
  avatar_height?: number | null;
  created_at?: string;
}

interface StoreStats {
  views?: number;
  inquiries?: number;
  sold?: number;
  revenue?: number;
}

interface CommunityStats {
  room: string;
  total_messages: number;
  active_senders_7d: number;
}

interface CommunityStatsApi {
  communityGetStats?: (room: string) => Promise<CommunityStats | null>;
}

type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'suspended';

// ─── Helpers ────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
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

function formatNaira(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '₦0';
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `₦${(v / 1_000).toFixed(1)}k`;
  return `₦${Math.round(v).toLocaleString('en-NG')}`;
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
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

function safeVerificationStatus(store: Store | null): VerificationStatus {
  const vs = (store?.verification_status || '').toLowerCase();
  if (
    vs === 'unverified' ||
    vs === 'pending' ||
    vs === 'verified' ||
    vs === 'rejected' ||
    vs === 'suspended'
  ) {
    return vs as VerificationStatus;
  }
  return store?.verified ? 'verified' : 'unverified';
}

const VERIFICATION_META: Record<
  VerificationStatus,
  { label: string; hint: string; color: string; soft: string }
> = {
  unverified: {
    label: 'Store not verified',
    hint: 'Get the verified badge — buyers trust it',
    color: '#64748B',
    soft: '#F1F5F9',
  },
  pending: {
    label: 'Verification under review',
    hint: 'We received your submission',
    color: '#D97706',
    soft: '#FEF3C7',
  },
  verified: {
    label: 'Store verified',
    hint: 'Buyers see the verified badge on your store',
    color: '#16A34A',
    soft: '#DCFCE7',
  },
  rejected: {
    label: 'Verification not approved',
    hint: 'Review the reason and resubmit',
    color: '#DC2626',
    soft: '#FEE2E2',
  },
  suspended: {
    label: 'Store suspended',
    hint: 'Contact support for details',
    color: '#DC2626',
    soft: '#FEE2E2',
  },
};

// ─── Component ──────────────────────────────────────────────────────
export default function StorekeeperDashboardPage() {
  useAuthGuard();
  const router = useRouter();

  const [store, setStore] = useState<Store | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<StoreStats>({});
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const [showStoreImageModal, setShowStoreImageModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const storeImageInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [storeImagePreview, setStoreImagePreview] = useState<string | null>(
    null,
  );
  const [storeImageFile, setStoreImageFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [uploadingStoreImage, setUploadingStoreImage] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadDashboardData = useCallback(async (showSpinner = true) => {
    const seq = ++reqSeq.current;
    if (showSpinner) setIsLoading(true);
    setErrored(false);
    try {
      const communityApi = api as unknown as CommunityStatsApi;
      const [storeData, profileData, statsData, communityData] =
        await Promise.all([
          api.getMyStore() as Promise<Store | null>,
          api.getMyProfile() as Promise<Profile>,
          api.getStoreStats() as Promise<StoreStats>,
          communityApi.communityGetStats?.('global').catch(() => null) ??
            Promise.resolve(null),
        ]);
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setStore(storeData);
      setProfile(profileData);
      setStats(statsData);
      setCommunityStats(communityData as CommunityStats | null);
    } catch {
      if (seq === reqSeq.current && isMountedRef.current) setErrored(true);
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboardData]);

  // ── Modals ────────────────────────────────────────────────────
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
      await loadDashboardData(false);
      closeStoreImageModal();
    } catch (err) {
      await alertDialog({
        title: 'Upload failed',
        body: extractErrorDetail(err, 'Please try again in a moment.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setUploadingStoreImage(false);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      await api.uploadAvatar(avatarFile);
      await loadDashboardData(false);
      closeAvatarModal();
    } catch (err) {
      await alertDialog({
        title: 'Upload failed',
        body: extractErrorDetail(err, 'Please try again in a moment.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setUploadingAvatar(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────
  const storeImageUrl =
    storeImagePreview || resolveImageUrl(store?.store_image_url);
  const avatarUrl = avatarPreview || resolveImageUrl(profile?.avatar_url);
  const userName =
    profile?.nickname || profile?.username || 'Storekeeper';
  const verificationStatus = safeVerificationStatus(store);
  const verificationMeta = VERIFICATION_META[verificationStatus];
  const memberSince = fmtMemberSince(
    store?.created_at || profile?.created_at,
  );

  const views = stats.views ?? 0;
  const inquiries = stats.inquiries ?? 0;
  const sold = stats.sold ?? 0;
  const revenue = stats.revenue ?? 0;

  // ── Loading skeleton ──────────────────────────────────────────
  if (isLoading) {
    return (
      <main style={css.root}>
        <style>{CSS}</style>
        <div style={css.hero}>
          <div style={css.topBar}>
            <span style={css.topTitle}>Dashboard</span>
            <div style={{ width: 38 }} />
          </div>
          <div style={css.identityRow}>
            <div style={css.thumbSkeleton} />
            <div style={{ flex: 1 }}>
              <div style={css.skelLine} />
              <div
                style={{ ...css.skelLine, width: 130, marginTop: 8 }}
              />
            </div>
          </div>
        </div>
        <div style={css.sheet}>
          <div style={css.revenueSkeleton} />
          <div style={css.pulseSkeleton} />
          {[0, 1].map((i) => (
            <div key={i} style={css.sectionSkeleton} />
          ))}
        </div>
      </main>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (errored) {
    return (
      <main style={css.errorRoot}>
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="#B91C1C" />
        </div>
        <h2 style={css.errorHeading}>Couldn&apos;t load your dashboard</h2>
        <p style={css.errorBody}>
          Check your connection and try again. If this keeps happening, sign
          out and back in.
        </p>
        <button
          onClick={() => void loadDashboardData()}
          style={css.errorRetry}
        >
          <MdRefresh size={18} color="#fff" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  // ── No store yet ──────────────────────────────────────────────
  if (!store) {
    return (
      <main style={css.errorRoot}>
        <style>{CSS}</style>
        <div style={css.setupHalo}>
          <MdStorefront size={40} color="#0504AA" />
        </div>
        <h2 style={css.errorHeading}>Set up your store</h2>
        <p style={css.errorBody}>
          You don&apos;t have a store yet. Create one to start selling on
          Admerce — it takes about two minutes.
        </p>
        <button
          onClick={() => router.push('/storekeeper/onboarding')}
          style={css.errorRetry}
        >
          <span>Create my store</span>
          <MdChevronRight size={18} color="#fff" />
        </button>
      </main>
    );
  }

  // ── Main dashboard ────────────────────────────────────────────
  return (
    <main style={css.root} className="sk-dash">
      <style>{CSS}</style>

      {/* HERO */}
      <div style={css.hero}>
        <div style={css.heroGlow} aria-hidden />

        <div style={css.topBar}>
          <span style={css.topTitle}>Dashboard</span>
          <button
            onClick={() => void loadDashboardData()}
            style={css.ghostBtn}
            aria-label="Refresh"
          >
            <MdRefresh size={20} color="#fff" />
          </button>
        </div>

        <div style={css.identityRow}>
          <button
            type="button"
            onClick={openStoreImageModal}
            style={css.storeThumb}
            aria-label="Change store image"
          >
            {storeImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storeImageUrl} alt="" style={css.storeThumbImg} />
            ) : (
              <div style={css.storeThumbPlaceholder}>
                <MdStorefront size={30} color="rgba(255,255,255,0.85)" />
              </div>
            )}
            <span style={css.cameraBadge} aria-hidden>
              <MdCameraAlt size={11} color="#0504AA" />
            </span>
          </button>

          <div style={css.identityMeta}>
            <div style={css.nameRow}>
              <span style={css.storeName}>{store.name || 'Your Store'}</span>
              {verificationStatus === 'verified' && (
                <MdVerified
                  size={18}
                  color="#7DD3FC"
                  aria-label="Verified"
                />
              )}
            </div>
            <div style={css.metaLine}>
              {userName}
              {memberSince && (
                <>
                  <span style={css.metaDot}>·</span>
                  <span>Since {memberSince}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SHEET */}
      <div style={css.sheet}>
        {/* REVENUE SPOTLIGHT */}
        <div style={css.revenueCard}>
          <div style={css.revenueTop}>
            <div style={css.revenueLabelRow}>
              <MdAccountBalanceWallet
                size={14}
                color="rgba(255,255,255,0.72)"
              />
              <span style={css.revenueLabel}>Total revenue</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/storekeeper/wallet')}
              style={css.revenueLink}
            >
              <span>Wallet</span>
              <MdChevronRight size={16} color="rgba(255,255,255,0.85)" />
            </button>
          </div>
          <div style={css.revenueAmount}>{formatNaira(revenue)}</div>
          <div style={css.revenueSub}>
            {sold > 0
              ? `Across ${sold} completed sale${sold === 1 ? '' : 's'}`
              : 'Complete your first sale to see it grow'}
          </div>
        </div>

        {/* PULSE ROW */}
        <div style={css.pulseRow}>
          <PulseTile
            icon={<MdVisibility size={18} color="#0504AA" />}
            tint="#EEF0FF"
            label="Views"
            value={formatNumber(views)}
          />
          <PulseTile
            icon={<MdChat size={18} color="#0891B2" />}
            tint="#E0F2FE"
            label="Inquiries"
            value={formatNumber(inquiries)}
          />
          <PulseTile
            icon={<MdShoppingBag size={18} color="#16A34A" />}
            tint="#DCFCE7"
            label="Sold"
            value={formatNumber(sold)}
          />
        </div>

        {/* STORE SETUP */}
        <h3 style={css.sectionLabel}>Store setup</h3>
        <div style={css.setupCard}>
          <button
            type="button"
            onClick={() => router.push('/storekeeper/verification')}
            style={css.setupRow}
            className="sk-setup-row"
          >
            <span
              style={{
                ...css.setupIcon,
                backgroundColor: verificationMeta.soft,
              }}
            >
              {verificationStatus === 'verified' && (
                <MdVerified size={18} color={verificationMeta.color} />
              )}
              {verificationStatus === 'pending' && (
                <MdHourglassEmpty size={18} color={verificationMeta.color} />
              )}
              {(verificationStatus === 'rejected' ||
                verificationStatus === 'suspended') && (
                <MdErrorOutline size={18} color={verificationMeta.color} />
              )}
              {verificationStatus === 'unverified' && (
                <MdInfoOutline size={18} color={verificationMeta.color} />
              )}
            </span>
            <span style={css.setupText}>
              <span
                style={{
                  ...css.setupTitle,
                  color: verificationMeta.color,
                }}
              >
                {verificationMeta.label}
              </span>
              <span style={css.setupHint}>{verificationMeta.hint}</span>
            </span>
            <MdChevronRight size={18} color="#CBD5E1" />
          </button>

          <button
            type="button"
            onClick={openStoreImageModal}
            style={css.setupRow}
            className="sk-setup-row"
          >
            <span
              style={{
                ...css.setupIcon,
                backgroundColor: storeImageUrl ? '#DCFCE7' : '#FEF3C7',
              }}
            >
              {storeImageUrl ? (
                <MdImage size={18} color="#16A34A" />
              ) : (
                <MdAddPhotoAlternate size={18} color="#D97706" />
              )}
            </span>
            <span style={css.setupText}>
              <span style={css.setupTitle}>
                {storeImageUrl ? 'Store image set' : 'Add a store image'}
              </span>
              <span style={css.setupHint}>
                {storeImageUrl
                  ? 'Tap to change your store cover'
                  : 'Buyers trust stores with photos'}
              </span>
            </span>
            <MdChevronRight size={18} color="#CBD5E1" />
          </button>
        </div>

        {/* QUICK ACTIONS */}
        <h3 style={css.sectionLabel}>Quick actions</h3>
        <div style={css.actionGrid}>
          <button
            type="button"
            onClick={() => router.push('/storekeeper/add-item')}
            style={{ ...css.actionTile, ...css.actionTilePrimary }}
            className="sk-action-tile"
          >
            <span style={css.actionIconWrapPrimary}>
              <MdAdd size={22} color="#0504AA" />
            </span>
            <span style={css.actionTextPrimary}>
              <span style={css.actionTitlePrimary}>Add item</span>
              <span style={css.actionHintPrimary}>List a new product</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/storekeeper/arrange-store?store_id=${store?.store_id || ''}`,
              )
            }
            style={css.actionTile}
            className="sk-action-tile"
          >
            <span
              style={{
                ...css.actionIconWrap,
                backgroundColor: '#EEF0FF',
              }}
            >
              <MdGridView size={22} color="#0504AA" />
            </span>
            <span style={css.actionText}>
              <span style={css.actionTitle}>Arrange</span>
              <span style={css.actionHint}>Reorder listings</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/seai/ask?mode=agent')}
            style={css.actionTile}
            className="sk-action-tile"
          >
            <span
              style={{
                ...css.actionIconWrap,
                backgroundColor: '#F3E8FF',
              }}
            >
              <MdAutoAwesome size={22} color="#7E22CE" />
            </span>
            <span style={css.actionText}>
              <span style={css.actionTitle}>Ask SEAI</span>
              <span style={css.actionHint}>Your AI assistant</span>
            </span>
          </button>

          <button
            type="button"
            onClick={openAvatarModal}
            style={css.actionTile}
            className="sk-action-tile"
          >
            <span
              style={{
                ...css.actionIconWrap,
                backgroundColor: '#E0F2FE',
              }}
            >
              <MdCameraAlt size={22} color="#0891B2" />
            </span>
            <span style={css.actionText}>
              <span style={css.actionTitle}>Avatar</span>
              <span style={css.actionHint}>Update your photo</span>
            </span>
          </button>
        </div>

        {/* COMMUNITY */}
        <h3 style={css.sectionLabel}>Sellers only</h3>
        <button
          type="button"
          onClick={() => router.push('/storekeeper/community')}
          style={css.communityCard}
          className="sk-community-card"
        >
          <span style={css.communityIcon}>
            <MdGroups size={22} color="#0504AA" />
            <span style={css.communityDot} />
          </span>
          <span style={css.communityText}>
            <span style={css.communityTitle}>Sellers community</span>
            <span style={css.communityHint}>
              {communityStats && communityStats.active_senders_7d > 0
                ? `${communityStats.active_senders_7d} seller${
                    communityStats.active_senders_7d === 1 ? '' : 's'
                  } active this week`
                : 'Chat with other sellers'}
            </span>
          </span>
          <MdChevronRight size={20} color="#CBD5E1" />
        </button>

        <div style={{ height: 32 }} />
      </div>

      {/* STORE IMAGE MODAL */}
      {showStoreImageModal && (
        <Modal onClose={closeStoreImageModal}>
          <h3 style={css.modalTitle}>Update store image</h3>
          <p style={css.modalSub}>
            This is the cover buyers see on your store page.
          </p>
          <div
            style={css.modalImagePreview}
            onClick={() => storeImageInputRef.current?.click()}
          >
            {storeImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeImageUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={css.modalImagePlaceholder}>
                <MdAddPhotoAlternate size={40} color="#94A3B8" />
                <span style={css.modalImagePlaceholderText}>
                  Tap to pick image
                </span>
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
          <div style={css.modalActions}>
            <button
              type="button"
              onClick={() => storeImageInputRef.current?.click()}
              style={css.secondaryBtn}
            >
              <MdPhotoLibrary size={18} color="#0504AA" />
              <span>Choose from gallery</span>
            </button>
            <button
              type="button"
              onClick={() => storeImageInputRef.current?.click()}
              style={css.secondaryBtn}
            >
              <MdCameraAlt size={18} color="#0504AA" />
              <span>Take a photo</span>
            </button>
          </div>
          <button
            onClick={uploadStoreImage}
            disabled={!storeImageFile || uploadingStoreImage}
            style={{
              ...css.primaryBtn,
              opacity: !storeImageFile || uploadingStoreImage ? 0.5 : 1,
              cursor:
                !storeImageFile || uploadingStoreImage
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {uploadingStoreImage ? 'Uploading…' : 'Save image'}
          </button>
        </Modal>
      )}

      {/* AVATAR MODAL */}
      {showAvatarModal && (
        <Modal onClose={closeAvatarModal}>
          <h3 style={css.modalTitle}>Update avatar</h3>
          <p style={css.modalSub}>
            A clear photo of yourself helps buyers trust your store.
          </p>
          <div
            style={css.modalAvatarPreview}
            onClick={() => avatarInputRef.current?.click()}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <MdCameraAlt size={40} color="#94A3B8" />
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
              style={css.secondaryBtn}
            >
              <MdPhotoLibrary size={18} color="#0504AA" />
              <span>Choose from gallery</span>
            </button>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              style={css.secondaryBtn}
            >
              <MdCameraAlt size={18} color="#0504AA" />
              <span>Take a photo</span>
            </button>
          </div>
          <button
            onClick={uploadAvatar}
            disabled={!avatarFile || uploadingAvatar}
            style={{
              ...css.primaryBtn,
              opacity: !avatarFile || uploadingAvatar ? 0.5 : 1,
              cursor:
                !avatarFile || uploadingAvatar
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {uploadingAvatar ? 'Uploading…' : 'Save avatar'}
          </button>
        </Modal>
      )}
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────
function PulseTile({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <div style={css.pulseTile} className="sk-pulse-tile">
      <div style={{ ...css.pulseIcon, backgroundColor: tint }}>{icon}</div>
      <div style={css.pulseValue}>{value}</div>
      <div style={css.pulseLabel}>{label}</div>
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div style={css.modalOverlay} onClick={onClose}>
      <div style={css.modalCard} onClick={(e) => e.stopPropagation()}>
        <button
          style={css.modalClose}
          onClick={onClose}
          aria-label="Close"
        >
          <MdClose size={20} color="#64748B" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Keyframes + interaction CSS ────────────────────────────────────
const CSS = `
  @keyframes skSpin { to { transform: rotate(360deg); } }
  @keyframes skShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes skPulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(1.45); }
  }
  @keyframes skSheetUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .sk-dash, .sk-dash *, .sk-dash *::before, .sk-dash *::after {
    box-sizing: border-box;
  }

  .sk-setup-row + .sk-setup-row {
    border-top: 1px solid #F1F5F9;
  }
  .sk-setup-row:hover { background-color: #FAFBFF; }

  .sk-action-tile {
    transition: transform 0.12s ease, box-shadow 0.15s ease;
  }
  .sk-action-tile:hover {
    box-shadow: 0 10px 24px rgba(5,4,170,0.10);
  }
  .sk-action-tile:active {
    transform: scale(0.98);
  }

  .sk-community-card:active {
    transform: scale(0.99);
  }

  .sk-pulse-tile {
    transition: transform 0.12s ease;
  }
  .sk-pulse-tile:active {
    transform: scale(0.97);
  }
`;

// ─── Styles ─────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F7F5F0',
    overflowX: 'hidden',
  },

  // HERO
  hero: {
    position: 'relative',
    backgroundColor: '#0504AA',
    backgroundImage:
      'radial-gradient(ellipse at 80% 0%, #1A0FB8 0%, #0504AA 55%, #03037A 100%)',
    padding: '0 20px 76px',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(61,59,255,0.45) 0%, rgba(61,59,255,0) 70%)',
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
    background: 'rgba(255,255,255,0.10)',
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

  identityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    paddingTop: 22,
  },
  storeThumb: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: 20,
    overflow: 'hidden',
    border: '3px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
  storeThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  storeThumbPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
    pointerEvents: 'none',
  },

  identityMeta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: -0.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  metaLine: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  metaDot: { color: 'rgba(255,255,255,0.4)' },

  // SHEET
  sheet: {
    flex: 1,
    marginTop: -52,
    padding: '0 20px 40px',
    position: 'relative',
    maxWidth: 720,
    margin: '-52px auto 0',
    width: '100%',
  },

  // REVENUE
  revenueCard: {
    backgroundColor: '#0504AA',
    backgroundImage:
      'linear-gradient(135deg, #0B0B1A 0%, #0504AA 100%)',
    borderRadius: 22,
    padding: '20px 22px 22px',
    color: '#fff',
    boxShadow: '0 20px 40px rgba(5,4,170,0.28)',
  },
  revenueTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  revenueLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  revenueLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  revenueLink: {
    background: 'rgba(255,255,255,0.10)',
    border: 'none',
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 10px 6px 12px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
  },
  revenueAmount: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: -1,
    fontVariantNumeric: 'tabular-nums',
    marginTop: 12,
    lineHeight: 1.05,
  },
  revenueSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: 500,
    marginTop: 6,
  },

  // PULSE
  pulseRow: {
    display: 'flex',
    gap: 10,
    marginTop: 16,
  },
  pulseTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  pulseIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseValue: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.4,
    fontVariantNumeric: 'tabular-nums',
    marginTop: 2,
  },
  pulseLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748B',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  // SECTIONS
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '26px 0 10px 4px',
  },

  // STORE SETUP
  setupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },
  setupRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '14px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  setupIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  setupText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  setupTitle: {
    fontSize: 14.5,
    fontWeight: 700,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  setupHint: {
    fontSize: 12,
    color: '#94A3B8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // QUICK ACTIONS
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  actionTile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 12,
    padding: '16px 16px 18px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    minHeight: 128,
    boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
  },
  actionTilePrimary: {
    backgroundColor: '#0504AA',
    backgroundImage:
      'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    border: 'none',
    boxShadow: '0 12px 28px rgba(5,4,170,0.28)',
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconWrapPrimary: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginTop: 'auto',
  },
  actionTextPrimary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginTop: 'auto',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.2,
  },
  actionTitlePrimary: {
    fontSize: 15,
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  actionHint: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: 500,
  },
  actionHintPrimary: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: 500,
  },

  // COMMUNITY
  communityCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '16px 16px',
    background:
      'linear-gradient(135deg, #FFFFFF 0%, #F8FAFF 100%)',
    border: '1px solid #DDE3F5',
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    boxShadow: '0 8px 22px rgba(5,4,170,0.06)',
  },
  communityIcon: {
    position: 'relative',
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 13,
    background: 'linear-gradient(135deg, #EEF0FF, #E0E7FF)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: '50%',
    backgroundColor: '#22C55E',
    border: '2px solid #FFFFFF',
    animation: 'skPulseDot 2s ease-in-out infinite',
  },
  communityText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  communityTitle: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: -0.1,
    color: '#0504AA',
  },
  communityHint: {
    fontSize: 12.5,
    color: '#64748B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // MODALS
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.48)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 200,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    padding: '24px 22px calc(28px + env(safe-area-inset-bottom))',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 520,
    position: 'relative',
    boxShadow: '0 -8px 40px rgba(5,4,170,0.2)',
    animation: 'skSheetUp 0.28s cubic-bezier(0.22,1,0.36,1)',
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    background: '#F1F5F9',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    margin: '0 0 4px',
    color: '#0B0B1A',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    margin: '0 0 20px',
    lineHeight: 1.5,
  },
  modalImagePreview: {
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: '#F4F5FB',
    margin: '0 auto 20px',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #EAECF3',
  },
  modalImagePlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    color: '#94A3B8',
  },
  modalImagePlaceholderText: {
    fontSize: 12.5,
    fontWeight: 600,
  },
  modalAvatarPreview: {
    width: 140,
    height: 140,
    borderRadius: '50%',
    backgroundColor: '#F4F5FB',
    margin: '0 auto 20px',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '3px solid #EEF0FF',
  },
  modalActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '13px 16px',
    borderRadius: 14,
    border: '1.5px solid #E6E8F0',
    background: '#FFFFFF',
    color: '#0504AA',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },
  primaryBtn: {
    width: '100%',
    padding: 16,
    backgroundColor: '#0504AA',
    backgroundImage:
      'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 10px 24px rgba(5,4,170,0.24)',
  },

  // SKELETONS
  thumbSkeleton: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexShrink: 0,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    width: 180,
  },
  revenueSkeleton: {
    height: 140,
    borderRadius: 22,
    backgroundColor: '#EAECF3',
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  pulseSkeleton: {
    height: 104,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    marginTop: 16,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  sectionSkeleton: {
    height: 160,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    marginTop: 20,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },

  // ERROR / EMPTY STATES
  errorRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#F7F5F0',
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
  setupHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7D2FE',
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
    maxWidth: 340,
    lineHeight: 1.55,
  },
  errorRetry: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: '13px 24px',
    borderRadius: 14,
    backgroundImage:
      'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
  },
};