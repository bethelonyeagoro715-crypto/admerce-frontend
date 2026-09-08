'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MdLock } from 'react-icons/md';
import api from '../../../../services/api';

function WalletPinSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intendedRole = searchParams.get('intended_role') || 'shopper';

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
      // Ensure wallet exists, then set pin
      await api.createWallet();
      await api.setWithdrawalPin(trimmedPin);

      alert('Wallet PIN set successfully!');

      // Route based on intended role
      switch (intendedRole) {
        case 'shopper':
          router.push('/shopper/home');
          break;
        case 'storekeeper':
          router.push('/storekeeper/onboarding/personal-info');
          break;
        case 'courier':
          router.push('/courier/onboarding');
          break;
        case 'flipper':
          router.push('/flipper/onboarding');
          break;
        case 'service-provider':
          router.push('/service-provider/onboarding');
          break;
        default:
          router.push('/shopper/home');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      alert(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) setPin(value);
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <MdLock size={64} color="#0504AA" />
        </div>
        <h1 style={styles.heading}>Set your wallet PIN</h1>
        <p style={styles.subtitle}>
          You&apos;ll use this to withdraw funds and confirm transactions.
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
            ...styles.primaryBtn,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? <div style={styles.spinner} /> : 'Set PIN & Continue'}
        </button>
      </div>
    </main>
  );
}

export default function WalletPinSetupPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>}>
      <WalletPinSetupContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#FFFFFF', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center' },
  iconWrapper: { marginBottom: 24 },
  heading: { fontSize: 28, fontWeight: 900, color: '#1A1A1A', margin: 0 },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
  pinInput: { width: '100%', marginTop: 40, padding: '16px', fontSize: 32, letterSpacing: 12, textAlign: 'center', border: '1px solid #ccc', borderRadius: 12, outline: 'none', backgroundColor: '#fff' },
  primaryBtn: { width: '100%', padding: '16px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 16, fontSize: 18, fontWeight: 700, cursor: 'pointer', marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  spinner: { width: 24, height: 24, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};