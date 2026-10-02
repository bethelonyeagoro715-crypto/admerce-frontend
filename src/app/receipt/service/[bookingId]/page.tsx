'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  MdArrowBack,
  MdPrint,
  MdShare,
  MdDownload,
  MdReceiptLong,
  MdPersonOutline,
  MdStore,
  MdCalendarToday,
  MdErrorOutline,
  MdCheckCircle,
} from 'react-icons/md';
import api from '../../../../services/api';

export const dynamic = 'force-dynamic';

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

function fmtMoney(value: number | string | undefined): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  if (!isFinite(n)) return '₦0';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
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

function statusLabel(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'locked') return 'In Escrow';
  if (s === 'accepted') return 'Accepted';
  if (s === 'completed') return 'Completed';
  if (s === 'pending') return 'Pending';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'declined') return 'Declined';
  if (s === 'refunded') return 'Refunded';
  return status || 'Unknown';
}

function statusColor(status: string): { bg: string; fg: string } {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return { bg: 'var(--success-bg)', fg: 'var(--success-fg)' };
  if (s === 'locked')    return { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' };
  if (s === 'accepted')  return { bg: 'var(--purple-bg)',  fg: 'var(--purple-fg)' };
  if (s === 'refunded')  return { bg: 'var(--info-bg)',    fg: 'var(--info-fg)' };
  if (s === 'cancelled' || s === 'declined')
    return { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' };
  return { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };
}

function ServiceReceiptContent() {
  const router = useRouter();
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();

  const bookingId = params.bookingId || searchParams.get('booking_id') || 'Unknown';

  const [serviceName, setServiceName] = useState(searchParams.get('service_name') || 'Service');
  const [providerName, setProviderName] = useState(searchParams.get('provider_name') || 'Provider');
  const [customerName, setCustomerName] = useState(searchParams.get('customer_name') || '');
  const [amount, setAmount] = useState<string>(searchParams.get('amount') || '0');
  const [status, setStatus] = useState<string>(searchParams.get('status') || '');
  const [scheduledFor, setScheduledFor] = useState<string>(searchParams.get('scheduled_for') || '');
  const [createdAt, setCreatedAt] = useState<string>(searchParams.get('created_at') || '');
  const [notes, setNotes] = useState<string>('');

  const hasBookingId = Boolean(bookingId && bookingId !== 'Unknown');
  const [loading, setLoading] = useState(hasBookingId);
  const [error, setError] = useState<string | null>(hasBookingId ? null : 'Missing booking ID.');

  useEffect(() => {
    if (!bookingId || bookingId === 'Unknown') return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const data = (await api.getServiceBookingDetail(bookingId)) as BookingDetail;
        if (cancelled) return;
        setServiceName(data.service_title || data.title || 'Service');
        setProviderName(data.provider_name || 'Provider');
        setCustomerName(data.customer_name || '');
        setAmount(String(data.amount ?? 0));
        setStatus(data.status || '');
        setScheduledFor(data.scheduled_for || '');
        setCreatedAt(data.created_at || '');
        setNotes(data.notes || '');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Could not load receipt.';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const shareText = `Admerce receipt for ${serviceName} — ${fmtMoney(amount)}`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Admerce Receipt', text: shareText, url: shareUrl });
        return;
      } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      alert('Receipt link copied to clipboard');
    } catch {
      alert('Could not share receipt');
    }
  };

  const sc = statusColor(status);
  const shortId = bookingId.slice(0, 8);
  const displayDate = scheduledFor || createdAt;
  const receiptDate = fmtDateTime(createdAt) !== '—' ? fmtDateTime(createdAt) : fmtDateTime(new Date().toISOString());

  if (loading) {
    return (
      <main style={styles.centerScreen}>
        <div style={styles.spinner} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  if (error && !serviceName) {
    return (
      <main style={styles.centerScreen}>
        <MdErrorOutline size={56} color="var(--danger-fg)" />
        <p style={{ marginTop: 12, color: 'var(--danger-fg)', textAlign: 'center' }}>{error}</p>
        <button onClick={() => router.back()} style={styles.retryBtn}>Go Back</button>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <style>{PRINT_CSS}</style>

      <div style={styles.header} className="no-print">
        <button onClick={() => router.back()} style={styles.backBtn} aria-label="Back">
          <MdArrowBack size={22} color="var(--text-primary)" />
        </button>
        <h1 style={styles.title}>Receipt</h1>
        <div style={styles.headerActions}>
          <button onClick={handlePrint} style={styles.iconBtn} title="Print" aria-label="Print">
            <MdPrint size={22} color="var(--text-primary)" />
          </button>
          <button onClick={handleShare} style={styles.iconBtn} title="Share" aria-label="Share">
            <MdShare size={22} color="var(--text-primary)" />
          </button>
          <button onClick={handlePrint} style={styles.iconBtn} title="Save as PDF" aria-label="Download PDF">
            <MdDownload size={22} color="var(--text-primary)" />
          </button>
        </div>
      </div>

      <div style={styles.cardWrapper}>
        <div style={styles.receiptCard} className="receipt-print-area">
          <div style={styles.cardHeader}>
            <div style={styles.iconWrapper}>
              <MdReceiptLong size={32} color="var(--brand-on-gradient)" />
            </div>
            <h2 style={styles.cardTitle}>Service Receipt</h2>
            <p style={styles.orderId}>Booking #{shortId}</p>
            <p style={styles.dateTime}>{receiptDate}</p>
          </div>

          {status && (
            <div style={styles.statusRow}>
              <span style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.fg }}>
                {status === 'completed' && <MdCheckCircle size={14} style={{ marginRight: 4 }} />}
                {statusLabel(status)}
              </span>
            </div>
          )}

          <div style={styles.infoSection}>
            {customerName && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>
                  <MdPersonOutline size={16} style={{ marginRight: 4 }} />
                  Customer
                </span>
                <span style={styles.infoValue}>{customerName}</span>
              </div>
            )}
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>
                <MdStore size={16} style={{ marginRight: 4 }} />
                Service
              </span>
              <span style={styles.infoValue}>{serviceName}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Provider</span>
              <span style={styles.infoValue}>{providerName}</span>
            </div>
            {displayDate && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>
                  <MdCalendarToday size={16} style={{ marginRight: 4 }} />
                  {scheduledFor ? 'Scheduled' : 'Booked'}
                </span>
                <span style={styles.infoValue}>{fmtDateTime(displayDate)}</span>
              </div>
            )}

            <div style={styles.divider} />

            <div style={styles.amountRow}>
              <span style={styles.amountLabel}>Amount paid</span>
              <span style={styles.amountValue}>{fmtMoney(amount)}</span>
            </div>

            {status === 'locked' && (
              <p style={styles.escrowNote}>
                Funds held in escrow. Released to the provider once the job is marked complete.
              </p>
            )}
            {status === 'completed' && (
              <p style={{ ...styles.escrowNote, color: 'var(--success-fg)' }}>
                Funds released to the provider. Thank you for using Admerce.
              </p>
            )}
          </div>

          {notes && (
            <div style={styles.notesBlock}>
              <div style={styles.notesLabel}>Notes</div>
              <div style={styles.notesText}>{notes}</div>
            </div>
          )}

          <div style={styles.footerNote}>
            <div style={styles.footerBrand}>Admerce</div>
            <div style={styles.footerSub}>Buy, sell, and provide services locally</div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ServiceReceiptPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.centerScreen}>
          <div style={styles.spinner} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <ServiceReceiptContent />
    </Suspense>
  );
}

