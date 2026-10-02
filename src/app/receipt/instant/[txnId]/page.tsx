'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  MdArrowBack,
  MdPrint,
  MdShare,
  MdDownload,
  MdCheckCircle,
  MdErrorOutline,
  MdContentCopy,
  MdCheck,
} from 'react-icons/md';
import api from '../../../../services/api';

export const dynamic = 'force-dynamic';

interface Counterparty {
  user_id?: string;
  display_name?: string;
  role?: string;
  store_name?: string | null;
  business_name?: string | null;
}

interface TransactionResponse {
  id?: number;
  user_id?: string;
  amount?: number | string;
  type?: string;
  description?: string;
  reference?: string;
  status?: string;
  created_at?: string;
  counterparty?: Counterparty | null;
}

interface MeShape {
  id?: string;
  nickname?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  role?: string;
  business_name?: string;
}

function fmtMoney(raw: number | string | null | undefined): string {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return '₦0.00';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  } catch {
    return '—';
  }
}

function maskPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return `••• ••• ${digits.slice(-4)}`;
}

function maskEmail(email?: string): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at < 1) return email;
  const head = email.slice(0, Math.min(2, at));
  return `${head}•••${email.slice(at)}`;
}

function fullName(u: {
  real_name?: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
} | null): string {
  if (!u) return '';
  const first = (u.first_name || '').trim();
  const last = (u.last_name || '').trim();
  const full = `${first} ${last}`.trim();
  return (u.real_name || '').trim() || (u.nickname || '').trim() || full;
}

function roleLabel(role: string | undefined): string {
  if (!role) return '';
  const r = role.toLowerCase().replace(/[_-]/g, '');
  if (r === 'shopper' || r === '') return 'Shopper';
  if (r === 'storekeeper') return 'Storekeeper';
  if (r === 'serviceprovider' || r === 'provider') return 'Service Provider';
  if (r === 'courier') return 'Courier';
  if (r === 'flipper') return 'Flipper';
  if (r === 'admin') return 'Admerce';
  return '';
}

function txnTypeLabel(txnType: string | undefined, reference: string | undefined): string {
  const t = (txnType || '').toLowerCase();
  const ref = reference || '';
  if (ref.startsWith('pickup_')) return 'Instant pickup';
  if (ref.startsWith('svcpay_')) return 'Service payment';
  if (ref.startsWith('wdr_')) return 'Withdrawal';
  if (ref.startsWith('book:')) return 'Service booking';
  if (ref.startsWith('confirm:')) return 'Booking confirmed payout';
  if (ref.startsWith('complete:')) return 'Booking completed payout';
  if (ref.startsWith('cancel:')) return 'Booking cancellation refund';
  if (ref.startsWith('decline:')) return 'Refund on decline';
  if (ref.startsWith('ord_')) return 'Order reservation';
  if (ref.startsWith('topup_')) return 'Wallet top-up';
  if (t === 'debit') return 'Debit';
  if (t === 'credit') return 'Credit';
  return 'Wallet transaction';
}

function CopyValue({ value, label, copied, onCopy, mono }: {
  value: string;
  label: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div className="field-value-row">
      <div className={`field-value${mono ? ' field-mono' : ''}`}>{value}</div>
      <button
        type="button"
        className="field-copy"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        title={copied ? 'Copied' : `Copy ${label}`}
      >
        {copied ? <MdCheck size={16} color="var(--success-fg)" /> : <MdContentCopy size={14} color="var(--text-muted)" />}
      </button>
    </div>
  );
}

