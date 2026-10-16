'use client';

import {
  useState,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import { AddMoneySheet } from '../AddMoneySheet';
import { useAuthGuard } from '../../hooks/useAuthGuard';
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

export type WalletRole = 'shopper' | 'storekeeper' | 'service_provider';

interface BalanceResponse { balance?: number }
interface ProfileResponse { email?: string }
interface StoreInfo { store_id?: string }
interface RawTransaction {
  id: string | number;
  type?: string;
  amount?: number | string;
  description?: string;
  created_at?: string;
}
interface RawEscrow {
  order_id: string;
  status?: string;
  total_amount?: number | string;
  expires_at?: string;
  created_at?: string;
  listing_title?: string;
  store_name?: string;
  [k: string]: unknown;
}
interface RawOrder {
  order_id: string;
  status?: string;
  total_amount?: number | string;
  customer_name?: string;
  created_at?: string;
  expires_at?: string;
  [k: string]: unknown;
}
interface RawBooking {
  booking_id?: string;
  service_id?: string;
  service_title?: string;
  title?: string;
  provider_name?: string;
  customer_name?: string;
  user_name?: string;
  status?: string;
  amount?: number | string;
  scheduled_for?: string;
  created_at?: string;
  [k: string]: unknown;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
}

interface PendingItem {
  id: string;
  title: string;
  subtitle: string;
  customer?: string;
  amount: number;
  status: string;
  expiresAt?: string;
  scheduledFor?: string;
  routeTo: string;
  avatarSeed: string;
}

interface WalletState {
  balance: number;
  email: string;
  transactions: Transaction[];
  pendingItems: PendingItem[];
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
      pendingItems: PendingItem[];
    }
  | { type: 'FETCH_ERROR' };

const initialState: WalletState = {
  balance: 0,
  email: '',
  transactions: [],
  pendingItems: [],
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
        pendingItems: action.pendingItems,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, errored: true };
    default:
      return state;
  }
}

const PENDING_STATUSES = new Set(['locked', 'accepted', 'dispatched']);
const EXPIRING_SOON_MS = 30 * 60 * 1000;

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

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const t = parseAsUtc(iso);
  if (Number.isNaN(t)) return iso;
  try {
    return new Date(t).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const t = parseAsUtc(iso);
  if (Number.isNaN(t)) return iso;
  try {
    return new Date(t).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

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
  if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m left` : `${hrs}h left`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h left`;
}

function normalizeTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawTransaction[]).map((t) => {
    const desc = t.description ?? '';
    const explicit =
      typeof t.type === 'string' ? t.type.toLowerCase().trim() : '';
    const isCredit =
      explicit === 'credit' ||
      explicit === 'topup' ||
      explicit === 'top-up' ||
      explicit === 'deposit' ||
      explicit === 'refund' ||
      explicit === 'reversal' ||
      explicit === 'released' ||
      explicit === 'earnings' ||
      explicit === 'payout';
    return {
      id: String(t.id),
      type: isCredit ? 'credit' : 'debit',
      amount: Math.abs(Number(t.amount ?? 0)),
      description:
        desc || (isCredit ? 'Payment received' : 'Debit'),
      date: t.created_at ?? '',
    };
  });
}

function roleSlug(role: WalletRole): string {
  return role === 'service_provider' ? 'service-provider' : role;
}

