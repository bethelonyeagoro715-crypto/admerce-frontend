'use client';

import { Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  MdArrowBack,
  MdPrint,
  MdShare,
  MdDownload,
  MdReceiptLong,
  MdStore,
  MdPersonOutline,
  MdCheckCircle,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

function fmtMoney(raw: string | null): string {
  const n = Number(raw || '0');
  if (!Number.isFinite(n)) return '₦0';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

function InstantReceiptContent() {
  const router = useRouter();
  const params = useParams<{ txnId: string }>();
  const searchParams = useSearchParams();

  const txnId = params.txnId || 'Unknown';
  const kind = (searchParams.get('kind') || 'item') as 'item' | 'service';
  const amount = searchParams.get('amount') || '0';
  const quantity = Number(searchParams.get('quantity') || '1');
  const unitPrice = searchParams.get('unit_price');
  const title = searchParams.get('title') || (kind === 'service' ? 'Service' : 'Item');
  const counterparty = searchParams.get('counterparty') || (kind === 'service' ? 'Provider' : 'Store');
  const customer = searchParams.get('customer') || '';
  const createdAt = searchParams.get('created_at') || new Date().toISOString();

  const shortId = txnId.length > 16 ? txnId.slice(0, 16) : txnId;
  const receiptDate = fmtDate(createdAt) || fmtDate(new Date().toISOString());

  const handlePrint = () => window.print();
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Admerce Receipt',
          text: `${title} — ${fmtMoney(amount)}`,
          url: window.location.href,
        });
      } catch { /* user cancelled */ }
    } else {
      alert('Share is not supported on this device.');
    }
  };

  return (
    <main style={s.container}>
      <style>{PRINT_CSS}</style>

      <div style={s.header} className="no-print">
        <button onClick={() => router.back()} style={s.backBtn} aria-label="Back">
          <MdArrowBack size={22} color="var(--text-primary)" />
        </button>
        <h1 style={s.title}>Receipt</h1>
        <div style={s.headerActions}>
          <button onClick={handlePrint} style={s.iconBtn} title="Print" aria-label="Print">
            <MdPrint size={22} color="var(--text-primary)" />
          </button>
          <button onClick={handleShare} style={s.iconBtn} title="Share" aria-label="Share">
            <MdShare size={22} color="var(--text-primary)" />
          </button>
          <button onClick={handlePrint} style={s.iconBtn} title="Save as PDF" aria-label="Download PDF">
            <MdDownload size={22} color="var(--text-primary)" />
          </button>
        </div>
      </div>

      <div style={s.cardWrap}>
        <div style={s.receiptCard} className="receipt-print-area">
          <div style={s.cardHeader}>
            <div style={s.iconWrapper}>
              <MdReceiptLong size={32} color="var(--brand-on-gradient)" />
            </div>
            <h2 style={s.cardTitle}>
              {kind === 'service' ? 'Service Receipt' : 'Purchase Receipt'}
            </h2>
            <p style={s.orderId}>Ref #{shortId}</p>
            <p style={s.dateTime}>{receiptDate}</p>
          </div>

          <div style={s.statusRow}>
            <span style={{ ...s.statusBadge, background: 'var(--success-bg)', color: 'var(--success-fg)' }}>
              <MdCheckCircle size={14} style={{ marginRight: 4 }} />
              Paid
            </span>
          </div>

          <div style={s.infoSection}>
            {customer && (
              <div style={s.infoRow}>
                <span style={s.infoLabel}>
                  <MdPersonOutline size={16} style={{ marginRight: 4 }} />
                  Customer
                </span>
                <span style={s.infoValue}>{customer}</span>
              </div>
            )}
            <div style={s.infoRow}>
              <span style={s.infoLabel}>
                <MdStore size={16} style={{ marginRight: 4 }} />
                {kind === 'service' ? 'Provider' : 'Store'}
              </span>
              <span style={s.infoValue}>{counterparty}</span>
            </div>
          </div>

          <div style={s.itemsSection}>
            <h3 style={s.itemsTitle}>{kind === 'service' ? 'Service' : 'Item'}</h3>
            <div style={s.itemRow}>
              <span style={s.itemName}>{title}</span>
              {kind === 'item' && quantity > 1 && (
                <span style={s.itemQty}>×{quantity}</span>
              )}
              <span style={s.itemSubtotal}>{fmtMoney(amount)}</span>
            </div>
            {kind === 'item' && quantity > 1 && unitPrice && (
              <div style={{ ...s.itemRow, marginTop: 4 }}>
                <span style={{ ...s.itemName, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Unit price
                </span>
                <span style={s.itemQty} />
                <span style={{ ...s.itemSubtotal, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {fmtMoney(unitPrice)}
                </span>
              </div>
            )}
          </div>

          <div style={s.totalSection}>
            <span style={s.totalLabel}>Total Paid</span>
            <span style={s.totalValue}>{fmtMoney(amount)}</span>
          </div>

          <div style={s.footerNote}>
            <div style={s.footerBrand}>Admerce</div>
            <div style={s.footerSub}>
              {kind === 'service'
                ? 'Paid directly to provider'
                : 'Thank you for your purchase'}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function InstantReceiptPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            color: 'var(--text-primary)',
          }}
        >
          Loading…
        </div>
      }
    >
      <InstantReceiptContent />
    </Suspense>
  );
}

