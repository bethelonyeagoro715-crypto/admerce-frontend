'use client';

import { useState, useEffect, useRef } from 'react';
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
  MdLocationOn,
  MdStar,
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
} from 'react-icons/md';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:8000';

const DOUBLE_TAP_MS = 260;
const FLASH_MS = 450;
const MODE_KEY = 'admerce_sdp_mode';

type DetailMode = 'reel' | 'hero' | 'hybrid';

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

interface ActiveBooking {
  booking_id: string;
  service_id: string;
  status: string;
  amount?: number;
  service_title?: string;
}

interface HeartBurst {
  id: number;
  x: number;
  y: number;
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  // Shared
  containerHero: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' },
  containerFull: { position: 'fixed', inset: 0, backgroundColor: '#000', overflow: 'hidden', height: '100dvh', width: '100vw' },

  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  spinner: { width: 40, height: 40, border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  // Hero mode — top app bar
  appBar: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 10 },
  backBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', marginRight: 12, color: '#333', display: 'flex', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 600, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actions: { display: 'flex', gap: 8 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Hero mode — scroll body
  scrollArea: { flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 32 },
  imageSection: { position: 'relative', marginBottom: 16 },
  image: { width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 20, backgroundColor: '#f0f0f0' },
  videoHero: { width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 20, backgroundColor: '#000', display: 'block' },
  lensButton: { position: 'absolute', bottom: 12, right: 12, width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  muteButton: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(12,12,17,0.55)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 2 },

  // Hero mode — body info
  serviceTitle: { fontSize: 22, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 },
  priceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  price: { fontSize: 24, fontWeight: 700, color: '#0504AA' },
  providerRow: { display: 'flex', alignItems: 'center', marginTop: 8 },
  avatar: { width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#0504AA20', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#0504AA', fontWeight: 'bold', fontSize: 14 },
  providerName: { color: '#666', flex: 1 },
  chatButton: { width: 36, height: 36, borderRadius: '50%', backgroundColor: '#0504AA14', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mapRow: { display: 'flex', alignItems: 'center', marginTop: 8 },
  mapText: { fontSize: 14, color: '#888', flex: 1 },
  viewMapLink: { color: '#0504AA', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' },
  ratingRow: { display: 'flex', alignItems: 'center', marginTop: 8 },
  star: { color: '#FFA000', marginRight: 4 },
  ratingText: { fontWeight: 600, fontSize: 14 },
  reviewText: { fontSize: 12, color: '#888', marginLeft: 4 },
  durationBadge: { backgroundColor: '#E8F0FE', color: '#1A73E8', padding: '2px 10px', borderRadius: 12, fontSize: 12, marginLeft: 'auto' },
  fulfillmentSection: { marginTop: 24, padding: 16, backgroundColor: '#f9f9f9', borderRadius: 16, border: '1px solid #eee' },
  sectionTitle: { fontWeight: 600, fontSize: 16, marginBottom: 12 },
  actionButton: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  descriptionSection: { marginTop: 24 },
  descriptionTitle: { fontWeight: 600, fontSize: 16, marginBottom: 8 },
  descriptionText: { color: '#555', lineHeight: 1.5 },

  // Full-screen mode — video layer
  videoFull: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' },
  tapLayer: { position: 'absolute', inset: 0, zIndex: 1 },
  heartsLayer: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 },
  flashIcon: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255,255,255,0.85)', zIndex: 6, pointerEvents: 'none', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' },

