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

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
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
    color: 'var(--text-tertiary)',
    soft: 'var(--bg-tertiary)',
  },
  pending: {
    label: 'Verification under review',
    hint: 'We received your submission',
    color: 'var(--warning-fg)',
    soft: 'var(--warning-bg)',
  },
  verified: {
    label: 'Store verified',
    hint: 'Buyers see the verified badge on your store',
    color: 'var(--success-fg)',
    soft: 'var(--success-bg)',
  },
  rejected: {
    label: 'Verification not approved',
    hint: 'Review the reason and resubmit',
    color: 'var(--danger-fg)',
    soft: 'var(--danger-bg)',
  },
  suspended: {
    label: 'Store suspended',
    hint: 'Contact support for details',
    color: 'var(--danger-fg)',
    soft: 'var(--danger-bg)',
  },
};

export default function StorekeeperDashboardPage() {
  useAuthGuard();
  const router = useRouter();

  const [store, setStore] = useState<Store | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<StoreStats>({});
  const [communityStats, setCommunityStats] =
    useState<CommunityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const [showStoreImageModal, setShowStoreImageModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const storeImageInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [storeImagePreview, setStoreImagePreview] = useState<
    string | null
  >(null);
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
      if (seq === reqSeq.current && isMountedRef.current)
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboardData]);

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

  const handleStoreImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoreImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setStoreImagePreview(reader.result as string);
    reader.readAsDataURL(file);
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
        body: extractErrorDetail(
          err,
          'Please try again in a moment.',
        ),
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
        body: extractErrorDetail(
          err,
          'Please try again in a moment.',
        ),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setUploadingAvatar(false);
    }
  };

  const storeImageUrl =
    storeImagePreview || resolveImageUrl(store?.store_image_url);
  const avatarUrl = avatarPreview || resolveImageUrl(profile?.avatar_url);
  const userName = profile?.nickname || profile?.username || 'Storekeeper';
  const verificationStatus = safeVerificationStatus(store);
  const verificationMeta = VERIFICATION_META[verificationStatus];
  const memberSince = fmtMemberSince(
    store?.created_at || profile?.created_at,
  );

  const views = stats.views ?? 0;
  const inquiries = stats.inquiries ?? 0;
  const sold = stats.sold ?? 0;
  const revenue = stats.revenue ?? 0;

  if (isLoading) {
    return (
      <main style={css.root} className="sk-dash">
        <style>{CSS}</style>
        <div style={css.hero}>
          <div className="sk-hero-inner">
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
        </div>
        <div style={css.sheet} className="sk-sheet">
          <div style={css.revenueSkeleton} />
          <div style={css.pulseSkeleton} />
          {[0, 1].map((i) => (
            <div key={i} style={css.sectionSkeleton} />
          ))}
        </div>
      </main>
    );
  }

  if (errored) {
    return (
      <main style={css.errorRoot} className="sk-dash">
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="var(--danger-fg)" />
        </div>
        <h2 style={css.errorHeading}>
          Couldn&apos;t load your dashboard
        </h2>
        <p style={css.errorBody}>
          Check your connection and try again. If this keeps happening,
          sign out and back in.
        </p>
        <button
          onClick={() => void loadDashboardData()}
          style={css.errorRetry}
        >
          <MdRefresh size={18} color="var(--brand-on-gradient)" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  if (!store) {
    return (
      <main style={css.errorRoot} className="sk-dash">
        <style>{CSS}</style>
        <div style={css.setupHalo}>
          <MdStorefront size={40} color="var(--brand-primary)" />
        </div>
        <h2 style={css.errorHeading}>Set up your store</h2>
        <p style={css.errorBody}>
          You don&apos;t have a store yet. Create one to start selling
          on Admerce — it takes about two minutes.
        </p>
        <button
          onClick={() => router.push('/storekeeper/onboarding')}
          style={css.errorRetry}
        >
          <span>Create my store</span>
          <MdChevronRight size={18} color="var(--brand-on-gradient)" />
        </button>
      </main>
    );
  }

  return (
    <main style={css.root} className="sk-dash">
      <style>{CSS}</style>

      <div style={css.hero} className="sk-hero">
        <div style={css.heroGlow} aria-hidden />

        <div className="sk-hero-inner">
          <div style={css.topBar}>
            <span style={css.topTitle}>Dashboard</span>
            <button
              onClick={() => void loadDashboardData()}
              style={css.ghostBtn}
              aria-label="Refresh"
            >
              <MdRefresh size={20} color="var(--brand-on-gradient)" />
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
                <img
                  src={storeImageUrl}
                  alt=""
                  style={css.storeThumbImg}
                />
              ) : (
                <div style={css.storeThumbPlaceholder}>
                  <MdStorefront
                    size={30}
                    color="color-mix(in srgb, var(--brand-on-gradient) 85%, transparent)"
                  />
                </div>
              )}
              <span style={css.cameraBadge} aria-hidden>
                <MdCameraAlt size={11} color="var(--brand-primary)" />
              </span>
            </button>

            <div style={css.identityMeta}>
              <div style={css.nameRow}>
                <span style={css.storeName}>
                  {store.name || 'Your Store'}
                </span>
                {verificationStatus === 'verified' && (
                  <MdVerified
                    size={18}
                    color="var(--info-fg)"
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
      </div>

      <div style={css.sheet} className="sk-sheet">
        <div style={css.revenueCard} className="sk-revenue-card">
          <div style={css.revenueTop}>
            <div style={css.revenueLabelRow}>
              <MdAccountBalanceWallet
                size={14}
                color="color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)"
              />
              <span style={css.revenueLabel}>Total revenue</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/storekeeper/wallet')}
              style={css.revenueLink}
            >
              <span>Wallet</span>
              <MdChevronRight
                size={16}
                color="color-mix(in srgb, var(--brand-on-gradient) 85%, transparent)"
              />
            </button>
          </div>
          <div style={css.revenueAmount} className="sk-revenue-amount">
            {formatNaira(revenue)}
          </div>
          <div style={css.revenueSub}>
            {sold > 0
              ? `Across ${sold} completed sale${sold === 1 ? '' : 's'}`
              : 'Complete your first sale to see it grow'}
          </div>
        </div>

        <div style={css.pulseRow} className="sk-pulse-row">
          <PulseTile
            icon={<MdVisibility size={18} color="var(--brand-primary)" />}
            tint="var(--brand-soft)"
            label="Views"
            value={formatNumber(views)}
          />
          <PulseTile
            icon={<MdChat size={18} color="var(--info-fg)" />}
            tint="var(--info-bg)"
            label="Inquiries"
            value={formatNumber(inquiries)}
          />
          <PulseTile
            icon={<MdShoppingBag size={18} color="var(--success-fg)" />}
            tint="var(--success-bg)"
            label="Sold"
            value={formatNumber(sold)}
          />
        </div>

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
                <MdHourglassEmpty
                  size={18}
                  color={verificationMeta.color}
                />
              )}
              {(verificationStatus === 'rejected' ||
                verificationStatus === 'suspended') && (
                <MdErrorOutline
                  size={18}
                  color={verificationMeta.color}
                />
              )}
              {verificationStatus === 'unverified' && (
                <MdInfoOutline
                  size={18}
                  color={verificationMeta.color}
                />
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
            <MdChevronRight size={18} color="var(--border-strong)" />
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
                backgroundColor: storeImageUrl
                  ? 'var(--success-bg)'
                  : 'var(--warning-bg)',
              }}
            >
              {storeImageUrl ? (
                <MdImage size={18} color="var(--success-fg)" />
              ) : (
                <MdAddPhotoAlternate
                  size={18}
                  color="var(--warning-fg)"
                />
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
            <MdChevronRight size={18} color="var(--border-strong)" />
          </button>
        </div>

        <h3 style={css.sectionLabel}>Quick actions</h3>
        <div style={css.actionGrid} className="sk-action-grid">
          <button
            type="button"
            onClick={() => router.push('/storekeeper/add-item')}
            style={{ ...css.actionTile, ...css.actionTilePrimary }}
            className="sk-action-tile"
          >
            <span style={css.actionIconWrapPrimary}>
              <MdAdd size={22} color="var(--brand-primary)" />
            </span>
            <span style={css.actionTextPrimary}>
              <span style={css.actionTitlePrimary}>Add item</span>
              <span style={css.actionHintPrimary}>
                List a new product
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/storekeeper/arrange-store?store_id=${
                  store?.store_id || ''
                }`,
              )
            }
            style={css.actionTile}
            className="sk-action-tile"
          >
            <span
              style={{
                ...css.actionIconWrap,
                backgroundColor: 'var(--brand-soft)',
              }}
            >
              <MdGridView size={22} color="var(--brand-primary)" />
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
                backgroundColor: 'var(--purple-bg)',
              }}
            >
              <MdAutoAwesome size={22} color="var(--purple-fg)" />
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
                backgroundColor: 'var(--info-bg)',
              }}
            >
              <MdCameraAlt size={22} color="var(--info-fg)" />
            </span>
            <span style={css.actionText}>
              <span style={css.actionTitle}>Avatar</span>
              <span style={css.actionHint}>Update your photo</span>
            </span>
          </button>
        </div>

        <h3 style={css.sectionLabel}>Sellers only</h3>
        <button
          type="button"
          onClick={() => router.push('/storekeeper/community')}
          style={css.communityCard}
          className="sk-community-card"
        >
          <span style={css.communityIcon}>
            <MdGroups size={22} color="var(--brand-primary)" />
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
          <MdChevronRight size={20} color="var(--border-strong)" />
        </button>

        <div style={{ height: 32 }} />
      </div>

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
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={css.modalImagePlaceholder}>
                <MdAddPhotoAlternate
                  size={40}
                  color="var(--text-muted)"
                />
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
              <MdPhotoLibrary size={18} color="var(--brand-primary)" />
              <span>Choose from gallery</span>
            </button>
            <button
              type="button"
              onClick={() => storeImageInputRef.current?.click()}
              style={css.secondaryBtn}
            >
              <MdCameraAlt size={18} color="var(--brand-primary)" />
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
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <MdCameraAlt size={40} color="var(--text-muted)" />
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
              <MdPhotoLibrary size={18} color="var(--brand-primary)" />
              <span>Choose from gallery</span>
            </button>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              style={css.secondaryBtn}
            >
              <MdCameraAlt size={18} color="var(--brand-primary)" />
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
      <div style={{ ...css.pulseIcon, backgroundColor: tint }}>
        {icon}
      </div>
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
    <div style={css.modalOverlay} className="sk-modal-overlay" onClick={onClose}>
      <div
        style={css.modalCard}
        className="sk-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          style={css.modalClose}
          onClick={onClose}
          aria-label="Close"
        >
          <MdClose size={20} color="var(--text-tertiary)" />
        </button>
        {children}
      </div>
    </div>
  );
}

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

  .sk-hero-inner {
    position: relative;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
  }
  .sk-sheet {
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
  }

  .sk-setup-row + .sk-setup-row {
    border-top: 1px solid var(--border-subtle);
  }
  .sk-setup-row:hover { background-color: var(--bg-hover); }

  .sk-action-tile {
    transition: transform 0.12s ease, box-shadow 0.15s ease;
  }
  .sk-action-tile:hover {
    box-shadow: 0 10px 24px
      color-mix(in srgb, var(--brand-primary) 10%, transparent);
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

  @media (min-width: 1024px) {
    .sk-hero-inner {
      max-width: 960px;
      padding-left: 32px;
      padding-right: 32px;
    }
    .sk-sheet {
      max-width: 960px;
      padding-left: 32px;
      padding-right: 32px;
    }
    .sk-revenue-amount {
      font-size: 52px !important;
      letter-spacing: -1.5px !important;
    }
    .sk-revenue-card {
      padding: 28px 30px 30px !important;
    }
    .sk-action-grid {
      grid-template-columns: repeat(4, 1fr) !important;
    }
    .sk-pulse-row {
      gap: 14px !important;
    }
    .sk-pulse-tile {
      padding: 18px 16px !important;
    }
    .sk-community-card {
      padding: 20px 22px !important;
    }
    .sk-modal-overlay {
      align-items: center !important;
      padding: 24px;
    }
    .sk-modal-card {
      border-radius: 24px !important;
      max-height: 80vh;
      overflow-y: auto;
    }
  }
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

  hero: {
    position: 'relative',
    background: 'var(--brand-gradient)',
    padding: '0 20px 76px',
    overflow: 'hidden',
    transition: 'background 0.18s ease',
  },
  heroGlow: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, color-mix(in srgb, var(--brand-on-gradient) 20%, transparent) 0%, transparent 70%)',
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
    color: 'var(--brand-on-gradient)',
    letterSpacing: 0.3,
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
    border:
      '3px solid color-mix(in srgb, var(--brand-on-gradient) 18%, transparent)',
    background:
      'color-mix(in srgb, var(--brand-on-gradient) 8%, transparent)',
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
    backgroundColor: 'var(--bg-secondary)',
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
    color: 'var(--brand-on-gradient)',
    letterSpacing: -0.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  metaLine: {
    fontSize: 12.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  metaDot: {
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 40%, transparent)',
  },

  sheet: {
    flex: 1,
    marginTop: -52,
    position: 'relative',
    padding: '0 20px 40px',
  },

  revenueCard: {
    background: 'var(--brand-gradient)',
    borderRadius: 22,
    padding: '20px 22px 22px',
    color: 'var(--brand-on-gradient)',
    boxShadow: 'var(--shadow-brand)',
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
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 75%, transparent)',
  },
  revenueLink: {
    background:
      'color-mix(in srgb, var(--brand-on-gradient) 10%, transparent)',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--brand-on-gradient)',
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
    color: 'var(--brand-on-gradient)',
  },
  revenueSub: {
    fontSize: 12.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 72%, transparent)',
    fontWeight: 500,
    marginTop: 6,
  },

  pulseRow: {
    display: 'flex',
    gap: 10,
    marginTop: 16,
  },
  pulseTile: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 18,
    border: '1px solid var(--border-default)',
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
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
    color: 'var(--text-primary)',
    letterSpacing: -0.4,
    fontVariantNumeric: 'tabular-nums',
    marginTop: 2,
  },
  pulseLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-tertiary)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: 'var(--text-tertiary)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '26px 0 10px 4px',
  },

  setupCard: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 18,
    border: '1px solid var(--border-default)',
    overflow: 'hidden',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
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
    color: 'var(--text-primary)',
    letterSpacing: -0.1,
  },
  setupHint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

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
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    minHeight: 128,
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  actionTilePrimary: {
    background: 'var(--brand-gradient)',
    border: 'none',
    boxShadow: 'var(--shadow-brand)',
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
    backgroundColor: 'var(--bg-secondary)',
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
    color: 'var(--text-primary)',
    letterSpacing: -0.2,
  },
  actionTitlePrimary: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    letterSpacing: -0.2,
  },
  actionHint: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  actionHintPrimary: {
    fontSize: 11.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 78%, transparent)',
    fontWeight: 500,
  },

  communityCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '16px 16px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  communityIcon: {
    position: 'relative',
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 13,
    background: 'var(--brand-soft)',
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
    border: '2px solid var(--bg-secondary)',
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
    color: 'var(--brand-primary)',
  },
  communityHint: {
    fontSize: 12.5,
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--overlay)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 200,
  },
  modalCard: {
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    padding: '24px 22px calc(28px + env(safe-area-inset-bottom))',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 520,
    position: 'relative',
    boxShadow: 'var(--shadow-lg)',
    animation: 'skSheetUp 0.28s cubic-bezier(0.22,1,0.36,1)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    background: 'var(--bg-tertiary)',
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
    color: 'var(--text-primary)',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    margin: '0 0 20px',
    lineHeight: 1.5,
  },
  modalImagePreview: {
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: 'var(--bg-tertiary)',
    margin: '0 auto 20px',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid var(--border-default)',
  },
  modalImagePlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-muted)',
  },
  modalImagePlaceholderText: {
    fontSize: 12.5,
    fontWeight: 600,
  },
  modalAvatarPreview: {
    width: 140,
    height: 140,
    borderRadius: '50%',
    backgroundColor: 'var(--bg-tertiary)',
    margin: '0 auto 20px',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '3px solid var(--brand-soft)',
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
    border: '1.5px solid var(--border-default)',
    background: 'var(--bg-secondary)',
    color: 'var(--brand-primary)',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },
  primaryBtn: {
    width: '100%',
    padding: 16,
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },

  thumbSkeleton: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 18%, transparent)',
    flexShrink: 0,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 22%, transparent)',
    width: 180,
  },
  revenueSkeleton: {
    height: 140,
    borderRadius: 22,
    backgroundColor: 'var(--bg-tertiary)',
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  pulseSkeleton: {
    height: 104,
    borderRadius: 18,
    backgroundColor: 'var(--bg-tertiary)',
    marginTop: 16,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  sectionSkeleton: {
    height: 160,
    borderRadius: 18,
    backgroundColor: 'var(--bg-tertiary)',
    marginTop: 20,
    animation: 'skShimmer 1.4s ease-in-out infinite',
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
    transition: 'background-color 0.18s ease, color 0.18s ease',
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
  setupHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'var(--brand-soft)',
    border: '1px solid var(--brand-primary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
};