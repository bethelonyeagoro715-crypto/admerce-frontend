'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../services/api';
import { MdMarkEmailRead } from 'react-icons/md';

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const phone = searchParams.get('phone') || '';
  const intendedRole = searchParams.get('intended_role') || 'shopper';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start countdown when page loads
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const showAlert = (message: string, isError = false) => {
    // You can replace with toast library if you have one
    alert(message);
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Something went wrong';
  };

  const handleVerify = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      showAlert('Enter the verification code', true);
      return;
    }

    setLoading(true);
    try {
      const result = await api.verifyAccount(phone, trimmedOtp);
      // api.verifyAccount already stores the token and fetches role
      showAlert('✅ Verification successful!', false);
      router.push(`/wallet-pin-setup?intended_role=${intendedRole}`);
    } catch (err: unknown) {
      showAlert(`Verification failed: ${getErrorMessage(err)}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      await api.resendVerification(phone);
      showAlert('📩 New code sent to your email.', false);
      setCountdown(60);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      showAlert(`Failed to resend: ${getErrorMessage(err)}`, true);
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // digits only
    if (value.length <= 6) {
      setOtp(value);
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <MdMarkEmailRead size={64} color="#0504AA" />
        </div>

        <h1 style={styles.heading}>Verify your account</h1>
        <p style={styles.subtitle}>Enter the code sent to your email</p>

        <input
          type="tel"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={handleOtpChange}
          placeholder="000000"
          style={styles.otpInput}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleVerify();
          }}
        />

        <button
          onClick={handleVerify}
          disabled={loading}
          style={{
            ...styles.primaryBtn,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <div style={styles.spinner} />
          ) : (
            'Verify'
          )}
        </button>

        <div style={styles.resendRow}>
          <span style={{ color: '#666' }}>Didn&apos;t receive the code? </span>
          {countdown > 0 ? (
            <span style={{ color: '#888', fontWeight: 500 }}>
              Resend in {countdown}s
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              style={styles.resendBtn}
            >
              {resending ? 'Sending...' : 'Resend'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    textAlign: 'center',
  },
  iconWrapper: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: 900,
    color: '#1A1A1A',
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  otpInput: {
    width: '100%',
    marginTop: 40,
    padding: '16px',
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    border: '1px solid #ccc',
    borderRadius: 12,
    outline: 'none',
    backgroundColor: '#fff',
    transition: 'border-color 0.2s',
  },
  primaryBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 16,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  spinner: {
    width: 24,
    height: 24,
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  resendRow: {
    marginTop: 16,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 14,
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: '#0504AA',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
    textDecoration: 'underline',
  },
};

// Add spinner keyframes if not in global CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}