  // Full-screen mode — top chrome
  topChrome: { position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 24px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)', zIndex: 7, pointerEvents: 'none' },
  topChromeBtn: { width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(12,12,17,0.42)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', pointerEvents: 'auto' },
  topChromeTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  // Full-screen mode — right rail
  rail: { position: 'absolute', right: 12, bottom: 160, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', zIndex: 8 },
  railBtn: { width: 44, height: 44, borderRadius: '50%', backgroundColor: 'rgba(12,12,17,0.42)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' },
  railLabel: { fontSize: 11, color: '#fff', fontWeight: 700, marginTop: -12, textShadow: '0 1px 4px rgba(0,0,0,0.5)' },

  // Full-screen mode — bottom overlay
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '56px 16px 28px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.25) 55%, transparent)', color: '#fff', zIndex: 7 },
  providerHandle: { fontSize: 13, fontWeight: 700, opacity: 0.92, marginBottom: 6, textShadow: '0 1px 4px rgba(0,0,0,0.5)' },
  reelTitle: { fontSize: 17, fontWeight: 800, lineHeight: 1.28, margin: 0, marginBottom: 6, textShadow: '0 1px 4px rgba(0,0,0,0.5)' },
  reelPriceLine: { fontSize: 14, fontWeight: 700, color: '#C7CBFF', textShadow: '0 1px 4px rgba(0,0,0,0.5)' },

  ctaRow: { display: 'flex', gap: 10, marginTop: 14 },
  ctaBook: { flex: 1, padding: '14px 16px', borderRadius: 14, border: 'none', backgroundColor: '#0504AA', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaMessage: { flex: 1, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.5)', backgroundColor: 'rgba(12,12,17,0.42)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' },

  floatingBook: { position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)', padding: '13px 28px', borderRadius: 999, border: 'none', backgroundColor: '#0504AA', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(5,4,170,0.5)', zIndex: 8 },

  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, display: 'flex', alignItems: 'flex-end', zIndex: 9, cursor: 'pointer' },
  progressLine: { width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  progressFill: { height: '100%', backgroundColor: '#fff', transition: 'width 0.1s linear' },

  swipeHandleWrap: { position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 8, paddingBottom: 10, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', cursor: 'pointer' },
  swipeHandleBar: { width: 44, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.75)' },
  swipeHandleLabel: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 4 },

  // Mode switcher (debug pill)
  modeSwitcher: { position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 5000, padding: '6px 14px', borderRadius: 999, backgroundColor: '#FCD34D', color: '#111', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 800, letterSpacing: 1, border: '2px solid #111', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' },

  // Bottom sheet
  sheetBackdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 4000 },
  sheetPanel: { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '88dvh', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 4001, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sheetGrabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#D1D5DB', margin: '10px auto 6px' },
  sheetScroll: { overflowY: 'auto', padding: '8px 20px 28px' },
  sheetHeaderRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetHeader: { fontSize: 18, fontWeight: 800, margin: 0 },
  sheetClose: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#666', display: 'flex', alignItems: 'center' },
  sheetSection: { marginTop: 18 },
  sheetSectionLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 },
  sheetText: { fontSize: 14, color: '#374151', lineHeight: 1.55, margin: 0 },
  sheetRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' },
  sheetRowLabel: { fontSize: 13, color: '#6B7280', fontWeight: 600 },
  sheetRowValue: { fontSize: 14, color: '#111827', fontWeight: 700 },
  sheetLink: { color: '#0504AA', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  jobDoneBtn: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', backgroundColor: '#27AE60', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  stubNote: { fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, marginTop: 14, fontStyle: 'italic' },

  // Media query helper — desktop reel cap
  mediaTarget: { display: 'contents' },
};

// ─────────────────────────────────────────────────────────────
// Mode switcher pill
// ─────────────────────────────────────────────────────────────
function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: DetailMode;
  onChange: (m: DetailMode) => void;
}) {
  const order: DetailMode[] = ['reel', 'hero', 'hybrid'];
  const next = order[(order.indexOf(mode) + 1) % order.length];

  return (
    <button
      type="button"
      style={styles.modeSwitcher}
      onClick={() => onChange(next)}
      title={`Tap to switch to ${next.toUpperCase()}`}
    >
      MODE: {mode.toUpperCase()} →
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
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
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
  const [checkingBooking, setCheckingBooking] = useState(false);

  // Mode — persisted across sessions for quick comparison
  const [mode, setModeState] = useState<DetailMode>(() => {
    if (typeof window === 'undefined') return 'hybrid';

    const stored = window.localStorage.getItem(MODE_KEY) as DetailMode | null;
    return stored === 'reel' || stored === 'hero' || stored === 'hybrid'
      ? stored
      : 'hybrid';
  });

  const setMode = (m: DetailMode) => {
    setModeState(m);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MODE_KEY, m);
    }
  };

