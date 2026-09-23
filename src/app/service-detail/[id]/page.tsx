'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../services/api';
import PickTimeBottomSheet from '../../../components/PickTimeBottomSheet';
import {
  MdShare,
  MdFavorite,
  MdFavoriteBorder,
  MdImage,
  MdChatBubbleOutline,
  MdCalendarToday,
  MdCheckCircle,
  MdClose,
  MdVolumeOff,
  MdVolumeUp,
  MdPlayArrow,
  MdPause,
  MdMoreVert,
  MdKeyboardArrowUp,
  MdChevronLeft,
  MdPersonOutline,
  MdLink,
  MdFlag,
  MdHistory,
  MdStorefront,
} from 'react-icons/md';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:8000';

const DOUBLE_TAP_MS = 260;
const FLASH_MS = 450;

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

interface ServiceDetail {
  service_id: string;
  title: string;
  price: number;
  description?: string;
  image_url?: string;
  video_url?: string;
  duration_minutes?: number;
  provider_id?: string;
  business_name?: string;
  business_image_url?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  review_count?: number;
  [key: string]: unknown;
}

interface Booking {
  booking_id: string;
  service_id: string;
  customer_id: string;
  provider_id: string;
  status: string;
  amount?: number;
  service_title?: string;
  scheduled_for?: string;
  created_at?: string;
}

interface HeartBurst {
  id: number;
  x: number;
  y: number;
}

