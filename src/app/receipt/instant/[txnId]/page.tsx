'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  MdArrowBack,
  MdPrint,
  MdShare,
  MdDownload,
  MdCheckCircle,
} from 'react-icons/md';
import api from '../../../../services/api';

export const dynamic = 'force-dynamic';

interface MeShape {
  nickname?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
}

function fmtMoney(raw: string | null): string {
  const n = Number(raw || '0');
  if (!Number.isFinite(n)) return '₦0.00';
  return (
    '₦' +
    n.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function maskPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const last4 = digits.slice(-4);
  return `••• ••• ${last4}`;
}

function maskEmail(email?: string): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${head}•••${domain}`;
}

function displayName(me: MeShape | null): string {
  if (!me) return 'You';
  const first = (me.first_name || '').trim();
  const last = (me.last_name || '').trim();
  if (first || last) return `${first} ${last}`.trim();
  if (me.real_name) return me.real_name;
  if (me.nickname) return me.nickname;
  return 'You';
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
  const counterparty =
    searchParams.get('counterparty') || (kind === 'service' ? 'Provider' : 'Store');
  const createdAt = searchParams.get('created_at') || new Date().toISOString();

  const [me, setMe] = useState<MeShape | null>(null);
  useEffect(() => {
    api
      .getMyProfile()
      .then((profile: MeShape) => setMe(profile))
      .catch(() => {});
  }, []);

  const customerName = displayName(me);
  const customerId = me ? maskPhone(me.phone) || maskEmail(me.email) : '';
  const receiptDate = fmtDate(createdAt) || fmtDate(new Date().toISOString());

  const handlePrint = () => window.print();
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Admerce Receipt',
          text: `${title} — ${fmtMoney(amount)} — Successful`,
          url: window.location.href,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      alert('Share is not supported on this device.');
    }
  };

  return (
    <main style={s.container}>
      <style>{PRINT_CSS}</style>
      <style>{RECEIPT_CSS}</style>

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
        <div className="receipt-card receipt-print-area">
          {/* Brand strip */}
          <div className="receipt-brand">
            <div className="receipt-brand-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/admerce_symbol.png"
                alt=""
                className="receipt-brand-mark"
              />
              <span className="receipt-brand-name">Admerce</span>
            </div>
            <span className="receipt-brand-right">Transaction Receipt</span>
          </div>

          {/* Amount anchor */}
          <div className="receipt-amount-block">
            <div className="receipt-amount">{fmtMoney(amount)}</div>
            <div className="receipt-status">
              <MdCheckCircle size={18} color="var(--success-fg)" />
              <span>Successful</span>
            </div>
            <div className="receipt-date">{receiptDate}</div>
          </div>

          <div className="receipt-dotted" />

          {/* Parties */}
          <div className="receipt-meta">
            <div className="meta-row">
              <div className="meta-label">Paid To</div>
              <div className="meta-value">{counterparty}</div>
              <div className="meta-sub">
                {kind === 'service' ? 'Admerce Service Provider' : 'Admerce Store'}
              </div>
            </div>

            <div className="meta-row">
              <div className="meta-label">Paid By</div>
              <div className="meta-value">{customerName}</div>
              {customerId && <div className="meta-sub">{customerId}</div>}
            </div>

            <div className="meta-row">
              <div className="meta-label">Transaction No.</div>
              <div className="meta-value meta-mono">{txnId}</div>
            </div>

            <div className="meta-row">
              <div className="meta-label">Paid With</div>
              <div className="meta-value">Admerce Wallet</div>
            </div>
          </div>

          <div className="receipt-dotted" />

          {/* Line items */}
          <div className="receipt-items">
            <div className="items-label">
              {kind === 'service' ? 'Service' : 'Item'}
            </div>
            <div className="item-row">
              <div className="item-name">{title}</div>
              <div className="item-amount">{fmtMoney(amount)}</div>
            </div>
            {kind === 'item' && quantity > 1 && unitPrice && (
              <div className="item-subline">
                {quantity} × {fmtMoney(unitPrice)}
              </div>
            )}
          </div>

          <div className="receipt-total">
            <span className="receipt-total-label">Total Paid</span>
            <span className="receipt-total-value">{fmtMoney(amount)}</span>
          </div>

          <div className="receipt-footer">
            <div className="footer-brand">Admerce</div>
            <div className="footer-sub">
              {kind === 'service'
                ? 'Paid directly to provider'
                : 'Thank you for your purchase'}
            </div>
            <div className="footer-verify">
              Verify this receipt with the Transaction No. above.
              <br />
              Questions? Contact support@admerce.app
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

const RECEIPT_CSS = `
  .receipt-card {
    position: relative;
    overflow: hidden;
    background-color: var(--bg-secondary);
    border-radius: 20px;
    padding: 22px 22px 18px;
    border: 1px solid var(--border-default);
    box-shadow: var(--shadow-lg);
  }
  .receipt-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='140'><text x='100' y='70' font-family='Inter,sans-serif' font-size='20' font-weight='800' letter-spacing='3' fill='%23000000' fill-opacity='0.045' text-anchor='middle' transform='rotate(-22 100 70)'>ADMERCE</text></svg>");
    background-repeat: repeat;
    background-size: 200px 140px;
    pointer-events: none;
    z-index: 0;
  }
  .receipt-card > * {
    position: relative;
    z-index: 1;
  }

  .receipt-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 24px;
  }
  .receipt-brand-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .receipt-brand-mark {
    width: 26px;
    height: 26px;
    object-fit: contain;
    display: block;
  }
  .receipt-brand-name {
    font-size: 17px;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .receipt-brand-right {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-tertiary);
    letter-spacing: 0.2px;
  }

  .receipt-amount-block {
    text-align: center;
    margin-bottom: 22px;
  }
  .receipt-amount {
    font-size: 40px;
    font-weight: 800;
    color: var(--brand-primary);
    letter-spacing: -1.2px;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  .receipt-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    font-size: 15px;
    font-weight: 800;
    color: var(--success-fg);
  }
  .receipt-date {
    margin-top: 6px;
    font-size: 12.5px;
    color: var(--text-muted);
    font-weight: 600;
  }

  .receipt-dotted {
    height: 1px;
    margin: 18px -22px;
    background-image: linear-gradient(
      to right,
      var(--border-default) 0,
      var(--border-default) 4px,
      transparent 4px,
      transparent 10px
    );
    background-size: 10px 1px;
    background-repeat: repeat-x;
  }

  .receipt-meta { display: flex; flex-direction: column; gap: 16px; }
  .meta-row { display: flex; flex-direction: column; gap: 2px; }
  .meta-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.8px;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  .meta-value {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    word-break: break-word;
  }
  .meta-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }
  .meta-sub {
    font-size: 12.5px;
    color: var(--text-tertiary);
    font-weight: 600;
  }

  .receipt-items { display: flex; flex-direction: column; gap: 8px; }
  .items-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.8px;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .item-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    flex: 1;
  }
  .item-amount {
    font-size: 15px;
    font-weight: 800;
    color: var(--brand-primary);
    font-variant-numeric: tabular-nums;
  }
  .item-subline {
    font-size: 12.5px;
    color: var(--text-tertiary);
    font-weight: 600;
  }

  .receipt-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-top: 14px;
    margin-top: 18px;
    border-top: 1px solid var(--border-subtle);
  }
  .receipt-total-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-secondary);
  }
  .receipt-total-value {
    font-size: 22px;
    font-weight: 800;
    color: var(--brand-primary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.4px;
  }

  .receipt-footer {
    margin-top: 24px;
    padding-top: 18px;
    border-top: 1px dashed var(--border-default);
    text-align: center;
  }
  .footer-brand {
    font-size: 14px;
    font-weight: 800;
    color: var(--brand-primary);
    letter-spacing: 0.4px;
  }
  .footer-sub {
    font-size: 11.5px;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .footer-verify {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-top: 12px;
    line-height: 1.6;
  }
`;

const PRINT_CSS = `
  @media print {
    html, body { background: #ffffff !important; color: #000000 !important; }
    body * { visibility: hidden !important; }
    .receipt-print-area, .receipt-print-area * { visibility: visible !important; }
    .receipt-print-area {
      position: absolute !important; left: 0 !important; top: 0 !important;
      width: 100% !important; margin: 0 !important; padding: 22px !important;
      box-shadow: none !important; border-radius: 0 !important; border: none !important;
      background: #ffffff !important; color: #000000 !important;
    }
    .receipt-print-area * { color: #000000 !important; }
    .receipt-print-area .receipt-amount,
    .receipt-print-area .receipt-total-value,
    .receipt-print-area .item-amount,
    .receipt-print-area .receipt-brand-name,
    .receipt-print-area .footer-brand { color: #0504AA !important; }
    .receipt-print-area .receipt-status { color: #15803D !important; }
    .receipt-print-area .receipt-dotted {
      background-image: linear-gradient(
        to right,
        #999 0, #999 4px, transparent 4px, transparent 10px
      ) !important;
    }
    .no-print { display: none !important; }
  }
`;

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
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
  cardWrap: {
    padding: 16,
    maxWidth: 540,
    width: '100%',
    margin: '0 auto',
  },
};