const PRINT_CSS = `
  @media print {
    html, body { background: #ffffff !important; color: #000000 !important; }
    body * { visibility: hidden !important; }
    .receipt-print-area, .receipt-print-area * { visibility: visible !important; }
    .receipt-print-area {
      position: absolute !important; left: 0 !important; top: 0 !important;
      width: 100% !important; margin: 0 !important; padding: 20px !important;
      box-shadow: none !important; border-radius: 0 !important; border: none !important;
      background: #ffffff !important; color: #000000 !important;
    }
    .receipt-print-area * { color: #000000 !important; background-image: none !important; }
    .receipt-print-area [style*="background"] { background: #ffffff !important; }
    .no-print { display: none !important; }
  }
`;

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' },
  header: { display: 'flex', alignItems: 'center', padding: '14px 16px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', marginRight: 12, display: 'flex', alignItems: 'center', padding: 4 },
  title: { fontSize: 20, fontWeight: 700, flex: 1, color: 'var(--text-primary)' },
  headerActions: { display: 'flex', gap: 12 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' },

  cardWrap: { padding: 16, maxWidth: 520, width: '100%', margin: '0 auto' },
  receiptCard: { backgroundColor: 'var(--bg-secondary)', borderRadius: 24, padding: 20, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' },
  cardHeader: { background: 'var(--brand-gradient)', margin: -20, marginBottom: 20, padding: 24, textAlign: 'center', color: 'var(--brand-on-gradient)' },
  iconWrapper: { width: 60, height: 60, borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--brand-on-gradient) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  cardTitle: { fontSize: 22, fontWeight: 800, margin: 0 },
  orderId: { fontSize: 14, opacity: 0.9, marginTop: 4 },
  dateTime: { fontSize: 12, opacity: 0.8, marginTop: 2 },

  statusRow: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  statusBadge: { display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.2 },

  infoSection: { padding: '8px 0', borderBottom: '1px dashed var(--border-default)', marginBottom: 12 },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, fontSize: 14, gap: 12 },
  infoLabel: { display: 'inline-flex', alignItems: 'center', color: 'var(--brand-primary)', fontWeight: 600, flexShrink: 0 },
  infoValue: { color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', maxWidth: '65%', wordBreak: 'break-word' },

  itemsSection: { marginTop: 16 },
  itemsTitle: { fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 12 },
  itemName: { flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemQty: { fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, minWidth: 30, textAlign: 'right' },
  itemSubtotal: { width: 90, textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--brand-primary)', fontVariantNumeric: 'tabular-nums' },

  totalSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 18, borderTop: '1px dashed var(--border-default)' },
  totalLabel: { fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' },
  totalValue: { fontSize: 26, fontWeight: 800, color: 'var(--brand-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 },

  footerNote: { marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', textAlign: 'center' },
  footerBrand: { fontSize: 14, fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: 0.5 },
  footerSub: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
};