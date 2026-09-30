'use client';

import {
  useState,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
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
} from 'react-icons/md';

interface BalanceResponse {
  balance?: number;
}
interface ProfileResponse {
  email?: string;
}
interface StoreInfo {
  store_id?: string;
}
interface RawOrder {
  order_id: string;
  status?: string;
  total_amount?: number | string;
  customer_name?: string;
  created_at?: string;
  expires_at?: string;
  quantity?: number;
  [key: string]: unknown;
}
interface RawTransaction {
  id: string | number;
  type?: string;
  amount?: number | string;
  description?: string;
  created_at?: string;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
}

interface PendingOrder {
  order_id: string;
  status: string;
  amount: number;
  customer: string;
  created_at: string;
  expires_at?: string;
}

interface WalletState {
  balance: number;
  email: string;
  transactions: Transaction[];
  pendingOrders: PendingOrder[];
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
      pendingOrders: PendingOrder[];
    }
  | { type: 'FETCH_ERROR' };

const initialState: WalletState = {
  balance: 0,
  email: '',
  transactions: [],
  pendingOrders: [],
  loading: true,
  errored: false,
};

function walletReducer(
  state: WalletState,
  action: WalletAction,
): WalletState {
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
        pendingOrders: action.pendingOrders,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, errored: true };
    default:
      return state;
  }
}

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];
const MIN_TOPUP = 100;
const MAX_TOPUP = 100_000_000;
const EXPIRING_SOON_MS = 30 * 60 * 1000;

const PENDING_STATUSES = new Set([
  'locked',
  'accepted',
  'dispatched',
]);

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