async function loadShopperPending(): Promise<PendingItem[]> {
  const [escrowRaw, bookingRaw] = await Promise.all([
    api.getMyEscrows().catch(() => [] as unknown[]),
    api.getServiceBookings().catch(() => [] as unknown[]),
  ]);
  const out: PendingItem[] = [];

  if (Array.isArray(escrowRaw)) {
    for (const e of escrowRaw as RawEscrow[]) {
      const s = (e.status || '').toLowerCase();
      if (!PENDING_STATUSES.has(s)) continue;
      const counterparty = (e.store_name as string) || 'Store';
      out.push({
        id: `esc-${e.order_id}`,
        title: (e.listing_title as string) || 'Reservation',
        subtitle: counterparty,
        amount: Number(e.total_amount ?? 0),
        status: s,
        expiresAt: e.expires_at as string | undefined,
        routeTo: `/reservation-confirmed?order_id=${e.order_id}`,
        avatarSeed: counterparty,
      });
    }
  }
  if (Array.isArray(bookingRaw)) {
    for (const b of bookingRaw as RawBooking[]) {
      const s = (b.status || '').toLowerCase();
      if (!PENDING_STATUSES.has(s)) continue;
      const bid = b.booking_id || b.service_id || '';
      const counterparty = (b.provider_name as string) || 'Provider';
      out.push({
        id: `bk-${bid}`,
        title:
          (b.service_title as string) ||
          (b.title as string) ||
          'Service booking',
        subtitle: counterparty,
        amount: Number(b.amount ?? 0),
        status: s,
        scheduledFor: b.scheduled_for as string | undefined,
        routeTo: b.booking_id
          ? `/booking-confirmed?booking_id=${b.booking_id}`
          : `/service-detail/${b.service_id}`,
        avatarSeed: counterparty,
      });
    }
  }
  return out;
}

async function loadStorekeeperPending(): Promise<PendingItem[]> {
  let storeId: string | null = null;
  try {
    const store = (await api.getMyStore()) as StoreInfo | null;
    storeId = store?.store_id ?? null;
  } catch {
    storeId = null;
  }
  if (!storeId) return [];
  const raw = await api.getStoreOrders(storeId).catch(() => [] as unknown[]);
  if (!Array.isArray(raw)) return [];
  const out: PendingItem[] = [];
  for (const o of raw as RawOrder[]) {
    const s = (o.status || '').toLowerCase();
    if (!PENDING_STATUSES.has(s)) continue;
    const customer = o.customer_name || 'Customer';
    out.push({
      id: `ord-${o.order_id}`,
      title: customer,
      subtitle: '',
      customer,
      amount: Number(o.total_amount ?? 0),
      status: s,
      expiresAt: o.expires_at as string | undefined,
      routeTo: `/storekeeper/orders?highlight=${o.order_id}`,
      avatarSeed: customer,
    });
  }
  return out;
}

async function loadProviderPending(): Promise<PendingItem[]> {
  const raw = await api.getProviderBookings().catch(() => [] as unknown[]);
  if (!Array.isArray(raw)) return [];
  const out: PendingItem[] = [];
  for (const b of raw as RawBooking[]) {
    const s = (b.status || '').toLowerCase();
    if (!PENDING_STATUSES.has(s)) continue;
    const bid = b.booking_id || b.service_id || '';
    const customer = b.customer_name || b.user_name || 'Customer';
    out.push({
      id: `bk-${bid}`,
      title:
        (b.service_title as string) ||
        (b.title as string) ||
        'Service booking',
      subtitle: '',
      customer,
      amount: Number(b.amount ?? 0),
      status: s,
      scheduledFor: b.scheduled_for as string | undefined,
      routeTo: '/service-provider/bookings',
      avatarSeed: customer,
    });
  }
  return out;
}

function statusLabel(role: WalletRole, status: string): string {
  if (role === 'shopper') {
    if (status === 'locked') return 'Awaiting confirmation';
    if (status === 'accepted') return 'Held for pickup';
    if (status === 'dispatched') return 'Out for delivery';
    return status;
  }
  if (role === 'storekeeper') {
    if (status === 'locked') return 'Reserved';
    if (status === 'accepted') return 'Awaiting pickup';
    if (status === 'dispatched') return 'Out for delivery';
    return status;
  }
  if (status === 'locked') return 'Awaiting confirmation';
  if (status === 'accepted') return 'Confirmed';
  return status;
}

