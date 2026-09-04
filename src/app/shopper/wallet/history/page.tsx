'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../services/api';
import {
  MdArrowBack,
  MdTrendingUp,
  MdTrendingDown,
  MdSearch,
} from 'react-icons/md';

interface RawTransaction {
  id: string | number;
  type?: string;
  amount?: number | string;
  description?: string;
  created_at?: string;
  status?: string;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  status: string;
}

const fmt = (v: number) =>
  '₦' + v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
};

/**
 * Normalize backend transaction rows into the domain Transaction type.
 * Treats 'credit', 'topup', 'refund' as credit; everything else as debit.
 */
function normalize(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return [];

  return (raw as RawTransaction[]).map((t) => {
    const rawType = (t.type || '').toLowerCase();
    const isCredit =
      rawType === 'credit' ||
      rawType === 'topup' ||
      rawType === 'refund' ||
      rawType === 'deposit';

    return {
      id: String(t.id),
      type: isCredit ? 'credit' : 'debit',
      amount: Number(t.amount ?? 0),
      description: t.description ?? (isCredit ? 'Wallet top-up' : 'Payment'),
      date: t.created_at ?? '',
      status: t.status ?? 'completed',
    };
  });
}

type Filter = 'all' | 'credit' | 'debit';

export default function HistoryPage() {
  const router = useRouter();

  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadTransactions = async () => {
      setLoading(true);
      try {
        const data = (await api.getWalletTransactions(50, 0)) as RawTransaction[];
        const list = normalize(data);
        setAllTxns(list);
      } catch {
        setAllTxns([]);
      } finally {
        setLoading(false);
      }
    };
    loadTransactions();
  }, []);

  const filtered = useMemo(() => {
    let result = allTxns;

    if (filter !== 'all') {
      result = result.filter((t) => t.type === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          fmt(t.amount).includes(q)
      );
    }

    return result;
  }, [allTxns, filter, search]);

  const totalCredit = allTxns
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebit = allTxns
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <div style={css.loadScreen}>
        <div style={css.loadRing} />
        <style>{KF}</style>
      </div>
    );
  }

  return (
    <div style={css.root}>
      <style>{KF}</style>

      {/* Header */}
      <div style={css.header}>
        <button style={css.backBtn} onClick={() => router.back()} aria-label="Back">
          <MdArrowBack size={22} color="#0F172A" />
        </button>
        <h1 style={css.headerTitle}>Transaction History</h1>
        <div style={{ width: 22 }} />
      </div>

      {/* Summary */}
      <div style={css.summaryRow}>
        <div style={css.summaryCard}>
          <MdTrendingUp size={16} color="#16A34A" />
          <span style={css.summaryLabel}>Money In</span>
          <span style={css.summaryValue}>{fmt(totalCredit)}</span>
        </div>
        <div style={css.summaryCard}>
          <MdTrendingDown size={16} color="#DC2626" />
          <span style={css.summaryLabel}>Money Out</span>
          <span style={css.summaryValue}>{fmt(totalDebit)}</span>
        </div>
      </div>

      {/* Search + Filter */}
      <div style={css.searchWrap}>
        <MdSearch size={18} color="#94A3B8" style={{ marginRight: 8 }} />
        <input
          type="text"
          placeholder="Search transactions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={css.searchInput}
        />
      </div>

      <div style={css.filterTabs}>
        {(['all', 'credit', 'debit'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...css.filterTab,
              backgroundColor: filter === f ? '#0504AA' : '#EEF2FF',
              color: filter === f ? '#fff' : '#0504AA',
            }}
          >
            {f === 'all' ? 'All' : f === 'credit' ? 'Credits' : 'Debits'}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={css.list}>
        {filtered.length === 0 ? (
          <div style={css.empty}>
            <p style={{ fontWeight: 600, color: '#6366F1' }}>No transactions found</p>
            <p style={{ fontSize: 13, color: '#94A3B8' }}>Try adjusting your filters</p>
          </div>
        ) : (
          filtered.map((txn) => {
            const isCredit = txn.type === 'credit';
            return (
              <div key={txn.id} style={css.txnItem}>
                <div
                  style={{
                    ...css.txnIcon,
                    backgroundColor: isCredit ? '#DCFCE7' : '#FEE2E2',
                  }}
                >
                  {isCredit ? (
                    <MdTrendingUp size={18} color="#16A34A" />
                  ) : (
                    <MdTrendingDown size={18} color="#DC2626" />
                  )}
                </div>
                <div style={css.txnInfo}>
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
                  {fmt(txn.amount)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const KF = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

const css: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F0F4FF' },
  loadScreen: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F0F4FF' },
  loadRing: { width: 40, height: 40, border: '3px solid rgba(5,4,170,0.2)', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#fff' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 },
  summaryRow: { display: 'flex', gap: 12, padding: '16px 16px 0' },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 },
  summaryLabel: { fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 16, fontWeight: 700, color: '#0F172A' },
  searchWrap: { display: 'flex', alignItems: 'center', margin: '16px 16px 8px', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '0 14px', backgroundColor: '#fff' },
  searchInput: { flex: 1, padding: '12px 0', fontSize: 14, border: 'none', outline: 'none', backgroundColor: 'transparent', color: '#0F172A' },
  filterTabs: { display: 'flex', gap: 8, padding: '0 16px 12px' },
  filterTab: { flex: 1, padding: '10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' },
  list: { flex: 1, padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 },
  txnItem: { display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: '14px 12px', border: '1px solid #EEF2FF' },
  txnIcon: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txnInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  txnDesc: { fontSize: 14, fontWeight: 600, color: '#0F172A' },
  txnDate: { fontSize: 11, color: '#94A3B8' },
  txnAmt: { fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' },
};