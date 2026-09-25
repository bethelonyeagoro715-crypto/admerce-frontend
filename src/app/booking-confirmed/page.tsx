'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MdCheckCircle,
  MdCalendarToday,
  MdStore,
  MdReceiptLong,
  MdHome,
  MdListAlt,
  MdWork,
  MdErrorOutline,
  MdPerson,
  MdChat,
  MdContentCopy,
  MdCheck,
  MdLocationOn,
  MdAccessTime,
} from 'react-icons/md';
import api from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────
interface BookingDetail {
  booking_id?: string;
  service_id?: string;
  service_title?: string;
  title?: string;
  provider_id?: string;
  provider_name?: string;
  customer_id?: string;
  customer_name?: string;
  status?: string;
  amount?: number | string;
  scheduled_for?: string;
  created_at?: string;
  notes?: string;
  [key: string]: unknown;
}

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

// ─── Helpers ──────────────────────────────────────────────────────
function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return 'Not specified';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function shortId(id: string): string {
  if (!id) return '';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

// ─── Ambient background elements ──────────────────────────────────
function AmbientBackground() {
  return (
    <div style={styles.bgWrap} aria-hidden>
      <div className="bc-grid" />
      <div className="bc-orb bc-orb-a" />
      <div className="bc-orb bc-orb-b" />
    </div>
  );
}

// ─── Confetti burst — CSS-only, no dependency ─────────────────────
function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 16 });
  return (
    <div style={styles.confettiWrap} aria-hidden>
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * 360;
        const distance = 90 + (i % 4) * 22;
        const rotate = (i * 47) % 360;
        const color =
          i % 3 === 0
            ? '#0504AA'
            : i % 3 === 1
              ? '#3D3BFF'
              : '#16A34A';
        return (
          <span
            key={i}
            className="bc-confetti"
            style={{
              backgroundColor: color,
              animationDelay: `${i * 18}ms`,
              // CSS variables consumed by the keyframe
              ['--bc-angle' as never]: `${angle}deg`,
              ['--bc-distance' as never]: `${distance}px`,
              ['--bc-rotate' as never]: `${rotate}deg`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────
function BookingConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingIdFromUrl = searchParams.get('booking_id') || '';

  const [serviceName, setServiceName] = useState(
    searchParams.get('service_name') || 'Service',
  );
  const [providerName, setProviderName] = useState(
    searchParams.get('provider_name') || 'Provider',
  );
  const [customerName, setCustomerName] = useState(
    searchParams.get('customer_name') || '',
  );
  const [scheduledFor, setScheduledFor] = useState(
    searchParams.get('scheduled_for') || '',
  );
  const [amount, setAmount] = useState(searchParams.get('amount') || '0');
  const [bookingId, setBookingId] = useState(bookingIdFromUrl);
  const [status, setStatus] = useState<string>('');

  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const isMountedRef = useRef(true);
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

  // ── Enrichment (unchanged logic) ──
  useEffect(() => {
    if (!bookingIdFromUrl) return;

    const hasFullUrl =
      !!searchParams.get('service_name') &&
      !!searchParams.get('provider_name') &&
      !!searchParams.get('amount');

    if (hasFullUrl) return;

    let cancelled = false;

    (async () => {
      setEnriching(true);
      setEnrichError(null);
      try {
        const data = (await api.getServiceBookingDetail(
          bookingIdFromUrl,
        )) as BookingDetail;

        if (cancelled) return;

        setBookingId(data.booking_id || bookingIdFromUrl);
        setServiceName(data.service_title || data.title || 'Service');
        setProviderName(data.provider_name || 'Provider');
        setCustomerName(data.customer_name || '');
        setScheduledFor(data.scheduled_for || data.created_at || '');
        setAmount(String(data.amount ?? 0));
        setStatus(data.status || '');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not load booking details.';
        setEnrichError(msg);
      } finally {
        if (!cancelled) setEnriching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingIdFromUrl]);

  // ── Receipt navigation ──
  const goToReceipt = useCallback(
    (overrideStatus?: string) => {
      if (!bookingId) {
        pushToast('error', 'Booking ID missing');
        return;
      }
      const qs = new URLSearchParams();
      if (serviceName) qs.set('service_name', serviceName);
      if (providerName) qs.set('provider_name', providerName);
      if (customerName) qs.set('customer_name', customerName);
      if (amount) qs.set('amount', String(amount));
      const s = overrideStatus || status;
      if (s) qs.set('status', s);
      if (scheduledFor) qs.set('scheduled_for', scheduledFor);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      router.push(`/receipt/service/${bookingId}${suffix}`);
    },
    [
      bookingId,
      serviceName,
      providerName,
      customerName,
      amount,
      status,
      scheduledFor,
      router,
      pushToast,
    ],
  );

  const handleViewReceipt = useCallback(() => {
    goToReceipt();
  }, [goToReceipt]);

  // ── Job Done ──
  const handleJobDone = useCallback(async () => {
    if (!bookingId) {
      pushToast('error', 'Booking ID missing');
      return;
    }
    setCompleting(true);
    try {
      await api.completeServiceBooking(bookingId);

      try {
        const refreshed = (await api.getServiceBookingDetail(
          bookingId,
        )) as BookingDetail;
        if (isMountedRef.current) setStatus(refreshed.status || 'completed');
      } catch {
        if (isMountedRef.current) setStatus('completed');
      }

      if (isMountedRef.current) setJustCompleted(true);

      setTimeout(() => {
        goToReceipt('completed');
      }, 700);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to complete job';
      pushToast('error', detail);
      setCompleting(false);
    }
  }, [bookingId, goToReceipt, pushToast]);

  const handleCopyId = useCallback(async () => {
    if (!bookingId) return;
    try {
      await navigator.clipboard.writeText(bookingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      pushToast('error', 'Could not copy');
    }
  }, [bookingId, pushToast]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/shopper/home');
    }
  };

  const formattedDate = fmtDateTime(scheduledFor);
  const amountNumber = Number(amount) || 0;
  const isCompleted = status === 'completed' || justCompleted;

  // ── Loading ──
  if (enriching) {
    return (
      <main style={styles.container}>
        <AmbientBackground />
        <div style={{ ...styles.content, alignItems: 'center' }}>
          <div style={styles.spinner} />
        </div>
      </main>
    );
  }

  // ── Hard error ──
  if (enrichError && !bookingId) {
    return (
      <main style={styles.container}>
        <AmbientBackground />
        <div style={{ ...styles.content, alignItems: 'center' }}>
          <div style={styles.errorHalo}>
            <MdErrorOutline size={44} color="#B91C1C" />
          </div>
          <h2 style={styles.errorHeading}>We couldn&rsquo;t load this booking</h2>
          <p style={styles.errorBody}>{enrichError}</p>
          <button onClick={handleBack} style={styles.primaryBtnFull}>
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <AmbientBackground />

      {/* Toast stack */}
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
        {/* ─── Hero ─────────────────────────────────────────── */}
        <div style={styles.heroWrap}>
          <ConfettiBurst active={justCompleted} />

          <div className="bc-pulse bc-pulse-1" aria-hidden />
          <div className="bc-pulse bc-pulse-2" aria-hidden />

          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            style={{
              ...styles.heroIconRing,
              borderColor: isCompleted ? 'rgba(22,163,74,0.28)' : 'rgba(217,119,6,0.28)',
            }}
          >
            <div
              style={{
                ...styles.heroIcon,
                background: isCompleted
                  ? 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)'
                  : 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
                boxShadow: isCompleted
                  ? '0 14px 32px rgba(22,163,74,0.32), inset 0 1px 0 rgba(255,255,255,0.28)'
                  : '0 14px 32px rgba(217,119,6,0.32), inset 0 1px 0 rgba(255,255,255,0.28)',
              }}
            >
              {isCompleted ? (
                <MdCheckCircle size={40} color="#fff" />
              ) : (
                <MdAccessTime size={40} color="#fff" />
              )}
            </div>
          </motion.div>
        </div>

        {/* ─── Headline ─────────────────────────────────────── */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          style={styles.heading}
        >
          {isCompleted ? 'Booking Successful' : 'Booking Confirmed'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4 }}
          style={styles.subheading}
        >
          {justCompleted
            ? 'Redirecting to your receipt…'
            : isCompleted
              ? 'Funds have been released to the provider.'
              : 'Your service has been booked successfully.'}
        </motion.p>

        {/* ─── Status chip ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.32 }}
          style={{
            ...styles.statusChip,
            backgroundColor: isCompleted ? '#ECFDF5' : '#FEF3C7',
            borderColor: isCompleted ? '#A7F3D0' : '#FDE68A',
          }}
        >
          <span
            className="bc-status-dot"
            style={{
              backgroundColor: isCompleted ? '#16A34A' : '#D97706',
            }}
          />
          <span
            style={{
              ...styles.statusChipText,
              color: isCompleted ? '#065F46' : '#92400E',
            }}
          >
            {isCompleted ? 'Completed' : 'Confirmed'}
          </span>
        </motion.div>

        {/* ─── Detail card ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.42 }}
          style={styles.card}
        >
          <DetailRow
            icon={<MdStore size={16} color="#0504AA" />}
            label="Service"
            value={serviceName}
            emphasis
          />
          <Divider />
          <DetailRow
            icon={<MdPerson size={16} color="#0504AA" />}
            label="Provider"
            value={providerName}
          />
          {customerName && (
            <>
              <Divider />
              <DetailRow
                icon={<MdPerson size={16} color="#0504AA" />}
                label="Customer"
                value={customerName}
              />
            </>
          )}
          <Divider />
          <DetailRow
            icon={<MdCalendarToday size={16} color="#0504AA" />}
            label="When"
            value={formattedDate}
          />
          <Divider />
          <DetailRow
            icon={<MdReceiptLong size={16} color="#0504AA" />}
            label="Amount"
            value={`₦${amountNumber.toLocaleString('en-NG')}`}
            valueColor="#0504AA"
            emphasis
          />
          {bookingId && (
            <>
              <Divider />
              <div style={styles.idRow}>
                <span style={styles.idLabel}>Booking ID</span>
                <button
                  onClick={handleCopyId}
                  className="bc-copy-btn"
                  style={styles.idValueBtn}
                  aria-label="Copy booking ID"
                >
                  <code style={styles.idCode}>{shortId(bookingId)}</code>
                  {copied ? (
                    <MdCheck size={14} color="#16A34A" />
                  ) : (
                    <MdContentCopy size={14} color="#94A3B8" />
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>

        {/* ─── Actions ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.42 }}
          style={styles.actions}
        >
          {isCompleted ? (
            // ── Completed: View Receipt is primary ──
            bookingId && (
              <button
                onClick={handleViewReceipt}
                className="bc-primary"
                style={styles.primaryBtn}
              >
                <MdReceiptLong size={20} color="#fff" />
                <span>View Receipt</span>
              </button>
            )
          ) : (
            // ── Confirmed: Job Done is primary ──
            bookingId && (
              <button
                onClick={handleJobDone}
                disabled={completing}
                className="bc-primary"
                style={{
                  ...styles.primaryBtn,
                  background: completing
                    ? '#9AA1B2'
                    : 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
                  boxShadow: completing
                    ? 'none'
                    : '0 10px 24px rgba(22,163,74,0.30)',
                  cursor: completing ? 'not-allowed' : 'pointer',
                }}
              >
                {completing ? (
                  <span style={styles.inlineSpinner} />
                ) : (
                  <MdWork size={20} color="#fff" />
                )}
                <span>{completing ? 'Completing…' : 'Job Done'}</span>
              </button>
            )
          )}

          {/* Secondary actions */}
          <div style={styles.secondaryRow}>
            <button
              onClick={() => router.push('/shopper/saved?tab=Bookings')}
              className="bc-secondary"
              style={styles.secondaryBtn}
            >
              <MdListAlt size={18} color="#0504AA" />
              <span>All bookings</span>
            </button>
            <button
              onClick={() => router.push('/shopper/home')}
              className="bc-secondary"
              style={styles.secondaryBtn}
            >
              <MdHome size={18} color="#0504AA" />
              <span>Home</span>
            </button>
          </div>

          {/* Message link — tertiary */}
          {bookingId && (
            <button
              onClick={() => router.push('/shopper/inbox')}
              className="bc-ghost"
              style={styles.ghostBtn}
            >
              <MdChat size={16} color="#5A6178" />
              <span>Message about this booking</span>
            </button>
          )}
        </motion.div>

        {/* Faint footer note */}
        <p style={styles.footerNote}>
          {isCompleted
            ? 'Your receipt is the official record of this transaction.'
            : 'You\u2019ll be able to view the receipt once the job is complete.'}
        </p>
      </div>
    </main>
  );
}

// ─── Card row ─────────────────────────────────────────────────────
function DetailRow({
  icon,
  label,
  value,
  emphasis,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasis?: boolean;
  valueColor?: string;
}) {
  return (
    <div style={styles.row}>
      <div style={styles.rowLabel}>
        {icon}
        <span style={styles.rowLabelText}>{label}</span>
      </div>
      <span
        style={{
          ...styles.rowValue,
          ...(emphasis ? styles.rowValueEmphasis : null),
          ...(valueColor ? { color: valueColor } : null),
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={styles.divider} />;
}

export default function BookingConfirmedPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.container}>
          <AmbientBackground />
          <div style={{ ...styles.content, alignItems: 'center' }}>
            <div style={styles.spinner} />
          </div>
        </main>
      }
    >
      <BookingConfirmedContent />
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
    padding: '32px 24px 48px',
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

  // ── Background
  bgWrap: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #E6E8F0',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'bcSpin 0.9s linear infinite',
  },
  inlineSpinner: {
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'bcSpin 0.7s linear infinite',
    marginRight: 2,
  },

  // ── Hero
  heroWrap: {
    position: 'relative',
    width: 120,
    height: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heroIconRing: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(6px)',
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Confetti
  confettiWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    pointerEvents: 'none',
    zIndex: 3,
  },

  // ── Headline
  heading: {
    fontSize: 30,
    fontWeight: 800,
    color: '#0F0F1A',
    margin: 0,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    color: '#5A6178',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 1.5,
    maxWidth: 340,
  },

  // ── Status chip
  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px',
    borderRadius: 999,
    border: '1px solid',
    marginTop: 18,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Card
  card: {
    width: '100%',
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    border: '1px solid #EEF0F7',
    boxShadow:
      '0 1px 2px rgba(15,23,42,0.03), 0 8px 28px rgba(15,23,42,0.06)',
    padding: '6px 18px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 0',
  },
  rowLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  rowLabelText: {
    fontSize: 13,
    color: '#5A6178',
    fontWeight: 600,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0F0F1A',
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '58%',
  },
  rowValueEmphasis: {
    fontWeight: 800,
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F3F9',
    margin: 0,
  },

  // ── Booking ID
  idRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 0',
  },
  idLabel: {
    fontSize: 13,
    color: '#5A6178',
    fontWeight: 600,
  },
  idValueBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#F6F7FB',
    border: '1px solid #EEF0F7',
    borderRadius: 10,
    padding: '7px 12px',
    cursor: 'pointer',
    transition: 'background-color 160ms, border-color 160ms',
  },
  idCode: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 13,
    fontWeight: 700,
    color: '#0504AA',
    letterSpacing: 0.2,
  },

  // ── Actions
  actions: {
    width: '100%',
    marginTop: 24,
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
    padding: '13px 14px',
    borderRadius: 14,
    border: '1.5px solid #0504AA',
    backgroundColor: '#FFFFFF',
    color: '#0504AA',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background-color 160ms, transform 160ms',
  },
  ghostBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '11px 14px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#5A6178',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
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
    marginBottom: 18,
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

  // ── Footer note
  footerNote: {
    fontSize: 12,
    color: '#9AA1B2',
    textAlign: 'center',
    marginTop: 24,
    maxWidth: 320,
    lineHeight: 1.55,
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
    animation: 'bcToastIn 220ms ease-out both',
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

// ─── Global keyframes (single injection) ──────────────────────────
const GLOBAL_CSS = `
  /* Background dot grid */
  .bc-grid {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle, rgba(15,23,42,0.06) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%);
  }

  /* Soft brand orbs */
  .bc-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    opacity: 0.55;
  }
  .bc-orb-a {
    width: 340px;
    height: 340px;
    top: -120px;
    left: -120px;
    background: radial-gradient(circle, rgba(5,4,170,0.20) 0%, rgba(5,4,170,0) 70%);
    animation: bcFloatA 22s ease-in-out infinite;
  }
  .bc-orb-b {
    width: 400px;
    height: 400px;
    bottom: -140px;
    right: -140px;
    background: radial-gradient(circle, rgba(61,59,255,0.16) 0%, rgba(61,59,255,0) 70%);
    animation: bcFloatB 28s ease-in-out infinite;
  }
  @keyframes bcFloatA {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(24px, -18px) scale(1.08); }
  }
  @keyframes bcFloatB {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(-20px, 22px) scale(0.96); }
  }

  /* Pulse rings around hero */
  .bc-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 96px;
    height: 96px;
    margin-left: -48px;
    margin-top: -48px;
    border-radius: 50%;
    border: 2px solid rgba(5,4,170,0.22);
    pointer-events: none;
  }
  .bc-pulse-1 { animation: bcPulse 2.6s ease-out infinite; }
  .bc-pulse-2 { animation: bcPulse 2.6s ease-out infinite; animation-delay: 1.3s; }

  @keyframes bcPulse {
    0%   { transform: scale(0.9); opacity: 0.65; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  /* Status dot pulse */
  .bc-status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: bcDotPulse 2s ease-in-out infinite;
  }
  @keyframes bcDotPulse {
    0%, 100% { transform: scale(1);   opacity: 1; }
    50%      { transform: scale(1.35); opacity: 0.55; }
  }

  /* Confetti particle */
  .bc-confetti {
    position: absolute;
    top: 0;
    left: 0;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    opacity: 0;
    animation: bcConfettiOut 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes bcConfettiOut {
    0% {
      transform:
        translate(-50%, -50%) rotate(0deg) scale(0.4);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    100% {
      transform:
        translate(
          calc(-50% + cos(var(--bc-angle)) * var(--bc-distance)),
          calc(-50% + sin(var(--bc-angle)) * var(--bc-distance))
        )
        rotate(var(--bc-rotate))
        scale(1);
      opacity: 0;
    }
  }

  /* Primary button hover */
  .bc-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba(5,4,170,0.32);
  }
  .bc-primary:active {
    transform: translateY(0) scale(0.985);
  }

  /* Secondary button hover */
  .bc-secondary:hover {
    background-color: #EEF0FF;
  }
  .bc-secondary:active {
    background-color: #E2E1FF;
  }

  /* Ghost button hover */
  .bc-ghost:hover {
    color: #0504AA;
  }

  /* Copy button hover */
  .bc-copy-btn:hover {
    background-color: #EEF0FF;
    border-color: #C7CCFF;
  }

  /* Keyframes for spinner + toast */
  @keyframes bcSpin { to { transform: rotate(360deg); } }
  @keyframes bcToastIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: none; }
  }

  /* Respect users who prefer reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .bc-orb, .bc-pulse, .bc-status-dot, .bc-confetti {
      animation: none !important;
    }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('bc-global-css')) {
  const s = document.createElement('style');
  s.id = 'bc-global-css';
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}