function statusColor(status: string): {
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

export function WalletShell({ role }: { role: WalletRole }) {
  useAuthGuard();
  const router = useRouter();

  const [state, dispatch] = useReducer(walletReducer, initialState);
  const { balance, transactions, pendingItems, loading, errored } = state;

  const [refreshing, setRefreshing] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const isSeller = role === 'storekeeper' || role === 'service_provider';
  const slug = roleSlug(role);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loadData = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) dispatch({ type: 'FETCH_START' });
      try {
        const [balData, txnData, profileData] = await Promise.all([
          api.getWalletBalance() as Promise<BalanceResponse>,
          api.getWalletTransactions(20, 0).catch(() => [] as unknown[]),
          api.getMyProfile() as Promise<ProfileResponse>,
        ]);

        let pending: PendingItem[] = [];
        if (role === 'shopper') pending = await loadShopperPending();
        else if (role === 'storekeeper')
          pending = await loadStorekeeperPending();
        else pending = await loadProviderPending();

        dispatch({
          type: 'FETCH_SUCCESS',
          balance: Number(balData.balance ?? 0),
          email: profileData.email ?? '',
          transactions: normalizeTransactions(txnData),
          pendingItems: pending,
        });
      } catch {
        dispatch({ type: 'FETCH_ERROR' });
      }
    },
    [role],
  );

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
      /* silent */
    }
  };

  const pendingTotal = useMemo(
    () => pendingItems.reduce((s, i) => s + i.amount, 0),
    [pendingItems],
  );

  const heroTitle = isSeller ? 'Earnings' : 'My Wallet';
  const heroLabel = isSeller ? 'Available to withdraw' : 'Escrow balance';
  const pendingTitle =
    role === 'storekeeper'
      ? 'Awaiting release'
      : role === 'service_provider'
        ? 'Awaiting completion'
        : 'In flight';
  const pendingEmptyBody =
    role === 'shopper'
      ? 'Your wallet is settled. Reservations and bookings will show here while funds are held.'
      : role === 'storekeeper'
        ? 'Reservations and orders will show here until they clear.'
        : "Bookings you haven't completed will show here until the funds release.";
  const pendingPillVerb = role === 'shopper' ? 'held' : 'pending';

  const primaryLabel = isSeller ? 'Withdraw to bank' : 'Add money';
  const primaryClick = isSeller
    ? () => router.push(`/${slug}/wallet/withdraw`)
    : () => setShowTopUp(true);
  const primaryIcon = isSeller ? (
    <MdArrowOutward size={20} color="var(--brand-on-gradient)" />
  ) : (
    <MdAdd size={20} color="var(--brand-on-gradient)" />
  );

  const secondaryActions: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = isSeller
    ? [
        {
          key: 'add',
          label: 'Add money',
          icon: <MdAdd size={16} color="var(--brand-primary)" />,
          onClick: () => setShowTopUp(true),
        },
        {
          key: 'history',
          label: 'History',
          icon: <MdHistory size={16} color="var(--info-fg)" />,
          onClick: () => router.push(`/${slug}/wallet/history`),
        },
      ]
    : [
        {
          key: 'withdraw',
          label: 'Withdraw',
          icon: <MdArrowOutward size={16} color="var(--brand-primary)" />,
          onClick: () => router.push('/shopper/wallet/withdraw'),
        },
        {
          key: 'history',
          label: 'History',
          icon: <MdHistory size={16} color="var(--info-fg)" />,
          onClick: () => router.push('/shopper/wallet/history'),
        },
      ];

  if (loading) {
    return (
      <div style={css.root} className="wl-root">
        <style>{KF}</style>
        <style>{SHELL_CSS}</style>
        <div className="wl-shell">
          <div style={css.hero}>
            <div style={css.topBar}>
              <div style={{ width: 38 }} />
              <span style={css.heroTitle}>{heroTitle}</span>
              <div style={{ width: 38 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errored) {
    return (
      <div style={css.errorRoot}>
        <style>{KF}</style>
        <style>{SHELL_CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={44} color="var(--danger-fg)" />
        </div>
        <h2 style={css.errorHeading}>Couldn&apos;t load your wallet</h2>
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
    <div style={css.root} className="wl-root">
      <style>{KF}</style>
      <style>{SHELL_CSS}</style>

      <div className="wl-shell">
        <div style={css.hero}>
          <div style={css.heroGlow} aria-hidden />

          <div style={css.topBar}>
            <button
              style={css.ghostBtn}
              onClick={() => router.back()}
              aria-label="Back"
            >
              <MdArrowBack size={22} color="var(--brand-on-gradient)" />
            </button>
            <span style={css.heroTitle}>{heroTitle}</span>
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
            aria-label="Copy balance"
          >
            <span style={css.balLabel}>
              {heroLabel}
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

          {pendingItems.length > 0 && (
            <div style={css.pendingPill}>
              <MdHourglassEmpty size={14} color="var(--warning-fg)" />
              <span style={css.pendingPillText}>
                <strong>{fmtShort(pendingTotal)}</strong>{' '}
                {pendingPillVerb}
                <span style={css.pendingPillCount}>
                  {' '}
                  · {pendingItems.length}
                </span>
              </span>
            </div>
          )}
        </div>

        <div style={css.sheet}>
          <button
            type="button"
            onClick={primaryClick}
            style={css.primaryCta}
            className="wl-primary-cta"
          >
            {primaryIcon}
            <span>{primaryLabel}</span>
          </button>

          <div style={css.secondaryRow}>
            {secondaryActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                style={css.secondaryBtn}
                className="wl-secondary"
              >
                <div style={css.secondaryIconWrap}>
                  {action.icon}
                </div>
                <span style={css.secondaryLabel}>{action.label}</span>
              </button>
            ))}
          </div>

          <div style={css.divider} />

          <div style={css.secHead}>
            <div style={css.secHeadLeft}>
              <span style={css.secTitle}>{pendingTitle}</span>
              {pendingItems.length > 0 && (
                <span style={css.secCount}>
                  {pendingItems.length}
                </span>
              )}
            </div>
            {pendingItems.length > 0 && (
              <span style={css.secSub}>{fmtShort(pendingTotal)}</span>
            )}
          </div>

          {pendingItems.length === 0 ? (
            <div style={css.emptySmall}>
              <div style={css.emptySmallIcon}>
                <MdWallet size={22} color="var(--text-muted)" />
              </div>
              <div>
                <div style={css.emptySmallTitle}>Nothing pending</div>
                <div style={css.emptySmallBody}>
                  {pendingEmptyBody}
                </div>
              </div>
            </div>
          ) : (
            <div style={css.pendingList}>
              {pendingItems.slice(0, 5).map((item) => {
                const color = statusColor(item.status);
                const expiresMs = parseAsUtc(item.expiresAt);
                const expiringSoon =
                  Number.isFinite(expiresMs) &&
                  item.status === 'locked' &&
                  expiresMs - nowTick < EXPIRING_SOON_MS &&
                  expiresMs - nowTick > 0;
                const expiryText =
                  Number.isFinite(expiresMs) &&
                  item.status === 'locked'
                    ? formatRemaining(expiresMs, nowTick)
                    : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(item.routeTo)}
                    style={css.pendingCard}
                    className="wl-pending-card"
                  >
                    <div style={css.pendingAvatar}>
                      {(item.avatarSeed || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div style={css.pendingBody}>
                      <div style={css.pendingTopRow}>
                        <span
                          style={css.pendingTitle}
                          title={item.title}
                        >
                          {item.title}
                        </span>
                        <span
                          style={{
                            ...css.pendingChip,
                            background: color.bg,
                            color: color.fg,
                            borderColor: color.border,
                          }}
                        >
                          {statusLabel(role, item.status)}
                        </span>
                      </div>
                      <div style={css.pendingMeta}>
                        {role === 'shopper' && item.subtitle && (
                          <>
                            <span style={css.pendingCounterparty}>
                              {item.subtitle}
                            </span>
                            <span style={css.pendingDot}>·</span>
                          </>
                        )}
                        {role === 'service_provider' &&
                          item.customer && (
                            <>
                              <MdPersonOutline
                                size={11}
                                color="var(--text-muted)"
                              />
                              <span style={css.pendingCounterparty}>
                                {item.customer}
                              </span>
                              <span style={css.pendingDot}>·</span>
                            </>
                          )}
                        <span style={css.pendingAmount}>
                          {fmtShort(item.amount)}
                        </span>
                        {expiryText && (
                          <>
                            <span style={css.pendingDot}>·</span>
                            <span
                              style={
                                expiringSoon
                                  ? {
                                      ...css.pendingExpiry,
                                      ...css.pendingExpiryWarn,
                                    }
                                  : css.pendingExpiry
                              }
                            >
                              {expiryText}
                            </span>
                          </>
                        )}
                        {item.scheduledFor && (
                          <>
                            <span style={css.pendingDot}>·</span>
                            <MdCalendarToday
                              size={11}
                              color="var(--text-muted)"
                            />
                            <span style={css.pendingExpiry}>
                              {fmtDateTime(item.scheduledFor)}
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
              {pendingItems.length > 5 && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/${slug}/wallet/history`)
                  }
                  style={css.viewAllBtn}
                >
                  View all {pendingItems.length} pending items →
                </button>
              )}
            </div>
          )}

          <div style={css.divider} />

          <div style={css.secHead}>
            <span style={css.secTitle}>Recent activity</span>
            <button
              style={css.seeAll}
              onClick={() => router.push(`/${slug}/wallet/history`)}
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
                    {isSeller
                      ? 'Sales and withdrawals will show here once you start receiving orders.'
                      : 'Top-ups, payments, and refunds will show here.'}
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
        <AddMoneySheet onClose={() => setShowTopUp(false)} />
      )}
    </div>
  );
}

const KF = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .wl-primary-cta:hover { transform: translateY(-2px); box-shadow: 0 14px 30px color-mix(in srgb, var(--brand-primary) 32%, transparent); }
  .wl-primary-cta:active { transform: translateY(0) scale(0.985); }
  .wl-secondary:hover { background-color: var(--bg-hover); }
  .wl-pending-card:hover { border-color: var(--brand-primary); }
`;

const SHELL_CSS = `
  .wl-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    overflow-x: hidden;
    transition: background-color 0.18s ease, color 0.18s ease;
  }
  .wl-shell {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  @media (min-width: 1024px) {
    .wl-shell { max-width: 720px; padding: 0 8px; }
  }
  @media (min-width: 1440px) {
    .wl-shell { max-width: 840px; }
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
  primaryCta: {
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
  secondaryRow: { display: 'flex', gap: 10, marginTop: 12 },
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
  secondaryIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'var(--brand-soft)',
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
  secHeadLeft: { display: 'flex', alignItems: 'center', gap: 8 },
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
  pendingList: { display: 'flex', flexDirection: 'column', gap: 8 },
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
  pendingTitle: {
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
    gap: 5,
    fontSize: 12,
    color: 'var(--text-tertiary)',
    minWidth: 0,
    flexWrap: 'wrap',
  },
  pendingCounterparty: {
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pendingAmount: {
    fontWeight: 700,
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  pendingDot: { color: 'var(--border-strong)' },
  pendingExpiry: { fontWeight: 500, color: 'var(--text-muted)' },
  pendingExpiryWarn: {
    color: 'var(--warning-fg)',
    fontWeight: 700,
  },
  txnList: { display: 'flex', flexDirection: 'column', gap: 10 },
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