function InstantReceiptContent() {
  const router = useRouter();
  const params = useParams<{ txnId: string }>();
  const searchParams = useSearchParams();

  const txnId = params.txnId || 'Unknown';

  const [txn, setTxn] = useState<TransactionResponse | null>(null);
  const [me, setMe] = useState<MeShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [txnRes, meRes] = await Promise.allSettled([
          api.getWalletTransaction(txnId),
          api.getMyProfile(),
        ]);
        if (cancelled) return;
        if (txnRes.status === 'fulfilled') setTxn(txnRes.value as TransactionResponse);
        else setLoadError('Could not load this receipt.');
        if (meRes.status === 'fulfilled') setMe(meRes.value as MeShape);
      } catch {
        if (!cancelled) setLoadError('Could not load this receipt.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [txnId]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch { /* ignore */ }
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareText = txn
      ? `${txn.description || 'Transaction'} — ${fmtMoney(txn.amount)} — Successful`
      : 'Admerce Receipt';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Admerce Receipt', text: shareText, url: shareUrl });
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopiedKey('share');
      setTimeout(() => setCopiedKey((k) => (k === 'share' ? null : k)), 1500);
    } catch { alert(shareUrl); }
  };

  if (loading) {
    return (
      <main style={s.container}>
        <div style={s.center}>
          <div style={s.spinner} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  if (loadError || !txn) {
    return (
      <main style={s.container}>
        <div style={s.center}>
          <MdErrorOutline size={48} color="var(--danger-fg)" />
          <h2 style={{ marginTop: 12, fontSize: 18, fontWeight: 800 }}>Receipt not found</h2>
          <p style={{ color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center', maxWidth: 320 }}>
            {loadError || 'This transaction does not exist or does not belong to your account.'}
          </p>
          <button onClick={() => router.back()} style={s.backCta}>Go back</button>
        </div>
      </main>
    );
  }

  const amount = txn.amount ?? 0;
  const description = txn.description || 'Wallet transaction';
  const reference = txn.reference || txnId;
  const createdAt = txn.created_at;
  const txnType = txnTypeLabel(txn.type, reference);
  const isDebit = (txn.type || '').toLowerCase() === 'debit';
  const narrativeVerb = isDebit ? 'You paid' : 'You received';

  const currentRealName = fullName(me);
  const currentRole = me?.role;
  const currentMask = me ? maskPhone(me.phone) || maskEmail(me.email) : '';
  const currentBusinessName = (me?.business_name || '').trim();

  const cp = txn.counterparty || null;
  const cpRealName = cp?.display_name || '';
  const cpStoreName = (cp?.store_name || '').trim();
  const cpBusinessName = (cp?.business_name || '').trim();
  const cpRole = cp?.role;

  // "Stage name" = store name or business name when present; fallback to personal name.
  // Do NOT gate on role — the DB stores empty-string roles for many storekeepers,
  // so a role check silently fails and hides the store name.
  const stageNameFor = (store?: string, business?: string, personal?: string): string => {
    if (store) return store;
    if (business) return business;
    return personal || '';
  };

  // The current user's own "stage name" — we only have business_name from /auth/me,
  // not the store name. Providers get business_name; storekeepers see their own
  // personal name unless we later add a store lookup for the current user.
  const currentStageName = (() => {
    if (currentRole === 'service_provider' || currentRole === 'serviceprovider') {
      return currentBusinessName || '';
    }
    return '';
  })();

  // Build the four display values
  const payerStage = isDebit
    ? (currentStageName || currentRealName)
    : (cp ? stageNameFor(cpStoreName, cpBusinessName, cpRealName) : 'Admerce');

  const payerPersonal = isDebit ? currentRealName : cpRealName;
  const payerRole = isDebit ? roleLabel(currentRole) : roleLabel(cpRole);

  const payeeStage = !isDebit
    ? (currentStageName || currentRealName)
    : (cp ? stageNameFor(cpStoreName, cpBusinessName, cpRealName) : 'Admerce');

  const payeePersonal = !isDebit ? currentRealName : cpRealName;
  const payeeRole = !isDebit ? roleLabel(currentRole) : roleLabel(cpRole);

  const renderParty = (
    stage: string,
    personal: string,
    role: string,
  ) => (
    <>
      <div className="field-value">{stage || 'Admerce'}</div>
      {personal && personal !== stage && (
        <div className="field-sub">{personal}</div>
      )}
      {role && <div className="field-role">{role}</div>}
    </>
  );

  return (
    <main style={s.container}>
      <style>{PRINT_CSS}</style>
      <style>{RECEIPT_CSS}</style>

      <div style={s.header} className="no-print">
        <button onClick={() => router.back()} style={s.backBtn} aria-label="Back">
          <MdArrowBack size={22} color="var(--text-primary)" />
        </button>
        <h1 style={s.title}>Receipt</h1>
        <div style={{ width: 34 }} />
      </div>

      <div style={s.cardWrap}>
        <div className="receipt-card receipt-print-area">
          <div className="receipt-brand">
            <div className="receipt-brand-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/admerce_symbol.png" alt="" className="receipt-brand-mark" />
              <span className="receipt-brand-name">Admerce</span>
            </div>
            <span className="receipt-brand-right">Transaction Receipt</span>
          </div>

          <div className="receipt-narrative">{narrativeVerb}</div>
          <div className="receipt-amount-block">
            <div className="receipt-amount">{fmtMoney(amount)}</div>
            <div className="receipt-status">
              <MdCheckCircle size={16} color="var(--success-fg)" />
              <span>{txn.status === 'completed' ? 'Successful' : txn.status || 'Paid'}</span>
            </div>
            {payeeStage && (
              <div className="receipt-recipient">
                {isDebit ? 'to' : 'from'} <strong>{isDebit ? payeeStage : payerStage}</strong>
              </div>
            )}
          </div>

          <div className="receipt-dotted" />

          <div className="receipt-fields">
            <div className="field">
              <div className="field-label">Transaction Reference</div>
              <CopyValue
                value={reference}
                label="reference"
                copied={copiedKey === 'ref'}
                onCopy={() => handleCopy('ref', reference)}
                mono
              />
            </div>

            <div className="field">
              <div className="field-label">Amount</div>
              <CopyValue
                value={fmtMoney(amount)}
                label="amount"
                copied={copiedKey === 'amt'}
                onCopy={() => handleCopy('amt', String(amount))}
              />
            </div>

            <div className="field">
              <div className="field-label">Description</div>
              <div className="field-value">{description}</div>
            </div>

            <div className="field">
              <div className="field-label">Paid By</div>
              {renderParty(payerStage, payerPersonal, payerRole)}
            </div>

            <div className="field">
              <div className="field-label">Paid To</div>
              {renderParty(payeeStage, payeePersonal, payeeRole)}
            </div>

            <div className="field">
              <div className="field-label">Date</div>
              <div className="field-value field-mono">{fmtDate(createdAt)}</div>
            </div>

            <div className="field">
              <div className="field-label">Transaction Type</div>
              <div className="field-value">{txnType}</div>
            </div>

            <div className="field">
              <div className="field-label">Status</div>
              <div className="field-value">
                <span className="field-status">
                  {txn.status === 'completed' ? 'Successful' : txn.status || '—'}
                </span>
              </div>
            </div>

            {typeof txn.id === 'number' && (
              <div className="field">
                <div className="field-label">Transaction ID</div>
                <CopyValue
                  value={String(txn.id)}
                  label="transaction ID"
                  copied={copiedKey === 'tid'}
                  onCopy={() => handleCopy('tid', String(txn.id))}
                  mono
                />
              </div>
            )}
          </div>

          <div className="receipt-dotted" />

          <div className="receipt-total">
            <span className="receipt-total-label">
              {isDebit ? 'Total Paid' : 'Total Received'}
            </span>
            <span className="receipt-total-value">{fmtMoney(amount)}</span>
          </div>

          <div className="receipt-actions no-print">
            <span className="action-status">
              <MdCheckCircle size={14} color="var(--success-fg)" />
              Successful
            </span>
            <button type="button" className="action-btn action-share" onClick={handleShare}>
              <MdShare size={16} />
              {copiedKey === 'share' ? 'Copied' : 'Share Receipt'}
            </button>
            <button type="button" className="action-btn action-download" onClick={handlePrint}>
              <MdDownload size={16} />
              Download
            </button>
          </div>

          <div className="receipt-footer">
            <div className="footer-brand">Admerce</div>
            <div className="footer-sub">Thank you for using Admerce</div>
            <div className="footer-verify">
              Verify this receipt with the Transaction Reference above.
              <br />
              Questions? Contact support@admerce.app
            </div>
          </div>

          <div className="receipt-watermark">Admerce</div>
        </div>
      </div>
    </main>
  );
}

export default function InstantReceiptPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-primary)' }}>Loading…</div>}>
      <InstantReceiptContent />
    </Suspense>
  );
}

