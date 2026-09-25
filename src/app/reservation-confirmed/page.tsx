'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  MdCheckCircle,
  MdCancel,
  MdArrowForward,
  MdDirections,
  MdCancelPresentation,
  MdStore,
  MdPersonOutline,
  MdContentCopy,
  MdCheck,
  MdWarning,
  MdErrorOutline,
  MdAccessTime,
} from 'react-icons/md';
import api from '../../services/api';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────
interface OrderDetail {
  order_id?: string;
  status?: string;
  total_amount?: number | string;
  item_amount?: number | string;
  delivery_fee?: number | string;
  quantity?: number;
  store_id?: string;
  storekeeper_id?: string;
  customer_name?: string;
  store_name?: string;
  expires_at?: string;
  created_at?: string;
  address?: string;
  [key: string]: unknown;
}

interface StoreDetail {
  store_id?: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

// ─── Constants ────────────────────────────────────────────────────
const RING_SIZE = 220;
const RING_RADIUS = 92;
const RING_CIRC = 2 * Math.PI * RING_RADIUS; // ≈ 578

// ─── Helpers ──────────────────────────────────────────────────────
function ringColor(progress: number, expired: boolean): string {
  if (expired || progress <= 0) return '#94A3B8';
  if (progress <= 0.2) return '#DC2626';
  if (progress <= 0.5) return '#D97706';
  return '#0504AA';
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ─── Ambient background (shared visual language) ──────────────────
function AmbientBackground() {
  return (
    <div style={styles.bgWrap} aria-hidden>
      <div className="rc-grid" />
      <div className="rc-orb rc-orb-a" />
      <div className="rc-orb rc-orb-b" />
    </div>
  );
}

// ─── Countdown ring ───────────────────────────────────────────────
function CountdownRing({
  remaining,
  progress,
  expired,
}: {
  remaining: number;
  progress: number;
  expired: boolean;
}) {
  const color = ringColor(progress, expired);
  const offset = RING_CIRC * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <div style={styles.ringWrap}>
      <div className="rc-ring-pulse rc-ring-pulse-1" aria-hidden />
      <div className="rc-ring-pulse rc-ring-pulse-2" aria-hidden />

      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="#EEF0F7"
          strokeWidth="11"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          className="rc-ring-progress"
        />
      </svg>

      <div style={styles.ringCenter}>
        <span
          style={{
            ...styles.ringTime,
            color: expired ? '#94A3B8' : '#0F0F1A',
          }}
        >
          {expired ? 'EXPIRED' : formatTime(remaining)}
        </span>
        <span style={styles.ringLabel}>
          {expired ? 'time is up' : 'time remaining'}
        </span>
      </div>
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────
function ReservationConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orderId] = useState(
    () => searchParams.get('order_id') || `ORD-${Date.now()}`
  );

  const urlPickupTime = searchParams.get('pickup_time');
  const urlStoreName = searchParams.get('store_name');
  const urlCustomerName = searchParams.get('customer_name');
  const urlTotal = searchParams.get('total');
  const urlStoreLat = searchParams.get('store_lat');
  const urlStoreLng = searchParams.get('store_lng');

  const [pickupTime, setPickupTime] = useState(urlPickupTime || '3 hours');
  const [storeName, setStoreName] = useState(urlStoreName || '');
  const [customerName, setCustomerName] = useState(urlCustomerName || '');
  const [total, setTotal] = useState<number>(
    urlTotal ? parseFloat(urlTotal) : 0
  );
  const [storeLat, setStoreLat] = useState<number | null>(
    urlStoreLat ? parseFloat(urlStoreLat) : null
  );
  const [storeLng, setStoreLng] = useState<number | null>(
    urlStoreLng ? parseFloat(urlStoreLng) : null
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [enriching, setEnriching] = useState(true);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [showDropModal, setShowDropModal] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [remaining, setRemaining] = useState<number>(0);
  const [totalSeconds, setTotalSeconds] = useState(1);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const totalSecondsRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const droppedOrCompletedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Toasts ──
  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }].slice(-3));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ── Enrichment ──
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!orderId) return;

      const hasEverything =
        urlStoreName && urlTotal && urlCustomerName && urlStoreLat && urlStoreLng;

      if (hasEverything) {
        setEnriching(false);
        return;
      }

      try {
        const raw = (await api.getOrderDetail(orderId)) as OrderDetail;
        if (cancelled) return;

        if (!urlCustomerName && raw.customer_name) {
          setCustomerName(raw.customer_name);
        }
        if (!urlStoreName && raw.store_name) {
          setStoreName(raw.store_name);
        }
        if (!urlTotal && raw.total_amount != null) {
          setTotal(Number(raw.total_amount));
        }
        if (raw.expires_at) {
          setExpiresAt(String(raw.expires_at));
        }

        if (!urlStoreName && !raw.store_name && raw.store_id) {
          try {
            const store = (await api.getStoreById(String(raw.store_id))) as StoreDetail;
            if (!cancelled && store?.name) setStoreName(store.name);
            if (!cancelled && store?.latitude != null && store?.longitude != null) {
              setStoreLat(Number(store.latitude));
              setStoreLng(Number(store.longitude));
            }
          } catch {
            // ignore — best-effort enrichment
          }
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Could not load reservation details.';
        setEnrichError(msg);
      } finally {
        if (!cancelled) setEnriching(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // ── Countdown ──
  useEffect(() => {
    const compute = () => {
      if (expiresAt) {
        const target = new Date(expiresAt).getTime();
        if (!isNaN(target)) {
          const ms = target - Date.now();
          const secs = ms > 0 ? Math.floor(ms / 1000) : 0;
          setRemaining(secs);
          // Capture the highest value we see as the initial total.
          if (totalSecondsRef.current === null || secs > totalSecondsRef.current) {
            totalSecondsRef.current = secs;
            setTotalSeconds(secs || 1);
          }
          return;
        }
      }
      const numeric = (pickupTime || '').replace(/\D/g, '');
      const hours = numeric ? parseInt(numeric, 10) : 3;
      const secs = hours * 3600;
      setRemaining(secs);
      if (totalSecondsRef.current === null) {
        totalSecondsRef.current = secs;
        setTotalSeconds(secs || 1);
      }
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [expiresAt, pickupTime]);

  // ── Actions ──
  const handlePickUpComplete = async () => {
    if (completing || droppedOrCompletedRef.current) return;
    setCompleting(true);
    try {
      await api.confirmOrder(orderId);
      if (!isMountedRef.current) return;

      droppedOrCompletedRef.current = true;
      setJustCompleted(true);

      confetti({
        particleCount: 140,
        spread: 70,
        origin: { y: 0.55 },
        colors: ['#0504AA', '#3D3BFF', '#16A34A', '#22C55E'],
      });

      // Give the confetti a beat to register, then navigate.
      setTimeout(() => {
        if (!isMountedRef.current) return;
        router.push(
          `/shopper/orders/receipt/${orderId}?store_name=${encodeURIComponent(
            storeName
          )}&total=${total}&customer_name=${encodeURIComponent(customerName)}`
        );
      }, 700);
    } catch (error) {
      if (!isMountedRef.current) return;
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (error instanceof Error ? error.message : null) ||
        'Failed to complete order. Please try again.';
      pushToast('error', msg);
      setCompleting(false);
    }
  };

  const handleDropOrder = async () => {
    if (dropping || droppedOrCompletedRef.current) return;
    setDropping(true);
    try {
      await api.returnOrder(orderId);
      if (!isMountedRef.current) return;

      droppedOrCompletedRef.current = true;
      setShowDropModal(false);
      pushToast('success', 'Order dropped. Refund processing.');

      setTimeout(() => {
        if (!isMountedRef.current) return;
        router.push('/shopper/wallet');
      }, 600);
    } catch (error) {
      if (!isMountedRef.current) return;
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (error instanceof Error ? error.message : null) ||
        'Failed to drop order. Please try again.';
      pushToast('error', msg);
      setDropping(false);
    }
  };

  const handleNavigateToStore = () => {
    if (storeLat !== null && storeLng !== null) {
      router.push(
        `/shopper/map?lat=${storeLat}&lng=${storeLng}&destination=${encodeURIComponent(
          storeName || 'Store'
        )}&navigate=true`
      );
    } else {
      pushToast('error', 'Store location not available');
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      pushToast('error', 'Could not copy');
    }
  };

  // ── Derived ──
  const displayStore = storeName || 'Store';
  const displayCustomer = customerName || 'Customer';
  const shortOrder = orderId.length > 8 ? orderId.substring(0, 8) : orderId;
  const expired = remaining <= 0;
  const progress = Math.max(0, Math.min(1, remaining / totalSeconds));

  // ── Loading ──
  if (enriching && !justCompleted) {
    return (
      <main style={styles.container}>
        <AmbientBackground />
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading reservation…</p>
        </div>
      </main>
    );
  }

  // ── Hard error ──
  if (enrichError && !storeName && !customerName) {
    return (
      <main style={styles.container}>
        <AmbientBackground />
        <div style={styles.loadingWrap}>
          <div style={styles.errorHalo}>
            <MdErrorOutline size={44} color="#B91C1C" />
          </div>
          <h2 style={styles.errorHeading}>We couldn&apos;t load this reservation</h2>
          <p style={styles.errorBody}>{enrichError}</p>
          <button
            onClick={() => router.push('/shopper/home')}
            style={styles.primaryBtnFull}
          >
            Go back home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <AmbientBackground />

      {/* Toasts */}
      <div style={styles.toastStack}>
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            style={{
              ...styles.toast,
              ...(t.kind === 'success' ? styles.toastSuccess : styles.toastError),
            }}
          >
            {t.text}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {/* Eyebrow */}
        <div style={styles.eyebrowRow}>
          <div style={styles.eyebrowIcon}>
            <MdCheckCircle size={16} color="#16A34A" />
          </div>
          <span style={styles.eyebrowText}>Reservation Confirmed</span>
        </div>

        {/* Hero — countdown ring */}
        <CountdownRing
          remaining={remaining}
          progress={progress}
          expired={expired}
        />

        {/* Heading */}
        <h1 style={styles.heading}>
          {justCompleted ? 'Order Complete!' : "You're all set"}
        </h1>
        <p style={styles.subheading}>
          {justCompleted
            ? 'Taking you to your receipt…'
            : expired
              ? 'This reservation has expired. You may still complete pickup if the store has your item.'
              : 'Head to the store before the timer runs out'}
        </p>

        {/* Pickup time pill */}
        <div style={styles.pickupPill}>
          <MdAccessTime size={16} color="#0504AA" />
          <span style={styles.pickupPillText}>Pickup window: {pickupTime}</span>
        </div>

        {/* Order detail card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={styles.card}
        >
          <div style={styles.cardSection}>
            <div style={styles.cardSectionHeader}>
              <MdPersonOutline size={16} color="#0504AA" />
              <span style={styles.cardSectionLabel}>Pickup for</span>
            </div>
            <p style={styles.customerName}>{displayCustomer}</p>
            <div style={styles.storeRow}>
              <MdStore size={14} color="#64748B" />
              <span style={styles.storeName}>
                {enriching && !storeName ? 'Loading…' : displayStore}
              </span>
            </div>
          </div>

          <div style={styles.divider} />

          <div style={styles.cardRow}>
            <span style={styles.rowLabel}>Order</span>
            <button
              onClick={handleCopyId}
              className="rc-copy"
              style={styles.idBtn}
              aria-label="Copy order ID"
            >
              <code style={styles.idCode}>#{shortOrder}</code>
              {copied ? (
                <MdCheck size={13} color="#16A34A" />
              ) : (
                <MdContentCopy size={13} color="#94A3B8" />
              )}
            </button>
          </div>

          <div style={styles.cardRow}>
            <span style={styles.rowLabel}>Total paid</span>
            <span style={styles.rowValue}>
              {total > 0
                ? `₦${total.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
                : enriching
                  ? '—'
                  : '₦0'}
            </span>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.42 }}
          style={styles.actions}
        >
          <button
            onClick={handlePickUpComplete}
            disabled={completing || enriching || justCompleted}
            className="rc-primary"
            style={{
              ...styles.primaryBtn,
              opacity: completing || enriching || justCompleted ? 0.6 : 1,
              cursor:
                completing || enriching || justCompleted ? 'not-allowed' : 'pointer',
            }}
          >
            <MdArrowForward size={20} color="#fff" />
            <span>
              {completing
                ? 'Processing…'
                : justCompleted
                  ? 'Redirecting…'
                  : 'Pick Up & Complete'}
            </span>
          </button>

          <div style={styles.secondaryRow}>
            <button
              onClick={handleNavigateToStore}
              disabled={storeLat === null || storeLng === null}
              className="rc-secondary"
              style={{
                ...styles.secondaryBtn,
                opacity: storeLat === null || storeLng === null ? 0.5 : 1,
                cursor:
                  storeLat === null || storeLng === null ? 'not-allowed' : 'pointer',
              }}
            >
              <MdDirections size={18} color="#0504AA" />
              <span>Navigate</span>
            </button>
            <button
              onClick={() => setShowDropModal(true)}
              disabled={justCompleted}
              className="rc-danger"
              style={{
                ...styles.dangerBtn,
                opacity: justCompleted ? 0.5 : 1,
              }}
            >
              <MdCancelPresentation size={18} color="#991B1B" />
              <span>Drop order</span>
            </button>
          </div>
        </motion.div>

        <p style={styles.footerNote}>
          Dropping releases your payment back to your wallet. The store is notified.
        </p>
      </div>

      {/* ── Drop confirmation modal ── */}
      <AnimatePresence>
        {showDropModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={styles.modalOverlay}
            onClick={() => {
              if (!dropping) setShowDropModal(false);
            }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={styles.modalCard}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={styles.modalIconWrap}>
                <MdWarning size={26} color="#B45309" />
              </div>

              <h3 style={styles.modalTitle}>Drop this order?</h3>
              <p style={styles.modalBody}>
                Your payment of{' '}
                <strong style={styles.modalAmount}>
                  {total > 0
                    ? `₦${total.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
                    : 'the held amount'}
                </strong>{' '}
                will be released back to your wallet. The store will be notified.
                You can reserve again anytime.
              </p>

              <div style={styles.modalActions}>
                <button
                  onClick={() => setShowDropModal(false)}
                  disabled={dropping}
                  className="rc-modal-keep"
                  style={{
                    ...styles.modalKeepBtn,
                    opacity: dropping ? 0.5 : 1,
                    cursor: dropping ? 'not-allowed' : 'pointer',
                  }}
                >
                  Keep reservation
                </button>
                <button
                  onClick={handleDropOrder}
                  disabled={dropping}
                  className="rc-modal-drop"
                  style={{
                    ...styles.modalDropBtn,
                    opacity: dropping ? 0.7 : 1,
                    cursor: dropping ? 'not-allowed' : 'pointer',
                  }}
                >
                  {dropping ? (
                    <>
                      <span style={styles.inlineSpinnerDark} />
                      <span>Dropping…</span>
                    </>
                  ) : (
                    <span>Yes, drop it</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function ReservationConfirmedPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.container}>
          <AmbientBackground />
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
          </div>
        </main>
      }
    >
      <ReservationConfirmedContent />
    </Suspense>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#FAFAFC',
    padding: '24px 20px 40px',
    overflow: 'hidden',
  },
  bgWrap: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
  },
  loadingWrap: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '70vh',
    gap: 14,
  },
  loadingText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: 500,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #E6E8F0',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'rcSpin 0.9s linear infinite',
  },
  inlineSpinnerDark: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(153,27,27,0.3)',
    borderTopColor: '#991B1B',
    borderRadius: '50%',
    animation: 'rcSpin 0.7s linear infinite',
    marginRight: 8,
  },

  // ── Eyebrow
  eyebrowRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px',
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    borderRadius: 999,
    marginBottom: 20,
  },
  eyebrowIcon: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowText: {
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#065F46',
  },

  // ── Ring hero
  ringWrap: {
    position: 'relative',
    width: 220,
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  ringCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    pointerEvents: 'none',
  },
  ringTime: {
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: -0.8,
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  },
  ringLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#94A3B8',
  },

  // ── Heading
  heading: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0F0F1A',
    margin: 0,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 14.5,
    color: '#5A6178',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 1.5,
    maxWidth: 340,
  },

  // ── Pickup pill
  pickupPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7CCFF',
    borderRadius: 999,
    marginTop: 16,
  },
  pickupPillText: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#0504AA',
  },

  // ── Order card
  card: {
    width: '100%',
    marginTop: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    border: '1px solid #EEF0F7',
    boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 8px 28px rgba(15,23,42,0.06)',
    padding: '18px 20px',
  },
  cardSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  customerName: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0F0F1A',
    margin: 0,
    letterSpacing: -0.4,
  },
  storeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  storeName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#5A6178',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F3F9',
    margin: '18px 0',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    gap: 12,
  },
  rowLabel: {
    fontSize: 13,
    color: '#5A6178',
    fontWeight: 600,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0F0F1A',
  },
  idBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#F6F7FB',
    border: '1px solid #EEF0F7',
    borderRadius: 10,
    padding: '5px 10px',
    cursor: 'pointer',
    transition: 'background-color 160ms, border-color 160ms',
  },
  idCode: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12.5,
    fontWeight: 700,
    color: '#0504AA',
    letterSpacing: 0.2,
  },

  // ── Actions
  actions: {
    width: '100%',
    marginTop: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '16px 20px',
    borderRadius: 16,
    border: 'none',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: -0.1,
    color: '#fff',
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    boxShadow: '0 10px 24px rgba(5,4,170,0.28)',
    cursor: 'pointer',
    transition: 'transform 160ms, box-shadow 200ms',
  },
  primaryBtnFull: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 20px',
    borderRadius: 14,
    border: 'none',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
    cursor: 'pointer',
    marginTop: 20,
  },
  secondaryRow: {
    display: 'flex',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '13px 12px',
    borderRadius: 14,
    border: '1.5px solid #0504AA',
    backgroundColor: '#FFFFFF',
    color: '#0504AA',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background-color 160ms',
  },
  dangerBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '13px 12px',
    borderRadius: 14,
    border: '1.5px solid #FCA5A5',
    backgroundColor: '#FFFFFF',
    color: '#991B1B',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background-color 160ms',
  },
  footerNote: {
    fontSize: 11.5,
    color: '#9AA1B2',
    textAlign: 'center',
    marginTop: 20,
    maxWidth: 320,
    lineHeight: 1.55,
  },

  // ── Error
  errorHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorHeading: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0F0F1A',
    margin: 0,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  errorBody: {
    fontSize: 14,
    color: '#5A6178',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 1.5,
  },

  // ── Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 400,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: '28px 24px 22px',
    boxShadow: '0 24px 60px rgba(15,23,42,0.24)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    border: '1px solid #FDE68A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: '#0F0F1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  modalBody: {
    fontSize: 14,
    color: '#5A6178',
    marginTop: 10,
    lineHeight: 1.55,
    maxWidth: 300,
  },
  modalAmount: {
    color: '#0F0F1A',
    fontWeight: 800,
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  modalKeepBtn: {
    flex: 1,
    padding: '13px 16px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
    fontFamily: 'inherit',
  },
  modalDropBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '13px 16px',
    borderRadius: 14,
    border: '1.5px solid #FCA5A5',
    backgroundColor: '#FFFFFF',
    color: '#991B1B',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // ── Toasts
  toastStack: {
    position: 'fixed',
    top: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 300,
    pointerEvents: 'none',
  },
  toast: {
    pointerEvents: 'auto',
    padding: '10px 16px',
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid transparent',
    boxShadow: '0 6px 18px rgba(15,23,42,0.10)',
    cursor: 'pointer',
    maxWidth: 320,
    animation: 'rcToastIn 220ms ease-out both',
  },
  toastSuccess: {
    backgroundColor: '#ECFDF5',
    color: '#065F46',
    borderColor: '#A7F3D0',
  },
  toastError: {
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
    borderColor: '#FECACA',
  },
};

// ─── Global CSS (single injection) ────────────────────────────────
const GLOBAL_CSS = `
  .rc-grid {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle, rgba(15,23,42,0.06) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%);
  }

  .rc-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    opacity: 0.55;
  }
  .rc-orb-a {
    width: 340px;
    height: 340px;
    top: -120px;
    left: -120px;
    background: radial-gradient(circle, rgba(5,4,170,0.20) 0%, rgba(5,4,170,0) 70%);
    animation: rcFloatA 22s ease-in-out infinite;
  }
  .rc-orb-b {
    width: 400px;
    height: 400px;
    bottom: -140px;
    right: -140px;
    background: radial-gradient(circle, rgba(61,59,255,0.16) 0%, rgba(61,59,255,0) 70%);
    animation: rcFloatB 28s ease-in-out infinite;
  }
  @keyframes rcFloatA {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(24px, -18px) scale(1.08); }
  }
  @keyframes rcFloatB {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(-20px, 22px) scale(0.96); }
  }

  .rc-ring-progress {
    transition: stroke-dashoffset 900ms linear, stroke 400ms ease;
  }

  .rc-ring-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 190px;
    height: 190px;
    margin-left: -95px;
    margin-top: -95px;
    border-radius: 50%;
    border: 2px solid rgba(5,4,170,0.18);
    pointer-events: none;
  }
  .rc-ring-pulse-1 { animation: rcPulse 2.8s ease-out infinite; }
  .rc-ring-pulse-2 { animation: rcPulse 2.8s ease-out infinite; animation-delay: 1.4s; }
  @keyframes rcPulse {
    0%   { transform: scale(0.95); opacity: 0.6; }
    100% { transform: scale(1.45); opacity: 0; }
  }

  .rc-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba(5,4,170,0.32);
  }
  .rc-primary:active {
    transform: translateY(0) scale(0.985);
  }
  .rc-secondary:hover { background-color: #EEF0FF; }
  .rc-secondary:active { background-color: #E2E1FF; }
  .rc-danger:hover { background-color: #FEF2F2; }
  .rc-danger:active { background-color: #FEE2E2; }
  .rc-copy:hover {
    background-color: #EEF0FF;
    border-color: #C7CCFF;
  }
  .rc-modal-keep:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(5,4,170,0.30);
  }
  .rc-modal-keep:active { transform: translateY(0) scale(0.985); }
  .rc-modal-drop:hover { background-color: #FEF2F2; }
  .rc-modal-drop:active { background-color: #FEE2E2; }

  @keyframes rcSpin { to { transform: rotate(360deg); } }
  @keyframes rcToastIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rc-orb, .rc-ring-pulse { animation: none !important; }
    .rc-ring-progress { transition: none !important; }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('rc-global-css')) {
  const s = document.createElement('style');
  s.id = 'rc-global-css';
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}