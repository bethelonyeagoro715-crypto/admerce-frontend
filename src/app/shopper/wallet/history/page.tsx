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
  '₦' +
  v.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return s;
  }
};

/**
 * Normalize backend transaction rows into the domain Transaction type.
 * Treats 'credit', 'topup', 'refund', 'deposit' as credit; else debit.
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
      description:
        t.description ?? (isCredit ? 'Wallet top-up' : 'Payment'),
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
        const data = (await api.getWalletTransactions(
          50,
          0,
        )) as RawTransaction[];
        setAllTxns(normalize(data));
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
          fmt(t.amount).includes(q),
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
        <style>{KF}</style>
        <style>{CSS}</style>
        <div style={css.loadRing} />
      </div>
    );
  }

  return (
    <div style={css.root}>
      <style>{KF}</style>
      <style>{CSS}</style>

      <div className="history-shell">
        {/* Header */}
        <div style={css.header}>
          <button
            style={css.backBtn}
            onClick={() => router.back()}
            aria-label="Back"
          >
            <MdArrowBack size={22} color="var(--text-primary)" />
          </button>
          <h1 style={css.headerTitle}>Transaction History</h1>
          <div style={{ width: 22 }} />
        </div>

        {/* Summary */}
        <div style={css.summaryRow}>
          <div style={css.summaryCard}>
            <MdTrendingUp size={16} color="var(--success-fg)" />
            <span style={css.summaryLabel}>Money In</span>
            <span style={css.summaryValue}>{fmt(totalCredit)}</span>
          </div>
          <div style={css.summaryCard}>
            <MdTrendingDown size={16} color="var(--danger-fg)" />
            <span style={css.summaryLabel}>Money Out</span>
            <span style={css.summaryValue}>{fmt(totalDebit)}</span>
          </div>
        </div>

        {/* Search */}
        <div style={css.searchWrap}>
          <MdSearch
            size={18}
            color="var(--text-muted)"
            style={{ marginRight: 8 }}
          />
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={css.searchInput}
          />
        </div>

        {/* Filter tabs */}
        <div style={css.filterTabs}>
          {(['all', 'credit', 'debit'] as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  ...css.filterTab,
                  background: active
                    ? 'var(--brand-gradient)'
                    : 'var(--brand-soft)',
                  color: active
                    ? 'var(--brand-on-gradient)'
                    : 'var(--brand-primary)',
                }}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'credit'
                    ? 'Credits'
                    : 'Debits'}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div style={css.list}>
          {filtered.length === 0 ? (
            <div style={css.empty}>
              <p
                style={{
                  fontWeight: 600,
                  color: 'var(--brand-primary)',
                  margin: 0,
                }}
              >
                No transactions found
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  margin: '6px 0 0',
                }}
              >
                Try adjusting your filters
              </p>
            </div>
          ) : (
            filtered.map((txn) => {
              const isCredit = txn.type === 'credit';
              return (
                <div key={txn.id} style={css.txnItem}>
                  <div
                    style={{
                      ...css.txnIcon,
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
                  <div style={css.txnInfo}>
                    <span style={css.txnDesc}>{txn.description}</span>
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
                    {fmt(txn.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const KF = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

const CSS = `
  /* History shell: caps content column, centered */
  .history-shell {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
`;

const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  loadScreen: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
    transition: 'background-color 0.18s ease',
  },
  loadRing: {
    width: 40,
    height: 40,
    border: '3px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-secondary)',
    transition: 'background-color 0.18s ease',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  summaryRow: {
    display: 'flex',
    gap: 12,
    padding: '16px 16px 0',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    border: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  summaryLabel: {
    fontSize: 11,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: 600,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    margin: '16px 16px 8px',
    border: '1.5px solid var(--border-default)',
    borderRadius: 12,
    padding: '0 14px',
    backgroundColor: 'var(--bg-secondary)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  searchInput: {
    flex: 1,
    padding: '12px 0',
    fontSize: 14,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
  },
  filterTabs: {
    display: 'flex',
    gap: 8,
    padding: '0 16px 12px',
  },
  filterTab: {
    flex: 1,
    padding: '10px',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'capitalize',
    fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s',
  },
  list: {
    flex: 1,
    padding: '0 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  txnItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 12,
    padding: '14px 12px',
    border: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txnInfo: {
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
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  txnAmt: {
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 0',
    textAlign: 'center',
  },
};