function formatRemaining(expiresMs: number, nowMs: number): string {
  if (!Number.isFinite(expiresMs)) return '';
  const ms = expiresMs - nowMs;
  if (ms <= 0) return 'expired';
  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 60) return `${totalSecs}s left`;
  const totalMins = Math.floor(totalSecs / 60);
  if (totalMins < 60) return `${totalMins}m left`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 24)
    return mins > 0 ? `${hrs}h ${mins}m left` : `${hrs}h left`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h left`;
}

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
    amount: Number(t.amount ?? 0),
    description:
      t.description ??
      (t.type === 'credit' ? 'Payment received' : 'Debit'),
    date: t.created_at ?? '',
  }));
}

function normalizePendingOrders(raw: unknown): PendingOrder[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawOrder[])
    .filter((o) =>
      PENDING_STATUSES.has((o.status || '').toLowerCase()),
    )
    .map((o) => ({
      order_id: o.order_id,
      status: (o.status || '').toLowerCase(),
      amount: Number(o.total_amount ?? 0),
      customer: o.customer_name || 'Customer',
      created_at: o.created_at ?? '',
      expires_at: o.expires_at as string | undefined,
    }));
}

function pendingStatusLabel(status: string): string {
  switch (status) {
    case 'locked':
      return 'Reserved';
    case 'accepted':
      return 'Awaiting pickup';
    case 'dispatched':
      return 'Out for delivery';
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
      return {
        bg: 'var(--brand-soft)',
        fg: 'var(--brand-primary)',
        border:
          'color-mix(in srgb, var(--brand-primary) 30%, transparent)',
      };
    case 'accepted':
      return {
        bg: 'var(--purple-bg)',
        fg: 'var(--purple-fg)',
        border:
          'color-mix(in srgb, var(--purple-fg) 30%, transparent)',
      };
    case 'dispatched':
      return {
        bg: 'var(--info-bg)',
        fg: 'var(--info-fg)',
        border:
          'color-mix(in srgb, var(--info-fg) 30%, transparent)',
      };
    default:
      return {
        bg: 'var(--bg-tertiary)',
        fg: 'var(--text-secondary)',
        border: 'var(--border-default)',
      };
  }
}

export default function StorekeeperWalletPage() {
  useAuthGuard();

  const router = useRouter();

  const [state, dispatch] = useReducer(walletReducer, initialState);
  const {
    balance,
    email,
    transactions,
    pendingOrders,
    loading,
    errored,
  } = state;

  const [refreshing, setRefreshing] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) dispatch({ type: 'FETCH_START' });
    try {
      const [balData, txnData, profileData, storeData] =
        await Promise.all([
          api.getWalletBalance() as Promise<BalanceResponse>,
          api
            .getWalletTransactions(20, 0)
            .catch(() => [] as unknown[]),
          api.getMyProfile() as Promise<ProfileResponse>,
          api.getMyStore().catch(() => null) as Promise<StoreInfo | null>,
        ]);

      let ordersRaw: unknown = [];
      const storeId = storeData?.store_id;
      if (storeId) {
        ordersRaw = await api
          .getStoreOrders(storeId)
          .catch(() => []);
      }

      dispatch({
        type: 'FETCH_SUCCESS',
        balance: balData.balance ?? 0,
        email: profileData.email ?? '',
        transactions: normalizeTransactions(txnData),
        pendingOrders: normalizePendingOrders(ordersRaw),
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
  const topUpDisabled =
    paying || !hasEmail || !amountNum || belowMin;

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
    () => pendingOrders.reduce((s, o) => s + o.amount, 0),
    [pendingOrders],
  );

  if (loading) {
    return (
      <div style={css.root} className="sk-wallet-root">
        <style>{KF}</style>
        <style>{CSS}</style>
        <div className="sk-wallet-shell">
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
                  backgroundColor:
                    'color-mix(in srgb, var(--brand-on-gradient) 18%, transparent)',
                }}
              />
              <div
                style={{
                  width: 200,
                  height: 42,
                  borderRadius: 6,
                  backgroundColor:
                    'color-mix(in srgb, var(--brand-on-gradient) 24%, transparent)',
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
                    backgroundColor: 'var(--bg-tertiary)',
                    animation:
                      'skWalletShimmer 1.4s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                height: 1,
                backgroundColor: 'var(--border-subtle)',
                margin: '20px 0',
              }}
            />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: 'var(--bg-tertiary)',
                  marginBottom: 10,
                  animation:
                    'skWalletShimmer 1.4s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (errored) {
    return (
      <div style={css.errorRoot}>
        <style>{KF}</style>
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={44} color="var(--danger-fg)" />
        </div>
        <h2 style={css.errorHeading}>
          Couldn&apos;t load your wallet
        </h2>
        <p style={css.errorBody}>
          Check your connection and try again. If this keeps happening,
          sign out and back in.
        </p>
        <button onClick={handleRefresh} style={css.errorRetry}>
          <MdRefresh size={18} color="var(--brand-on-gradient)" />
          <span>Retry</span>
        </button>
        <button onClick={() => router.back()} style={css.errorBack}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div style={css.root} className="sk-wallet-root">
      <style>{KF}</style>
      <style>{CSS}</style>

      <div className="sk-wallet-shell">
        <div style={css.hero}>
          <div style={css.heroGlow} aria-hidden />

          <div style={css.topBar}>
            <button
              style={css.ghostBtn}
              onClick={() => router.back()}
              aria-label="Back"
            >
              <MdArrowBack
                size={22}
                color="var(--brand-on-gradient)"
              />
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
                color="var(--brand-on-gradient)"
                style={{
                  animation: refreshing
                    ? 'spin 0.8s linear infinite'
                    : 'none',
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
                aria-label={
                  balanceVisible ? 'Hide balance' : 'Show balance'
                }
              >
                {balanceVisible ? (
                  <MdVisibility
                    size={16}
                    color="color-mix(in srgb, var(--brand-on-gradient) 75%, transparent)"
                  />
                ) : (
                  <MdVisibilityOff
                    size={16}
                    color="color-mix(in srgb, var(--brand-on-gradient) 75%, transparent)"
                  />
                )}
              </button>
            </span>

            <span style={css.balValue}>
              {balanceVisible ? fmt(balance) : '₦ ••••••'}
            </span>

            <span style={css.copyHint}>
              {copied ? (
                <>
                  <MdCheck size={13} color="var(--success-fg)" />
                  <span style={{ color: 'var(--success-fg)' }}>
                    Copied
                  </span>
                </>
              ) : (
                <>
                  <MdContentCopy
                    size={13}
                    color="color-mix(in srgb, var(--brand-on-gradient) 55%, transparent)"
                  />
                  <span>Tap to copy</span>
                </>
              )}
            </span>
          </button>

          {pendingOrders.length > 0 && (
            <div style={css.pendingPill}>
              <MdHourglassEmpty size={14} color="var(--warning-fg)" />
              <span style={css.pendingPillText}>
                <strong>{fmtShort(pendingTotal)}</strong> pending
                pickup
                <span style={css.pendingPillCount}>
                  · {pendingOrders.length}
                </span>
              </span>
            </div>
          )}
        </div>

        <div style={css.sheet}>
          <button
            type="button"
            onClick={() =>
              router.push('/storekeeper/wallet/withdraw')
            }
            style={css.primaryWithdraw}
            className="sk-primary-withdraw"
          >
            <MdArrowOutward size={20} color="var(--brand-on-gradient)" />
            <span>Withdraw to bank</span>
          </button>

          <div style={css.secondaryRow}>
            <button
              type="button"
              onClick={() => setShowTopUp(true)}
              style={css.secondaryBtn}
              className="sk-secondary"
            >
              <div style={css.secondaryIconAdd}>
                <MdAdd size={16} color="var(--brand-primary)" />
              </div>
              <span style={css.secondaryLabel}>Top up</span>
            </button>
            <button
              type="button"
              onClick={() =>
                router.push('/storekeeper/wallet/history')
              }
              style={css.secondaryBtn}
              className="sk-secondary"
            >
              <div style={css.secondaryIconHistory}>
                <MdHistory size={16} color="var(--info-fg)" />
              </div>
              <span style={css.secondaryLabel}>History</span>
            </button>
          </div>

          <div style={css.divider} />

          <div style={css.secHead}>
            <div style={css.secHeadLeft}>
              <span style={css.secTitle}>Awaiting release</span>
              {pendingOrders.length > 0 && (
                <span style={css.secCount}>
                  {pendingOrders.length}
                </span>
              )}
            </div>
            {pendingOrders.length > 0 && (
              <span style={css.secSub}>
                {fmtShort(pendingTotal)}
              </span>
            )}
          </div>

          {pendingOrders.length === 0 ? (
            <div style={css.emptySmall}>
              <div style={css.emptySmallIcon}>
                <MdWallet size={22} color="var(--text-muted)" />
              </div>
              <div>
                <div style={css.emptySmallTitle}>
                  Nothing pending
                </div>
                <div style={css.emptySmallBody}>
                  Reservations and orders will show here until they
                  clear.
                </div>
              </div>
            </div>
          ) : (
            <div style={css.pendingList}>
              {pendingOrders.slice(0, 5).map((order) => {
                const color = pendingStatusColor(order.status);
                const expiresMs = parseAsUtc(order.expires_at);
                const expiringSoon =
                  Number.isFinite(expiresMs) &&
                  order.status === 'locked' &&
                  expiresMs - nowTick < EXPIRING_SOON_MS &&
                  expiresMs - nowTick > 0;

                return (
                  <button
                    key={order.order_id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/storekeeper/orders?highlight=${order.order_id}`,
                      )
                    }
                    style={css.pendingCard}
                    className="sk-pending-card"
                  >
                    <div style={css.pendingAvatar}>
                      {order.customer.charAt(0).toUpperCase()}
                    </div>
                    <div style={css.pendingBody}>
                      <div style={css.pendingTopRow}>
                        <span
                          style={css.pendingCustomer}
                          title={order.customer}
                        >
                          {order.customer}
                        </span>
                        <span
                          style={{
                            ...css.pendingChip,
                            background: color.bg,
                            color: color.fg,
                            borderColor: color.border,
                          }}
                        >
                          {pendingStatusLabel(order.status)}
                        </span>
                      </div>
                      <div style={css.pendingMeta}>
                        <span style={css.pendingAmount}>
                          {fmtShort(order.amount)}
                        </span>
                        {Number.isFinite(expiresMs) &&
                          order.status === 'locked' && (
                            <>
                              <span style={css.pendingDot}>·</span>
                              <span
                                style={{
                                  ...css.pendingExpiry,
                                  ...(expiringSoon
                                    ? css.pendingExpiryWarn
                                    : null),
                                }}
                              >
                                {formatRemaining(
                                  expiresMs,
                                  nowTick,
                                )}
                              </span>
                            </>
                          )}
                      </div>
                    </div>
                    <MdChevronRight
                      size={18}
                      color="var(--text-muted)"
                    />
                  </button>
                );
              })}
              {pendingOrders.length > 5 && (
                <button
                  type="button"
                  onClick={() =>
                    router.push('/storekeeper/orders')
                  }
                  style={css.viewAllBtn}
                >
                  View all {pendingOrders.length} pending orders →
                </button>
              )}
            </div>
          )}

          <div style={css.divider} />

          <div style={css.secHead}>
            <span style={css.secTitle}>Recent activity</span>
            <button
              style={css.seeAll}
              onClick={() =>
                router.push('/storekeeper/wallet/history')
              }
            >
              See all →
            </button>
          </div>

          <div style={css.txnList}>
            {transactions.length === 0 ? (
              <div style={css.emptySmall}>
                <div style={css.emptySmallIcon}>
                  <MdAccountBalanceWallet
                    size={22}
                    color="var(--text-muted)"
                  />
                </div>
                <div>
                  <div style={css.emptySmallTitle}>
                    No activity yet
                  </div>
                  <div style={css.emptySmallBody}>
                    Sales and withdrawals will show here once you
                    start receiving orders.
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
                        isCredit
                          ? 'var(--success-fg)'
                          : 'var(--danger-fg)'
                      }`,
                      animationDelay: `${i * 30}ms`,
                    }}
                  >
                    <div
                      style={{
                        ...css.txnIconWrap,
                        backgroundColor: isCredit
                          ? 'var(--success-bg)'
                          : 'var(--danger-bg)',
                      }}
                    >
                      {isCredit ? (
                        <MdTrendingUp
                          size={18}
                          color="var(--success-fg)"
                        />
                      ) : (
                        <MdTrendingDown
                          size={18}
                          color="var(--danger-fg)"
                        />
                      )}
                    </div>
                    <div style={css.txnMeta}>
                      <span style={css.txnDesc}>
                        {txn.description}
                      </span>
                      <span style={css.txnDate}>
                        {fmtDate(txn.date)}
                      </span>
                    </div>
                    <span
                      style={{
                        ...css.txnAmt,
                        color: isCredit
                          ? 'var(--success-fg)'
                          : 'var(--danger-fg)',
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
      </div>

      {showTopUp && (
        <div
          style={css.overlay}
          className="sk-wallet-overlay"
          onClick={closeTopUp}
        >
          <div
            style={css.bottomSheet}
            className="sk-wallet-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={css.sheetHandle} />
            <h2 style={css.modalTitle}>Add money</h2>
            <p style={css.modalSub}>
              Top up your wallet to spend as a shopper on Admerce
            </p>

            {!hasEmail && (
              <div style={css.warnBox}>
                <strong>Email required.</strong> Add an email to
                your profile to receive a Paystack receipt and
                unlock top-ups.
              </div>
            )}

            <div style={css.presets}>
              {PRESET_AMOUNTS.map((p) => {
                const active =
                  amount === p.toLocaleString('en-NG');
                return (
                  <button
                    key={p}
                    type="button"
                    style={{
                      ...css.preset,
                      background: active
                        ? 'var(--brand-gradient)'
                        : 'var(--brand-soft)',
                      color: active
                        ? 'var(--brand-on-gradient)'
                        : 'var(--brand-primary)',
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
                    ? 'var(--danger-fg)'
                    : 'var(--border-default)',
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
              <div style={css.inlineError}>
                Enter an amount to continue
              </div>
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

const KF = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes skWalletShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .sk-primary-withdraw:hover { transform: translateY(-2px); box-shadow: 0 14px 30px color-mix(in srgb, var(--brand-primary) 32%, transparent); }
  .sk-primary-withdraw:active { transform: translateY(0) scale(0.985); }
  .sk-secondary:hover { background-color: var(--bg-hover); }
  .sk-pending-card:hover { border-color: var(--brand-primary); }
`;

const CSS = `
  .sk-wallet-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    overflow-x: hidden;
    transition: background-color 0.18s ease, color 0.18s ease;
  }
  .sk-wallet-shell {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .sk-wallet-overlay { align-items: flex-end; }

  @media (min-width: 1024px) {
    .sk-wallet-overlay {
      align-items: center !important;
      padding: 24px;
    }
    .sk-wallet-sheet {
      border-radius: 24px !important;
      max-height: 80vh;
      overflow-y: auto;
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

  hero: {
    position: 'relative',
    background: 'var(--brand-gradient)',
    padding: '0 20px 30px',
    overflow: 'hidden',
    transition: 'background 0.18s ease',
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, color-mix(in srgb, var(--brand-on-gradient) 18%, transparent) 0%, transparent 70%)',
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
    background:
      'color-mix(in srgb, var(--brand-on-gradient) 8%, transparent)',
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
    color: 'var(--brand-on-gradient)',
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
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 65%, transparent)',
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
    color: 'var(--brand-on-gradient)',
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
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 55%, transparent)',
    marginTop: 8,
    letterSpacing: 0.2,
  },

  pendingPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 14px',
    borderRadius: 999,
    backgroundColor:
      'color-mix(in srgb, var(--warning-fg) 18%, transparent)',
    border:
      '1px solid color-mix(in srgb, var(--warning-fg) 35%, transparent)',
  },
  pendingPillText: {
    fontSize: 12.5,
    fontWeight: 600,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 92%, transparent)',
  },
  pendingPillCount: {
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 60%, transparent)',
    fontWeight: 500,
    marginLeft: 4,
  },

  sheet: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '24px 24px 0 0',
    marginTop: -16,
    padding: '24px 20px 120px',
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
    transition: 'background-color 0.18s ease',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: -0.1,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-brand)',
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
    border: '1.5px solid var(--border-default)',
    backgroundColor: 'var(--bg-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s',
  },
  secondaryIconAdd: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'var(--brand-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryIconHistory: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'var(--info-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: -0.1,
  },

  divider: {
    height: 1,
    backgroundColor: 'var(--border-subtle)',
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
    color: 'var(--text-primary)',
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
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    fontSize: 11.5,
    fontWeight: 800,
  },
  secSub: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  seeAll: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--brand-primary)',
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
    border: '1px solid var(--border-default)',
    backgroundColor: 'var(--bg-tertiary)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s, background-color 0.18s ease',
  },
  pendingAvatar: {
    width: 38,
    height: 38,
    flex: '0 0 38px',
    borderRadius: 12,
    background: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
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
    color: 'var(--text-primary)',
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
    gap: 6,
    fontSize: 12.5,
    color: 'var(--text-tertiary)',
  },
  pendingAmount: {
    fontWeight: 700,
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  pendingDot: {
    color: 'var(--border-strong)',
  },
  pendingExpiry: {
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  pendingExpiryWarn: {
    color: 'var(--warning-fg)',
    fontWeight: 700,
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
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 12,
    animation: 'fadeUp 0.3s ease both',
    border: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
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
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  txnDate: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
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
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px dashed var(--border-default)',
  },
  emptySmallIcon: {
    width: 44,
    height: 44,
    flex: '0 0 44px',
    borderRadius: 12,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySmallTitle: {
    fontSize: 13.5,
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: -0.1,
  },
  emptySmallBody: {
    fontSize: 12.5,
    color: 'var(--text-muted)',
    marginTop: 2,
    lineHeight: 1.4,
  },

  viewAllBtn: {
    alignSelf: 'flex-start',
    padding: '8px 4px',
    background: 'none',
    border: 'none',
    color: 'var(--brand-primary)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--overlay)',
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
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    borderRadius: '24px 24px 0 0',
    padding: '12px 24px calc(32px + env(safe-area-inset-bottom))',
    boxShadow: 'var(--shadow-lg)',
    animation: 'sheetUp 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'var(--border-default)',
    borderRadius: 2,
    margin: '0 auto 20px',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: '0 0 4px',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 13,
    color: 'var(--text-muted)',
    margin: '0 0 20px',
  },
  warnBox: {
    padding: '12px 14px',
    borderRadius: 12,
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-strong)',
    marginBottom: 18,
    fontSize: 12.5,
    color: 'var(--warning-fg)',
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
    border: '1.5px solid var(--border-default)',
    borderRadius: 14,
    padding: '0 16px',
    marginBottom: 8,
    backgroundColor: 'var(--bg-tertiary)',
  },
  inputPrefix: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--brand-primary)',
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
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums',
  },
  inlineError: {
    fontSize: 12,
    color: 'var(--danger-fg)',
    fontWeight: 600,
    marginBottom: 14,
    paddingLeft: 4,
  },
  payBtn: {
    width: '100%',
    padding: 16,
    marginTop: 8,
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  cancelBtn: {
    width: '100%',
    padding: 14,
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
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
  errorHeading: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  errorBody: {
    fontSize: 14,
    color: 'var(--text-secondary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  errorBack: {
    marginTop: 12,
    padding: 10,
    background: 'none',
    border: 'none',
    color: 'var(--brand-primary)',
    fontWeight: 700,
    fontSize: 13.5,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};