'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MdLock } from 'react-icons/md';
import api from '../../../../services/api';

export const dynamic = 'force-dynamic';

function WalletPinSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetPin = async () => {
    const trimmedPin = pin.trim();
    if (trimmedPin.length !== 4) {
      alert('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    try {
      await api.createWallet();
      await api.setWithdrawalPin(trimmedPin);

      alert('Wallet PIN set successfully!');

      const intendedRole = searchParams.get('intended_role') || 'shopper';

      switch (intendedRole) {
        case 'shopper':
          router.push('/shopper/home');
          break;
        case 'storekeeper':
          router.push('/storekeeper/onboarding/personal-info');
          break;
        case 'service-provider':
          router.push('/service-provider/onboarding');
          break;
        default:
          router.push('/shopper/home');
      }
    } catch (error) {
      console.error(error);
      alert(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) {
      setPin(value);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.appBar}>
        <button onClick={() => router.back()} style={styles.backButton}>
          ←
        </button>
        <h1 style={styles.title}>Secure Your Wallet</h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={styles.content}>
        <div style={styles.lockIconWrapper}>
          <MdLock size={64} color="#0504AA" />
        </div>
        <h2 style={styles.heading}>Set your wallet PIN</h2>
        <p style={styles.subtitle}>
          You’ll use this to withdraw funds and confirm transactions.
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={handlePinChange}
          placeholder="0000"
          style={styles.pinInput}
          autoFocus
        />

        <button
          onClick={handleSetPin}
          disabled={loading}
          style={{
            ...styles.primaryButton,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <div style={styles.spinner} />
          ) : (
            'Set PIN & Continue'
          )}
        </button>
      </div>
    </div>
  );
}

export default function WalletPinSetupPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading wallet setup…</div>}>
      <WalletPinSetupContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
  },
  appBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #f0f0f0',
  },
  backButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#000',
    padding: 0,
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    margin: 0,
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 32px',
    textAlign: 'center',
  },
  lockIconWrapper: {
    marginBottom: '24px',
  },
  heading: {
    fontSize: '24px',
    fontWeight: 900,
    margin: '0 0 8px',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '32px',
  },
  pinInput: {
    width: '100%',
    maxWidth: '300px',
    padding: '16px',
    fontSize: '32px',
    letterSpacing: '12px',
    textAlign: 'center',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    outline: 'none',
    transition: 'border-color 0.2s',
    backgroundColor: '#fff',
    marginBottom: '32px',
  },
  primaryButton: {
    width: '100%',
    maxWidth: '300px',
    padding: '16px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};