const RECEIPT_CSS = `
  /* Prevent any horizontal scroll on the receipt page */
  html, body { overflow-x: hidden !important; }

  .receipt-card {
    position: relative;
    overflow: hidden;
    background-color: var(--bg-secondary);
    border-radius: 20px;
    padding: 22px 22px 0;
    border: 1px solid var(--border-default);
    box-shadow: var(--shadow-lg);
    box-sizing: border-box;
    max-width: 100%;
  }
  .receipt-card > * { position: relative; z-index: 1; max-width: 100%; }

  /* Logo watermark — clipped by overflow hidden above */
  .receipt-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url('/admerce_symbol.png');
    background-repeat: repeat;
    background-size: 110px 110px;
    background-position: 0 0;
    opacity: 0.05;
    pointer-events: none;
    z-index: 0;
  }

  .receipt-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 22px;
    min-width: 0;
  }
  .receipt-brand-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .receipt-brand-mark { width: 26px; height: 26px; object-fit: contain; display: block; flex-shrink: 0; }
  .receipt-brand-name { font-size: 17px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em; }
  .receipt-brand-right { font-size: 12px; font-weight: 700; color: var(--text-tertiary); letter-spacing: 0.2px; white-space: nowrap; }

  .receipt-narrative {
    font-size: 14px; font-weight: 600;
    color: var(--text-tertiary);
    text-align: center; margin-bottom: 4px;
  }
  .receipt-amount-block { text-align: center; margin-bottom: 22px; }
  .receipt-amount {
    font-size: 36px; font-weight: 800;
    color: var(--brand-primary);
    letter-spacing: -1.2px; line-height: 1.05;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .receipt-status {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 10px;
    font-size: 14px; font-weight: 800; color: var(--success-fg);
  }
  .receipt-recipient {
    margin-top: 8px;
    font-size: 13.5px; color: var(--text-secondary); font-weight: 600;
    overflow-wrap: anywhere;
  }
  .receipt-recipient strong { color: var(--text-primary); font-weight: 800; }

  .receipt-dotted {
    height: 1px; margin: 18px -22px;
    background-image: linear-gradient(
      to right,
      var(--border-default) 0, var(--border-default) 4px,
      transparent 4px, transparent 10px
    );
    background-size: 10px 1px;
    background-repeat: repeat-x;
  }

  .receipt-fields { display: flex; flex-direction: column; gap: 18px; }
  .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .field-label {
    font-size: 11px; font-weight: 800;
    letter-spacing: 0.8px; color: var(--text-muted);
    text-transform: uppercase;
  }
  .field-value {
    font-size: 14.5px; font-weight: 700;
    color: var(--text-primary);
    overflow-wrap: anywhere;
    word-break: break-word;
    line-height: 1.4;
    max-width: 100%;
  }
  .field-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px; letter-spacing: -0.2px;
    word-break: break-all;
  }
  .field-sub {
    font-size: 12.5px; color: var(--text-tertiary); font-weight: 600;
    overflow-wrap: anywhere;
  }
  .field-role {
    font-size: 11px; color: var(--text-muted); font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.6px; margin-top: 2px;
  }
  .field-value-row {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    min-width: 0;
  }
  .field-value-row .field-value { flex: 1; min-width: 0; }
  .field-copy {
    flex: 0 0 auto; width: 32px; height: 32px;
    border-radius: 8px; border: 1px solid var(--border-default);
    background: var(--bg-tertiary); cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.15s, border-color 0.15s;
  }
  .field-copy:hover { background: var(--bg-hover); border-color: var(--border-strong); }
  .field-copy:active { transform: scale(0.95); }

  .field-status {
    display: inline-flex; align-items: center;
    padding: 3px 10px; border-radius: 999px;
    background: var(--success-bg); color: var(--success-fg);
    font-size: 12.5px; font-weight: 800; letter-spacing: 0.2px;
  }

  .receipt-total {
    display: flex; justify-content: space-between; align-items: baseline;
    padding-top: 14px; margin-top: 18px;
    border-top: 1px solid var(--border-subtle);
    gap: 12px;
  }
  .receipt-total-label {
    font-size: 14px; font-weight: 700; color: var(--text-secondary);
  }
  .receipt-total-value {
    font-size: 22px; font-weight: 800;
    color: var(--brand-primary);
    font-variant-numeric: tabular-nums; letter-spacing: -0.4px;
    overflow-wrap: anywhere;
  }

  .receipt-actions {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-top: 20px; padding-top: 18px;
    border-top: 1px dashed var(--border-default);
    align-items: center;
  }
  .action-status {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 999px;
    background: var(--success-bg); color: var(--success-fg);
    font-size: 12.5px; font-weight: 800; flex: 0 0 auto;
  }
  .action-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 14px; border-radius: 12px;
    font-size: 13px; font-weight: 800;
    cursor: pointer; font-family: inherit; border: none;
    transition: opacity 0.15s, transform 0.1s;
    flex: 1 1 120px; min-width: 0;
  }
  .action-btn:active { transform: scale(0.98); }
  .action-share {
    background: var(--brand-gradient); color: var(--brand-on-gradient);
    box-shadow: var(--shadow-brand);
  }
  .action-share:hover { opacity: 0.94; }
  .action-download {
    background: var(--bg-tertiary); color: var(--text-primary);
    border: 1px solid var(--border-default);
  }
  .action-download:hover { background: var(--bg-hover); }

  .receipt-footer {
    margin-top: 22px; padding-top: 18px;
    border-top: 1px dashed var(--border-default);
    text-align: center;
  }
  .footer-brand { font-size: 14px; font-weight: 800; color: var(--brand-primary); letter-spacing: 0.4px; }
  .footer-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
  .footer-verify { font-size: 10.5px; color: var(--text-muted); margin-top: 12px; line-height: 1.6; }

  .receipt-watermark {
    text-align: center;
    font-size: 22px; font-weight: 800;
    color: var(--text-muted); opacity: 0.22;
    letter-spacing: 1px;
    padding: 18px 0 14px;
    margin: 0 -22px;
    user-select: none; pointer-events: none;
    overflow: hidden;
  }

  /* Mobile safety net */
  @media (max-width: 480px) {
    .receipt-amount { font-size: 32px; }
    .receipt-total-value { font-size: 20px; }
  }
`;

