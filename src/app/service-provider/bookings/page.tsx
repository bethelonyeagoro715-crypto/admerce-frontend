'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { confirmDialog, alertDialog, promptDialog } from '../../../components/ui/dialogs';
import {
  MdRefresh,
  MdCalendarToday,
  MdCheckCircle,
  MdCancel,
  MdSearch,
  MdClose,
  MdErrorOutline,
  MdDesignServices,
  MdAccessTime,
} from 'react-icons/md';

interface Booking {
  booking_id?: string;
  id?: string;
  status?: string;
  amount?: number;
  service_title?: string;
  user_name?: string;
  customer_name?: string;
  booking_date?: string;
  scheduled_for?: string;
  created_at?: string;
  notes?: string;
  [key: string]: unknown;
}

type FilterKey = 'all' | 'new' | 'confirmed' | 'completed' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function formatNaira(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '₦0';
  return `₦${Math.round(v).toLocaleString('en-NG')}`;
}

function bookingId(b: Booking): string {
  return String(b.booking_id ?? b.id ?? '');
}

function customerName(b: Booking): string {
  return b.customer_name || b.user_name || 'Customer';
}

function bookingDate(b: Booking): string {
  return String(b.scheduled_for || b.booking_date || b.created_at || '');
}

function fmtDate(raw: string): string {
  if (!raw) return 'Date not set';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return raw;
  }
}

function isNewStatus(s: string): boolean {
  const l = s.toLowerCase();
  return l === 'locked' || l === 'pending';
}

function isConfirmedStatus(s: string): boolean {
  return s.toLowerCase() === 'accepted';
}

function isCompletedStatus(s: string): boolean {
  return s.toLowerCase() === 'completed';
}

function isCancelledStatus(s: string): boolean {
  const l = s.toLowerCase();
  return l === 'cancelled' || l === 'declined';
}

interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
}

