'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../services/api';
import { MdLockOutline, MdVisibility, MdVisibilityOff } from 'react-icons/md';

// ✅ Next.js 16 requires useSearchParams to be wrapped in Suspense
export const dynamic = 'force-dynamic';

function PinSetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intendedRole = searchParams.get('intended_role') || 'shopper';

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.setWithdrawalPin(pin);
      // Success — continue the onboarding flow
      router.replace(`/onboarding?intended_role=${encodeURIComponent(intendedRole)}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not save PIN. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.replace(`/onboarding?intended_role=${encodeURIComponent(intendedRole)}`);
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <MdLockOutline size={32} color="#0504AA" />
        </div>

        <h1 style={styles.title}>Set your wallet PIN</h1>
        <p style={styles.subtitle}>
          This 4-digit PIN protects withdrawals and payments from your wallet.
          You&apos;ll need it every time you move money out.
        </p>

        <label style={styles.label}>
          Enter PIN
          <div style={styles.inputWrap}>
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              style={styles.input}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPin((s) => !s)}
              style={styles.eyeBtn}
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
            >
              {showPin ? (
                <MdVisibilityOff size={20} color="#888" />
              ) : (
                <MdVisibility size={20} color="#888" />
              )}
            </button>
          </div>
        </label>

        <label style={styles.label}>
          Confirm PIN
          <div style={styles.inputWrap}>
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              style={styles.input}
              autoComplete="new-password"
            />
          </div>
        </label>

        {error && <div style={styles.error}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || pin.length !== 4 || confirmPin.length !== 4}
          style={{
            ...styles.primaryBtn,
            opacity:
              isSubmitting || pin.length !== 4 || confirmPin.length !== 4 ? 0.5 : 1,
            cursor:
              isSubmitting || pin.length !== 4 || confirmPin.length !== 4
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {isSubmitting ? 'Saving…' : 'Save PIN'}
        </button>

        <button onClick={handleSkip} style={styles.skipBtn} type="button">
          Skip for now
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

export default function WalletPinSetupPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.container}>
          <div style={styles.card}>
            <div style={styles.spinner} />
          </div>
        </main>
      }
    >
      <PinSetupInner />
    </Suspense>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8f9fb',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: '28px 24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    backgroundColor: '#0504AA10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1A1A1A',
    textAlign: 'center',
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '8px 0 24px',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 14,
  },
  inputWrap: {
    position: 'relative',
    marginTop: 6,
  },
  input: {
    width: '100%',
    padding: '12px 44px 12px 14px',
    borderRadius: 10,
    border: '1px solid #e0e0e0',
    outline: 'none',
    fontSize: 18,
    letterSpacing: 6,
    textAlign: 'center',
    color: '#1A1A1A',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  error: {
    padding: '10px 12px',
    backgroundColor: '#FFEBEE',
    border: '1px solid #FFCDD2',
    borderRadius: 8,
    color: '#B71C1C',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#0504AA',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    marginTop: 4,
  },
  skipBtn: {
    width: '100%',
    padding: '12px',
    marginTop: 8,
    border: 'none',
    background: 'none',
    color: '#666',
    fontSize: 13,
    cursor: 'pointer',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
};