'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { extractErrorDetail } from '../../services/api';
import PhoneField from '../../components/ui/PhoneField';
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
  MdErrorOutline,
  MdArrowForward,
  MdLockOutline,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState(''); // E.164 from PhoneField
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
        // Handoff rule: route is /admin, NOT /_admin
        router.replace('/admin/dashboard');
        break;
      default:
        router.replace('/shopper/home');
    }
  };

  const navigateStorekeeper = async () => {
    try {
      const store = await api.getMyStore();
      router.replace(
        store ? '/storekeeper/home' : '/storekeeper/onboarding/personal-info',
      );
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
      router.replace(
        Array.isArray(listings) && listings.length > 0
          ? '/flipper/home'
          : '/flipper/onboarding',
      );
    } catch {
      router.replace('/flipper/onboarding');
    }
  };

  const navigateServiceProvider = async () => {
    try {
      const services = await api.getProviderServices();
      router.replace(
        Array.isArray(services) && services.length > 0
          ? '/service-provider/home'
          : '/service-provider/onboarding',
      );
    } catch {
      router.replace('/service-provider/onboarding');
    }
  };

  // ─── Login handler ──────────────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;
    setLoading(true);
    setError('');

    try {
      // `phone` is already E.164 from PhoneField.
      await api.login(phone, password);

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
          // Backend returns snake_case 'service_provider'; the nav switch
          // expects a hyphenated 'service-provider'.
          const normalized = dbRole.replace(/_/g, '-');
          setActiveRole(dbRole);
          await navigateByRoleKey(normalized);
        } else {
          setActiveRole('shopper');
          router.replace('/shopper/home');
        }
      }
    } catch (err: unknown) {
      setError(
        extractErrorDetail(
          err,
          "That didn't work. Check your number and password.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Preserve query params on cross-links ───────────────
  const preserveParams = () => {
    const redirect = searchParams.get('redirect');
    const intendedRole = searchParams.get('intended_role');
    const params = new URLSearchParams();
    if (redirect) params.set('redirect', redirect);
    if (intendedRole) params.set('intended_role', intendedRole);
    return params.toString();
  };

  const qs = preserveParams();
  const signupUrl = `/signup${qs ? `?${qs}` : ''}`;
  const forgotPasswordUrl = `/forgot-password${qs ? `?${qs}` : ''}`;

  const canSubmit = phone.length > 0 && password.length > 0 && !loading;

  return (
    <main className="li-root">
      <style>{CSS}</style>

      <div className="li-shell">
        {/* Brand */}
        <header className="li-brandRow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/admerce_symbol.png"
            alt="Admerce"
            className="li-brandLogo"
          />
          <span className="li-brandName">Admerce</span>
        </header>

        <h1 className="li-heading">Welcome back</h1>
        <p className="li-subtitle">Ready to find something amazing?</p>

        <form onSubmit={handleLogin} className="li-form" noValidate>
          <div className="li-field">
            <label htmlFor="li-phone" className="li-label">
              <span>Phone number</span>
            </label>
            <PhoneField
              id="li-phone"
              value={phone}
              onChange={setPhone}
              disabled={loading}
              placeholder="Phone number"
              autoFocus
            />
          </div>

          <div className="li-field">
            <label htmlFor="li-password" className="li-label">
              <span className="li-labelIcon" aria-hidden>
                <MdLockOutline size={14} color="#64748B" />
              </span>
              <span>Password</span>
            </label>
            <div className="li-passwordRow">
              <input
                id="li-password"
                type={obscure ? 'password' : 'text'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="li-input li-inputPassword"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setObscure((v) => !v)}
                className="li-eyeBtn"
                aria-label={obscure ? 'Show password' : 'Hide password'}
                tabIndex={-1}
              >
                {obscure ? (
                  <MdVisibility size={18} color="#64748B" />
                ) : (
                  <MdVisibilityOff size={18} color="#64748B" />
                )}
              </button>
            </div>
          </div>

          <div className="li-forgotRow">
            <Link href={forgotPasswordUrl} className="li-forgotLink">
              Forgot password?
            </Link>
          </div>

          {error && (
            <div className="li-errorBox" role="alert">
              <MdErrorOutline size={18} color="#991B1B" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="li-submit"
            style={{
              opacity: canSubmit ? 1 : 0.55,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? (
              <>
                <span className="li-spinner" />
                <span>Logging in…</span>
              </>
            ) : (
              <>
                <span>Log in</span>
                <MdArrowForward size={18} color="#fff" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="li-footer">
          <span className="li-footerText">New to Admerce?</span>
          <Link href={signupUrl} className="li-footerLink">
            Let&apos;s get started
            <MdArrowForward size={14} color="#0504AA" />
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#F4F5FB',
            color: '#64748B',
            fontSize: 14,
          }}
        >
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────
const CSS = `
  @keyframes liSpin { to { transform: rotate(360deg); } }
  @keyframes liFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .li-root {
    min-height: 100vh;
    background:
      radial-gradient(ellipse at 15% 0%, rgba(61,59,255,0.08) 0%, rgba(61,59,255,0) 55%),
      #F4F5FB;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 24px 20px 48px;
    font-family: inherit;
  }

  .li-shell {
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    animation: liFadeIn 0.3s ease both;
    padding-top: 8vh;
  }

  /* Brand */
  .li-brandRow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 28px;
    padding-top: 4px;
  }
  .li-brandLogo {
    width: 34px;
    height: 34px;
    display: block;
    object-fit: contain;
  }
  .li-brandName {
    font-size: 16px;
    font-weight: 800;
    color: #0B0B1A;
    letter-spacing: -0.02em;
  }

  /* Heading */
  .li-heading {
    font-size: 30px;
    line-height: 1.15;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0 0 8px;
    letter-spacing: -0.03em;
  }
  .li-subtitle {
    font-size: 14.5px;
    color: #64748B;
    margin: 0 0 28px;
    line-height: 1.5;
  }

  /* Form */
  .li-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .li-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .li-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    letter-spacing: 0.01em;
  }
  .li-labelIcon {
    display: inline-flex;
    align-items: center;
  }

  .li-input {
    width: 100%;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1.5px solid #E6E8F0;
    background: #FFFFFF;
    font-size: 15.5px;
    color: #0B0B1A;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  .li-input::placeholder { color: #94A3B8; }
  .li-input:hover:not(:disabled) { border-color: #CBD5E1; }
  .li-input:focus {
    border-color: #0504AA;
    box-shadow: 0 0 0 4px rgba(5,4,170,0.10);
  }
  .li-input:disabled {
    background: #F8FAFC;
    color: #94A3B8;
    cursor: not-allowed;
  }
  .li-inputPassword { padding-right: 52px; }

  .li-passwordRow {
    position: relative;
  }
  .li-eyeBtn {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .li-eyeBtn:hover { background: #F1F5F9; }

  /* Forgot link row */
  .li-forgotRow {
    display: flex;
    justify-content: flex-end;
    margin-top: -6px;
  }
  .li-forgotLink {
    font-size: 12.5px;
    font-weight: 700;
    color: #0504AA;
    text-decoration: none;
    letter-spacing: -0.01em;
  }
  .li-forgotLink:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* Error */
  .li-errorBox {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    background: #FEF2F2;
    border: 1px solid #FECACA;
    color: #991B1B;
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.45;
    animation: liFadeIn 0.2s ease both;
  }

  /* Submit */
  .li-submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 16px 20px;
    margin-top: 6px;
    border: none;
    border-radius: 14px;
    background-image: linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%);
    background-color: #0504AA;
    color: #FFFFFF;
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.01em;
    box-shadow: 0 10px 24px rgba(5,4,170,0.26);
    transition: transform 0.12s, box-shadow 0.15s, opacity 0.15s;
  }
  .li-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(5,4,170,0.32);
  }
  .li-submit:active:not(:disabled) {
    transform: translateY(0) scale(0.985);
  }
  .li-spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    animation: liSpin 0.7s linear infinite;
  }

  /* Footer */
  .li-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 28px;
    padding-top: 22px;
    border-top: 1px solid #EAECF3;
  }
  .li-footerText {
    font-size: 13.5px;
    color: #64748B;
  }
  .li-footerLink {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13.5px;
    font-weight: 800;
    color: #0504AA;
    text-decoration: none;
    letter-spacing: -0.01em;
  }
  .li-footerLink:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;