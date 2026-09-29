'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { alertDialog, confirmDialog } from '../../../components/ui/dialogs';
import {
  MdRefresh,
  MdAutoAwesome,
  MdEdit,
  MdCheckCircle,
  MdAdd,
  MdStorefront,
  MdCalendarToday,
  MdToday,
  MdWallet,
  MdStar,
  MdAccountBalanceWallet,
  MdDesignServices,
  MdToggleOn,
  MdToggleOff,
  MdGroups,
  MdChevronRight,
  MdErrorOutline,
  MdImage,
  MdSearch,
  MdReceiptLong,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface ServiceItem {
  service_id: string;
  title?: string;
  description?: string;
  price?: number;
  duration_minutes?: number;
  is_active?: boolean | number;
  image_url?: string;
  video_url?: string;
  [key: string]: unknown;
}

interface Booking {
  id?: string;
  booking_id?: string;
  service_title?: string;
  user_name?: string;
  customer_name?: string;
  booking_date?: string;
  scheduled_for?: string;
  amount?: number;
  status?: string;
  [key: string]: unknown;
}

interface Stats {
  today_bookings?: number;
  total_earnings?: number;
  rating?: number;
  [key: string]: unknown;
}

interface Profile {
  business_name?: string;
  nickname?: string;
  username?: string;
  avatar_url?: string;
  business_image_url?: string;
  is_available?: boolean;
  [key: string]: unknown;
}

interface CommunityStats {
  room: string;
  total_messages: number;
  active_senders_7d: number;
}

interface CommunityStatsApi {
  communityGetStats?: (room: string) => Promise<CommunityStats | null>;
}

// ─── Helpers ────────────────────────────────────────────────────────
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

function formatNaira(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '₦0';
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `₦${(v / 1_000).toFixed(1)}k`;
  return `₦${Math.round(v).toLocaleString('en-NG')}`;
}

function isServiceActive(s: ServiceItem): boolean {
  return typeof s.is_active === 'boolean' ? s.is_active : s.is_active === 1;
}

function bookingId(b: Booking): string {
  return String(b.booking_id ?? b.id ?? '');
}

function isActiveBooking(b: Booking): boolean {
  const s = (b.status || '').toLowerCase();
  return s === 'pending' || s === 'locked' || s === 'accepted';
}

function bookingStatusMeta(status: string): {
  label: string;
  bg: string;
  fg: string;
} {
  const s = (status || 'pending').toLowerCase();
  if (s === 'locked' || s === 'pending') {
    return { label: 'New', bg: '#FEF3C7', fg: '#92400E' };
  }
  if (s === 'accepted') {
    return { label: 'Confirmed', bg: '#E0F2FE', fg: '#075985' };
  }
  if (s === 'completed') {
    return { label: 'Completed', bg: '#DCFCE7', fg: '#166534' };
  }
  if (s === 'cancelled' || s === 'declined') {
    return { label: 'Cancelled', bg: '#FEE2E2', fg: '#991B1B' };
  }
  return { label: status || 'Pending', bg: '#F1F5F9', fg: '#475569' };
}

// ─── Component ──────────────────────────────────────────────────────
export default function ServiceProviderDashboardPage() {
  useAuthGuard();
  const router = useRouter();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(
    null,
  );
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

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
      const [
        servicesData,
        bookingsData,
        statsData,
        profileData,
        communityData,
      ] = await Promise.all([
        api.getProviderServices() as Promise<ServiceItem[]>,
        api.getProviderBookings() as Promise<Booking[]>,
        api.getProviderStats() as Promise<Stats>,
        api.getMyProfile().catch(() => ({
          nickname: 'Service Provider',
          username: 'Provider',
          avatar_url: null,
        })) as Promise<Profile>,
        communityApi.communityGetStats?.('global').catch(() => null) ??
          Promise.resolve(null),
      ]);
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setServices(Array.isArray(servicesData) ? servicesData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setStats(statsData || {});
      setProfile(profileData);
      setCommunityStats(communityData as CommunityStats | null);
      if (typeof profileData?.is_available === 'boolean') {
        setIsAvailable(profileData.is_available);
      }
    } catch {
      if (seq === reqSeq.current && isMountedRef.current) setErrored(true);
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadDashboardData(), 0);
    return () => window.clearTimeout(t);
  }, [loadDashboardData]);

  // ── Actions ────────────────────────────────────────────────────
  const toggleAvailability = async (value: boolean) => {
    if (togglingAvailability) return;
    setTogglingAvailability(true);
    const previous = isAvailable;
    setIsAvailable(value); // optimistic
    try {
      await api.updateProviderAvailability(value);
    } catch (err) {
      if (isMountedRef.current) setIsAvailable(previous);
      await alertDialog({
        title: "Couldn't update availability",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setTogglingAvailability(false);
    }
  };

  const handleConfirmBooking = async (b: Booking) => {
    const id = bookingId(b);
    if (!id) return;
    const customer = b.customer_name || b.user_name || 'this customer';
    const ok = await confirmDialog({
      title: 'Confirm this booking?',
      body: `${b.service_title || 'The service'} for ${customer}. Once confirmed, they'll be notified to expect you.`,
      kind: 'info',
      confirmLabel: 'Confirm booking',
      cancelLabel: 'Not yet',
    });
    if (!ok) return;
    setBusyBookingId(id);
    try {
      await api.confirmBooking(id);
      await loadDashboardData(false);
    } catch (err) {
      await alertDialog({
        title: "Couldn't confirm booking",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyBookingId(null);
    }
  };

  const handleCompleteBooking = async (b: Booking) => {
    const id = bookingId(b);
    if (!id) return;
    const customer = b.customer_name || b.user_name || 'this customer';
    const ok = await confirmDialog({
      title: 'Mark as complete?',
      body: `Confirm that you've finished ${b.service_title || 'this job'} for ${customer}. Payment will be released to your wallet.`,
      kind: 'info',
      confirmLabel: 'Complete & release',
      cancelLabel: 'Not yet',
    });
    if (!ok) return;
    setBusyBookingId(id);
    try {
      await api.completeBooking(id);
      await loadDashboardData(false);
    } catch (err) {
      await alertDialog({
        title: "Couldn't complete booking",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyBookingId(null);
    }
  };

  const goAddService = () => router.push('/service-provider/add-service');
  const goServices = () => router.push('/service-provider/services');
  const goBookings = () => router.push('/service-provider/bookings');
  const goEditProfile = () => router.push('/service-provider/edit-profile');
  const goSeai = () => router.push('/seai/ask?mode=agent');
  const goCommunity = () => router.push('/service-provider/community');
  const goSettings = () => router.push('/settings/service-provider');

  // ── Derived ────────────────────────────────────────────────────
  const name =
    profile?.business_name ||
    profile?.nickname ||
    profile?.username ||
    'Service Provider';
  const businessImageUrl =
    resolveImageUrl(profile?.business_image_url) ||
    resolveImageUrl(profile?.avatar_url);
  const initial = (name.charAt(0) || '?').toUpperCase();

  const servicesActiveCount = services.filter(isServiceActive).length;
  const pendingBookings = bookings.filter(isActiveBooking);
  const todayBookings = Number(stats.today_bookings ?? 0);
  const totalEarnings = Number(stats.total_earnings ?? 0);
  const rating = Number(stats.rating ?? 0);

  // ── Loading skeleton ───────────────────────────────────────────
  if (isLoading) {
    return (
      <main style={css.root} className="sp-dash">
        <style>{CSS}</style>
        <div style={css.hero}>
          <div className="sp-hero-inner">
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
        <div style={css.sheet} className="sp-sheet">
          <div style={css.blockSkeleton} />
          <div style={css.blockSkeleton} />
          {[0, 1].map((i) => (
            <div key={i} style={css.blockSkeleton} />
          ))}
        </div>
      </main>
    );
  }

  // ── Error ──────────────────────────────────────────────────────
  if (errored) {
    return (
      <main style={css.centerRoot} className="sp-dash">
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="#B91C1C" />
        </div>
        <h2 style={css.centerTitle}>Couldn&apos;t load your dashboard</h2>
        <p style={css.centerBody}>
          Check your connection and try again. If this keeps happening, sign
          out and back in.
        </p>
        <button
          onClick={() => void loadDashboardData()}
          style={css.centerPrimary}
        >
          <MdRefresh size={18} color="#fff" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  // ── Main ───────────────────────────────────────────────────────
  return (
    <main style={css.root} className="sp-dash">
      <style>{CSS}</style>

      {/* HERO */}
      <div style={css.hero}>
        <div style={css.heroGlow} aria-hidden />

        <div className="sp-hero-inner">
          <div style={css.topBar}>
            <span style={css.topTitle}>Dashboard</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={goSettings}
                style={css.ghostBtn}
                aria-label="Settings"
              >
                <MdEdit size={18} color="#fff" />
              </button>
              <button
                type="button"
                onClick={() => void loadDashboardData()}
                style={css.ghostBtn}
                aria-label="Refresh"
              >
                <MdRefresh size={18} color="#fff" />
              </button>
            </div>
          </div>

          <div style={css.identityRow}>
            <button
              type="button"
              onClick={goEditProfile}
              style={css.bizThumb}
              aria-label="Edit business profile"
            >
              {businessImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={businessImageUrl}
                  alt=""
                  style={css.bizThumbImg}
                />
              ) : (
                <div style={css.bizThumbPlaceholder}>
                  <span style={css.bizThumbInitial}>{initial}</span>
                </div>
              )}
            </button>

            <div style={css.identityMeta}>
              <div style={css.nameRow}>
                <span style={css.businessName}>{name}</span>
              </div>
              <div style={css.metaLine}>
                <span
                  style={{
                    ...css.availabilityPill,
                    backgroundColor: isAvailable
                      ? 'rgba(34,197,94,0.22)'
                      : 'rgba(148,163,184,0.22)',
                    color: isAvailable ? '#86EFAC' : '#CBD5E1',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: isAvailable ? '#22C55E' : '#94A3B8',
                      display: 'inline-block',
                    }}
                  />
                  {isAvailable ? 'Available' : 'Paused'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SHEET */}
      <div style={css.sheet} className="sp-sheet">
        {/* REVENUE SPOTLIGHT */}
        <div style={css.revenueCard} className="sp-revenue-card">
          <div style={css.revenueTop}>
            <div style={css.revenueLabelRow}>
              <MdAccountBalanceWallet
                size={14}
                color="rgba(255,255,255,0.72)"
              />
              <span style={css.revenueLabel}>Total earnings</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/service-provider/wallet')}
              style={css.revenueLink}
            >
              <span>Wallet</span>
              <MdChevronRight size={16} color="rgba(255,255,255,0.85)" />
            </button>
          </div>
          <div style={css.revenueAmount} className="sp-revenue-amount">
            {formatNaira(totalEarnings)}
          </div>
          <div style={css.revenueSub}>
            {rating > 0
              ? `★ ${rating.toFixed(1)} avg rating across completed jobs`
              : 'Complete your first job to build your rating'}
          </div>
        </div>

        {/* AVAILABILITY — hero control */}
        <button
          type="button"
          onClick={() => toggleAvailability(!isAvailable)}
          disabled={togglingAvailability}
          style={{
            ...css.availabilityCard,
            borderColor: isAvailable ? '#86EFAC' : '#E6E8F0',
            backgroundColor: isAvailable ? '#F0FDF4' : '#FFFFFF',
            opacity: togglingAvailability ? 0.6 : 1,
          }}
          className="sp-availability-card"
        >
          <span
            style={{
              ...css.availabilityIcon,
              backgroundColor: isAvailable ? '#DCFCE7' : '#F1F5F9',
            }}
          >
            {isAvailable ? (
              <MdToggleOn size={26} color="#16A34A" />
            ) : (
              <MdToggleOff size={26} color="#64748B" />
            )}
          </span>
          <span style={css.availabilityText}>
            <span
              style={{
                ...css.availabilityTitle,
                color: isAvailable ? '#166534' : '#0B0B1A',
              }}
            >
              {isAvailable ? 'Available now' : 'Paused'}
            </span>
            <span style={css.availabilityHint}>
              {isAvailable
                ? 'Buyers can book your services'
                : 'No new bookings will be accepted'}
            </span>
          </span>
          <span
            style={{
              ...css.miniSwitch,
              backgroundColor: isAvailable ? '#16A34A' : '#CBD5E1',
            }}
            aria-hidden
          >
            <span
              style={{
                ...css.miniSwitchKnob,
                left: isAvailable ? 20 : 3,
              }}
            />
          </span>
        </button>

        {/* PULSE ROW */}
        <div style={css.pulseRow} className="sp-pulse-row">
          <PulseTile
            icon={<MdToday size={18} color="#0504AA" />}
            tint="#EEF0FF"
            label="Today"
            value={String(todayBookings)}
          />
          <PulseTile
            icon={<MdStar size={18} color="#D97706" />}
            tint="#FEF3C7"
            label="Rating"
            value={rating > 0 ? rating.toFixed(1) : '—'}
          />
          <PulseTile
            icon={<MdDesignServices size={18} color="#7E22CE" />}
            tint="#F3E8FF"
            label="Services"
            value={`${servicesActiveCount}/${services.length}`}
          />
        </div>

        {/* PENDING BOOKINGS */}
        {pendingBookings.length > 0 && (
          <>
            <h3 style={css.sectionLabel}>
              Needs your attention · {pendingBookings.length}
            </h3>
            <div style={css.section}>
              {pendingBookings.slice(0, 3).map((b) => {
                const id = bookingId(b);
                const busy = busyBookingId === id;
                const status = (b.status || 'pending').toLowerCase();
                const meta = bookingStatusMeta(status);
                const isPending = status === 'locked' || status === 'pending';
                const isAccepted = status === 'accepted';
                const customer =
                  b.customer_name || b.user_name || 'Customer';
                const when =
                  b.scheduled_for || b.booking_date || 'Date not set';

                return (
                  <div
                    key={id}
                    style={{ ...css.bookingRow, opacity: busy ? 0.55 : 1 }}
                  >
                    <span style={css.bookingAvatar}>
                      {(customer.charAt(0) || '?').toUpperCase()}
                    </span>
                    <div style={css.bookingBody}>
                      <div style={css.bookingService} title={b.service_title}>
                        {b.service_title || 'Service'}
                      </div>
                      <div style={css.bookingMeta}>
                        <span>{customer}</span>
                        <span style={css.bookingDot}>·</span>
                        <span style={css.bookingDate}>{String(when)}</span>
                      </div>
                      <div style={css.bookingStatusRow}>
                        <span
                          style={{
                            ...css.bookingChip,
                            backgroundColor: meta.bg,
                            color: meta.fg,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <div style={css.bookingActions}>
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleConfirmBooking(b)}
                          disabled={busy}
                          style={{
                            ...css.bookingPrimary,
                            opacity: busy ? 0.6 : 1,
                          }}
                          className="sp-booking-btn"
                        >
                          Confirm
                        </button>
                      )}
                      {isAccepted && (
                        <button
                          type="button"
                          onClick={() => handleCompleteBooking(b)}
                          disabled={busy}
                          style={{
                            ...css.bookingSuccess,
                            opacity: busy ? 0.6 : 1,
                          }}
                          className="sp-booking-btn"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {pendingBookings.length > 3 && (
                <button
                  type="button"
                  onClick={goBookings}
                  style={css.viewAllRow}
                  className="sp-row"
                >
                  <span style={css.viewAllText}>
                    View all {pendingBookings.length} pending bookings
                  </span>
                  <MdChevronRight size={18} color="#CBD5E1" />
                </button>
              )}
            </div>
          </>
        )}

        {/* QUICK ACTIONS */}
        <h3 style={css.sectionLabel}>Quick actions</h3>
        <div style={css.actionGrid} className="sp-action-grid">
          <button
            type="button"
            onClick={goAddService}
            style={{ ...css.actionTile, ...css.actionTilePrimary }}
            className="sp-action-tile"
          >
            <span style={css.actionIconWrapPrimary}>
              <MdAdd size={22} color="#0504AA" />
            </span>
            <span style={css.actionTextPrimary}>
              <span style={css.actionTitlePrimary}>Add service</span>
              <span style={css.actionHintPrimary}>List a new offering</span>
            </span>
          </button>

          <button
            type="button"
            onClick={goServices}
            style={css.actionTile}
            className="sp-action-tile"
          >
            <span
              style={{
                ...css.actionIconWrap,
                backgroundColor: '#F3E8FF',
              }}
            >
              <MdDesignServices size={22} color="#7E22CE" />
            </span>
            <span style={css.actionText}>
              <span style={css.actionTitle}>My services</span>
              <span style={css.actionHint}>
                {services.length} listing{services.length === 1 ? '' : 's'}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={goBookings}
            style={css.actionTile}
            className="sp-action-tile"
          >
            <span
              style={{
                ...css.actionIconWrap,
                backgroundColor: '#E0F2FE',
              }}
            >
              <MdCalendarToday size={22} color="#0891B2" />
            </span>
            <span style={css.actionText}>
              <span style={css.actionTitle}>Bookings</span>
              <span style={css.actionHint}>
                {bookings.length} total
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={goSeai}
            style={css.actionTile}
            className="sp-action-tile"
          >
            <span
              style={{
                ...css.actionIconWrap,
                backgroundColor: '#FEF3C7',
              }}
            >
              <MdAutoAwesome size={22} color="#D97706" />
            </span>
            <span style={css.actionText}>
              <span style={css.actionTitle}>Ask SEAI</span>
              <span style={css.actionHint}>AI assistant</span>
            </span>
          </button>
        </div>

        {/* COMMUNITY */}
        <h3 style={css.sectionLabel}>Sellers only</h3>
        <button
          type="button"
          onClick={goCommunity}
          style={css.communityCard}
          className="sp-community-card"
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
    <div style={css.pulseTile} className="sp-pulse-tile">
      <div style={{ ...css.pulseIcon, backgroundColor: tint }}>{icon}</div>
      <div style={css.pulseValue}>{value}</div>
      <div style={css.pulseLabel}>{label}</div>
    </div>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────
const CSS = `
  @keyframes spShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes spPulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(1.45); }
  }

  .sp-dash, .sp-dash *, .sp-dash *::before, .sp-dash *::after {
    box-sizing: border-box;
  }

  .sp-hero-inner {
    position: relative;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
  }
  .sp-sheet {
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
  }

  .sp-availability-card {
    transition: background-color 0.15s, border-color 0.15s, transform 0.12s;
  }
  .sp-availability-card:active:not(:disabled) { transform: scale(0.995); }

  .sp-action-tile {
    transition: transform 0.12s ease, box-shadow 0.15s ease;
  }
  .sp-action-tile:hover {
    box-shadow: 0 10px 24px rgba(5,4,170,0.10);
  }
  .sp-action-tile:active { transform: scale(0.98); }

  .sp-community-card:active { transform: scale(0.99); }

  .sp-pulse-tile {
    transition: transform 0.12s ease;
  }
  .sp-pulse-tile:active { transform: scale(0.97); }

  .sp-booking-btn {
    transition: transform 0.12s ease, opacity 0.15s;
  }
  .sp-booking-btn:active:not(:disabled) { transform: scale(0.97); }

  .sp-row:hover { background-color: #FAFBFF; }

  @media (min-width: 1024px) {
    .sp-hero-inner {
      max-width: 960px;
      padding-left: 32px;
      padding-right: 32px;
    }
    .sp-sheet {
      max-width: 960px;
      padding-left: 32px;
      padding-right: 32px;
    }
    .sp-revenue-amount {
      font-size: 52px !important;
      letter-spacing: -1.5px !important;
    }
    .sp-revenue-card {
      padding: 28px 30px 30px !important;
    }
    .sp-action-grid {
      grid-template-columns: repeat(4, 1fr) !important;
    }
    .sp-pulse-row {
      gap: 14px !important;
    }
    .sp-pulse-tile {
      padding: 18px 16px !important;
    }
    .sp-community-card {
      padding: 20px 22px !important;
    }
  }
`;

// ─── Styles ─────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
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
  bizThumb: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 22,
    overflow: 'hidden',
    border: '3px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
  bizThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  bizThumbPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'linear-gradient(135deg, rgba(61,59,255,0.6) 0%, rgba(5,4,170,0.6) 100%)',
  },
  bizThumbInitial: {
    fontSize: 30,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: -0.5,
  },

  identityMeta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  businessName: {
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
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  availabilityPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // SHEET
  sheet: {
    flex: 1,
    marginTop: -52,
    position: 'relative',
    padding: '0 20px 40px',
  },

  // REVENUE
  revenueCard: {
    backgroundColor: '#0504AA',
    backgroundImage: 'linear-gradient(135deg, #0B0B1A 0%, #0504AA 100%)',
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

  // AVAILABILITY
  availabilityCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 16,
    padding: '14px 16px',
    borderRadius: 18,
    border: '1.5px solid',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background-color 0.15s, border-color 0.15s',
  },
  availabilityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  availabilityText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  availabilityTitle: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: -0.2,
  },
  availabilityHint: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  miniSwitch: {
    position: 'relative',
    width: 44,
    height: 24,
    borderRadius: 999,
    flexShrink: 0,
    transition: 'background-color 0.18s',
  },
  miniSwitchKnob: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'left 0.18s',
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

  // SECTION LABEL
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '26px 0 10px 4px',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },

  // BOOKING ROW
  bookingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderBottom: '1px solid #F1F5F9',
  },
  bookingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    fontSize: 16,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bookingBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  bookingService: {
    fontSize: 14.5,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bookingMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#64748B',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bookingDot: { color: '#CBD5E1' },
  bookingDate: { color: '#94A3B8' },
  bookingStatusRow: { marginTop: 4 },
  bookingChip: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
    padding: '3px 8px',
    borderRadius: 999,
    textTransform: 'uppercase',
  },
  bookingActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  bookingPrimary: {
    padding: '9px 16px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  bookingSuccess: {
    padding: '9px 16px',
    backgroundColor: '#16A34A',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  viewAllRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s',
  },
  viewAllText: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#0504AA',
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
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
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
    background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFF 100%)',
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
    animation: 'spPulseDot 2s ease-in-out infinite',
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

  // CENTER SCREENS
  centerRoot: {
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
  centerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  centerBody: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    maxWidth: 340,
    lineHeight: 1.55,
  },
  centerPrimary: {
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
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
  },

  // SKELETONS
  thumbSkeleton: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexShrink: 0,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    width: 180,
  },
  blockSkeleton: {
    height: 120,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 16,
    animation: 'spShimmer 1.4s ease-in-out infinite',
  },
};