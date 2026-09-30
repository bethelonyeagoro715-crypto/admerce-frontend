'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  MdAccessTime,
  MdWarning,
  MdClose,
} from 'react-icons/md';
import api, { extractErrorDetail } from '../../services/api';

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
  kind: 'success' | 'error' | 'info';
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

// Conversation ID convention — matches item-detail and chat pages.
function buildConversationId(myUserId: string, otherUserId: string): string {
  const pair = [myUserId || 'me', otherUserId].sort();
  return `${pair[0]}_${pair[1]}`;
}

// ─── Ambient background ───────────────────────────────────────────
function AmbientBackground() {
  return (
    <div style={styles.bgWrap} aria-hidden>
      <div className="bc-grid" />
      <div className="bc-orb bc-orb-a" />
      <div className="bc-orb bc-orb-b" />
    </div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────
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
            ? 'var(--brand-primary)'
            : i % 3 === 1
              ? 'var(--purple-fg)'
              : 'var(--success-fg)';
        return (
          <span
            key={i}
            className="bc-confetti"
            style={{
              backgroundColor: color,
              animationDelay: `${i * 18}ms`,
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

// ─── Detail row ───────────────────────────────────────────────────
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

// ─── Page content ─────────────────────────────────────────────────
function BookingConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingIdFromUrl = searchParams.get('booking_id') || '';
  const hasUrlDisplayData =
    !!searchParams.get('service_name') &&
    !!searchParams.get('provider_name') &&
    !!searchParams.get('amount');

  const [serviceName, setServiceName] = useState(
    searchParams.get('service_name') || 'Service',
  );
  const [providerName, setProviderName] = useState(
    searchParams.get('provider_name') || 'Provider',
  );
  const [providerId, setProviderId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState(
    searchParams.get('customer_name') || '',
  );
  const [scheduledFor, setScheduledFor] = useState(
    searchParams.get('scheduled_for') || '',
  );
  const [amount, setAmount] = useState(searchParams.get('amount') || '0');
  const [bookingId, setBookingId] = useState(bookingIdFromUrl);
  const [status, setStatus] = useState<string>('');

  const [enriching, setEnriching] = useState(
    !!bookingIdFromUrl && !hasUrlDisplayData,
  );
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const pushToast = useCallback(
    (kind: Toast['kind'], text: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, text }].slice(-3));
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        3200,
      );
    },
    [],
  );

  // ── Enrichment ──
  useEffect(() => {
    if (!bookingIdFromUrl) return;

    let cancelled = false;

    (async () => {
      try {
        const data = (await api.getServiceBookingDetail(
          bookingIdFromUrl,
        )) as BookingDetail;

        if (cancelled || !isMountedRef.current) return;

        if (data.booking_id) setBookingId(data.booking_id);
        if (data.service_title || data.title) {
          setServiceName(data.service_title || data.title || 'Service');
        }
        if (data.provider_name) setProviderName(data.provider_name);
        if (data.customer_name) setCustomerName(data.customer_name);
        if (data.provider_id) setProviderId(String(data.provider_id));
        if (data.customer_id) setCustomerId(String(data.customer_id));
        if (data.scheduled_for || data.created_at) {
          setScheduledFor(data.scheduled_for || data.created_at || '');
        }
        if (data.amount != null) setAmount(String(data.amount));
        if (data.status) setStatus(data.status);
      } catch (err: unknown) {
        if (cancelled || !isMountedRef.current) return;
        if (!hasUrlDisplayData) {
          setEnrichError(extractErrorDetail(err, 'Could not load booking details.'));
        }
      } finally {
        if (!cancelled && !hasUrlDisplayData) setEnriching(false);
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
      const detail = extractErrorDetail(err, 'Failed to complete job');
      pushToast('error', detail);
      if (isMountedRef.current) setCompleting(false);
    }
  }, [bookingId, goToReceipt, pushToast]);

  // ── Cancel booking ──
  const handleCancel = useCallback(async () => {
    if (!bookingId) {
      pushToast('error', 'Booking ID missing');
      return;
    }
    setCancelling(true);
    try {
      await api.cancelServiceBooking(bookingId);

      if (!isMountedRef.current) return;

      setShowCancelModal(false);
      pushToast('success', 'Booking cancelled');

      setTimeout(() => {
        router.replace('/shopper/saved?tab=Bookings');
      }, 500);
    } catch (err: unknown) {
      const detail = extractErrorDetail(err, 'Could not cancel this booking');
      pushToast('error', detail);
      if (isMountedRef.current) setCancelling(false);
    }
  }, [bookingId, router, pushToast]);

  // ── Message the other party ──
  const handleMessageAboutBooking = useCallback(async () => {
    if (openingChat) return;
    if (!bookingId) {
      pushToast('error', 'Booking ID missing');
      return;
    }

    if (!providerId && !customerId) {
      pushToast('info', 'Opening your inbox');
      router.push('/shopper/inbox');
      return;
    }

    setOpeningChat(true);
    try {
      const me = (await api.getMyProfile()) as { id?: string };
      const myId = me?.id || '';
      if (!myId) {
        pushToast('error', 'Could not resolve your account');
        setOpeningChat(false);
        return;
      }

      let otherId = '';
      let otherName = '';
      if (myId === customerId && providerId) {
        otherId = providerId;
        otherName = providerName || 'Provider';
      } else if (myId === providerId && customerId) {
        otherId = customerId;
        otherName = customerName || 'Customer';
      } else if (providerId) {
        otherId = providerId;
        otherName = providerName || 'Provider';
      } else if (customerId) {
        otherId = customerId;
        otherName = customerName || 'Customer';
      }

      if (!otherId) {
        pushToast('info', 'Opening your inbox');
        router.push('/shopper/inbox');
        setOpeningChat(false);
        return;
      }

      const conversationId = buildConversationId(myId, otherId);
      const qs = new URLSearchParams();
      qs.set('otherUserId', otherId);
      qs.set('otherUserName', otherName);

      router.push(`/chat/${conversationId}?${qs.toString()}`);
    } catch (err: unknown) {
      const detail = extractErrorDetail(err, 'Could not open chat');
      pushToast('error', detail);
      if (isMountedRef.current) setOpeningChat(false);
    }
  }, [
    openingChat,
    bookingId,
    providerId,
    customerId,
    providerName,
    customerName,
    router,
    pushToast,
  ]);

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
  const isCancelled = status === 'cancelled';

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
            <MdErrorOutline size={44} color="var(--danger-fg)" />
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

      {/* Toasts */}
      <div style={styles.toastStack}>
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            style={{
              ...styles.toast,
              ...(t.kind === 'success'
                ? styles.toastSuccess
                : t.kind === 'error'
                  ? styles.toastError
                  : styles.toastInfo),
            }}
          >
            {t.text}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {/* ── Hero ── */}
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
              borderColor: isCompleted
                ? 'color-mix(in srgb, var(--success-fg) 30%, transparent)'
                : isCancelled
                  ? 'color-mix(in srgb, var(--text-muted) 30%, transparent)'
                  : 'color-mix(in srgb, var(--warning-fg) 30%, transparent)',
            }}
          >
            <div
              style={{
                ...styles.heroIcon,
                background: isCompleted
                  ? 'var(--success-fg)'
                  : isCancelled
                    ? 'var(--text-tertiary)'
                    : 'var(--warning-fg)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {isCompleted ? (
                <MdCheckCircle size={40} color="var(--brand-on-primary)" />
              ) : isCancelled ? (
                <MdClose size={40} color="var(--brand-on-primary)" />
              ) : (
                <MdAccessTime size={40} color="var(--brand-on-primary)" />
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Headline ── */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          style={styles.heading}
        >
          {isCompleted
            ? 'Booking Successful'
            : isCancelled
              ? 'Booking Cancelled'
              : 'Booking Confirmed'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4 }}
          style={styles.subheading}
        >
          {justCompleted
            ? 'Redirecting to your receipt…'
            : isCancelled
              ? 'Your payment has been released back to your wallet.'
              : isCompleted
                ? 'Funds have been released to the provider.'
                : 'Your service has been booked successfully.'}
        </motion.p>

        {/* ── Status chip ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.32 }}
          style={{
            ...styles.statusChip,
            backgroundColor: isCompleted
              ? 'var(--success-bg)'
              : isCancelled
                ? 'var(--bg-tertiary)'
                : 'var(--warning-bg)',
            borderColor: isCompleted
              ? 'var(--success-strong)'
              : isCancelled
                ? 'var(--border-strong)'
                : 'var(--warning-strong)',
          }}
        >
          <span
            className="bc-status-dot"
            style={{
              backgroundColor: isCompleted
                ? 'var(--success-fg)'
                : isCancelled
                  ? 'var(--text-tertiary)'
                  : 'var(--warning-fg)',
            }}
          />
          <span
            style={{
              ...styles.statusChipText,
              color: isCompleted
                ? 'var(--success-fg)'
                : isCancelled
                  ? 'var(--text-secondary)'
                  : 'var(--warning-fg)',
            }}
          >
            {isCompleted
              ? 'Completed'
              : isCancelled
                ? 'Cancelled'
                : 'Confirmed'}
          </span>
        </motion.div>

        {/* ── Detail card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.42 }}
          style={styles.card}
        >
          <DetailRow
            icon={<MdStore size={16} color="var(--brand-primary)" />}
            label="Service"
            value={serviceName}
            emphasis
          />
          <Divider />
          <DetailRow
            icon={<MdPerson size={16} color="var(--brand-primary)" />}
            label="Provider"
            value={providerName}
          />
          {customerName && (
            <>
              <Divider />
              <DetailRow
                icon={<MdPerson size={16} color="var(--brand-primary)" />}
                label="Customer"
                value={customerName}
              />
            </>
          )}
          <Divider />
          <DetailRow
            icon={<MdCalendarToday size={16} color="var(--brand-primary)" />}
            label="When"
            value={formattedDate}
          />
          <Divider />
          <DetailRow
            icon={<MdReceiptLong size={16} color="var(--brand-primary)" />}
            label="Amount"
            value={`₦${amountNumber.toLocaleString('en-NG')}`}
            valueColor="var(--brand-primary)"
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
                    <MdCheck size={14} color="var(--success-fg)" />
                  ) : (
                    <MdContentCopy size={14} color="var(--text-muted)" />
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>

        {/* ── Actions ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.42 }}
          style={styles.actions}
        >
          {isCompleted ? (
            bookingId && (
              <button
                onClick={handleViewReceipt}
                className="bc-primary"
                style={styles.primaryBtn}
              >
                <MdReceiptLong size={20} color="var(--brand-on-gradient)" />
                <span>View Receipt</span>
              </button>
            )
          ) : isCancelled ? (
            <button
              onClick={() => router.push('/shopper/home')}
              className="bc-primary"
              style={styles.primaryBtn}
            >
              <MdHome size={20} color="var(--brand-on-gradient)" />
              <span>Back to Home</span>
            </button>
          ) : (
            bookingId && (
              <button
                onClick={handleJobDone}
                disabled={completing}
                className="bc-primary"
                style={{
                  ...styles.primaryBtn,
                  background: completing
                    ? 'var(--text-muted)'
                    : 'var(--success-fg)',
                  boxShadow: completing ? 'none' : 'var(--shadow-md)',
                  cursor: completing ? 'not-allowed' : 'pointer',
                }}
              >
                {completing ? (
                  <span style={styles.inlineSpinner} />
                ) : (
                  <MdWork size={20} color="var(--brand-on-primary)" />
                )}
                <span>{completing ? 'Completing…' : 'Job Done'}</span>
              </button>
            )
          )}

          {/* Secondary actions */}
          {!isCancelled && (
            <div style={styles.secondaryRow}>
              <button
                onClick={() => router.push('/shopper/saved?tab=Bookings')}
                className="bc-secondary"
                style={styles.secondaryBtn}
              >
                <MdListAlt size={18} color="var(--brand-primary)" />
                <span>All bookings</span>
              </button>
              <button
                onClick={() => router.push('/shopper/home')}
                className="bc-secondary"
                style={styles.secondaryBtn}
              >
                <MdHome size={18} color="var(--brand-primary)" />
                <span>Home</span>
              </button>
            </div>
          )}

          {/* Message — routes directly to chat with the other party */}
          {bookingId && !isCancelled && (
            <button
              onClick={handleMessageAboutBooking}
              disabled={openingChat}
              className="bc-ghost"
              style={{
                ...styles.ghostBtn,
                opacity: openingChat ? 0.6 : 1,
                cursor: openingChat ? 'wait' : 'pointer',
              }}
            >
              {openingChat ? (
                <span style={styles.inlineSpinnerSmall} />
              ) : (
                <MdChat size={16} color="var(--text-secondary)" />
              )}
              <span>
                {openingChat ? 'Opening chat…' : 'Message about this booking'}
              </span>
            </button>
          )}
        </motion.div>

        {/* Footer note */}
        <p style={styles.footerNote}>
          {isCancelled
            ? 'You can book again anytime from this provider\u2019s page.'
            : isCompleted
              ? 'Your receipt is the official record of this transaction.'
              : 'You\u2019ll be able to view the receipt once the job is complete.'}
        </p>

        {/* Cancel link */}
        {!isCompleted && !isCancelled && bookingId && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="bc-cancel-link"
            style={styles.cancelLink}
            aria-label="Cancel booking"
          >
            Cancel this booking
          </button>
        )}
      </div>

      {/* ── Cancel confirmation modal ── */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={styles.modalOverlay}
            onClick={() => {
              if (!cancelling) setShowCancelModal(false);
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
                <MdWarning size={26} color="var(--warning-fg)" />
              </div>

              <h3 style={styles.modalTitle}>Cancel this booking?</h3>
              <p style={styles.modalBody}>
                {providerName} will be notified. Your payment of{' '}
                <strong style={styles.modalAmount}>
                  ₦{amountNumber.toLocaleString('en-NG')}
                </strong>{' '}
                will be released back to your wallet. This can&rsquo;t be
                undone.
              </p>

              <div style={styles.modalActions}>
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  className="bc-modal-keep"
                  style={{
                    ...styles.modalKeepBtn,
                    opacity: cancelling ? 0.5 : 1,
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                  }}
                >
                  Keep booking
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="bc-modal-cancel"
                  style={{
                    ...styles.modalCancelBtn,
                    opacity: cancelling ? 0.7 : 1,
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cancelling ? (
                    <>
                      <span style={styles.inlineSpinnerDark} />
                      <span>Cancelling…</span>
                    </>
                  ) : (
                    <span>Yes, cancel</span>
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
    backgroundColor: 'var(--bg-primary)',
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
    border: '3px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
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
  inlineSpinnerSmall: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid var(--border-strong)',
    borderTopColor: 'var(--text-secondary)',
    borderRadius: '50%',
    animation: 'bcSpin 0.7s linear infinite',
    marginRight: 6,
  },
  inlineSpinnerDark: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid var(--danger-strong)',
    borderTopColor: 'var(--danger-fg)',
    borderRadius: '50%',
    animation: 'bcSpin 0.7s linear infinite',
    marginRight: 8,
  },

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
    backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)',
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
  confettiWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    pointerEvents: 'none',
    zIndex: 3,
  },

  heading: {
    fontSize: 30,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 1.5,
    maxWidth: 340,
  },

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

  card: {
    width: '100%',
    marginTop: 24,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 22,
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-md)',
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
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
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
    backgroundColor: 'var(--border-subtle)',
    margin: 0,
  },
  idRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 0',
  },
  idLabel: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  idValueBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-subtle)',
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
    color: 'var(--brand-primary)',
    letterSpacing: 0.2,
  },

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
    color: 'var(--brand-on-gradient)',
    background: 'var(--brand-gradient)',
    boxShadow: 'var(--shadow-brand)',
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
    color: 'var(--brand-on-gradient)',
    background: 'var(--brand-gradient)',
    boxShadow: 'var(--shadow-brand)',
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
    border: '1.5px solid var(--brand-primary)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--brand-primary)',
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
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },

  cancelLink: {
    marginTop: 20,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 12.5,
    fontWeight: 600,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    cursor: 'pointer',
    padding: '6px 10px',
    fontFamily: 'inherit',
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
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  errorBody: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 1.5,
  },
  footerNote: {
    fontSize: 12,
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: 24,
    maxWidth: 320,
    lineHeight: 1.55,
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 400,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 22,
    padding: '28px 24px 22px',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  modalBody: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginTop: 10,
    lineHeight: 1.55,
    maxWidth: 300,
  },
  modalAmount: {
    color: 'var(--text-primary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-brand)',
    fontFamily: 'inherit',
  },
  modalCancelBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '13px 16px',
    borderRadius: 14,
    border: '1.5px solid var(--danger-strong)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--danger-fg)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

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
    boxShadow: 'var(--shadow-md)',
    cursor: 'pointer',
    maxWidth: 320,
    animation: 'bcToastIn 220ms ease-out both',
  },
  toastSuccess: {
    backgroundColor: 'var(--success-bg)',
    color: 'var(--success-fg)',
    borderColor: 'var(--success-strong)',
  },
  toastError: {
    backgroundColor: 'var(--danger-bg)',
    color: 'var(--danger-fg)',
    borderColor: 'var(--danger-strong)',
  },
  toastInfo: {
    backgroundColor: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
    borderColor: 'var(--brand-soft-strong)',
  },
};

