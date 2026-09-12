'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import {
  MdArrowBack,
  MdLockOutline,
  MdVisibility,
  MdVisibilityOff,
  MdCheckCircle,
} from 'react-icons/md';

export default function ChangePasswordPage() {
  useAuthGuard();

  const router = useRouter();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    current.length > 0 && next.length >= 6 && next === confirm && !submitting;

  const handleSubmit = async () => {
    setError(null);

    if (next.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (next === current) {
      setError('New password must be different from the current one.');
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword(current, next);
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>
            <MdCheckCircle size={56} color="#2E7D32" />
          </div>
          <h2 style={styles.successTitle}>Password updated</h2>
          <p style={styles.successBody}>
            Use your new password the next time you log in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.appBar}>
        <button onClick={() => router.back()} style={styles.backBtn}>
          <MdArrowBack size={24} color="#1A1A1A" />
        </button>
        <h1 style={styles.appBarTitle}>Change Password</h1>
        <div style={{ width: 32 }} />
      </div>

      <div style={styles.body}>
        <div style={styles.iconWrap}>
          <MdLockOutline size={32} color="#0504AA" />
        </div>
        <p style={styles.subtitle}>
          Choose a strong password you don&apos;t use anywhere else. It must be
          at least 6 characters.
        </p>

        <label style={styles.label}>
          Current password
          <div style={styles.inputWrap}>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              style={styles.input}
            />
            <button
              type="button"
              onClick={() => setShowCurrent((s) => !s)}
              style={styles.eyeBtn}
              aria-label={showCurrent ? 'Hide password' : 'Show password'}
            >
              {showCurrent ? (
                <MdVisibilityOff size={20} color="#888" />
              ) : (
                <MdVisibility size={20} color="#888" />
              )}
            </button>
          </div>
        </label>

        <label style={styles.label}>
          New password
          <div style={styles.inputWrap}>
            <input
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              style={styles.input}
            />
            <button
              type="button"
              onClick={() => setShowNext((s) => !s)}
              style={styles.eyeBtn}
              aria-label={showNext ? 'Hide password' : 'Show password'}
            >
              {showNext ? (
                <MdVisibilityOff size={20} color="#888" />
              ) : (
                <MdVisibility size={20} color="#888" />
              )}
            </button>
          </div>
          {next.length > 0 && next.length < 6 && (
            <span style={styles.hint}>Too short ({next.length}/6)</span>
          )}
        </label>

        <label style={styles.label}>
          Confirm new password
          <div style={styles.inputWrap}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
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
          {confirm.length > 0 && confirm !== next && (
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
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </main>
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
  return 'Could not update password. Please try again.';
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  appBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#fff',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  body: {
    flex: 1,
    padding: '24px 20px',
    maxWidth: 480,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
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
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '0 0 24px',
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
  hint: {
    display: 'block',
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
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
  successCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    textAlign: 'center',
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1A1A1A',
    margin: 0,
  },
  successBody: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 1.5,
  },
};