const PRINT_CSS = `
  @media print {
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
    }
    body * { visibility: hidden !important; }
    .receipt-print-area,
    .receipt-print-area * { visibility: visible !important; }
    .receipt-print-area {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 20px !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      border: none !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    .receipt-print-area * {
      color: #000000 !important;
      background-image: none !important;
    }
    .receipt-print-area [style*="background"] { background: #ffffff !important; }
    .no-print { display: none !important; }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  centerScreen: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    padding: 24,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    marginTop: 16,
    padding: '10px 20px',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--brand-on-primary)',
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-default)',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginRight: 12,
    display: 'flex',
    alignItems: 'center',
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    flex: 1,
    color: 'var(--text-primary)',
  },
  headerActions: { display: 'flex', gap: 12 },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
  },
  cardWrapper: {
    padding: 16,
    maxWidth: 520,
    width: '100%',
    margin: '0 auto',
  },
  receiptCard: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 24,
    padding: 20,
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  cardHeader: {
    background: 'var(--brand-gradient)',
    margin: -20,
    marginBottom: 20,
    padding: 24,
    textAlign: 'center',
    color: 'var(--brand-on-gradient)',
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    backgroundColor: 'color-mix(in srgb, var(--brand-on-gradient) 15%, transparent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
  },
  cardTitle: { fontSize: 22, fontWeight: 800, margin: 0 },
  orderId: { fontSize: 14, opacity: 0.9, marginTop: 4 },
  dateTime: { fontSize: 12, opacity: 0.8, marginTop: 2 },
  statusRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  infoSection: { padding: '4px 0' },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    fontSize: 14,
    gap: 12,
  },
  infoLabel: {
    color: 'var(--text-tertiary)',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  infoValue: {
    color: 'var(--text-primary)',
    fontWeight: 600,
    textAlign: 'right',
    maxWidth: '60%',
    wordBreak: 'break-word',
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--border-default)',
    margin: '16px 0',
  },
  amountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
    fontWeight: 600,
  },
  amountValue: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: -0.5,
  },
  escrowNote: {
    marginTop: 8,
    fontSize: 12,
    color: 'var(--warning-fg)',
    lineHeight: 1.4,
    textAlign: 'center',
  },
  notesBlock: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 10,
    border: '1px solid var(--border-default)',
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-tertiary)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  footerNote: {
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px dashed var(--border-default)',
    textAlign: 'center',
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    letterSpacing: 0.5,
  },
  footerSub: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
};