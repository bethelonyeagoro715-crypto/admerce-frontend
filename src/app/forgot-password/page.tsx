'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../services/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Request OTP ──────────────────────────────────────────────
  const requestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.forgotPassword(phone.trim());
      setOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ─── Reset Password ───────────────────────────────────────────
  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(phone.trim(), otp.trim(), newPassword);
      // Success – go back to login, preserving any params
      const params = preserveParams();
      router.replace(`/login${params ? `?${params}` : ''}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Preserve URL query params (redirect, intended_role) ─────
  const preserveParams = () => {
    const redirect = searchParams.get('redirect');
    const intendedRole = searchParams.get('intended_role');
    const p = new URLSearchParams();
    if (redirect) p.set('redirect', redirect);
    if (intendedRole) p.set('intended_role', intendedRole);
    return p.toString();
  };

  const loginUrl = `/login${preserveParams() ? `?${preserveParams()}` : ''}`;

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        {!otpSent ? (
          <>
            <h1 style={styles.heading}>Oops, need a new password?</h1>
            <p style={styles.subtitle}>No worries – it happens to the best of us.</p>

            <form onSubmit={requestOtp} style={styles.form}>
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={styles.input}
                required
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.button,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 style={styles.heading}>Reset your password</h1>
            <p style={styles.subtitle}>We sent a code to your email.</p>

            <form onSubmit={resetPassword} style={styles.form}>
              <input
                type="text"
                placeholder="OTP Code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={styles.input}
                required
              />
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
                required
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.button,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <a href={loginUrl} style={styles.loginLink}>
          Remembered your password? Log in
        </a>
      </div>
    </main>
  );
}

// ─── Styles (mirror Flutter) ─────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  heading: {
    fontSize: '28px',
    fontWeight: 900,
    color: '#1A1A1A',
    marginBottom: '8px',
    marginTop: '60px',
  },
  subtitle: {
    color: 'grey',
    fontSize: '16px',
    marginBottom: '40px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #e0e0e0',
    fontSize: '16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  button: {
    padding: '16px',
    backgroundColor: '#0504AA',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '12px',
  },
  error: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '8px',
    fontSize: '14px',
  },
  loginLink: {
    display: 'block',
    marginTop: '16px',
    color: 'grey',
    textDecoration: 'none',
    fontSize: '14px',
  },
};