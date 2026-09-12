'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../services/api';
import {
  MdLockOutline,
  MdVisibility,
  MdVisibilityOff,
  MdCheckCircle,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const phone = searchParams.get('phone') || '';
  const otp = searchParams.get('otp') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    password.length >= 6 && password === confirm && !submitting && !!phone && !!otp;

  const handleSubmit = async () => {
    setError(null);

    if (!phone || !otp) {
      setError('Missing verification data. Please restart the reset flow.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(phone, otp, password);
      setSuccess(true);
      setTimeout(() => router.replace('/login'), 1800);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>
            <MdCheckCircle size={56} color="#2E7D32" />
          </div>
          <h2 style={styles.heading}>Password reset</h2>
          <p style={styles.subtitle}>Redirecting you to login…</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <MdLockOutline size={32} color="#0504AA" />
        </div>
        <h1 style={styles.heading}>Set a new password</h1>
        <p style={styles.subtitle}>
          Choose a password you don&apos;t use anywhere else. At least 6 characters.
        </p>

        <label style={styles.label}>
          New password
          <div style={styles.inputWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              style={styles.input}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={styles.eyeBtn}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <MdVisibilityOff size={20} color="#888" />
              ) : (
                <MdVisibility size={20} color="#888" />
              )}
            </button>
          </div>
          {password.length > 0 && password.length < 6 && (
            <span style={styles.hint}>Too short ({password.length}/6)</span>
          )}
        </label>

        <label style={styles.label}>
          Confirm password
          <div style={styles.inputWrap}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              style={styles.input}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              style={styles.eyeBtn}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? (
                <MdVisibilityOff size={20} color="#888" />
              ) : (
                <MdVisibility size={20} color="#888" />
              )}
            </button>
          </div>
          {confirm.length > 0 && confirm !== password && (
            <span style={{ ...styles.hint, color: '#C62828' }}>
              Passwords don&apos;t match
            </span>
          )}
        </label>

        {error && <div style={styles.error}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            ...styles.primaryBtn,
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Updating…' : 'Reset password'}
        </button>

        <button
          onClick={() => router.replace('/login')}
          style={styles.cancelBtn}
          type="button"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          Loading...
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as {
      response?: { data?: { detail?: unknown } };
      message?: unknown;
    };
    const detail = e.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Could not reset password. Please try again.';
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
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    backgroundColor: '#0504AA10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
  },
  successIcon: { marginBottom: 16 },
  heading: { fontSize: 24, fontWeight: 800, color: '#1A1A1A', margin: 0 },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 1.5,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 14,
    textAlign: 'left',
  },
  inputWrap: { position: 'relative', marginTop: 6 },
  input: {
    width: '100%',
    padding: '12px 44px 12px 14px',
    borderRadius: 10,
    border: '1px solid #e0e0e0',
    outline: 'none',
    fontSize: 15,
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
  hint: { display: 'block', fontSize: 12, color: '#888', marginTop: 4 },
  error: {
    padding: '10px 12px',
    backgroundColor: '#FFEBEE',
    border: '1px solid #FFCDD2',
    borderRadius: 8,
    color: '#B71C1C',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
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
    marginTop: 16,
  },
  cancelBtn: {
    width: '100%',
    padding: '12px',
    marginTop: 8,
    border: 'none',
    background: 'none',
    color: '#666',
    fontSize: 13,
    cursor: 'pointer',
  },
};