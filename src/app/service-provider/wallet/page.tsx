'use client';

import { useState, useReducer, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { initializePaystack } from '../../../services/paymentService';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import {
  MdAdd,
  MdArrowBack,
  MdRefresh,
  MdTrendingUp,
  MdTrendingDown,
  MdHistory,
  MdArrowOutward,
  MdAccountBalanceWallet,
  MdVisibility,
  MdVisibilityOff,
  MdCheck,
  MdContentCopy,
  MdHourglassEmpty,
  MdChevronRight,
  MdWallet,
  MdErrorOutline,
  MdCalendarToday,
  MdPersonOutline,
} from 'react-icons/md';

// ─── Types ────────────────────────────────────────────────────────────
interface BalanceResponse { balance?: number }
interface ProfileResponse { email?: string }
interface RawTransaction {
  id: string | number;
  type?: string;
  amount?: number | string;
  description?: string;
  created_at?: string;
}
interface RawBooking {
  booking_id?: string;
  service_id?: string;
  service_title?: string;
  title?: string;
  provider_id?: string;
  provider_name?: string;
  customer_id?: string;
  customer_name?: string;
  user_name?: string;
  status?: string;
  amount?: number | string;
  scheduled_for?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
}

interface PendingBooking {
  booking_id: string;
  service_title: string;
  customer: string;
  amount: number;
  status: string;
  scheduled_for?: string;
  created_at: string;
}

interface WalletState {
  balance: number;
  email: string;
  transactions: Transaction[];
  pendingBookings: PendingBooking[];
  loading: boolean;
  errored: boolean;
}

type WalletAction =
  | { type: 'FETCH_START' }
  | {
      type: 'FETCH_SUCCESS';
      balance: number;
      email: string;
      transactions: Transaction[];
      pendingBookings: PendingBooking[];
    }
  | { type: 'FETCH_ERROR' };

const initialState: WalletState = {
  balance: 0,
  email: '',
  transactions: [],
  pendingBookings: [],
  loading: true,
  errored: false,
};

function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, errored: false };
    case 'FETCH_SUCCESS':
      return {
        loading: false,
        errored: false,
        balance: action.balance,
        email: action.email,
        transactions: action.transactions,
        pendingBookings: action.pendingBookings,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, errored: true };
    default:
      return state;
  }
}

// ─── Constants ────────────────────────────────────────────────────────
const PRESET_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];
const MIN_TOPUP = 100;
const MAX_TOPUP = 100_000_000;

const PENDING_BOOKING_STATUSES = new Set(['locked', 'accepted']);

// ─── Helpers ──────────────────────────────────────────────────────────
const fmt = (v: number) =>
  '₦' +
  v.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtShort = (v: number) =>
  '₦' + Math.round(v).toLocaleString('en-NG');

function parseAsUtc(iso?: string | null): number {
  if (!iso) return NaN;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const trimmed = iso.replace(/(\.\d{3})\d+/, '$1');
  return new Date(hasTz ? trimmed : `${trimmed}Z`).getTime();
}

const fmtDate = (s: string) => {
  if (!s) return '—';
  const t = parseAsUtc(s);
  if (Number.isNaN(t)) return s;
  try {
    return new Date(t).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return s;
  }
};

const fmtDateTime = (s?: string) => {
  if (!s) return '';
  const t = parseAsUtc(s);
  if (Number.isNaN(t)) return s;
  try {
    return new Date(t).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
};

function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return '';
  if (n > MAX_TOPUP) return MAX_TOPUP.toLocaleString('en-NG');
  return n.toLocaleString('en-NG');
}

function normalizeTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawTransaction[]).map((t) => ({
    id: String(t.id),
    type: t.type === 'credit' ? 'credit' : 'debit',
    amount: Math.abs(Number(t.amount ?? 0)),
    description:
      t.description ?? (t.type === 'credit' ? 'Payment received' : 'Debit'),
    date: t.created_at ?? '',
  }));
}