// ─── Global CSS ────────────────────────────────────────────────────
const GLOBAL_CSS = `
  .bc-grid {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle, color-mix(in srgb, var(--text-primary) 6%, transparent) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%);
  }

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
    background: radial-gradient(circle,
      color-mix(in srgb, var(--brand-primary) 20%, transparent) 0%,
      transparent 70%);
    animation: bcFloatA 22s ease-in-out infinite;
  }
  .bc-orb-b {
    width: 400px;
    height: 400px;
    bottom: -140px;
    right: -140px;
    background: radial-gradient(circle,
      color-mix(in srgb, var(--brand-primary) 16%, transparent) 0%,
      transparent 70%);
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

  .bc-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 96px;
    height: 96px;
    margin-left: -48px;
    margin-top: -48px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--brand-primary) 22%, transparent);
    pointer-events: none;
  }
  .bc-pulse-1 { animation: bcPulse 2.6s ease-out infinite; }
  .bc-pulse-2 { animation: bcPulse 2.6s ease-out infinite; animation-delay: 1.3s; }

  @keyframes bcPulse {
    0%   { transform: scale(0.9); opacity: 0.65; }
    100% { transform: scale(1.8); opacity: 0; }
  }

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
      transform: translate(-50%, -50%) rotate(0deg) scale(0.4);
      opacity: 0;
    }
    20% { opacity: 1; }
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

  .bc-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-brand);
  }
  .bc-primary:active {
    transform: translateY(0) scale(0.985);
  }
  .bc-secondary:hover { background-color: var(--brand-soft); }
  .bc-secondary:active { background-color: var(--brand-soft-strong); }
  .bc-ghost:hover { color: var(--brand-primary); }
  .bc-copy-btn:hover {
    background-color: var(--brand-soft);
    border-color: color-mix(in srgb, var(--brand-primary) 40%, transparent);
  }
  .bc-cancel-link:hover {
    color: var(--danger-fg);
  }
  .bc-modal-keep:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-brand);
  }
  .bc-modal-keep:active {
    transform: translateY(0) scale(0.985);
  }
  .bc-modal-cancel:hover {
    background-color: var(--danger-bg);
  }
  .bc-modal-cancel:active {
    background-color: var(--danger-bg);
  }

  @keyframes bcSpin { to { transform: rotate(360deg); } }
  @keyframes bcToastIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: none; }
  }

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