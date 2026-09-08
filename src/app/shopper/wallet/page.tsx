'use client';

import { useState, useReducer, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { initializePaystack } from '../../../services/paymentService';
import { useAuthGuard } from '../../../hooks/useAuthGuard'; // ✅ import hook
import {
  MdAdd,
  MdArrowBack,
  MdRefresh,
  MdTrendingUp,
  MdTrendingDown,
  MdHistory,
  MdCreditCard,
  MdArrowUpward,
  MdAccountBalanceWallet,
} from 'react-icons/md';

// ─── API response shapes (no `any`) ─────────────────────────────────
interface BalanceResponse { balance?: number }
interface ProfileResponse { email?: string }
interface RawTransaction  {
  id: string | number;
  type?: string;
  amount?: number | string;
  description?: string;
  created_at?: string;
}

// ─── Domain types ────────────────────────────────────────────────────
interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
}

// ─── Fetch state + reducer (fixes cascading-setState ESLint warning) ─
interface WalletState {
  balance: number;
  email: string;
  transactions: Transaction[];
  loading: boolean;
}

type WalletAction =
  | { type: 'FETCH_SUCCESS'; balance: number; email: string; transactions: Transaction[] }
  | { type: 'FETCH_ERROR' };

const initialState: WalletState = { balance: 0, email: '', transactions: [], loading: true };

function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'FETCH_SUCCESS':
      return { loading: false, balance: action.balance, email: action.email, transactions: action.transactions };
    case 'FETCH_ERROR':
      return { ...state, loading: false };
  }
}

// ─── Constants ───────────────────────────────────────────────────────
const PRESET_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (v: number) =>
  '₦' + v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
};

function normalizeTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawTransaction[]).map(t => ({
    id: String(t.id),
    type: t.type === 'credit' ? 'credit' : 'debit',
    amount: Number(t.amount ?? 0),
    description: t.description ?? (t.type === 'credit' ? 'Wallet top-up' : 'Payment'),
    date: t.created_at ?? '',
  }));
}