const PRINT_CSS = `
  @media print {
    html, body { background: #ffffff !important; color: #000000 !important; overflow: visible !important; }
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
    .receipt-print-area .receipt-brand-name,
    .receipt-print-area .footer-brand { color: #0504AA !important; }
    .receipt-print-area .receipt-status,
    .receipt-print-area .field-status,
    .receipt-print-area .action-status { color: #15803D !important; }
    .receipt-print-area .action-share,
    .receipt-print-area .action-download { display: none !important; }
    .receipt-print-area .field-copy { display: none !important; }
    .receipt-print-area .receipt-dotted {
      background-image: linear-gradient(
        to right, #999 0, #999 4px, transparent 4px, transparent 10px
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
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100vw',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  spinner: {
    width: 40, height: 40,
    border: '4px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  backCta: {
    marginTop: 20, padding: '12px 22px',
    borderRadius: 12, border: 'none',
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    fontSize: 14, fontWeight: 800,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  header: {
    display: 'flex', alignItems: 'center',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-default)',
  },
  backBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', marginRight: 12,
    display: 'flex', alignItems: 'center', padding: 4,
  },
  title: { fontSize: 20, fontWeight: 700, flex: 1, color: 'var(--text-primary)' },
  cardWrap: {
    padding: 16,
    maxWidth: 540,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
};