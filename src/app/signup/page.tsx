'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../services/api';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

// ─── Role chip data ─────────────────────────────────────────────
const ROLE_OPTIONS: { key: string; label: string }[] = [
  { key: 'shopper', label: 'Buy items' },
  { key: 'storekeeper', label: 'Sell items' },
  { key: 'courier', label: 'Deliver packages' },
  { key: 'flipper', label: 'Resell for profit' },
  { key: 'service_provider', label: 'Provide a service' },
];

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intendedRole = searchParams.get('intended_role') ?? undefined;

  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [obscurePassword, setObscurePassword] = useState(true);
  const [futureRoles, setFutureRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Available roles (exclude the intended role, if any) ──────
  const availableRoles = intendedRole
    ? ROLE_OPTIONS.filter((r) => r.key !== intendedRole).map((r) => r.label)
    : ROLE_OPTIONS.map((r) => r.label);

  // ─── Toggle future role chip ──────────────────────────────────
  const toggleRole = (label: string) => {
    setFutureRoles((prev) =>
      prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label]
    );
  };

  // ─── Submit ────────────────────────────────────────────────────
  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.signup(phone.trim(), password, email.trim(), username.trim());

      // Navigate to OTP verification
      const params = new URLSearchParams();
      params.set('phone', phone.trim());
      if (intendedRole) params.set('intended_role', intendedRole);
      router.push(`/verify-otp?${params.toString()}`);
    } catch (err: unknown) {
      let message = 'Signup failed';
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        // Axios error
        const axiosError = err as { response?: { data?: { detail?: string } } };
        message = axiosError.response?.data?.detail ?? message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Let&rsquo;s get started</h1>
        <p style={styles.subtitle}>Your next big find is just a signup away.</p>

        <form onSubmit={handleSignup} style={styles.form}>
          <input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />

          <div style={styles.passwordWrapper}>
            <input
              type={obscurePassword ? 'password' : 'text'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...styles.input, paddingRight: '48px' }}
              required
            />
            <button
              type="button"
              onClick={() => setObscurePassword(!obscurePassword)}
              style={styles.eyeButton}
            >
              {obscurePassword ? '👁️' : '🙈'}
            </button>
          </div>

          {/* ─── Future role chips ───────────────────────────── */}
          <p style={styles.chipsLabel}>Which would you also fit in the future?</p>
          <div style={styles.chipsContainer}>
            {availableRoles.map((label) => {
              const selected = futureRoles.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleRole(label)}
                  style={{
                    ...styles.chip,
                    backgroundColor: selected ? '#0504AA' : '#ffffff',
                    color: selected ? '#ffffff' : '#0504AA',
                    borderColor: selected ? '#0504AA' : '#ccc',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {error && <div style={styles.error}>{error}</div>}

        <a
          href="/login"
          style={styles.loginLink}
        >
          Already part of Admerce? Right this way
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
    maxWidth: '420px',
    textAlign: 'center',
  },
  heading: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#1A1A1A',
    marginTop: '40px',
    marginBottom: '8px',
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
  passwordWrapper: {
    position: 'relative' as const,
  },
  eyeButton: {
    position: 'absolute' as const,
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
  },
  chipsLabel: {
    color: 'grey',
    fontSize: '14px',
    marginTop: '12px',
    textAlign: 'left' as const,
  },
  chipsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  chip: {
    padding: '8px 14px',
    borderRadius: '20px',
    border: '1.5px solid',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
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