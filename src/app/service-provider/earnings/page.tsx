'use client';

import { useState, useEffect } from 'react';
import { MdAttachMoney, MdRefresh } from 'react-icons/md';
import api from '../../../services/api';

export default function ServiceProviderEarningsPage() {
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEarnings = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = (await api.getProviderStats()) as { total_earnings?: number };
      setTotalEarnings(stats.total_earnings ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEarnings();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Earnings</h1>
        <button onClick={loadEarnings} style={styles.refreshBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      {/* Content */}
      <div style={styles.body}>
        {loading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : error ? (
          <div style={styles.center}>
            <MdAttachMoney size={48} color="#ef9a9a" />
            <p style={{ color: '#666', margin: '8px 0 16px' }}>{error}</p>
            <button onClick={loadEarnings} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        ) : (
          <div style={styles.earningsCard}>
            <MdAttachMoney size={48} color="#0504AA" />
            <p style={styles.earningsLabel}>Total earned</p>
            <p style={styles.earningsValue}>₦{totalEarnings.toFixed(2)}</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    padding: '8px 20px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    textAlign: 'center',
    marginTop: 20,
  },
  earningsLabel: {
    fontSize: 14,
    color: '#888',
    margin: '8px 0',
  },
  earningsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0504AA',
    margin: 0,
  },
};