function statusMeta(status: string): StatusMeta {
  const s = (status || 'pending').toLowerCase();
  if (s === 'locked' || s === 'pending') {
    return { label: 'New', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' };
  }
  if (s === 'accepted') {
    return { label: 'Confirmed', bg: 'var(--info-bg)', fg: 'var(--info-fg)' };
  }
  if (s === 'completed') {
    return { label: 'Completed', bg: 'var(--success-bg)', fg: 'var(--success-fg)' };
  }
  if (s === 'cancelled' || s === 'declined') {
    return { label: 'Cancelled', bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' };
  }
  return { label: status || 'Pending', bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };
}

export default function ServiceProviderBookingsPage() {
  useAuthGuard();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadBookings = useCallback(async (showSpinner = true) => {
    const seq = ++reqSeq.current;
    if (showSpinner) setLoading(true);
    setErrored(false);
    try {
      const data = (await api.getProviderBookings()) as Booking[];
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      if (seq === reqSeq.current && isMountedRef.current) setErrored(true);
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadBookings(), 0);
    return () => window.clearTimeout(t);
  }, [loadBookings]);

  const buckets = useMemo(() => {
    const newB: Booking[] = [];
    const confirmed: Booking[] = [];
    const completed: Booking[] = [];
    const cancelled: Booking[] = [];
    for (const b of bookings) {
      const s = (b.status || '').toLowerCase();
      if (isNewStatus(s)) newB.push(b);
      else if (isConfirmedStatus(s)) confirmed.push(b);
      else if (isCompletedStatus(s)) completed.push(b);
      else if (isCancelledStatus(s)) cancelled.push(b);
    }
    return { newB, confirmed, completed, cancelled };
  }, [bookings]);

  const counts = useMemo(
    () => ({
      all: bookings.length,
      new: buckets.newB.length,
      confirmed: buckets.confirmed.length,
      completed: buckets.completed.length,
      cancelled: buckets.cancelled.length,
    }),
    [bookings.length, buckets],
  );

  const filtered = useMemo(() => {
    let base: Booking[];
    switch (activeFilter) {
      case 'new':
        base = buckets.newB;
        break;
      case 'confirmed':
        base = buckets.confirmed;
        break;
      case 'completed':
        base = buckets.completed;
        break;
      case 'cancelled':
        base = buckets.cancelled;
        break;
      default:
        base = bookings;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((b) => {
      const name = customerName(b).toLowerCase();
      const service = (b.service_title || '').toLowerCase();
      const id = bookingId(b).toLowerCase();
      return name.includes(q) || service.includes(q) || id.includes(q);
    });
  }, [activeFilter, buckets, bookings, searchQuery]);

  const handleAccept = async (b: Booking) => {
    const id = bookingId(b);
    if (!id) return;
    const customer = customerName(b);
    const ok = await confirmDialog({
      title: 'Accept this booking?',
      body: `${b.service_title || 'The service'} for ${customer}. They'll be notified that you're on the job.`,
      kind: 'info',
      confirmLabel: 'Accept',
      cancelLabel: 'Not now',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.acceptServiceBooking(id);
      await loadBookings(false);
      await alertDialog({
        title: 'Booking accepted',
        body: `${customer} has been notified.`,
        kind: 'success',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't accept",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyId(null);
    }
  };

  const handleDecline = async (b: Booking) => {
    const id = bookingId(b);
    if (!id) return;
    const customer = customerName(b);
    const reason = await promptDialog({
      title: 'Decline this booking?',
      body: `${customer} will be refunded in full and notified. Optional reason helps them understand.`,
      kind: 'warning',
      placeholder: 'e.g. Fully booked, Outside my area…',
      multiline: true,
      confirmLabel: 'Decline & refund',
      cancelLabel: 'Keep booking',
      required: false,
    });
    if (reason === null) return;
    setBusyId(id);
    try {
      await api.declineServiceBooking(id, reason.trim() || undefined);
      await loadBookings(false);
      await alertDialog({
        title: 'Booking declined',
        body: `${customer} has been refunded and notified.`,
        kind: 'success',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't decline",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyId(null);
    }
  };

  const handleComplete = async (b: Booking) => {
    const id = bookingId(b);
    if (!id) return;
    const customer = customerName(b);
    const ok = await confirmDialog({
      title: 'Mark as complete?',
      body: `Confirm that you've finished ${b.service_title || 'this job'} for ${customer}. Payment will be released to your wallet.`,
      kind: 'info',
      confirmLabel: 'Complete & release',
      cancelLabel: 'Not yet',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      // /confirm is the provider-side "mark complete" endpoint.
      await api.confirmServiceBooking(id);
      await loadBookings(false);
      await alertDialog({
        title: 'Booking completed',
        body: 'Payment has been released to your wallet.',
        kind: 'success',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't complete",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyId(null);
    }
  };

  if (loading) {
    return (
      <main style={css.root} className="sp-bookings">
        <style>{CSS}</style>
        <div style={css.headerWrap}>
          <div style={css.headerInner}>
            <div style={css.headerSkel} />
            <div style={{ ...css.headerSkel, width: 100 }} />
          </div>
        </div>
        <div style={css.sheet}>
          <div style={css.searchSkeleton} />
          <div style={css.pillRowSkeleton} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={css.cardSkeleton} />
          ))}
        </div>
      </main>
    );
  }

  if (errored) {
    return (
      <main style={css.centerRoot} className="sp-bookings">
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="var(--danger-fg)" />
        </div>
        <h2 style={css.centerTitle}>Couldn&apos;t load your bookings</h2>
        <p style={css.centerBody}>
          Check your connection and try again. If this keeps happening, sign out and back in.
        </p>
        <button onClick={() => void loadBookings()} style={css.centerPrimary}>
          <MdRefresh size={18} color="var(--brand-on-gradient)" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  const hasNoBookings = bookings.length === 0;
  const hasNoMatches = !hasNoBookings && filtered.length === 0;

  return (
    <main style={css.root} className="sp-bookings">
      <style>{CSS}</style>

      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={css.title}>Bookings</h1>
            <div style={css.subtitle}>
              {hasNoBookings
                ? 'Bookings will show up here'
                : `${counts.all} total · ${counts.new} new${
                    counts.confirmed > 0 ? ` · ${counts.confirmed} confirmed` : ''
                  }`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadBookings()}
            style={css.refreshBtn}
            aria-label="Refresh"
            className="sp-refresh"
          >
            <MdRefresh size={20} color="var(--brand-on-gradient)" />
          </button>
        </div>
      </div>

      <div style={css.sheet}>
        {hasNoBookings ? (
          <div style={css.emptyState}>
            <div style={css.emptyHalo}>
              <MdCalendarToday size={44} color="var(--brand-primary)" />
            </div>
            <h2 style={css.emptyTitle}>No bookings yet</h2>
            <p style={css.emptyBody}>
              When shoppers book your services, they&apos;ll show up here. Keep your services
              visible and priced right.
            </p>
            <button
              onClick={() => router.push('/service-provider/services')}
              style={css.emptyPrimary}
            >
              <MdDesignServices size={20} color="var(--brand-on-gradient)" />
              <span>Manage my services</span>
            </button>
          </div>
        ) : (
          <>
            <div style={css.searchWrap}>
              <MdSearch size={18} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search by customer, service or ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                style={css.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={css.searchClear}
                  aria-label="Clear search"
                >
                  <MdClose size={14} color="var(--text-tertiary)" />
                </button>
              )}
            </div>

            <div style={css.pillRow}>
              {FILTERS.map((f) => {
                const active = activeFilter === f.key;
                const count = counts[f.key];
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActiveFilter(f.key)}
                    style={{
                      ...css.pill,
                      borderColor: active ? 'var(--brand-primary)' : 'var(--border-default)',
                      backgroundColor: active ? 'var(--brand-soft)' : 'var(--bg-secondary)',
                    }}
                    className="sp-pill"
                  >
                    <span
                      style={{
                        color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        fontWeight: active ? 800 : 700,
                        fontSize: 12.5,
                      }}
                    >
                      {f.label}
                    </span>
                    <span
                      style={{
                        ...css.pillCount,
                        backgroundColor: active ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                        color: active ? 'var(--brand-primary)' : 'var(--text-tertiary)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {hasNoMatches ? (
              <div style={css.noMatchWrap}>
                <div style={css.noMatchHalo}>
                  <MdSearch size={32} color="var(--text-muted)" />
                </div>
                <div style={css.noMatchTitle}>No matches</div>
                <div style={css.noMatchBody}>Try a different word, or clear the filters.</div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                  style={css.clearAllBtn}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div style={css.list} className="sp-booking-list">
                {filtered.map((b) => (
                  <BookingCard
                    key={bookingId(b)}
                    booking={b}
                    busy={busyId === bookingId(b)}
                    onAccept={() => handleAccept(b)}
                    onDecline={() => handleDecline(b)}
                    onComplete={() => handleComplete(b)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ height: 32 }} />
      </div>
    </main>
  );
}

function BookingCard({
  booking,
  busy,
  onAccept,
  onDecline,
  onComplete,
}: {
  booking: Booking;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onComplete: () => void;
}) {
  const status = (booking.status || 'pending').toLowerCase();
  const meta = statusMeta(status);
  const total = Number(booking.amount || 0);
  const customer = customerName(booking);
  const service = booking.service_title || 'Service';
  const dateStr = bookingDate(booking);

  const isNew = isNewStatus(status);
  const isConfirmed = isConfirmedStatus(status);
  const isCompleted = isCompletedStatus(status);
  const isCancelled = isCancelledStatus(status);

  return (
    <div style={{ ...css.card, opacity: busy ? 0.55 : 1 }} className="sp-booking-card">
      <div style={css.cardTop}>
        <div style={css.avatar}>{(customer.charAt(0) || '?').toUpperCase()}</div>
        <div style={css.cardTopMeta}>
          <div style={css.customerName} title={customer}>
            {customer}
          </div>
          <div style={css.bookingId}>Booking #{bookingId(booking).slice(0, 8)}</div>
        </div>
        <span
          style={{
            ...css.statusChip,
            backgroundColor: meta.bg,
            color: meta.fg,
          }}
        >
          {meta.label}
        </span>
      </div>

      <div style={css.serviceRow}>
        <MdDesignServices size={14} color="var(--brand-primary)" />
        <span style={css.serviceText} title={service}>
          {service}
        </span>
      </div>

      {dateStr && (
        <div style={css.dateRow}>
          <MdAccessTime size={14} color="var(--text-muted)" />
          <span style={css.dateText}>{fmtDate(dateStr)}</span>
        </div>
      )}

      <div style={css.amount}>{formatNaira(total)}</div>

      {booking.notes && (
        <div style={css.notesRow}>
          <span style={css.notesText}>{String(booking.notes)}</span>
        </div>
      )}

      {isNew && (
        <div style={css.actions}>
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            style={{ ...css.dangerBtn, opacity: busy ? 0.6 : 1 }}
            className="sp-action-btn"
          >
            <MdCancel size={18} color="var(--danger-fg)" />
            <span>Decline</span>
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            style={{ ...css.primaryBtn, opacity: busy ? 0.6 : 1 }}
            className="sp-action-btn"
          >
            <MdCheckCircle size={18} color="var(--brand-on-gradient)" />
            <span>Accept booking</span>
          </button>
        </div>
      )}

      {isConfirmed && (
        <div style={css.actions}>
          <button
            type="button"
            onClick={onComplete}
            disabled={busy}
            style={{ ...css.successBtn, opacity: busy ? 0.6 : 1 }}
            className="sp-action-btn"
          >
            <MdCheckCircle size={18} color="#FFFFFF" />
            <span>Mark complete</span>
          </button>
        </div>
      )}

      {isCompleted && (
        <div style={css.doneRow}>
          <MdCheckCircle size={18} color="var(--success-fg)" />
          <span style={css.doneText}>Completed · Payment released</span>
        </div>
      )}
      {isCancelled && (
        <div style={css.cancelledRow}>
          <MdCancel size={18} color="var(--danger-fg)" />
          <span style={css.cancelledText}>Cancelled · No payment due</span>
        </div>
      )}
    </div>
  );
}

const CSS = `
  @keyframes spSpin { to { transform: rotate(360deg); } }
  @keyframes spShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  .sp-bookings, .sp-bookings *, .sp-bookings *::before, .sp-bookings *::after {
    box-sizing: border-box;
  }

  .sp-refresh {
    transition: transform 0.12s, background-color 0.15s;
  }
  .sp-refresh:hover {
    background-color: color-mix(in srgb, var(--brand-on-gradient) 18%, transparent);
  }
  .sp-refresh:active { transform: scale(0.94); }

  .sp-pill { transition: background-color 0.15s, border-color 0.15s; }
  .sp-pill:active { transform: scale(0.97); }

  .sp-booking-card {
    transition: box-shadow 0.15s ease, background-color 0.18s ease,
      border-color 0.18s ease;
  }
  .sp-booking-card:hover {
    box-shadow: 0 10px 24px rgba(15,23,42,0.06) !important;
  }

  .sp-action-btn { transition: transform 0.12s, opacity 0.15s; }
  .sp-action-btn:active:not(:disabled) { transform: scale(0.98); }

  @media (min-width: 1024px) {
    .sp-booking-list {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .sp-booking-list > div {
      margin-bottom: 0 !important;
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
  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--brand-gradient)',
    padding: '14px 20px',
    transition: 'background 0.18s ease',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--brand-on-gradient)',
    margin: 0,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    color: 'color-mix(in srgb, var(--brand-on-gradient) 78%, transparent)',
    fontWeight: 600,
    marginTop: 3,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'color-mix(in srgb, var(--brand-on-gradient) 12%, transparent)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  headerSkel: {
    height: 20,
    width: 180,
    borderRadius: 8,
    backgroundColor: 'color-mix(in srgb, var(--brand-on-gradient) 22%, transparent)',
  },
  sheet: {
    flex: 1,
    padding: '16px 20px 40px',
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 14,
    border: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14.5,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  searchClear: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'var(--bg-tertiary)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 8px 7px 14px',
    borderRadius: 999,
    border: '1.5px solid',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s, border-color 0.15s',
  },
  pillCount: {
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 18,
    border: '1px solid var(--border-default)',
    padding: '16px 18px',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 17,
    fontWeight: 800,
    flexShrink: 0,
  },
  cardTopMeta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  customerName: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bookingId: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  statusChip: {
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.2,
    padding: '5px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  serviceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '8px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 10,
  },
  serviceText: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--brand-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingLeft: 4,
  },
  dateText: {
    fontSize: 12.5,
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
  amount: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    letterSpacing: -0.6,
    fontVariantNumeric: 'tabular-nums',
    marginTop: 12,
    lineHeight: 1.1,
  },
  notesRow: {
    marginTop: 10,
    padding: '10px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 10,
    borderLeft: '3px solid var(--border-strong)',
  },
  notesText: {
    fontSize: 12.5,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 14,
  },
  primaryBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  dangerBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--danger-fg)',
    border: '1.5px solid var(--danger-strong)',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  successBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: 'var(--success-fg)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 18px color-mix(in srgb, var(--success-fg) 22%, transparent)',
  },
  doneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '10px 12px',
    backgroundColor: 'var(--success-bg)',
    borderRadius: 10,
  },
  doneText: {
    fontSize: 13,
    color: 'var(--success-fg)',
    fontWeight: 700,
  },
  cancelledRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '10px 12px',
    backgroundColor: 'var(--danger-bg)',
    borderRadius: 10,
  },
  cancelledText: {
    fontSize: 13,
    color: 'var(--danger-fg)',
    fontWeight: 700,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '56px 24px',
    textAlign: 'center',
  },
  emptyHalo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'var(--brand-soft)',
    border: '1px solid var(--brand-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
    margin: '8px 0 24px',
    maxWidth: 340,
    lineHeight: 1.55,
  },
  emptyPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 22px',
    borderRadius: 14,
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  noMatchWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  noMatchHalo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noMatchTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  noMatchBody: {
    fontSize: 13.5,
    color: 'var(--text-tertiary)',
    marginTop: 4,
    lineHeight: 1.5,
  },
  clearAllBtn: {
    marginTop: 16,
    padding: '10px 18px',
    borderRadius: 12,
    backgroundColor: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
    border: 'none',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  centerRoot: {
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
  centerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  centerBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  searchSkeleton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    animation: 'spShimmer 1.4s ease-in-out infinite',
  },
  pillRowSkeleton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    marginTop: 12,
    maxWidth: 480,
    animation: 'spShimmer 1.4s ease-in-out infinite',
  },
  cardSkeleton: {
    height: 200,
    borderRadius: 18,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    marginTop: 12,
    animation: 'spShimmer 1.4s ease-in-out infinite',
  },
};