  // Video refs and state (shared across all modes)
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [heroMuted, setHeroMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
  const [hearts, setHearts] = useState<HeartBurst[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef(0);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartIdRef = useRef(0);

  // Load service
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

  // Sync mute
  useEffect(() => {
    const v = heroVideoRef.current;
    if (!v) return;
    v.muted = heroMuted;
  }, [heroMuted]);

  // Pause on tab hide
  useEffect(() => {
    const onVis = () => {
      const v = heroVideoRef.current;
      if (!v) return;
      if (document.hidden) {
        v.pause();
      } else if (playing) {
        v.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [playing]);

  // Progress from video
  useEffect(() => {
    const v = heroVideoRef.current;
    if (!v) return;
    const onTime = () => {
      if (isFinite(v.duration) && v.duration > 0) {
        setProgress(v.currentTime / v.duration);
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [mode, loading]);

  // ─── Video interactions ─────────────────────────────────────
  const triggerFlash = (kind: 'play' | 'pause') => {
    setFlash(kind);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlash(null), FLASH_MS);
  };

  const togglePlay = () => {
    const v = heroVideoRef.current;
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
    // Self-remove after animation finishes
    setTimeout(() => {
      setHearts((h) => h.filter((item) => item.id !== id));
    }, 900);
  };

  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      // Double tap → like
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      spawnHeart(x, y);
    } else {
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        // Single tap → toggle play
        togglePlay();
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_MS);
    }
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = heroVideoRef.current;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
    setProgress(ratio);
  };

  // ─── Save / share stubs ─────────────────────────────────────
  const toggleSave = async () => {
    if (isSaveLoading) return;
    setIsSaveLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsSaved(!isSaved);
    setIsSaveLoading(false);
  };

  const shareService = () => {
    alert('Share feature coming soon!');
  };

  const openVisualSearch = () => {
    const imageUrl = service?.image_url;
    if (imageUrl) {
      router.push(`/seai-lens?image=${encodeURIComponent(resolveImageUrl(imageUrl))}`);
    } else {
      alert('No image available for visual search.');
    }
  };

  // ─── Booking flow ───────────────────────────────────────────
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

  const handleJobDoneClick = async () => {
    if (!service) return;
    setCheckingBooking(true);
    try {
      const bookings = (await api.getServiceBookings()) as ActiveBooking[];
      const active = bookings.find(
        (b) =>
          b.service_id === serviceId &&
          (b.status?.toLowerCase() === 'locked' || b.status?.toLowerCase() === 'accepted'),
      );
      if (!active) {
        alert('No active booking found for this service.');
        return;
      }
      setSheetOpen(false);
      setActiveBooking(active);
      setShowSatisfaction(true);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Could not load your bookings');
      alert(detail);
    } finally {
      setCheckingBooking(false);
    }
  };

  const handleConfirmSatisfaction = async () => {
    if (!service || !activeBooking) return;
    setShowSatisfaction(false);
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

  // ─── Render gates ───────────────────────────────────────────
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
  const providerId = service.provider_id || '';
  const hasVideo = Boolean(videoUrl);
  const priceLabel = `₦${service.price.toFixed(0)}`;

  // ─── Shared JSX blocks ──────────────────────────────────────
  const videoEl = hasVideo ? (
    <video
      ref={heroVideoRef}
      src={videoUrl}
      poster={imageUrl || undefined}
      autoPlay
      muted={heroMuted}
      loop
      playsInline
      preload="metadata"
      style={
        mode === 'hero'
          ? styles.videoHero
          : styles.videoFull
      }
    />
  ) : imageUrl ? (
    <img
      src={imageUrl}
      alt={service.title}
      style={mode === 'hero' ? styles.image : styles.videoFull}
    />
  ) : (
    <div
      style={{
        ...(mode === 'hero' ? styles.image : styles.videoFull),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#555',
      }}
    >
      <MdImage size={64} />
    </div>
  );

  const heartsLayer = (
    <div style={styles.heartsLayer}>
      <AnimatePresence>
        {hearts.map((h) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, scale: 0.4, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.35, 1.15, 1], y: -50 }}
            transition={{ duration: 0.85 }}
            style={{
              position: 'absolute',
              left: h.x - 40,
              top: h.y - 40,
              pointerEvents: 'none',
            }}
          >
            <MdFavorite size={80} color="#FE2C55" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  const flashLayer = (
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
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <main style={mode === 'hero' ? styles.containerHero : styles.containerFull}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Desktop cap for full-screen reel so 9:16 isn't absurd on a monitor */
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

      <ModeSwitcher mode={mode} onChange={setMode} />

      {isLoading && (
        <div style={styles.overlay}>
          <div style={styles.spinner} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          HERO MODE  (reel hero at top, page scrolls below)
          ═══════════════════════════════════════════════════════════ */}
      {mode === 'hero' && (
        <>
          <div style={styles.appBar}>
            <button style={styles.backBtn} onClick={() => router.back()}>
              <MdClose size={24} />
            </button>
            <h1 style={styles.title}>Service Detail</h1>
            <div style={styles.actions}>
              <button style={styles.iconBtn} onClick={shareService} title="Share">
                <MdShare size={24} color="#0504AA" />
              </button>
              <button
                style={styles.iconBtn}
                onClick={toggleSave}
                disabled={isSaveLoading}
                title={isSaved ? 'Unsave' : 'Save'}
              >
                {isSaved ? (
                  <MdFavorite size={24} color="#0504AA" />
                ) : (
                  <MdFavoriteBorder size={24} color="#666" />
                )}
              </button>
            </div>
          </div>

          <div style={styles.scrollArea}>
            <div style={styles.imageSection}>
              {videoEl}
              {hasVideo && (
                <button
                  type="button"
                  style={styles.muteButton}
                  onClick={() => setHeroMuted((m) => !m)}
                  aria-label={heroMuted ? 'Unmute' : 'Mute'}
                >
                  {heroMuted ? <MdVolumeOff size={18} /> : <MdVolumeUp size={18} />}
                </button>
              )}
              {!hasVideo && imageUrl && (
                <button style={styles.lensButton} onClick={openVisualSearch} title="Visual Search">
                  <MdImage size={18} color="#0504AA" />
                </button>
              )}
            </div>

            <h2 style={styles.serviceTitle}>{service.title}</h2>
            <div style={styles.priceRow}>
              <span style={styles.price}>{priceLabel}</span>
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
                  <span style={styles.avatarText}>
                    {providerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span style={styles.providerName}>By {providerName}</span>
              <button
                style={styles.chatButton}
                onClick={() => router.push(`/chat/${providerId}`)}
                title="Message Provider"
              >
                <MdChatBubbleOutline size={18} color="#0504AA" />
              </button>
            </div>

            {service.lat && service.lng && (
              <div style={styles.mapRow}>
                <MdLocationOn size={16} color="#888" style={{ marginRight: 4 }} />
                <span style={styles.mapText}>Tap to view on map</span>
                <button
                  style={styles.viewMapLink}
                  onClick={() =>
                    router.push(
                      `/shopper/map?lat=${service.lat}&lng=${service.lng}&destination=${encodeURIComponent(
                        providerName,
                      )}`,
                    )
                  }
                >
                  View on Map
                </button>
              </div>
            )}

            <div style={styles.ratingRow}>
              {(service.rating ?? 0) > 0 && (
                <>
                  <MdStar size={16} style={styles.star} />
                  <span style={styles.ratingText}>{(service.rating ?? 0).toFixed(1)}</span>
                  <span style={styles.reviewText}>({service.review_count ?? 0} reviews)</span>
                </>
              )}
              {(service.duration_minutes ?? 0) > 0 && (
                <span style={styles.durationBadge}>{service.duration_minutes} min</span>
              )}
            </div>

            <div style={styles.fulfillmentSection}>
              <h3 style={styles.sectionTitle}>What would you like to do?</h3>
              <button
                style={{
                  ...styles.actionButton,
                  backgroundColor: '#0504AA',
                  marginBottom: 10,
                  opacity: isLoading ? 0.6 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
                onClick={handleBookClick}
                disabled={isLoading}
              >
                <MdCalendarToday size={20} />
                Book Service
              </button>
              <button
                style={{
                  ...styles.actionButton,
                  backgroundColor: '#27AE60',
                  opacity: checkingBooking || isLoading ? 0.6 : 1,
                  cursor: checkingBooking || isLoading ? 'not-allowed' : 'pointer',
                }}
                onClick={handleJobDoneClick}
                disabled={checkingBooking || isLoading}
              >
                <MdCheckCircle size={20} />
                {checkingBooking ? 'Checking…' : 'Job Done'}
              </button>
            </div>

            {service.description && (
              <div style={styles.descriptionSection}>
                <h3 style={styles.descriptionTitle}>Description</h3>
                <p style={styles.descriptionText}>{service.description}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          REEL / HYBRID MODE  (full-screen video, right rail, bottom CTA)
          ═══════════════════════════════════════════════════════════ */}
      {(mode === 'reel' || mode === 'hybrid') && (
        <div className="sdp-reel-shell" style={{ position: 'absolute', inset: 0 }}>
          {videoEl}

          {/* Tap layer for play/pause and double-tap-to-like. */}
          <div style={styles.tapLayer} onClick={handleVideoTap} />

          {heartsLayer}
          {flashLayer}

          {/* Top chrome — back, provider name (hybrid only), more menu */}
          <div style={styles.topChrome}>
            <button
              type="button"
              style={styles.topChromeBtn}
              onClick={() => router.back()}
              aria-label="Back"
            >
              <MdChevronLeft size={26} />
            </button>

            {mode === 'hybrid' && (
              <span style={styles.topChromeTitle}>@{providerName}</span>
            )}

            <button
              type="button"
              style={styles.topChromeBtn}
              onClick={() => setSheetOpen(true)}
              aria-label="More info"
            >
              <MdMoreVert size={22} />
            </button>
          </div>

          {/* Right rail — mute, save, share, message */}
          <div style={styles.rail}>
            {hasVideo && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  style={styles.railBtn}
                  onClick={() => setHeroMuted((m) => !m)}
                  aria-label={heroMuted ? 'Unmute' : 'Mute'}
                >
                  {heroMuted ? <MdVolumeOff size={22} /> : <MdVolumeUp size={22} />}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
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
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                style={styles.railBtn}
                onClick={shareService}
                aria-label="Share"
                title="Share (not yet wired to backend)"
              >
                <MdShare size={22} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                style={styles.railBtn}
                onClick={() => router.push(`/chat/${providerId}`)}
                aria-label="Message provider"
              >
                <MdChatBubbleOutline size={22} />
              </button>
            </div>
          </div>

          {/* Bottom overlay — provider handle, title, price line */}
          <div style={styles.bottomOverlay}>
            <p style={styles.providerHandle}>@{providerName}</p>
            <h2 style={styles.reelTitle}>{service.title}</h2>
            <p style={styles.reelPriceLine}>
              {priceLabel}
              {service.duration_minutes ? ` · ${service.duration_minutes} min` : ''}
            </p>

            {/* HYBRID: two big CTAs side by side */}
            {mode === 'hybrid' && (
              <div style={styles.ctaRow}>
                <button
                  type="button"
                  style={{ ...styles.ctaBook, opacity: isLoading ? 0.6 : 1 }}
                  onClick={handleBookClick}
                  disabled={isLoading}
                >
                  <MdCalendarToday size={18} />
                  Book Service
                </button>
                <button
                  type="button"
                  style={styles.ctaMessage}
                  onClick={() => router.push(`/chat/${providerId}`)}
                >
                  <MdChatBubbleOutline size={18} />
                  Message
                </button>
              </div>
            )}
          </div>

          {/* REEL: single floating Book pill above the progress bar */}
          {mode === 'reel' && (
            <button
              type="button"
              style={{ ...styles.floatingBook, opacity: isLoading ? 0.6 : 1 }}
              onClick={handleBookClick}
              disabled={isLoading}
            >
              <MdCalendarToday size={18} />
              Book · {priceLabel}
            </button>
          )}

          {/* HYBRID: visible swipe-up handle */}
          {mode === 'hybrid' && (
            <div
              style={styles.swipeHandleWrap}
              onClick={() => setSheetOpen(true)}
              role="button"
              aria-label="Swipe up for details"
            >
              <div style={styles.swipeHandleBar} />
              <span style={styles.swipeHandleLabel}>
                <MdKeyboardArrowUp size={14} />
                Swipe up for details
              </span>
            </div>
          )}

          {/* Progress bar — always present, click-to-seek */}
          <div style={styles.progressTrack} onClick={handleScrub}>
            <div style={styles.progressLine}>
              <div style={{ ...styles.progressFill, width: `${progress * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail sheet (reel + hybrid) ─────────────────────── */}
      <AnimatePresence>
        {sheetOpen && (mode === 'reel' || mode === 'hybrid') && (
          <>
            <motion.div
              key="sdp-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSheetOpen(false)}
              style={styles.sheetBackdrop}
            />
            <motion.div
              key="sdp-sheet"
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
              style={styles.sheetPanel}
            >
              <div style={styles.sheetGrabber} />
              <div style={styles.sheetScroll}>
                <div style={styles.sheetHeaderRow}>
                  <h3 style={styles.sheetHeader}>Service details</h3>
                  <button
                    type="button"
                    style={styles.sheetClose}
                    onClick={() => setSheetOpen(false)}
                    aria-label="Close"
                  >
                    <MdClose size={22} />
                  </button>
                </div>

                {/* Provider */}
                <div style={styles.providerRow}>
                  <div style={styles.avatar}>
                    {providerImageUrl ? (
                      <img
                        src={providerImageUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={styles.avatarText}>
                        {providerName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span style={styles.providerName}>By {providerName}</span>
                  <button
                    style={styles.chatButton}
                    onClick={() => {
                      setSheetOpen(false);
                      router.push(`/chat/${providerId}`);
                    }}
                    title="Message Provider"
                  >
                    <MdChatBubbleOutline size={18} color="#0504AA" />
                  </button>
                </div>

                {/* Description */}
                {service.description && (
                  <div style={styles.sheetSection}>
                    <p style={styles.sheetSectionLabel}>Description</p>
                    <p style={styles.sheetText}>{service.description}</p>
                  </div>
                )}

                {/* Meta rows */}
                <div style={styles.sheetSection}>
                  <div style={styles.sheetRow}>
                    <span style={styles.sheetRowLabel}>Price</span>
                    <span style={styles.sheetRowValue}>{priceLabel}</span>
                  </div>
                  {service.duration_minutes ? (
                    <div style={styles.sheetRow}>
                      <span style={styles.sheetRowLabel}>Duration</span>
                      <span style={styles.sheetRowValue}>{service.duration_minutes} min</span>
                    </div>
                  ) : null}
                  {(service.rating ?? 0) > 0 ? (
                    <div style={styles.sheetRow}>
                      <span style={styles.sheetRowLabel}>Rating</span>
                      <span style={styles.sheetRowValue}>
                        {(service.rating ?? 0).toFixed(1)} ({service.review_count ?? 0})
                      </span>
                    </div>
                  ) : null}
                  {service.lat && service.lng ? (
                    <div style={styles.sheetRow}>
                      <span style={styles.sheetRowLabel}>Location</span>
                      <button
                        style={styles.sheetLink}
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
                  ) : null}
                </div>

                {/* Job Done — moved here from the main screen */}
                <div style={styles.sheetSection}>
                  <button
                    type="button"
                    style={{ ...styles.jobDoneBtn, opacity: checkingBooking ? 0.6 : 1 }}
                    onClick={handleJobDoneClick}
                    disabled={checkingBooking}
                  >
                    <MdCheckCircle size={18} />
                    {checkingBooking ? 'Checking…' : 'Job Done'}
                  </button>
                </div>

                <p style={styles.stubNote}>
                  Save and share are not yet connected to the backend. They will reset on reload.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Time picker ──────────────────────────────────────── */}
      <PickTimeBottomSheet
        isOpen={showPickTime}
        onClose={() => setShowPickTime(false)}
        onSelect={handlePickTime}
        mode="service"
      />

      {/* ─── Satisfaction modal ───────────────────────────────── */}
      <SatisfactionModal
        isOpen={showSatisfaction}
        providerName={providerName}
        amount={service.price}
        onCancel={() => {
          setShowSatisfaction(false);
          setActiveBooking(null);
        }}
        onConfirm={handleConfirmSatisfaction}
      />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Satisfaction modal (unchanged)
// ─────────────────────────────────────────────────────────────
function SatisfactionModal({
  isOpen,
  providerName,
  amount,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  providerName: string;
  amount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === 'undefined') return null;
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 4999,
            }}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: '24px 22px',
              width: '90%',
              maxWidth: 380,
              zIndex: 5000,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <MdCheckCircle size={36} color="#16A34A" />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', margin: '0 0 8px' }}>
              Are you satisfied with the service?
            </h3>

            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.5, margin: '0 0 20px' }}>
              Confirming will release{' '}
              <strong style={{ color: '#0504AA' }}>
                ₦{amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </strong>{' '}
              to <strong>{providerName}</strong>. This cannot be undone.
            </p>

            <button
              onClick={onConfirm}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#27AE60',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <MdCheckCircle size={20} />
              Yes, release funds
            </button>

            <button
              onClick={onCancel}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'transparent',
                color: '#666',
                border: '1px solid #E5E7EB',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Not yet
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}