const styles: Record<string, React.CSSProperties> = {
  container: { position: 'fixed', inset: 0, backgroundColor: '#000', overflow: 'hidden', height: '100dvh', width: '100vw' },

  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  spinner: { width: 40, height: 40, border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  videoFull: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' },
  tapLayer: { position: 'absolute', inset: 0, zIndex: 1 },
  heartsLayer: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 },
  flashIcon: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255,255,255,0.85)', zIndex: 6, pointerEvents: 'none', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' },

  // Top chrome
  topChrome: { position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 24px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)', zIndex: 7, pointerEvents: 'none' },
  topChromeBtn: { width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(12,12,17,0.42)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', pointerEvents: 'auto' },
  topChromeTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  // Right rail — 4 items now (mute, save, share, message)
  rail: { position: 'absolute', right: 12, bottom: 240, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', zIndex: 8 },
  railBtn: { width: 44, height: 44, borderRadius: '50%', backgroundColor: 'rgba(12,12,17,0.42)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' },

  // Bottom overlay
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '56px 16px 80px', background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.3) 55%, transparent)', color: '#fff', zIndex: 7 },
  providerHandle: { fontSize: 13, fontWeight: 700, opacity: 0.92, marginBottom: 6, textShadow: '0 1px 4px rgba(0,0,0,0.5)' },
  reelTitle: { fontSize: 17, fontWeight: 800, lineHeight: 1.28, margin: 0, marginBottom: 6, textShadow: '0 1px 4px rgba(0,0,0,0.5)' },
  reelPriceLine: { fontSize: 14, fontWeight: 700, color: '#C7CBFF', textShadow: '0 1px 4px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  bulletDot: { opacity: 0.5 },
  starInline: { color: '#FBBF24' },
  descPreview: { fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 8, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', textShadow: '0 1px 4px rgba(0,0,0,0.5)', cursor: 'pointer' },

  ctaRow: { display: 'flex', gap: 10, marginTop: 14 },
  ctaBook: { flex: 1, padding: '14px 16px', borderRadius: 14, border: 'none', backgroundColor: '#0504AA', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaMessage: { flex: 1, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.5)', backgroundColor: 'rgba(12,12,17,0.42)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' },
  // ✅ Emerald "Are you at store?" — replaces Message when there's an active booking.
  ctaAtStore: { flex: 1, padding: '14px 16px', borderRadius: 14, border: 'none', backgroundColor: '#16A34A', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 20px rgba(22,163,74,0.35)' },

  // Swipe handle
  swipeHandleWrap: { position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 8, paddingBottom: 10, cursor: 'pointer' },
  swipeHandleBar: { width: 44, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.75)' },
  swipeHandleLabel: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 4 },

  // Progress bar
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, display: 'flex', alignItems: 'flex-end', zIndex: 9, cursor: 'pointer' },
  progressLine: { width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  progressFill: { height: '100%', backgroundColor: '#fff', transition: 'width 0.1s linear' },

  // Sheets (shared)
  backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 4000 },
  panel: { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '88dvh', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 4001, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#D1D5DB', margin: '10px auto 6px' },
  scroll: { overflowY: 'auto', padding: '8px 20px 28px' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  header: { fontSize: 18, fontWeight: 800, margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#666', display: 'flex', alignItems: 'center' },

  sheetSection: { marginTop: 18 },
  sectionLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 },
  text: { fontSize: 14, color: '#374151', lineHeight: 1.55, margin: 0 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' },
  rowLabel: { fontSize: 13, color: '#6B7280', fontWeight: 600 },
  rowValue: { fontSize: 14, color: '#111827', fontWeight: 700 },
  link: { color: '#0504AA', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  stubNote: { fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, marginTop: 14, fontStyle: 'italic' },

  // ⋯ action menu
  actionSheetPanel: { position: 'fixed', left: 12, right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 20, zIndex: 4001, overflow: 'hidden', padding: '8px 0', maxWidth: 420, margin: '0 auto' },
  actionItem: { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#111827' },
  actionItemDanger: { color: '#DC2626' },
  actionDivider: { height: 1, backgroundColor: '#F3F4F6', margin: '4px 0' },
  actionCancel: { width: '100%', padding: '16px 20px', border: 'none', background: '#F9FAFB', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 4 },

  // Provider row inside sheets
  providerRow: { display: 'flex', alignItems: 'center', marginTop: 8 },
  avatar: { width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#0504AA20', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#0504AA', fontWeight: 'bold', fontSize: 15 },
  providerName: { color: '#111827', flex: 1, fontWeight: 700, fontSize: 15 },
  chatButton: { width: 36, height: 36, borderRadius: '50%', backgroundColor: '#0504AA14', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // ✅ Job Done / "At store" ceremony — emerald theme now, matching the CTA.
  ceremonyPanel: { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '92dvh', backgroundColor: '#F0FDF4', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 4001, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  ceremonyGrabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#86EFAC', margin: '10px auto 6px' },
  ceremonyBanner: { backgroundColor: '#065F46', color: '#D1FAE5', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' },
  ceremonyTitle: { fontSize: 22, fontWeight: 800, color: '#065F46', margin: '16px 20px 6px', lineHeight: 1.2 },
  ceremonySubtitle: { fontSize: 14, color: '#065F46', opacity: 0.8, margin: '0 20px 16px', lineHeight: 1.45 },

  historyCard: { margin: '4px 20px 0', padding: '14px 16px', borderRadius: 16, backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' },
  historyHead: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: '#047857', textTransform: 'uppercase', marginBottom: 8 },
  historyLine: { fontSize: 14, color: '#065F46', fontWeight: 700, lineHeight: 1.4, margin: 0 },
  historyMeta: { fontSize: 12, color: '#047857', marginTop: 4, lineHeight: 1.4 },
  historyMiniRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #A7F3D0', fontSize: 13, color: '#065F46' },
  historyMiniRowLast: { borderBottom: 'none' },
  historyAmount: { fontWeight: 800, color: '#047857' },

  bookingSummary: { margin: '16px 20px 0', padding: '14px 16px', borderRadius: 16, backgroundColor: '#fff', border: '1px solid #D1FAE5' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 },
  summaryLabel: { color: '#6B7280', fontWeight: 600 },
  summaryValue: { color: '#111827', fontWeight: 700 },

  ceremonyWarning: { margin: '16px 20px 0', padding: '12px 14px', borderRadius: 12, backgroundColor: '#FEF3C7', fontSize: 12.5, color: '#78350F', lineHeight: 1.5, fontWeight: 600 },

  ceremonyCTA: { margin: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 10 },
  releaseBtn: { width: '100%', padding: '16px', borderRadius: 14, border: 'none', backgroundColor: '#16A34A', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 24px rgba(22,163,74,0.3)' },
  cancelBtn: { width: '100%', padding: '14px', borderRadius: 14, border: '1px solid #86EFAC', backgroundColor: 'transparent', color: '#065F46', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
};

export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const serviceId = params.id;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  const [showPickTime, setShowPickTime] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [jobSheetOpen, setJobSheetOpen] = useState(false);

  const [bookings, setBookings] = useState<Booking[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
  const [hearts, setHearts] = useState<HeartBurst[]>([]);

  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef(0);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartIdRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const data = (await api.getService(serviceId)) as unknown as ServiceDetail;
        setService(data);
      } catch (error) {
        console.error('Failed to load service:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceId]);

  useEffect(() => {
    (async () => {
      try {
        const data = (await api.getServiceBookings()) as unknown as Booking[];
        setBookings(Array.isArray(data) ? data : []);
      } catch {
        // silent
      }
    })();
  }, [serviceId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  useEffect(() => {
    const onVis = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else if (playing) v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [playing]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (isFinite(v.duration) && v.duration > 0) {
        setProgress(v.currentTime / v.duration);
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [loading]);

  const activeBooking = useMemo(
    () =>
      bookings.find(
        (b) =>
          b.service_id === serviceId &&
          (b.status?.toLowerCase() === 'locked' || b.status?.toLowerCase() === 'accepted'),
      ) || null,
    [bookings, serviceId],
  );

  const providerId = service?.provider_id;
  const pastBookings = useMemo(() => {
    if (!providerId) return [];
    return bookings
      .filter(
        (b) =>
          b.provider_id === providerId &&
          b.status?.toLowerCase() === 'completed',
      )
      .slice(0, 2);
  }, [bookings, providerId]);

  const pastCount = pastBookings.length;

  const triggerFlash = (kind: 'play' | 'pause') => {
    setFlash(kind);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlash(null), FLASH_MS);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
      triggerFlash('play');
    } else {
      v.pause();
      setPlaying(false);
      triggerFlash('pause');
    }
  };

  const spawnHeart = (x: number, y: number) => {
    const id = ++heartIdRef.current;
    setHearts((h) => [...h, { id, x, y }]);
    setTimeout(() => setHearts((h) => h.filter((item) => item.id !== id)), 900);
  };

  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      spawnHeart(x, y);
    } else {
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        togglePlay();
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_MS);
    }
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
    setProgress(ratio);
  };

  const toggleSave = async () => {
    if (isSaveLoading) return;
    setIsSaveLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    setIsSaved(!isSaved);
    setIsSaveLoading(false);
  };

  const shareService = async () => {
    if (!service) return;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const payload = {
      title: service.title,
      text: `${service.title} by ${service.business_name || 'a provider'} — on Admerce`,
      url,
    };
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share(payload);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert('Link copied.');
        return;
      }
      alert(url);
    } catch {
      // user cancelled — silent
    }
  };

  const copyLink = async () => {
    setMenuOpen(false);
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert('Link copied.');
      } else {
        alert(url);
      }
    } catch {
      alert(url);
    }
  };

  const reportService = () => {
    setMenuOpen(false);
    alert('Reported. Our team will review this service.');
  };

  const openProviderProfile = () => {
    if (!service?.provider_id) return;
    router.push(
      `/provider-services/${service.provider_id}?name=${encodeURIComponent(
        service.business_name || 'Service Provider',
      )}`,
    );
  };

  const handleBookClick = () => {
    if (!service) return;
    setShowPickTime(true);
  };

  const handlePickTime = async (scheduledFor: string) => {
    if (!service) return;
    setShowPickTime(false);
    setSheetOpen(false);

    try {
      const wallet = (await api.getWalletBalance()) as { balance: number };
      if (wallet.balance < service.price) {
        alert(
          `Insufficient balance. You need ₦${service.price.toFixed(0)} but have ₦${wallet.balance.toFixed(0)}.`,
        );
        router.push('/shopper/wallet');
        return;
      }
    } catch (err) {
      console.error('Could not verify wallet balance:', err);
    }

    setIsLoading(true);
    try {
      const response = await api.bookService(serviceId, scheduledFor, '', undefined, undefined);
      const bookingId = (response as { booking_id?: string }).booking_id || '';
      const query = new URLSearchParams({
        service_name: service.title,
        provider_name: service.business_name || 'Service Provider',
        scheduled_for: scheduledFor,
        amount: String(service.price),
        booking_id: bookingId,
      });
      router.push(`/booking-confirmed?${query.toString()}`);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Booking failed');
      alert(detail);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ "Are you at store?" → open ceremony sheet
  const handleAtStoreClick = () => {
    if (!activeBooking) {
      alert('No active booking found for this service.');
      return;
    }
    setJobSheetOpen(true);
  };

  const confirmJobDone = async () => {
    if (!service || !activeBooking) return;
    setJobSheetOpen(false);
    setIsLoading(true);
    try {
      await api.completeServiceBooking(activeBooking.booking_id);
      const query = new URLSearchParams({
        service_name: service.title,
        provider_name: service.business_name || 'Service Provider',
        amount: String(service.price),
        booking_id: activeBooking.booking_id,
        status: 'completed',
      });
      router.push(`/receipt/service/${activeBooking.booking_id}?${query.toString()}`);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Failed to complete job');
      alert(detail);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={styles.loadingContainer}>
        <div>Loading...</div>
      </main>
    );
  }
  if (!service) {
    return (
      <main style={styles.loadingContainer}>
        <div>Service not found</div>
      </main>
    );
  }

  const imageUrl = resolveImageUrl(service.image_url);
  const videoUrl = resolveImageUrl(service.video_url);
  const providerImageUrl = resolveImageUrl(service.business_image_url);
  const providerName = service.business_name || 'Service Provider';
  const providerProfileId = service.provider_id || '';
  const hasVideo = Boolean(videoUrl);
  const priceLabel = `₦${service.price.toFixed(0)}`;
  const rating = service.rating ?? 0;
  const reviews = service.review_count ?? 0;
  const duration = service.duration_minutes ?? 0;

  return (
    <main style={styles.container}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 720px) {
          .sdp-reel-shell {
            max-width: 520px;
            margin-left: auto;
            margin-right: auto;
            left: 0;
            right: 0;
          }
        }
      `}</style>

      {isLoading && (
        <div style={styles.overlay}>
          <div style={styles.spinner} />
        </div>
      )}

      <div className="sdp-reel-shell" style={{ position: 'absolute', inset: 0 }}>
        {hasVideo ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={imageUrl || undefined}
            autoPlay
            muted={muted}
            loop
            playsInline
            preload="metadata"
            style={styles.videoFull}
          />
        ) : imageUrl ? (
          <img src={imageUrl} alt={service.title} style={styles.videoFull} />
        ) : (
          <div
            style={{
              ...styles.videoFull,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#555',
            }}
          >
            <MdImage size={64} />
          </div>
        )}

        <div style={styles.tapLayer} onClick={handleVideoTap} />

        <div style={styles.heartsLayer}>
          <AnimatePresence>
            {hearts.map((h) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, scale: 0.4, y: 0 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.35, 1.15, 1], y: -50 }}
                transition={{ duration: 0.85 }}
                style={{ position: 'absolute', left: h.x - 40, top: h.y - 40, pointerEvents: 'none' }}
              >
                <MdFavorite
                  size={80}
                  color="#FE2C55"
                  style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: 0.2 }}
              style={styles.flashIcon}
            >
              {flash === 'play' ? <MdPlayArrow size={76} /> : <MdPause size={76} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top chrome */}
        <div style={styles.topChrome}>
          <button
            type="button"
            style={styles.topChromeBtn}
            onClick={() => router.back()}
            aria-label="Back"
          >
            <MdChevronLeft size={26} />
          </button>
          <span style={styles.topChromeTitle}>@{providerName}</span>
          <button
            type="button"
            style={styles.topChromeBtn}
            onClick={() => setMenuOpen(true)}
            aria-label="More"
          >
            <MdMoreVert size={22} />
          </button>
        </div>

        {/* ✅ Right rail — message icon is BACK, 4 items total. */}
        <div style={styles.rail}>
          {hasVideo && (
            <button
              type="button"
              style={styles.railBtn}
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MdVolumeOff size={22} /> : <MdVolumeUp size={22} />}
            </button>
          )}

          <button
            type="button"
            style={styles.railBtn}
            onClick={toggleSave}
            disabled={isSaveLoading}
            aria-label={isSaved ? 'Unsave' : 'Save'}
            title="Save (not yet wired to backend)"
          >
            {isSaved ? <MdFavorite size={22} /> : <MdFavoriteBorder size={22} />}
          </button>

          <button
            type="button"
            style={styles.railBtn}
            onClick={shareService}
            aria-label="Share"
          >
            <MdShare size={22} />
          </button>

          <button
            type="button"
            style={styles.railBtn}
            onClick={() => router.push(`/chat/${providerProfileId}`)}
            aria-label="Message provider"
          >
            <MdChatBubbleOutline size={22} />
          </button>
        </div>

        {/* Bottom overlay */}
        <div style={styles.bottomOverlay}>
          <p style={styles.providerHandle}>@{providerName}</p>
          <h2 style={styles.reelTitle}>{service.title}</h2>
          <p style={styles.reelPriceLine}>
            {priceLabel}
            {duration > 0 && (
              <>
                <span style={styles.bulletDot}>·</span>
                {duration} min
              </>
            )}
            {rating > 0 && (
              <>
                <span style={styles.bulletDot}>·</span>
                <span>
                  <span style={styles.starInline}>★</span> {rating.toFixed(1)} ({reviews})
                </span>
              </>
            )}
          </p>

          {service.description && (
            <p style={styles.descPreview} onClick={() => setSheetOpen(true)}>
              {service.description}
            </p>
          )}

          {/* ✅ CTA row: Book Service + (Message OR "Are you at store?") */}
          <div style={styles.ctaRow}>
            <button
              type="button"
              style={{ ...styles.ctaBook, opacity: isLoading ? 0.6 : 1 }}
              onClick={handleBookClick}
              disabled={isLoading}
            >
              <MdCalendarToday size={18} />
              {pastCount > 0 ? 'Book Again' : 'Book Service'}
            </button>

            {activeBooking ? (
              <button
                type="button"
                style={styles.ctaAtStore}
                onClick={handleAtStoreClick}
              >
                <MdStorefront size={18} />
                Are you at store?
              </button>
            ) : (
              <button
                type="button"
                style={styles.ctaMessage}
                onClick={() => router.push(`/chat/${providerProfileId}`)}
              >
                <MdChatBubbleOutline size={18} />
                Message
              </button>
            )}
          </div>
        </div>

        {/* Swipe handle */}
        <div
          style={styles.swipeHandleWrap}
          onClick={() => setSheetOpen(true)}
          role="button"
          aria-label="Open details"
        >
          <div style={styles.swipeHandleBar} />
          <span style={styles.swipeHandleLabel}>
            <MdKeyboardArrowUp size={14} />
            Swipe up for details
          </span>
        </div>

        {/* Progress bar */}
        <div style={styles.progressTrack} onClick={handleScrub}>
          <div style={styles.progressLine}>
            <div style={{ ...styles.progressFill, width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      {/* ═══════ Action menu (⋯) ═══════ */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMenuOpen(false)}
              style={styles.backdrop}
            />
            <motion.div
              key="menu-panel"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={styles.actionSheetPanel}
            >
              <button
                type="button"
                style={styles.actionItem}
                onClick={() => {
                  setMenuOpen(false);
                  openProviderProfile();
                }}
              >
                <MdPersonOutline size={22} color="#0504AA" />
                More from @{providerName}
              </button>
              <div style={styles.actionDivider} />
              <button type="button" style={styles.actionItem} onClick={copyLink}>
                <MdLink size={22} color="#0504AA" />
                Copy link
              </button>
              <div style={styles.actionDivider} />
              <button
                type="button"
                style={{ ...styles.actionItem, ...styles.actionItemDanger }}
                onClick={reportService}
              >
                <MdFlag size={22} color="#DC2626" />
                Report this service
              </button>
              <button
                type="button"
                style={styles.actionCancel}
                onClick={() => setMenuOpen(false)}
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════ Detail sheet ═══════ */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              key="sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSheetOpen(false)}
              style={styles.backdrop}
            />
            <motion.div
              key="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120) setSheetOpen(false);
              }}
              style={styles.panel}
            >
              <div style={styles.grabber} />
              <div style={styles.scroll}>
                <div style={styles.headerRow}>
                  <h3 style={styles.header}>Service details</h3>
                  <button
                    type="button"
                    style={styles.closeBtn}
                    onClick={() => setSheetOpen(false)}
                    aria-label="Close"
                  >
                    <MdClose size={22} />
                  </button>
                </div>

                <div style={styles.providerRow}>
                  <div style={styles.avatar}>
                    {providerImageUrl ? (
                      <img
                        src={providerImageUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={styles.avatarText}>{providerName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span style={styles.providerName}>{providerName}</span>
                  <button
                    style={styles.chatButton}
                    onClick={() => {
                      setSheetOpen(false);
                      router.push(`/chat/${providerProfileId}`);
                    }}
                    title="Message Provider"
                  >
                    <MdChatBubbleOutline size={18} color="#0504AA" />
                  </button>
                </div>

                {service.description && (
                  <div style={styles.sheetSection}>
                    <p style={styles.sectionLabel}>Description</p>
                    <p style={styles.text}>{service.description}</p>
                  </div>
                )}

                <div style={styles.sheetSection}>
                  <div style={styles.row}>
                    <span style={styles.rowLabel}>Price</span>
                    <span style={styles.rowValue}>{priceLabel}</span>
                  </div>
                  {duration > 0 && (
                    <div style={styles.row}>
                      <span style={styles.rowLabel}>Duration</span>
                      <span style={styles.rowValue}>{duration} min</span>
                    </div>
                  )}
                  {rating > 0 && (
                    <div style={styles.row}>
                      <span style={styles.rowLabel}>Rating</span>
                      <span style={styles.rowValue}>
                        {rating.toFixed(1)} ({reviews})
                      </span>
                    </div>
                  )}
                  {service.lat && service.lng && (
                    <div style={styles.row}>
                      <span style={styles.rowLabel}>Location</span>
                      <button
                        style={styles.link}
                        onClick={() => {
                          setSheetOpen(false);
                          router.push(
                            `/shopper/map?lat=${service.lat}&lng=${service.lng}&destination=${encodeURIComponent(
                              providerName,
                            )}`,
                          );
                        }}
                      >
                        View on map
                      </button>
                    </div>
                  )}
                </div>

                <p style={styles.stubNote}>
                  Save and share are not yet connected to the backend. They will reset on reload.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════ "Are you at store?" ceremony ═══════ */}
      <AnimatePresence>
        {jobSheetOpen && (
          <>
            <motion.div
              key="job-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setJobSheetOpen(false)}
              style={styles.backdrop}
            />
            <motion.div
              key="job-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120) setJobSheetOpen(false);
              }}
              style={styles.ceremonyPanel}
            >
              <div style={styles.ceremonyGrabber} />

              <div style={styles.ceremonyBanner}>
                <MdStorefront size={16} />
                Job completion
              </div>

              <h2 style={styles.ceremonyTitle}>Confirm the job is done</h2>
              <p style={styles.ceremonySubtitle}>
                You&apos;re at @{providerName}. Once the work is finished, tap below
                to release the held funds and close this booking.
              </p>

              {/* Your history with this provider */}
              <div style={styles.historyCard}>
                <div style={styles.historyHead}>
                  <MdHistory size={14} />
                  Your history with @{providerName}
                </div>
                {pastCount > 0 ? (
                  <>
                    <p style={styles.historyLine}>
                      You&apos;ve hired them {pastCount}
                      {pastCount === 1 ? ' time' : ' times'} before.
                    </p>
                    <div style={{ marginTop: 10 }}>
                      {pastBookings.map((b, i) => (
                        <div
                          key={b.booking_id}
                          style={{
                            ...styles.historyMiniRow,
                            ...(i === pastBookings.length - 1
                              ? styles.historyMiniRowLast
                              : {}),
                          }}
                        >
                          <span>
                            {b.scheduled_for
                              ? new Date(b.scheduled_for).toLocaleDateString('en-NG', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : b.service_title || 'Previous job'}
                          </span>
                          <span style={styles.historyAmount}>
                            ₦{Number(b.amount || 0).toLocaleString('en-NG', {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={styles.historyLine}>
                    This is your first booking with @{providerName}.
                  </p>
                )}
              </div>

              {/* Current booking */}
              {activeBooking && (
                <div style={styles.bookingSummary}>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Service</span>
                    <span style={styles.summaryValue}>{service.title}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Scheduled</span>
                    <span style={styles.summaryValue}>
                      {activeBooking.scheduled_for
                        ? new Date(activeBooking.scheduled_for).toLocaleString('en-NG', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'ASAP'}
                    </span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Amount held</span>
                    <span style={styles.summaryValue}>
                      ₦{Number(activeBooking.amount || service.price).toLocaleString('en-NG', {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                </div>
              )}

              <div style={styles.ceremonyWarning}>
                ⚠️ Confirming will release the held funds to {providerName}. This cannot
                be undone.
              </div>

              <div style={styles.ceremonyCTA}>
                <button type="button" style={styles.releaseBtn} onClick={confirmJobDone}>
                  <MdCheckCircle size={20} />
                  Yes, the job is done
                </button>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setJobSheetOpen(false)}
                >
                  Not yet
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Time picker */}
      <PickTimeBottomSheet
        isOpen={showPickTime}
        onClose={() => setShowPickTime(false)}
        onSelect={handlePickTime}
        mode="service"
      />
    </main>
  );
}