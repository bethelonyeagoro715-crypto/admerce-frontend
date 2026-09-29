'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { confirmDialog, alertDialog } from '../../../components/ui/dialogs';
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
  MdPerson,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
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

// ─── Helpers ────────────────────────────────────────────────────────
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

  // ── Derived buckets + counts ───────────────────────────────────
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

  // ── Actions ────────────────────────────────────────────────────
  const handleConfirm = async (b: Booking) => {
    const id = bookingId(b);
    if (!id) return;
    const customer = customerName(b);
    const ok = await confirmDialog({
      title: 'Confirm this booking?',
      body: `${b.service_title || 'The service'} for ${customer}. Once confirmed, they'll be notified to expect you.`,
      kind: 'info',
      confirmLabel: 'Confirm booking',
      cancelLabel: 'Not yet',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.confirmServiceBooking(id);
      await loadBookings(false);
      await alertDialog({
        title: 'Booking confirmed',
        body: `${customer} has been notified.`,
        kind: 'success',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't confirm",
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

  // ── Loading skeleton ───────────────────────────────────────────
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

  // ── Error ──────────────────────────────────────────────────────
  if (errored) {
    return (
      <main style={css.centerRoot} className="sp-bookings">
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="#B91C1C" />
        </div>
        <h2 style={css.centerTitle}>Couldn&apos;t load your bookings</h2>
        <p style={css.centerBody}>
          Check your connection and try again. If this keeps happening, sign
          out and back in.
        </p>
        <button
          onClick={() => void loadBookings()}
          style={css.centerPrimary}
        >
          <MdRefresh size={18} color="#fff" />
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

      {/* HEADER */}
      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={css.title}>Bookings</h1>
            <div style={css.subtitle}>
              {hasNoBookings
                ? 'Bookings will show up here'
                : `${counts.all} total · ${counts.new} new${
                    counts.confirmed > 0
                      ? ` · ${counts.confirmed} confirmed`
                      : ''
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
            <MdRefresh size={20} color="#fff" />
          </button>
        </div>
      </div>

      <div style={css.sheet}>
        {hasNoBookings ? (
          // ── EMPTY ────────────────────────────────────────────
          <div style={css.emptyState}>
            <div style={css.emptyHalo}>
              <MdCalendarToday size={44} color="#0504AA" />
            </div>
            <h2 style={css.emptyTitle}>No bookings yet</h2>
            <p style={css.emptyBody}>
              When shoppers book your services, they&apos;ll show up here.
              Keep your services visible and priced right.
            </p>
            <button
              onClick={() => router.push('/service-provider/services')}
              style={css.emptyPrimary}
            >
              <MdDesignServices size={20} color="#fff" />
              <span>Manage my services</span>
            </button>
          </div>
        ) : (
          <>
            {/* SEARCH */}
            <div style={css.searchWrap}>
              <MdSearch size={18} color="#94A3B8" />
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
                  <MdClose size={14} color="#64748B" />
                </button>
              )}
            </div>

            {/* FILTER PILLS */}
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
                      borderColor: active ? '#0504AA' : '#E6E8F0',
                      backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                    }}
                    className="sp-pill"
                  >
                    <span
                      style={{
                        color: active ? '#0504AA' : '#475569',
                        fontWeight: active ? 800 : 700,
                        fontSize: 12.5,
                      }}
                    >
                      {f.label}
                    </span>
                    <span
                      style={{
                        ...css.pillCount,
                        backgroundColor: active ? '#FFFFFF' : '#F1F5F9',
                        color: active ? '#0504AA' : '#64748B',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* LIST */}
            {hasNoMatches ? (
              <div style={css.noMatchWrap}>
                <div style={css.noMatchHalo}>
                  <MdSearch size={32} color="#94A3B8" />
                </div>
                <div style={css.noMatchTitle}>No matches</div>
                <div style={css.noMatchBody}>
                  Try a different word, or clear the filters.
                </div>
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
                    onConfirm={() => handleConfirm(b)}
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

// ─── Booking card ───────────────────────────────────────────────────
function BookingCard({
  booking,
  busy,
  onConfirm,
  onComplete,
}: {
  booking: Booking;
  busy: boolean;
  onConfirm: () => void;
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
    <div
      style={{ ...css.card, opacity: busy ? 0.55 : 1 }}
      className="sp-booking-card"
    >
      {/* TOP */}
      <div style={css.cardTop}>
        <div style={css.avatar}>
          {(customer.charAt(0) || '?').toUpperCase()}
        </div>
        <div style={css.cardTopMeta}>
          <div style={css.customerName} title={customer}>
            {customer}
          </div>
          <div style={css.bookingId}>
            Booking #{bookingId(booking).slice(0, 8)}
          </div>
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

      {/* SERVICE */}
      <div style={css.serviceRow}>
        <MdDesignServices size={14} color="#0504AA" />
        <span style={css.serviceText} title={service}>
          {service}
        </span>
      </div>

      {/* DATE */}
      {dateStr && (
        <div style={css.dateRow}>
          <MdAccessTime size={14} color="#94A3B8" />
          <span style={css.dateText}>{fmtDate(dateStr)}</span>
        </div>
      )}

      {/* AMOUNT */}
      <div style={css.amount}>{formatNaira(total)}</div>

      {/* NOTES */}
      {booking.notes && (
        <div style={css.notesRow}>
          <span style={css.notesText}>{String(booking.notes)}</span>
        </div>
      )}

      {/* ACTIONS */}
      {(isNew || isConfirmed) && (
        <div style={css.actions}>
          {isNew && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              style={{ ...css.primaryBtn, opacity: busy ? 0.6 : 1 }}
              className="sp-action-btn"
            >
              <MdCheckCircle size={18} color="#fff" />
              <span>Confirm booking</span>
            </button>
          )}
          {isConfirmed && (
            <button
              type="button"
              onClick={onComplete}
              disabled={busy}
              style={{ ...css.successBtn, opacity: busy ? 0.6 : 1 }}
              className="sp-action-btn"
            >
              <MdCheckCircle size={18} color="#fff" />
              <span>Mark complete</span>
            </button>
          )}
        </div>
      )}

      {/* TERMINAL FOOTNOTES */}
      {isCompleted && (
        <div style={css.doneRow}>
          <MdCheckCircle size={18} color="#166534" />
          <span style={css.doneText}>Completed · Payment released</span>
        </div>
      )}
      {isCancelled && (
        <div style={css.cancelledRow}>
          <MdCancel size={18} color="#991B1B" />
          <span style={css.cancelledText}>Cancelled · No payment due</span>
        </div>
      )}
    </div>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────
const CSS = `
  @keyframes spSpin { to { transform: rotate(360deg); } }
  @keyframes spShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  .sp-bookings, .sp-bookings *, .sp-bookings *::before, .sp-bookings *::after {
    box-sizing: border-box;
  }

  .sp-refresh {
    transition: transform 0.12s, background-color 0.15s;
  }
  .sp-refresh:hover { background-color: rgba(255,255,255,0.18); }
  .sp-refresh:active { transform: scale(0.94); }

  .sp-pill { transition: background-color 0.15s, border-color 0.15s; }
  .sp-pill:active { transform: scale(0.97); }

  .sp-booking-card {
    transition: box-shadow 0.15s ease;
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

// ─── Styles ─────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    overflowX: 'hidden',
  },

  // HEADER
  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    backgroundColor: '#0504AA',
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    padding: '14px 20px',
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
    color: '#fff',
    margin: 0,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: 600,
    marginTop: 3,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // SHEET
  sheet: {
    flex: 1,
    padding: '16px 20px 40px',
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },

  // SEARCH
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    border: '1px solid #EAECF3',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14.5,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  searchClear: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // PILLS
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

  // LIST
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },

  // CARD
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    padding: '16px 18px',
    boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
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
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
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
    color: '#0B0B1A',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bookingId: {
    fontSize: 11.5,
    color: '#94A3B8',
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

  // SERVICE ROW
  serviceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '8px 10px',
    backgroundColor: '#F8FAFF',
    borderRadius: 10,
  },
  serviceText: {
    fontSize: 13,
    fontWeight: 600,
    color: '#0504AA',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // DATE
  dateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingLeft: 4,
  },
  dateText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: 500,
  },

  // AMOUNT
  amount: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0504AA',
    letterSpacing: -0.6,
    fontVariantNumeric: 'tabular-nums',
    marginTop: 12,
    lineHeight: 1.1,
  },

  // NOTES
  notesRow: {
    marginTop: 10,
    padding: '10px 12px',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderLeft: '3px solid #CBD5E1',
  },
  notesText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 1.5,
    fontWeight: 500,
  },

  // ACTIONS
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
    backgroundColor: '#0504AA',
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 18px rgba(5,4,170,0.22)',
  },
  successBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: '#16A34A',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 18px rgba(22,163,74,0.22)',
  },

  // DONE / CANCELLED FOOTERS
  doneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '10px 12px',
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
  },
  doneText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: 700,
  },
  cancelledRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '10px 12px',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },
  cancelledText: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: 700,
  },

  // EMPTY
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
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7D2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
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
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 12px 24px rgba(5,4,170,0.28)',
  },

  // NO MATCH
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
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noMatchTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0B0B1A',
  },
  noMatchBody: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 1.5,
  },
  clearAllBtn: {
    marginTop: 16,
    padding: '10px 18px',
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    border: 'none',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
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
  searchSkeleton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    animation: 'spShimmer 1.4s ease-in-out infinite',
  },
  pillRowSkeleton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 12,
    maxWidth: 480,
    animation: 'spShimmer 1.4s ease-in-out infinite',
  },
  cardSkeleton: {
    height: 200,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 12,
    animation: 'spShimmer 1.4s ease-in-out infinite',
  },
};