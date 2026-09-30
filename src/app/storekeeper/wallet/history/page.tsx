'use client';

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import {
  MdArrowBack,
  MdRefresh,
  MdTrendingUp,
  MdTrendingDown,
  MdAccountBalanceWallet,
  MdSearch,
} from 'react-icons/md';

type Filter = 'all' | 'credit' | 'debit';

interface RawTxn {
  id?: string | number;
  type?: string;
  amount?: number | string;
  description?: string;
  reference?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface Txn {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference: string;
  date: string;
}

function fmtNaira(v: number) {
  return (
    '₦' +
    v.toLocaleString('en-NG', { maximumFractionDigits: 2 })
  );
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function normalize(raw: unknown): Txn[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawTxn[]).map((t) => ({
    id: String(t.id ?? Math.random()),
    type: t.type === 'credit' ? 'credit' : 'debit',
    amount: Number(t.amount ?? 0),
    description:
      t.description ||
      (t.type === 'credit' ? 'Credit' : 'Debit'),
    reference: t.reference || '',
    date: t.created_at || '',
  }));
}

export default function HistoryPage() {
  useAuthGuard();
  const router = useRouter();

  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    try {
      const raw = await api.getWalletTransactions(limit, 0);
      setTxns(normalize(raw));
    } catch {
      setTxns([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    let list = txns;
    if (filter === 'credit')
      list = list.filter((t) => t.type === 'credit');
    else if (filter === 'debit')
      list = list.filter((t) => t.type === 'debit');

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q),
      );
    }
    return list;
  }, [txns, filter, query]);

  const totals = useMemo(() => {
    const credit = txns
      .filter((t) => t.type === 'credit')
      .reduce((s, t) => s + t.amount, 0);
    const debit = txns
      .filter((t) => t.type === 'debit')
      .reduce((s, t) => s + t.amount, 0);
    return { credit, debit };
  }, [txns]);

  return (
    <main style={css.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <style>{SHELL_CSS}</style>

      <div className="hist-shell">
        <div style={css.appBar}>
          <button
            onClick={() => router.back()}
            style={css.backBtn}
          >
            <MdArrowBack size={22} color="var(--text-primary)" />
          </button>
          <h1 style={css.title}>Transaction History</h1>
          <button
            onClick={onRefresh}
            style={css.backBtn}
            title="Refresh"
          >
            <MdRefresh
              size={22}
              color="var(--text-primary)"
              style={{
                animation: refreshing
                  ? 'spin 0.8s linear infinite'
                  : 'none',
              }}
            />
          </button>
        </div>

        <div style={css.statRow}>
          <div style={css.statCard}>
            <MdTrendingUp size={18} color="var(--success-fg)" />
            <span style={css.statLabel}>Money in</span>
            <span style={css.statValueCredit}>
              {fmtNaira(totals.credit)}
            </span>
          </div>
          <div style={css.statCard}>
            <MdTrendingDown size={18} color="var(--danger-fg)" />
            <span style={css.statLabel}>Money out</span>
            <span style={css.statValueDebit}>
              {fmtNaira(totals.debit)}
            </span>
          </div>
        </div>

        <div style={css.searchWrap}>
          <MdSearch size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={css.searchInput}
          />
        </div>

        <div style={css.filterRow}>
          {(['all', 'credit', 'debit'] as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  ...css.filterBtn,
                  background: active
                    ? 'var(--brand-gradient)'
                    : 'transparent',
                  color: active
                    ? 'var(--brand-on-gradient)'
                    : 'var(--brand-primary)',
                  borderColor: active
                    ? 'transparent'
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

        <div style={css.list}>
          {loading ? (
            <div style={css.center}>
              <div style={css.spinner} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={css.empty}>
              <MdAccountBalanceWallet
                size={48}
                color="var(--brand-soft)"
              />
              <p style={css.emptyText}>No transactions yet.</p>
            </div>
          ) : (
            filtered.map((t) => {
              const isCredit = t.type === 'credit';
              return (
                <div key={t.id} style={css.txnRow}>
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
                  <div style={css.txnBody}>
                    <span style={css.txnDesc}>
                      {t.description}
                    </span>
                    <span style={css.txnDate}>
                      {fmtDate(t.date)}
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
                    {fmtNaira(t.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {!loading && txns.length >= limit && (
          <button
            onClick={() => setLimit((n) => n + 50)}
            style={css.loadMore}
          >
            Load more
          </button>
        )}
      </div>
    </main>
  );
}

const SHELL_CSS = `
  .hist-shell {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
`;

const css: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  appBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    padding: 16,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  statLabel: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
  },
  statValueCredit: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--success-fg)',
    fontVariantNumeric: 'tabular-nums',
  },
  statValueDebit: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--danger-fg)',
    fontVariantNumeric: 'tabular-nums',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 16px 12px',
    padding: '10px 14px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 12,
    border: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14,
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    padding: '0 16px 12px',
  },
  filterBtn: {
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  },
  list: {
    flex: 1,
    padding: '0 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px 0',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 0',
    gap: 12,
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: 14,
    margin: 0,
  },
  txnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 12,
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
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
  txnBody: {
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
  loadMore: {
    margin: '0 16px 24px',
    padding: 12,
    borderRadius: 12,
    border: '1px solid var(--brand-primary)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--brand-primary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};