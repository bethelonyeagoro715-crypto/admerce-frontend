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
  MdShield,
  MdWarning,
  MdErrorOutline,
  MdLock,
  MdAccessTime,
  MdEventNote,
  MdBuild,
  MdChevronRight,
  MdMailOutline,
} from 'react-icons/md';

// ─── API response shapes ────────────────────────────────────────────
interface BalanceResponse { balance?: number }
interface ProfileResponse { email?: string }
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
  [key: string]: unknown;
}
interface RawBooking {
  booking_id?: string;
  service_id?: string;
  service_title?: string;
  title?: string;
  provider_name?: string;
  customer_name?: string;
  status?: string;
  amount?: number | string;
  scheduled_for?: string;
  created_at?: string;
  [key: string]: unknown;
}

// ─── Domain types ────────────────────────────────────────────────────
interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
}

interface InFlightItem {
  id: string;
  kind: 'reservation' | 'booking';
  title: string;
  subtitle: string;
  amount: number;
  expiresAt?: string;
  status: string;
  routeTo: string;
}

// ─── Fetch state + reducer ───────────────────────────────────────────
interface WalletState {
  balance: number;
  email: string;
  transactions: Transaction[];
  escrows: RawEscrow[];
  bookings: RawBooking[];
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
      escrows: RawEscrow[];
      bookings: RawBooking[];
    }
  | { type: 'FETCH_ERROR' };

const initialState: WalletState = {
  balance: 0,
  email: '',
  transactions: [],
  escrows: [],
  bookings: [],
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
        escrows: action.escrows,
        bookings: action.bookings,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, errored: true };
    default:
      return state;
  }
}

// ─── Constants ───────────────────────────────────────────────────────
const PRESET_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];
const MIN_TOPUP = 100;
const MAX_TOPUP = 100_000_000;

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (v: number) =>
  '₦' + v.toLocaleString('en-NG', {
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

function normalizeTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawTransaction[]).map((t) => ({
    id: String(t.id),
    type: t.type === 'credit' ? 'credit' : 'debit',
    amount: Number(t.amount ?? 0),
    description: t.description ?? (t.type === 'credit' ? 'Wallet top-up' : 'Payment'),
    date: t.created_at ?? '',
  }));
}

function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return '';
  if (n > MAX_TOPUP) return MAX_TOPUP.toLocaleString('en-NG');
  return n.toLocaleString('en-NG');
}

