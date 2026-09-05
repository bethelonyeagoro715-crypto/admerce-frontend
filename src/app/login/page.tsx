'use client';

import { Suspense } from 'react';
import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../services/api';
import {
  getIntendedRole,
  clearIntendedRole,
  setActiveRole,
  setUserId,
  setUserName,
} from '../../services/localStorage';
import {
  MdVisibility,
  MdVisibilityOff,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Navigation helpers ──────────────────────────────────
  const navigateByRoleKey = async (roleKey: string) => {
    switch (roleKey) {
      case 'shopper':
        router.replace('/shopper/home');
        break;
      case 'storekeeper':
        await navigateStorekeeper();
        break;
      case 'courier':
        await navigateCourier();
        break;
      case 'flipper':
        await navigateFlipper();
        break;
      case 'service-provider':
        await navigateServiceProvider();
        break;
      case 'admin':
        router.replace('/_admin/dashboard');
        break;
      default:
        router.replace('/shopper/home');
    }
  };

  const navigateStorekeeper = async () => {
    try {
      const store = await api.getMyStore();
      router.replace(store ? '/storekeeper/home' : '/storekeeper/onboarding/personal-info');
    } catch {
      router.replace('/storekeeper/onboarding/personal-info');
    }
  };

  const navigateCourier = async () => {
    try {
      await api.getCourierJobs();
      router.replace('/courier/home');
    } catch {
      router.replace('/courier/onboarding');
    }
  };

  const navigateFlipper = async () => {
    try {
      const listings = await api.getFlipperListings();
      router.replace(listings.length > 0 ? '/flipper/home' : '/flipper/onboarding');
    } catch {
      router.replace('/flipper/onboarding');
    }
  };

  const navigateServiceProvider = async () => {
    try {
      const services = await api.getProviderServices();
      router.replace(services.length > 0 ? '/service-provider/home' : '/service-provider/onboarding');
    } catch {
      router.replace('/service-provider/onboarding');
    }
  };

  // ─── Login handler ──────────────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.login(phone.trim(), password);

      const profile = await api.getMyProfile();

      if (profile.id) {
        setUserId(profile.id as string);
      }
      const name = (profile.nickname ?? profile.phone ?? 'User') as string;
      setUserName(name);

      const intendedRoleKey = getIntendedRole();
      clearIntendedRole();

      if (intendedRoleKey) {
        setActiveRole(intendedRoleKey);
        await navigateByRoleKey(intendedRoleKey);
      } else {
        const dbRole = profile.role as string | undefined;
        if (dbRole) {
          setActiveRole(dbRole);
          await navigateByRoleKey(dbRole);
        } else {
          setActiveRole('shopper');
          router.replace('/shopper/home');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Build query string ────────────────────────────────
  const preserveParams = () => {
    const redirect = searchParams.get('redirect');
    const intendedRole = searchParams.get('intended_role');
    const params = new URLSearchParams();
    if (redirect) params.set('redirect', redirect);
    if (intendedRole) params.set('intended_role', intendedRole);
    return params.toString();
  };

  const signupUrl = `/signup${preserveParams() ? `?${preserveParams()}` : ''}`;
  const forgotPasswordUrl = `/forgot-password${preserveParams() ? `?${preserveParams()}` : ''}`;

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subtitle}>Ready to find something amazing?</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={styles.input}
            required
          />

          <div style={styles.passwordWrapper}>
            <input
              type={obscure ? 'password' : 'text'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...styles.input, marginBottom: 0, paddingRight: '48px' }}
              required
            />
            <button
              type="button"
              onClick={() => setObscure(!obscure)}
              style={styles.eyeButton}
              aria-label={obscure ? 'Show password' : 'Hide password'}
            >
              {obscure ? <MdVisibility size={22} color="#666" /> : <MdVisibilityOff size={22} color="#666" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.links}>
          <a href={signupUrl} style={styles.link}>
            Let&apos;s get started
          </a>
          <span style={{ color: '#ccc', margin: '0 8px' }}>|</span>
          <a href={forgotPasswordUrl} style={styles.link}>
            Forgot password?
          </a>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

// ─── Styles ──────────────────────────────────────────────
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
    fontSize: '32px',
    fontWeight: 900,
    color: '#1A1A1A',
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
    gap: '16px',
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
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
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
  },
  error: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '8px',
    fontSize: '14px',
  },
  links: {
    marginTop: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  link: {
    color: '#0504AA',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '14px',
  },
};;