function normalizePendingBookings(raw: unknown): PendingBooking[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawBooking[])
    .filter((b) =>
      PENDING_BOOKING_STATUSES.has((b.status || '').toLowerCase()),
    )
    .map((b) => ({
      booking_id: String(b.booking_id || b.id || ''),
      service_title:
        (b.service_title as string) ||
        (b.title as string) ||
        'Service booking',
      customer:
        (b.customer_name as string) ||
        (b.user_name as string) ||
        'Customer',
      amount: Number(b.amount ?? 0),
      status: (b.status || '').toLowerCase(),
      scheduled_for: b.scheduled_for as string | undefined,
      created_at: (b.created_at as string) || '',
    }))
    .filter((b) => b.booking_id);
}

function pendingStatusLabel(status: string): string {
  switch (status) {
    case 'locked':
      return 'Awaiting confirmation';
    case 'accepted':
      return 'Confirmed';
    default:
      return status;
  }
}

function pendingStatusColor(status: string): {
  bg: string;
  fg: string;
  border: string;
} {
  switch (status) {
    case 'locked':
      return { bg: '#EEF0FF', fg: '#0504AA', border: '#C7CCFF' };
    case 'accepted':
      return { bg: '#F3E8FF', fg: '#7E22CE', border: '#D8B4FE' };
    default:
      return { bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' };
  }
}

// ─── Component ────────────────────────────────────────────────────────
export default function ServiceProviderWalletPage() {
  useAuthGuard();

  const router = useRouter();

  const [state, dispatch] = useReducer(walletReducer, initialState);
  const { balance, email, transactions, pendingBookings, loading, errored } = state;

  const [refreshing, setRefreshing] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) dispatch({ type: 'FETCH_START' });
    try {
      const [balData, txnData, profileData, bookingsData] = await Promise.all([
        api.getWalletBalance() as Promise<BalanceResponse>,
        api.getWalletTransactions(20, 0).catch(() => [] as unknown[]),
        api.getMyProfile() as Promise<ProfileResponse>,
        api.getProviderBookings().catch(() => [] as unknown[]),
      ]);

      dispatch({
        type: 'FETCH_SUCCESS',
        balance: Number(balData.balance ?? 0),
        email: profileData.email ?? '',
        transactions: normalizeTransactions(txnData),
        pendingBookings: normalizePendingBookings(bookingsData),
      });
    } catch {
      dispatch({ type: 'FETCH_ERROR' });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  };

  const handleCopyBalance = async () => {
    if (!balance) return;
    try {
      await navigator.clipboard.writeText(balance.toFixed(2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — silent
    }
  };

  const amountNum = useMemo(
    () => Number(amount.replace(/,/g, '')) || 0,
    [amount],
  );
  const hasEmail = email?.includes('@');
  const belowMin = amountNum > 0 && amountNum < MIN_TOPUP;
  const topUpDisabled = paying || !hasEmail || !amountNum || belowMin;

  const handleTopUp = async () => {
    if (topUpDisabled) return;
    setPaying(true);
    try {
      await initializePaystack({
        email,
        amount: amountNum,
        onSuccess: async () => {
          setShowTopUp(false);
          setAmount('');
          setAmountTouched(false);
          await loadData(false);
        },
        onClose: () => setShowTopUp(false),
      });
    } finally {
      setPaying(false);
    }
  };

  const closeTopUp = () => {
    setShowTopUp(false);
    setAmount('');
    setAmountTouched(false);
  };

  const pendingTotal = useMemo(
    () => pendingBookings.reduce((s, b) => s + b.amount, 0),
    [pendingBookings],
  );

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={css.root}>
        <style>{KF}</style>
        <div style={css.hero}>
          <div style={css.topBar}>
            <div style={{ width: 38 }} />
            <span style={css.heroTitle}>Earnings</span>
            <div style={{ width: 38 }} />
          </div>
          <div style={{ padding: '8px 0 26px' }}>
            <div
              style={{
                width: 140,
                height: 10,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.18)',
              }}
            />
            <div
              style={{
                width: 200,
                height: 42,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.24)',
                marginTop: 16,
              }}
            />
          </div>
        </div>
        <div style={css.sheet}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 14,
                  background: '#EEF2FF',
                  animation: 'spWalletShimmer 1.4s ease-in-out infinite',
                }}
              />
            ))}
          </div>
          <div style={{ height: 1, background: '#F1F5F9', margin: '20px 0' }} />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 56,
                borderRadius: 12,
                background: '#EEF2FF',
                marginBottom: 10,
                animation: 'spWalletShimmer 1.4s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────
  if (errored) {
    return (
      <div style={css.errorRoot}>
        <style>{KF}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={44} color="#B91C1C" />
        </div>
        <h2 style={css.errorHeading}>Couldn&apos;t load your wallet</h2>
        <p style={css.errorBody}>
          Check your connection and try again. If this keeps happening, sign
          out and back in.
        </p>
        <button onClick={handleRefresh} style={css.errorRetry}>
          <MdRefresh size={18} color="#fff" />
          <span>Retry</span>
        </button>
        <button onClick={() => router.back()} style={css.errorBack}>
          Go back
        </button>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────
  return (
    <div style={css.root}>
      <style>{KF}</style>

      {/* HERO */}
      <div style={css.hero}>
        <div style={css.heroGlow} aria-hidden />

        <div style={css.topBar}>
          <button
            style={css.ghostBtn}
            onClick={() => router.back()}
            aria-label="Back"
          >
            <MdArrowBack size={22} color="#fff" />
          </button>
          <span style={css.heroTitle}>Earnings</span>
          <button
            style={css.ghostBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <MdRefresh
              size={22}
              color="#fff"
              style={{
                animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
              }}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyBalance}
          style={css.balanceBlock}
          aria-label="Copy available balance"
        >
          <span style={css.balLabel}>
            Available to withdraw
            <button
              type="button"
              style={css.eyeBtn}
              onClick={(e) => {
                e.stopPropagation();
                setBalanceVisible((v) => !v);
              }}
              aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
            >
              {balanceVisible ? (
                <MdVisibility size={16} color="rgba(255,255,255,0.75)" />
              ) : (
                <MdVisibilityOff size={16} color="rgba(255,255,255,0.75)" />
              )}
            </button>
          </span>

          <span style={css.balValue}>
            {balanceVisible ? fmt(balance) : '₦ ••••••'}
          </span>

          <span style={css.copyHint}>
            {copied ? (
              <>
                <MdCheck size={13} color="#4CDE80" />
                <span style={{ color: '#4CDE80' }}>Copied</span>
              </>
            ) : (
              <>
                <MdContentCopy size={13} color="rgba(255,255,255,0.55)" />
                <span>Tap to copy</span>
              </>
            )}
          </span>
        </button>

        {pendingBookings.length > 0 && (
          <div style={css.pendingPill}>
            <MdHourglassEmpty size={14} color="#FDE68A" />
            <span style={css.pendingPillText}>
              <strong>{fmtShort(pendingTotal)}</strong> in escrow
              <span style={css.pendingPillCount}>
                · {pendingBookings.length}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* SHEET */}
      <div style={css.sheet}>
        <button
          type="button"
          onClick={() => router.push('/service-provider/wallet/withdraw')}
          style={css.primaryWithdraw}
          className="sp-primary-withdraw"
        >
          <MdArrowOutward size={20} color="#FFFFFF" />
          <span>Withdraw to bank</span>
        </button>

        <div style={css.secondaryRow}>
          <button
            type="button"
            onClick={() => setShowTopUp(true)}
            style={css.secondaryBtn}
            className="sp-secondary"
          >
            <div style={css.secondaryIconAdd}>
              <MdAdd size={16} color="#0504AA" />
            </div>
            <span style={css.secondaryLabel}>Top up</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/service-provider/wallet/history')}
            style={css.secondaryBtn}
            className="sp-secondary"
          >
            <div style={css.secondaryIconHistory}>
              <MdHistory size={16} color="#0891B2" />
            </div>
            <span style={css.secondaryLabel}>History</span>
          </button>
        </div>

        <div style={css.divider} />

        {/* Awaiting completion */}
        <div style={css.secHead}>
          <div style={css.secHeadLeft}>
            <span style={css.secTitle}>Awaiting completion</span>
            {pendingBookings.length > 0 && (
              <span style={css.secCount}>{pendingBookings.length}</span>
            )}
          </div>
          {pendingBookings.length > 0 && (
            <span style={css.secSub}>{fmtShort(pendingTotal)}</span>
          )}
        </div>

        {pendingBookings.length === 0 ? (
          <div style={css.emptySmall}>
            <div style={css.emptySmallIcon}>
              <MdWallet size={22} color="#94A3B8" />
            </div>
            <div>
              <div style={css.emptySmallTitle}>Nothing pending</div>
              <div style={css.emptySmallBody}>
                Bookings you haven&apos;t completed will show here until the
                funds release.
              </div>
            </div>
          </div>
        ) : (
          <div style={css.pendingList}>
            {pendingBookings.slice(0, 5).map((b) => {
              const color = pendingStatusColor(b.status);
              return (
                <button
                  key={b.booking_id}
                  type="button"
                  onClick={() => router.push('/service-provider/bookings')}
                  style={css.pendingCard}
                  className="sp-pending-card"
                >
                  <div style={css.pendingAvatar}>
                    {b.customer.charAt(0).toUpperCase()}
                  </div>
                  <div style={css.pendingBody}>
                    <div style={css.pendingTopRow}>
                      <span style={css.pendingCustomer} title={b.service_title}>
                        {b.service_title}
                      </span>
                      <span
                        style={{
                          ...css.pendingChip,
                          background: color.bg,
                          color: color.fg,
                          borderColor: color.border,
                        }}
                      >
                        {pendingStatusLabel(b.status)}
                      </span>
                    </div>
                    <div style={css.pendingMeta}>
                      <MdPersonOutline size={11} color="#94A3B8" />
                      <span style={css.pendingCustomerName}>{b.customer}</span>
                      <span style={css.pendingDot}>·</span>
                      <span style={css.pendingAmount}>
                        {fmtShort(b.amount)}
                      </span>
                      {b.scheduled_for && (
                        <>
                          <span style={css.pendingDot}>·</span>
                          <MdCalendarToday size={11} color="#94A3B8" />
                          <span style={css.pendingExpiry}>
                            {fmtDateTime(b.scheduled_for)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <MdChevronRight size={18} color="#94A3B8" />
                </button>
              );
            })}
            {pendingBookings.length > 5 && (
              <button
                type="button"
                onClick={() => router.push('/service-provider/bookings')}
                style={css.viewAllBtn}
              >
                View all {pendingBookings.length} bookings →
              </button>
            )}
          </div>
        )}

        <div style={css.divider} />

        {/* Recent activity */}
        <div style={css.secHead}>
          <span style={css.secTitle}>Recent activity</span>
          <button
            style={css.seeAll}
            onClick={() => router.push('/service-provider/wallet/history')}
          >
            See all →
          </button>
        </div>

        <div style={css.txnList}>
          {transactions.length === 0 ? (
            <div style={css.emptySmall}>
              <div style={css.emptySmallIcon}>
                <MdAccountBalanceWallet size={22} color="#94A3B8" />
              </div>
              <div>
                <div style={css.emptySmallTitle}>No activity yet</div>
                <div style={css.emptySmallBody}>
                  Completed bookings and withdrawals will show here.
                </div>
              </div>
            </div>
          ) : (
            transactions.map((txn, i) => {
              const isCredit = txn.type === 'credit';
              return (
                <div
                  key={txn.id}
                  style={{
                    ...css.txnCard,
                    borderLeft: `3px solid ${
                      isCredit ? '#4CDE80' : '#FF5757'
                    }`,
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  <div
                    style={{
                      ...css.txnIconWrap,
                      backgroundColor: isCredit ? '#DCFCE7' : '#FEE2E2',
                    }}
                  >
                    {isCredit ? (
                      <MdTrendingUp size={18} color="#16A34A" />
                    ) : (
                      <MdTrendingDown size={18} color="#DC2626" />
                    )}
                  </div>
                  <div style={css.txnMeta}>
                    <span style={css.txnDesc}>{txn.description}</span>
                    <span style={css.txnDate}>{fmtDate(txn.date)}</span>
                  </div>
                  <span
                    style={{
                      ...css.txnAmt,
                      color: isCredit ? '#16A34A' : '#DC2626',
                    }}
                  >
                    {isCredit ? '+' : '−'}
                    {fmtShort(txn.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* TOP-UP MODAL */}
      {showTopUp && (
        <div style={css.overlay} onClick={closeTopUp}>
          <div style={css.bottomSheet} onClick={(e) => e.stopPropagation()}>
            <div style={css.sheetHandle} />
            <h2 style={css.modalTitle}>Add money</h2>
            <p style={css.modalSub}>
              Top up your wallet to spend on Admerce as a buyer
            </p>

            {!hasEmail && (
              <div style={css.warnBox}>
                <strong>Email required.</strong> Add an email to your profile
                to receive a Paystack receipt and unlock top-ups.
              </div>
            )}

            <div style={css.presets}>
              {PRESET_AMOUNTS.map((p) => {
                const active = amount === p.toLocaleString('en-NG');
                return (
                  <button
                    key={p}
                    type="button"
                    style={{
                      ...css.preset,
                      backgroundColor: active ? '#0504AA' : '#EEF2FF',
                      color: active ? '#fff' : '#0504AA',
                    }}
                    onClick={() => {
                      setAmount(p.toLocaleString('en-NG'));
                      setAmountTouched(true);
                    }}
                  >
                    {fmtShort(p)}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                ...css.inputWrap,
                borderColor:
                  belowMin || (amountTouched && !amountNum)
                    ? '#FCA5A5'
                    : '#E2E8F0',
              }}
            >
              <span style={css.inputPrefix}>₦</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => {
                  setAmount(formatAmountInput(e.target.value));
                  setAmountTouched(true);
                }}
                style={css.amtInput}
                autoFocus
                disabled={!hasEmail}
              />
            </div>

            {hasEmail && belowMin && (
              <div style={css.inlineError}>
                Minimum top-up is {fmtShort(MIN_TOPUP)}
              </div>
            )}
            {hasEmail && amountTouched && !amountNum && (
              <div style={css.inlineError}>Enter an amount to continue</div>
            )}

            <button
              type="button"
              onClick={handleTopUp}
              disabled={topUpDisabled}
              style={{
                ...css.payBtn,
                opacity: topUpDisabled ? 0.5 : 1,
                cursor: topUpDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {paying
                ? 'Opening Paystack…'
                : !hasEmail
                  ? 'Add email to continue'
                  : belowMin
                    ? `Minimum ${fmtShort(MIN_TOPUP)}`
                    : amountNum
                      ? `Pay ${fmt(amountNum)} with Paystack`
                      : 'Enter an amount'}
            </button>

            <button style={css.cancelBtn} onClick={closeTopUp}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Keyframes ────────────────────────────────────────────────────────
const KF = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spWalletShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .sp-primary-withdraw:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(5, 4, 170, 0.32); }
  .sp-primary-withdraw:active { transform: translateY(0) scale(0.985); }
  .sp-secondary:hover { background-color: #F6F7FB; }
  .sp-pending-card:hover { border-color: #C7CCFF; }
`;

// ─── Styles ───────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F0F4FF',
    overflowX: 'hidden',
  },
  hero: {
    position: 'relative',
    backgroundColor: '#0504AA',
    backgroundImage:
      'radial-gradient(ellipse at 80% 0%, #1A0FB8 0%, #0504AA 55%, #03037A 100%)',
    padding: '0 20px 30px',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(61,59,255,0.35) 0%, rgba(61,59,255,0) 70%)',
    pointerEvents: 'none',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 18,
  },
  ghostBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minWidth: 38,
    minHeight: 38,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    letterSpacing: 0.3,
  },
  balanceBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    marginBottom: 14,
  },
  balLabel: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 700,
  },
  eyeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  },
  balValue: {
    fontSize: 40,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: -1,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
  },
  copyHint: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11.5,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 8,
    letterSpacing: 0.2,
  },
  pendingPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 14px',
    borderRadius: 999,
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
    border: '1px solid rgba(253, 230, 138, 0.35)',
  },
  pendingPillText: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.92)',
  },
  pendingPillCount: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 500,
    marginLeft: 4,
  },

  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: '24px 24px 0 0',
    marginTop: -16,
    padding: '24px 20px 120px',
    boxShadow: '0 -4px 30px rgba(5,4,170,0.08)',
    position: 'relative',
  },

  primaryWithdraw: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '16px 20px',
    borderRadius: 16,
    border: 'none',
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: -0.1,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(5, 4, 170, 0.28)',
    fontFamily: 'inherit',
    transition: 'transform 0.15s, box-shadow 0.2s',
  },
  secondaryRow: {
    display: 'flex',
    gap: 10,
    marginTop: 12,
  },
  secondaryBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '13px 14px',
    borderRadius: 14,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s',
  },
  secondaryIconAdd: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryIconHistory: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    margin: '22px 0',
  },

  secHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  secHeadLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  secTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  secCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    color: '#475569',
    fontSize: 11.5,
    fontWeight: 800,
  },
  secSub: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0504AA',
    fontVariantNumeric: 'tabular-nums',
  },
  seeAll: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: '#0504AA',
    fontWeight: 700,
    fontFamily: 'inherit',
    padding: 4,
  },

  pendingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  pendingCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid #EEF2FF',
    backgroundColor: '#FAFBFF',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  pendingAvatar: {
    width: 38,
    height: 38,
    flex: '0 0 38px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%)',
    color: '#0504AA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
  },
  pendingBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  pendingTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  pendingCustomer: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0B0B1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: '0 1 auto',
    letterSpacing: -0.1,
  },
  pendingChip: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 999,
    border: '1px solid',
    flexShrink: 0,
  },
  pendingMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: '#64748B',
    minWidth: 0,
    flexWrap: 'wrap',
  },
  pendingCustomerName: {
    color: '#64748B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pendingAmount: {
    fontWeight: 700,
    color: '#0504AA',
    fontVariantNumeric: 'tabular-nums',
  },
  pendingDot: {
    color: '#CBD5E1',
  },
  pendingExpiry: {
    fontWeight: 500,
    color: '#94A3B8',
  },

  txnList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  txnCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 14px 14px 12px',
    backgroundColor: '#FAFBFF',
    borderRadius: 12,
    animation: 'fadeUp 0.3s ease both',
    border: '1px solid #EEF2FF',
  },
  txnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txnMeta: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  txnDesc: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0F172A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  txnDate: {
    fontSize: 11.5,
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  txnAmt: {
    fontSize: 14,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },

  emptySmall: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 14px',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    border: '1px dashed #E2E8F0',
  },
  emptySmallIcon: {
    width: 44,
    height: 44,
    flex: '0 0 44px',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EEF0F7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySmallTitle: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  emptySmallBody: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 1.4,
  },

  viewAllBtn: {
    alignSelf: 'flex-start',
    padding: '8px 4px',
    background: 'none',
    border: 'none',
    color: '#0504AA',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(3,3,90,0.5)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
  },
  bottomSheet: {
    width: '100%',
    maxWidth: 520,
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: '24px 24px 0 0',
    padding: '12px 24px calc(32px + env(safe-area-inset-bottom))',
    boxShadow: '0 -8px 40px rgba(5,4,170,0.2)',
    animation: 'sheetUp 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    margin: '0 auto 20px',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 4px',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 13,
    color: '#94A3B8',
    margin: '0 0 20px',
  },
  warnBox: {
    padding: '12px 14px',
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    border: '1px solid #FDE68A',
    marginBottom: 18,
    fontSize: 12.5,
    color: '#92400E',
    lineHeight: 1.5,
    fontWeight: 500,
  },
  presets: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 18,
  },
  preset: {
    padding: '12px 8px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    border: '1.5px solid #E2E8F0',
    borderRadius: 14,
    padding: '0 16px',
    marginBottom: 8,
    backgroundColor: '#F8FAFF',
  },
  inputPrefix: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0504AA',
    marginRight: 8,
  },
  amtInput: {
    flex: 1,
    padding: '16px 0',
    fontSize: 20,
    fontWeight: 700,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: '#0F172A',
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums',
  },
  inlineError: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: 600,
    marginBottom: 14,
    paddingLeft: 4,
  },
  payBtn: {
    width: '100%',
    padding: 16,
    marginTop: 8,
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
  },
  cancelBtn: {
    width: '100%',
    padding: 14,
    backgroundColor: 'transparent',
    color: '#94A3B8',
    border: 'none',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  errorRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#F0F4FF',
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
  errorHeading: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  errorBody: {
    fontSize: 14,
    color: '#5A6178',
    marginTop: 8,
    maxWidth: 320,
    lineHeight: 1.5,
  },
  errorRetry: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: '13px 24px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
  },
  errorBack: {
    marginTop: 12,
    padding: 10,
    background: 'none',
    border: 'none',
    color: '#0504AA',
    fontWeight: 700,
    fontSize: 13.5,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};