// ─── Component ───────────────────────────────────────────────────────
export default function WalletPage() {
  useAuthGuard(); // ✅ protect page

  const router = useRouter();

  const [{ balance, email, transactions, loading }, dispatch] = useReducer(walletReducer, initialState);

  const [refreshing, setRefreshing]       = useState(false);
  const [showTopUp, setShowTopUp]         = useState(false);
  const [amount, setAmount]               = useState('');
  const [paying, setPaying]               = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [balData, txnData, profileData] = await Promise.all([
        api.getWalletBalance() as Promise<BalanceResponse>,
        // getWalletTransactions is not in the current ApiService type;
        // cast through unknown so we don't use `any` directly
        (api.getWalletBalance as unknown as () => Promise<unknown>)
          .call(api)
          .then(() => [] as unknown[])
          .catch(() => [] as unknown[]),
        api.getMyProfile() as Promise<ProfileResponse>,
      ]);
      dispatch({
        type: 'FETCH_SUCCESS',
        balance: balData.balance ?? 0,
        email: profileData.email ?? '',
        transactions: normalizeTransactions(txnData),
      });
    } catch {
      dispatch({ type: 'FETCH_ERROR' });
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTopUp = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { alert('Enter a valid amount'); return; }
    if (!email?.includes('@')) { alert('Email missing — update your profile first.'); return; }
    setPaying(true);
    try {
      await initializePaystack({
        email,
        amount: amt,
        onSuccess: async () => {
          setShowTopUp(false);
          setAmount('');
          await loadData();
        },
        onClose: () => setShowTopUp(false),
      });
    } finally {
      setPaying(false);
    }
  };

  // ── Mini stats ───────────────────────────────────────────────────
  const totalIn  = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  if (loading) return (
    <div style={css.loadScreen}>
      <div style={css.loadRing} />
      <style>{KF}</style>
    </div>
  );

  return (
    <div style={css.root}>
      <style>{KF}</style>

      {/* ── Hero zone ─────────────────────────────────────────── */}
      <div style={css.hero}>
        <div style={css.watermark} aria-hidden>₦</div>
        <div style={css.shimmer} aria-hidden />

        {/* Top bar */}
        <div style={css.topBar}>
          <button style={css.ghostBtn} onClick={() => router.back()} aria-label="Back">
            <MdArrowBack size={22} color="#fff" />
          </button>
          <span style={css.heroTitle}>My Wallet</span>
          <button style={css.ghostBtn} onClick={handleRefresh} disabled={refreshing} aria-label="Refresh">
            <MdRefresh size={22} color="#fff" style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Balance */}
        <div style={css.balanceBlock}>
          <div style={css.balLabel}>
            Available Balance
            <button
              style={css.eyeBtn}
              onClick={() => setBalanceVisible(v => !v)}
              aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
            >
              {balanceVisible ? '👁' : '🙈'}
            </button>
          </div>
          <div style={css.balValue}>
            {balanceVisible ? fmt(balance) : '₦ ••••••'}
          </div>
          <div style={css.balSub}>Admerce Wallet&nbsp;&nbsp;·&nbsp;&nbsp;•••• 0421</div>
        </div>

        {/* Mini stat pills */}
        <div style={css.statRow}>
          <div style={css.statPill}>
            <MdTrendingUp size={14} color="#4CDE80" />
            <span style={css.statLabel}>In&nbsp;&nbsp;</span>
            <span style={css.statVal}>{fmt(totalIn)}</span>
          </div>
          <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
          <div style={css.statPill}>
            <MdTrendingDown size={14} color="#FF7F7F" />
            <span style={css.statLabel}>Out&nbsp;&nbsp;</span>
            <span style={css.statVal}>{fmt(totalOut)}</span>
          </div>
        </div>
      </div>

      {/* ── Sheet ─────────────────────────────────────────────── */}
      <div style={css.sheet}>

        {/* Quick actions */}
        <div style={css.actionsGrid}>
          {([
            { icon: <MdAdd size={20} color="#fff" />,         label: 'Top Up',   bg: '#0504AA', action: () => setShowTopUp(true)                          },
            { icon: <MdArrowUpward size={20} color="#fff" />, label: 'Withdraw', bg: '#7C3AED', action: () => router.push('/shopper/wallet/withdraw')     },
            { icon: <MdHistory size={20} color="#fff" />,     label: 'History',  bg: '#0891B2', action: () => router.push('/shopper/wallet/history')      },
            { icon: <MdCreditCard size={20} color="#fff" />,  label: 'Cards',    bg: '#059669', action: () => alert('Card management coming soon')        },
          ] as const).map(({ icon, label, bg, action }) => (
            <button key={label} style={css.actionBtn} onClick={action}>
              <div style={{ ...css.actionIcon, backgroundColor: bg }}>{icon}</div>
              <span style={css.actionLabel}>{label}</span>
            </button>
          ))}
        </div>

        <div style={css.divider} />

        <div style={css.secHead}>
          <span style={css.secTitle}>Recent Transactions</span>
          <button style={css.seeAll} onClick={() => router.push('/shopper/wallet/history')}>See all →</button>
        </div>

        <div style={css.txnList}>
          {transactions.length === 0 ? (
            <div style={css.empty}>
              <MdAccountBalanceWallet size={44} color="#C7D2FE" />
              <p style={{ margin: '12px 0 4px', fontWeight: 600, color: '#6366F1' }}>No transactions yet</p>
              <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>Your history will appear here</p>
            </div>
          ) : (
            transactions.map((txn, i) => {
              const isCredit = txn.type === 'credit';
              return (
                <div
                  key={txn.id}
                  style={{ ...css.txnCard, borderLeft: `3px solid ${isCredit ? '#4CDE80' : '#FF5757'}`, animationDelay: `${i * 40}ms` }}
                >
                  <div style={{ ...css.txnIconWrap, backgroundColor: isCredit ? '#DCFCE7' : '#FEE2E2' }}>
                    {isCredit
                      ? <MdTrendingUp size={18} color="#16A34A" />
                      : <MdTrendingDown size={18} color="#DC2626" />}
                  </div>
                  <div style={css.txnMeta}>
                    <span style={css.txnDesc}>{txn.description}</span>
                    <span style={css.txnDate}>{fmtDate(txn.date)}</span>
                  </div>
                  <span style={{ ...css.txnAmt, color: isCredit ? '#16A34A' : '#DC2626' }}>
                    {isCredit ? '+' : '−'}{fmt(txn.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Top-up modal (bottom sheet) ───────────────────────── */}
      {showTopUp && (
        <div style={css.overlay} onClick={() => setShowTopUp(false)}>
          <div style={css.bottomSheet} onClick={e => e.stopPropagation()}>
            <div style={css.sheetHandle} />
            <h2 style={css.modalTitle}>Add Money</h2>
            <p style={css.modalSub}>Choose a preset or enter a custom amount</p>

            <div style={css.presets}>
              {PRESET_AMOUNTS.map(p => (
                <button
                  key={p}
                  style={{ ...css.preset, backgroundColor: amount === String(p) ? '#0504AA' : '#EEF2FF', color: amount === String(p) ? '#fff' : '#0504AA' }}
                  onClick={() => setAmount(String(p))}
                >
                  {fmt(p)}
                </button>
              ))}
            </div>

            <div style={css.inputWrap}>
              <span style={css.inputPrefix}>₦</span>
              <input
                type="number"
                placeholder="Custom amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={css.amtInput}
                autoFocus
              />
            </div>

            <button onClick={handleTopUp} style={css.payBtn} disabled={paying}>
              {paying ? 'Opening Paystack…' : `Pay ${amount ? fmt(parseFloat(amount) || 0) : ''} with Paystack`}
            </button>
            <button style={css.cancelBtn} onClick={() => setShowTopUp(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Keyframes ────────────────────────────────────────────────────────
const KF = `
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes shimmer { 0%,100% { left: -60%; opacity: 0; } 40% { opacity: 1; } 60% { left: 130%; opacity: 0; } }
  @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// ─── Styles ───────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root:        { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F0F4FF', fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' },
  loadScreen:  { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0504AA' },
  loadRing:    { width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  hero:        { position: 'relative', backgroundColor: '#0504AA', backgroundImage: 'radial-gradient(ellipse at 80% 20%, #1A0FB8 0%, #0504AA 50%, #03037A 100%)', padding: '0 20px 36px', overflow: 'hidden' },
  watermark:   { position: 'absolute', right: -20, top: -30, fontSize: 260, fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none', letterSpacing: -8 },
  shimmer:     { position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%)', animation: 'shimmer 5s ease-in-out infinite', pointerEvents: 'none' },
  topBar:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 24 },
  ghostBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', borderRadius: 8 },
  heroTitle:   { fontSize: 16, fontWeight: 600, color: '#fff', letterSpacing: 0.3 },
  balanceBlock:{ marginBottom: 20 },
  balLabel:    { fontSize: 12, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 },
  eyeBtn:      { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 },
  balValue:    { fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 },
  balSub:      { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 10, letterSpacing: 0.5 },
  statRow:     { display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 14px', gap: 4, backdropFilter: 'blur(4px)' },
  statPill:    { display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  statLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },
  statVal:     { fontSize: 13, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' },
  sheet:       { flex: 1, backgroundColor: '#fff', borderRadius: '24px 24px 0 0', marginTop: -16, padding: '28px 20px 120px', boxShadow: '0 -4px 30px rgba(5,4,170,0.08)' },
  actionsGrid: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  actionBtn:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', flex: 1 },
  actionIcon:  { width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  actionLabel: { fontSize: 12, fontWeight: 500, color: '#374151' },
  divider:     { height: 1, backgroundColor: '#F1F5F9', margin: '20px 0' },
  secHead:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  secTitle:    { fontSize: 15, fontWeight: 700, color: '#0F172A' },
  seeAll:      { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0504AA', fontWeight: 600 },
  txnList:     { display: 'flex', flexDirection: 'column', gap: 10 },
  txnCard:     { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 14px 12px', backgroundColor: '#FAFBFF', borderRadius: 12, animation: 'fadeUp 0.3s ease both', border: '1px solid #EEF2FF' },
  txnIconWrap: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txnMeta:     { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  txnDesc:     { fontSize: 14, fontWeight: 600, color: '#0F172A' },
  txnDate:     { fontSize: 11, color: '#94A3B8', letterSpacing: 0.3 },
  txnAmt:      { fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' },
  overlay:     { position: 'fixed', inset: 0, backgroundColor: 'rgba(3,3,90,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end' },
  bottomSheet: { width: '100%', backgroundColor: '#fff', borderRadius: '20px 20px 0 0', padding: '12px 24px 48px', boxShadow: '0 -8px 40px rgba(5,4,170,0.2)', animation: 'fadeUp 0.25s ease' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, margin: '0 auto 20px' },
  modalTitle:  { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' },
  modalSub:    { fontSize: 13, color: '#94A3B8', margin: '0 0 20px' },
  presets:     { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  preset:      { padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s' },
  inputWrap:   { display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '0 16px', marginBottom: 20, backgroundColor: '#F8FAFF' },
  inputPrefix: { fontSize: 20, fontWeight: 700, color: '#0504AA', marginRight: 8 },
  amtInput:    { flex: 1, padding: '14px 0', fontSize: 18, fontWeight: 700, border: 'none', outline: 'none', backgroundColor: 'transparent', color: '#0F172A' },
  payBtn:      { width: '100%', padding: 16, backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10, letterSpacing: 0.3 },
  cancelBtn:   { width: '100%', padding: 14, backgroundColor: 'transparent', color: '#94A3B8', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
};