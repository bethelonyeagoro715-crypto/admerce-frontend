'use client';

import { useState, useEffect } from 'react';
import { MdAccountBalanceWallet } from 'react-icons/md';
import api from '../../../services/api';

export default function ServiceProviderWalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadBalance = async () => {
    setLoading(true);
    try {
      const data = (await api.getWalletBalance()) as { balance?: number };
      setBalance(data.balance ?? 0);
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBalance();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  return (
    <main style={styles.center}>
      <MdAccountBalanceWallet size={64} color="#0504AA" />
      <p style={styles.balanceText}>
        Balance: ₦{balance.toFixed(2)}
      </p>
      <button
        onClick={() => alert('Top-up flow coming soon!')}
        style={styles.topUpBtn}
      >
        Top Up
      </button>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#fff',
    padding: 16,
    textAlign: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  balanceText: {
    fontSize: 24,
    color: '#1A1A1A',
    margin: '16px 0 32px',
  },
  topUpBtn: {
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(5, 4, 170, 0.3)',
    transition: 'background-color 0.2s',
  },
};

// Add spinner keyframes
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}