function relativeFrom(ms: number, nowMs: number): string {
  const secs = Math.max(0, Math.floor((nowMs - ms) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTimeRemaining(expiresMs: number, nowMs: number): string {
  if (!Number.isFinite(expiresMs)) return '';
  const ms = expiresMs - nowMs;
  if (ms <= 0) return 'Expired';
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

// ─── Component ───────────────────────────────────────────────────────
export default function WalletPage() {
  useAuthGuard();

  const router = useRouter();

  const [state, dispatch] = useReducer(walletReducer, initialState);
  const { balance, email, transactions, escrows, bookings, loading, errored } = state;

  const [refreshing, setRefreshing] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number>(() => Date.now());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // ── Data ────────────────────────────────────────────────────────
  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) dispatch({ type: 'FETCH_START' });
    try {
      const [balData, txnData, profileData, escrowData, bookingData] =
        await Promise.all([
          api.getWalletBalance() as Promise<BalanceResponse>,
          api.getWalletTransactions(30, 0).catch(() => [] as unknown[]),
          api.getMyProfile() as Promise<ProfileResponse>,
          api.getMyEscrows().catch(() => [] as unknown[]),
          api.getServiceBookings().catch(() => [] as unknown[]),
        ]);
      dispatch({
        type: 'FETCH_SUCCESS',
        balance: balData.balance ?? 0,
        email: profileData.email ?? '',
        transactions: normalizeTransactions(txnData),
        escrows: Array.isArray(escrowData) ? (escrowData as RawEscrow[]) : [],
        bookings: Array.isArray(bookingData) ? (bookingData as RawBooking[]) : [],
      });
      setUpdatedAt(Date.now());
    } catch {
      dispatch({ type: 'FETCH_ERROR' });
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(id);
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  };

  // ── Top-up ──────────────────────────────────────────────────────
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

  // ── Copy balance ────────────────────────────────────────────────
  const handleCopyBalance = async () => {
    if (!balance) return;
    try {
      await navigator.clipboard.writeText(balance.toFixed(2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Silent — non-critical
    }
  };

  // ── Derived ─────────────────────────────────────────────────────
  const weekIn = useMemo(() => {
    const cutoff = nowTick - 7 * 86_400_000;
    return transactions
      .filter((t) => t.type === 'credit')
      .filter((t) => {
        const ts = parseAsUtc(t.date);
        return !Number.isNaN(ts) && ts >= cutoff;
      })
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, nowTick]);

  const weekOut = useMemo(() => {
    const cutoff = nowTick - 7 * 86_400_000;
    return transactions
      .filter((t) => t.type === 'debit')
      .filter((t) => {
        const ts = parseAsUtc(t.date);
        return !Number.isNaN(ts) && ts >= cutoff;
      })
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, nowTick]);

  // Active escrows: any status that means money is still held.
  const activeEscrows = useMemo(
    () =>
      escrows.filter((e) => {
        const s = (e.status || '').toLowerCase();
        return s === 'locked' || s === 'accepted' || s === 'dispatched';
      }),
    [escrows],
  );

  // Active bookings: money held in escrow until completion or cancellation.
  const activeBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const s = (b.status || '').toLowerCase();
        return s === 'locked' || s === 'accepted';
      }),
    [bookings],
  );

  const inFlightItems = useMemo<InFlightItem[]>(() => {
    const items: InFlightItem[] = [];

    for (const e of activeEscrows) {
      const expiresMs = parseAsUtc(e.expires_at);
      items.push({
        id: `esc-${e.order_id}`,
        kind: 'reservation',
        title: (e.listing_title as string) || 'Reservation',
        subtitle: (e.store_name as string) || 'Store',
        amount: Number(e.total_amount ?? 0),
        expiresAt: Number.isFinite(expiresMs) ? e.expires_at : undefined,
        status: (e.status || '').toLowerCase(),
        routeTo: `/reservation-confirmed?order_id=${e.order_id}`,
      });
    }

    for (const b of activeBookings) {
      const title =
        (b.service_title as string) || (b.title as string) || 'Service booking';
      const subtitle = (b.provider_name as string) || 'Provider';
      const routeId = b.booking_id || b.service_id || '';
      items.push({
        id: `bk-${routeId}`,
        kind: 'booking',
        title,
        subtitle,
        amount: Number(b.amount ?? 0),
        status: (b.status || '').toLowerCase(),
        routeTo: b.booking_id
          ? `/booking-confirmed?booking_id=${b.booking_id}`
          : `/service-detail/${b.service_id}`,
      });
    }

    return items;
  }, [activeEscrows, activeBookings]);

  const inFlightTotal = useMemo(
    () => inFlightItems.reduce((s, i) => s + i.amount, 0),
    [inFlightItems],
  );

  const isEmptyWallet = transactions.length === 0 && balance === 0;

  // ── Loading skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={css.root}>
        <style>{KF}</style>
        <div style={css.hero}>
          <div style={css.topBar}>
            <div style={{ width: 38 }} />
            <span style={css.heroTitle}>My Wallet</span>
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
                width: 220,
                height: 42,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.24)',
                marginTop: 18,
              }}
            />
            <div
              style={{
                width: 180,
                height: 12,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.14)',
                marginTop: 16,
              }}
            />
          </div>
        </div>
        <div style={css.sheet}>
          <div style={css.actionsGrid}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...css.actionBtn, pointerEvents: 'none' }}>
                <div
                  style={{
                    ...css.actionIcon,
                    background: '#EEF2FF',
                    animation: 'skelPulse 1.4s ease-in-out infinite',
                  }}
                />
                <div
                  style={{
                    width: 40,
                    height: 10,
                    borderRadius: 4,
                    background: '#EEF2FF',
                    marginTop: 4,
                    animation: 'skelPulse 1.4s ease-in-out infinite',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={css.divider} />
          <div
            style={{
              width: 100,
              height: 12,
              borderRadius: 4,
              background: '#EEF2FF',
              marginBottom: 18,
              animation: 'skelPulse 1.4s ease-in-out infinite',
            }}
          />
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                height: 74,
                borderRadius: 14,
                backgroundColor: '#FAFBFF',
                border: '1px solid #EEF2FF',
                marginBottom: 10,
                animation: 'skelPulse 1.4s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={css.root}>
      <style>{KF}</style>

      {/* ═══ HERO ════════════════════════════════════════════════ */}
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
          <span style={css.heroTitle}>My Wallet</span>
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

        <div style={css.statusChip}>
          <MdShield size={12} color="rgba(255,255,255,0.9)" />
          <span style={css.statusChipText}>Admerce Wallet · Secured</span>
        </div>

        <button
          type="button"
          onClick={handleCopyBalance}
          style={css.balanceBlock}
          aria-label="Copy balance"
        >
          <span style={css.balLabel}>
            Available balance
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

          <span style={css.balValue} className="tnum">
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

        {/* This-week in/out — non-interactive, informational */}
        <div style={css.insight}>
          {weekIn > 0 || weekOut > 0 ? (
            <>
              <MdTrendingUp size={14} color="#4CDE80" />
              <span style={css.insightText}>
                <strong>+{fmtShort(weekIn)}</strong> in
              </span>
              <span style={css.insightDivider}>·</span>
              <MdTrendingDown size={14} color="#FF9C9C" />
              <span style={css.insightText}>
                <strong>−{fmtShort(weekOut)}</strong> out
              </span>
              <span style={css.insightDivider}>·</span>
              <span style={css.insightTextMuted}>this week</span>
            </>
          ) : (
            <span style={css.insightTextMuted}>
              No activity this week · Updated {relativeFrom(updatedAt, nowTick)}
            </span>
          )}
        </div>
      </div>

      {/* ═══ SHEET ═══════════════════════════════════════════════ */}
      <div style={css.sheet}>
        {/* Actions — 3 buttons now, Cards removed */}
        <div style={css.actionsGrid}>
          <ActionButton
            icon={<MdAdd size={20} color="#fff" />}
            label="Top Up"
            bg="linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)"
            onClick={() => setShowTopUp(true)}
          />
          <ActionButton
            icon={<MdArrowOutward size={20} color="#fff" />}
            label="Withdraw"
            bg="linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)"
            onClick={() => router.push('/shopper/wallet/withdraw')}
          />
          <ActionButton
            icon={<MdHistory size={20} color="#fff" />}
            label="History"
            bg="linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)"
            onClick={() => router.push('/shopper/wallet/history')}
          />
        </div>

        <div style={css.divider} />

        {/* Setup nudge — only if email missing */}
        {!hasEmail && (
          <button
            type="button"
            onClick={() => router.push('/shopper/profile')}
            style={css.nudge}
          >
            <div style={css.nudgeIcon}>
              <MdMailOutline size={18} color="#B45309" />
            </div>
            <div style={css.nudgeBody}>
              <span style={css.nudgeTitle}>Add an email to unlock top-ups</span>
              <span style={css.nudgeSub}>
                Paystack needs it for receipts and payment confirmation.
              </span>
            </div>
            <MdChevronRight size={20} color="#B45309" />
          </button>
        )}

        {/* In-flight section */}
        <div style={css.secHead}>
          <span style={css.secTitle}>
            In flight{inFlightItems.length > 0 ? ` · ${fmtShort(inFlightTotal)}` : ''}
          </span>
          <button
            style={css.seeAll}
            onClick={() => router.push('/shopper/wallet/history')}
          >
            See all →
          </button>
        </div>

        {inFlightItems.length === 0 ? (
          isEmptyWallet ? (
            <div style={css.empty}>
              <div style={css.emptyHalo}>
                <MdAccountBalanceWallet size={34} color="#0504AA" />
              </div>
              <h3 style={css.emptyTitle}>Start your wallet</h3>
              <p style={css.emptyBody}>
                Top up to pay for pickups, reservations, and services — all in
                one place.
              </p>
              <button
                type="button"
                onClick={() => setShowTopUp(true)}
                style={css.emptyCta}
              >
                <MdAdd size={18} color="#fff" />
                <span>Top up now</span>
              </button>
            </div>
          ) : (
            <div style={css.emptyMuted}>
              <div style={css.emptyHaloMuted}>
                <MdCheck size={26} color="#16A34A" />
              </div>
              <h3 style={css.emptyTitle}>Nothing in flight</h3>
              <p style={css.emptyBody}>
                Your wallet is settled. Reservations and bookings you make will
                show up here while their funds are held.
              </p>
            </div>
          )
        ) : (
          <div style={css.inFlightList}>
            {inFlightItems.map((item) => {
              const expiresMs = item.expiresAt
                ? parseAsUtc(item.expiresAt)
                : NaN;
              const expiryText = Number.isFinite(expiresMs)
                ? formatTimeRemaining(expiresMs, nowTick)
                : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(item.routeTo)}
                  style={css.inFlightCard}
                >
                  <div style={css.inFlightIconWrap}>
                    {item.kind === 'reservation' ? (
                      <MdEventNote size={18} color="#0504AA" />
                    ) : (
                      <MdBuild size={18} color="#7C3AED" />
                    )}
                  </div>
                  <div style={css.inFlightMeta}>
                    <span style={css.inFlightTitle} title={item.title}>
                      {item.title}
                    </span>
                    <span style={css.inFlightSub} title={item.subtitle}>
                      {item.subtitle} · {item.status === 'accepted'
                        ? 'Held for pickup'
                        : item.status === 'dispatched'
                          ? 'Out for delivery'
                          : 'Awaiting confirmation'}
                    </span>
                  </div>
                  <div style={css.inFlightRight}>
                    <span style={css.inFlightAmount}>
                      {fmtShort(item.amount)}
                    </span>
                    {expiryText && (
                      <span style={css.inFlightExpiry}>
                        <MdAccessTime size={11} />
                        <span>{expiryText}</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            <p style={css.inFlightNote}>
              <MdLock size={12} color="#64748B" />
              <span>
                Held funds release to the store when you confirm pickup.
              </span>
            </p>
          </div>
        )}
      </div>

      {/* ═══ TOP-UP BOTTOM SHEET ════════════════════════════════ */}
      {showTopUp && (
        <div style={css.overlay} onClick={closeTopUp}>
          <div style={css.bottomSheet} onClick={(e) => e.stopPropagation()}>
            <div style={css.sheetHandle} />

            <h2 style={css.modalTitle}>Add money</h2>
            <p style={css.modalSub}>
              Choose a preset or enter a custom amount
            </p>

            {!hasEmail && (
              <div style={css.warnBox}>
                <MdWarning size={16} color="#B45309" />
                <div style={css.warnText}>
                  <strong>Email required.</strong> Add an email to your profile
                  to receive a Paystack receipt and unlock top-ups.
                </div>
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
                <MdWarning size={13} color="#B91C1C" />
                <span>Minimum top-up is {fmtShort(MIN_TOPUP)}</span>
              </div>
            )}
            {hasEmail && amountTouched && !amountNum && (
              <div style={css.inlineError}>
                <MdWarning size={13} color="#B91C1C" />
                <span>Enter an amount to continue</span>
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

            <p style={css.paystackNote}>
              Payments are processed securely by Paystack. You&apos;ll be
              redirected to complete the payment.
            </p>

            <button style={css.cancelBtn} onClick={closeTopUp}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action button helper ────────────────────────────────────────────
function ActionButton({
  icon,
  label,
  bg,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  onClick: () => void;
}) {
  return (
    <button type="button" style={css.actionBtn} onClick={onClick}>
      <div style={{ ...css.actionIcon, background: bg }}>{icon}</div>
      <span style={css.actionLabel}>{label}</span>
    </button>
  );
}

// ─── Keyframes ────────────────────────────────────────────────────────
const KF = `
  @keyframes spin       { to { transform: rotate(360deg); } }
  @keyframes fadeUp     { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes skelPulse  { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes sheetUp    { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
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

  // ── Hero
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

  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.14)',
    marginBottom: 16,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
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

  insight: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: '100%',
    flexWrap: 'wrap',
  },
  insightText: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
  },
  insightTextMuted: {
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
  },
  insightDivider: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    margin: '0 2px',
  },

  // ── Sheet
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: '24px 24px 0 0',
    marginTop: -16,
    padding: '24px 20px 120px',
    boxShadow: '0 -4px 30px rgba(5,4,170,0.08)',
    position: 'relative',
  },

  actionsGrid: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  actionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    fontFamily: 'inherit',
    padding: 4,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    letterSpacing: 0.2,
  },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    margin: '20px 0',
  },

  // ── Nudge
  nudge: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 14px',
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    border: '1px solid #FDE68A',
    marginBottom: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    width: '100%',
  },
  nudgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF7E6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nudgeBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  nudgeTitle: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#92400E',
    letterSpacing: -0.1,
  },
  nudgeSub: {
    fontSize: 12,
    color: '#92400E',
    opacity: 0.75,
    lineHeight: 1.4,
  },

  // ── Section header
  secHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  secTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0F172A',
    letterSpacing: -0.2,
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

  // ── In-flight list
  inFlightList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  inFlightCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 14px 14px 14px',
    backgroundColor: '#FAFBFF',
    border: '1px solid #EEF2FF',
    borderRadius: 14,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    width: '100%',
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  inFlightIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inFlightMeta: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  inFlightTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0B0B1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: -0.1,
  },
  inFlightSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  inFlightRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  inFlightAmount: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0504AA',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: -0.2,
  },
  inFlightExpiry: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    color: '#94A3B8',
  },
  inFlightNote: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 12,
    marginBottom: 0,
    paddingLeft: 4,
    lineHeight: 1.4,
  },

  // ── Empty states
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyMuted: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    textAlign: 'center',
  },
  emptyHalo: {
    width: 72,
    height: 72,
    borderRadius: 24,
    background: 'linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0 10px 28px rgba(5,4,170,0.08)',
  },
  emptyHaloMuted: {
    width: 68,
    height: 68,
    borderRadius: 22,
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 0,
    maxWidth: 300,
    lineHeight: 1.5,
  },
  emptyCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    padding: '12px 22px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.28)',
  },

  // ── Error state
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

  // ── Top-up sheet
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
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    border: '1px solid #FDE68A',
    marginBottom: 18,
  },
  warnText: {
    flex: 1,
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
    transition: 'background-color 0.15s, color 0.15s',
  },

  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    border: '1.5px solid #E2E8F0',
    borderRadius: 14,
    padding: '0 16px',
    marginBottom: 8,
    backgroundColor: '#F8FAFF',
    transition: 'border-color 0.15s',
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
    letterSpacing: -0.3,
    minWidth: 0,
  },
  inlineError: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
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
    letterSpacing: 0.2,
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
    transition: 'opacity 0.15s, transform 0.15s',
  },
  paystackNote: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '14px 0 8px',
    paddingLeft: 8,
    paddingRight: 8,
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
};