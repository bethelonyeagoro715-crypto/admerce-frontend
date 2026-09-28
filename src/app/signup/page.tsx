'use client';

import { Suspense, useState, useMemo, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { extractErrorDetail } from '../../services/api';
import PhoneField from '../../components/ui/PhoneField';
import {
  MdPersonOutline,
  MdMailOutline,
  MdLockOutline,
  MdVisibility,
  MdVisibilityOff,
  MdCheckCircle,
  MdErrorOutline,
  MdArrowForward,
  MdStorefront,
  MdHandyman,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  shopper: 'Shopper',
  storekeeper: 'Storekeeper',
  courier: 'Courier',
  flipper: 'Flipper',
  service_provider: 'Service Provider',
};

// ─── Password strength ──────────────────────────────────────────────
interface Strength {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
  bg: string;
}

function evaluatePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: '', color: '#E2E8F0', bg: '#E2E8F0' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;

  if (s <= 1)
    return { score: 1, label: 'Weak', color: '#DC2626', bg: '#FEE2E2' };
  if (s === 2)
    return { score: 2, label: 'Fair', color: '#D97706', bg: '#FEF3C7' };
  if (s === 3)
    return { score: 3, label: 'Good', color: '#0891B2', bg: '#E0F2FE' };
  if (s === 4)
    return { score: 4, label: 'Strong', color: '#16A34A', bg: '#DCFCE7' };
  return { score: 5, label: 'Excellent', color: '#065F46', bg: '#ECFDF5' };
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

// ─── Component ──────────────────────────────────────────────────────
function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intendedRole = searchParams.get('intended_role') ?? undefined;

  const [phone, setPhone] = useState(''); // E.164 from PhoneField
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const strength = useMemo(() => evaluatePassword(password), [password]);

  // E.164 always starts with "+". The library only emits a valid value
  // once the number parses, so this is a strong gate.
  const phoneValid = phone.length >= 8 && phone.startsWith('+');
  const emailValid = isEmail(email);
  const usernameValid = username.trim().length >= 3;
  const passwordValid = password.length >= 8;

  const formValid =
    phoneValid && emailValid && usernameValid && passwordValid && !loading;

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValid) {
      setTouched({
        phone: true,
        email: true,
        username: true,
        password: true,
      });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const trimmedEmail = email.trim();

      // `phone` is already canonical E.164 from PhoneField.
      await api.signup(phone, password, trimmedEmail, username.trim());

      const params = new URLSearchParams();
      params.set('phone', phone);
      params.set('email', trimmedEmail);
      if (intendedRole) params.set('intended_role', intendedRole);
      router.push(`/verify-otp?${params.toString()}`);
    } catch (err) {
      setError(
        extractErrorDetail(err, "We couldn't create your account. Try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  const roleBanner =
    intendedRole && ROLE_LABELS[intendedRole]
      ? ROLE_LABELS[intendedRole]
      : null;

  return (
    <main className="su-root">
      <style>{CSS}</style>

      <div className="su-shell">
        <header className="su-brandRow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/admerce_symbol.png"
            alt="Admerce"
            className="su-brandLogo"
          />
          <span className="su-brandName">Admerce</span>
        </header>

        {roleBanner && (
          <div className="su-intentBanner">
            <span className="su-intentIcon" aria-hidden>
              {intendedRole === 'service_provider' ? (
                <MdHandyman size={16} color="#0504AA" />
              ) : (
                <MdStorefront size={16} color="#0504AA" />
              )}
            </span>
            <span className="su-intentText">
              Signing up as a <strong>{roleBanner}</strong>
            </span>
          </div>
        )}

        <h1 className="su-heading">Let&rsquo;s get started</h1>
        <p className="su-subtitle">
          Create your Admerce account in under a minute.
        </p>

        <form onSubmit={handleSignup} className="su-form" noValidate>
          <Field
            id="su-phone"
            label="Phone number"
            hint="We'll text you a 6-digit code"
            error={
              touched.phone && !phoneValid
                ? 'Enter a valid phone number for your country'
                : undefined
            }
          >
            <PhoneField
              id="su-phone"
              value={phone}
              onChange={setPhone}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              disabled={loading}
              placeholder="Phone number"
            />
          </Field>

          <Field
            id="su-username"
            label="Username"
            icon={<MdPersonOutline size={18} color="#64748B" />}
            hint="This is how buyers and sellers see you"
            error={
              touched.username && !usernameValid
                ? 'At least 3 characters'
                : undefined
            }
          >
            <input
              id="su-username"
              type="text"
              autoComplete="username"
              placeholder="e.g. Graham Bell"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, username: true }))}
              className="su-input"
              disabled={loading}
              required
            />
          </Field>

          <Field
            id="su-email"
            label="Email"
            icon={<MdMailOutline size={18} color="#64748B" />}
            hint="For receipts and account recovery"
            error={
              touched.email && !emailValid ? 'Enter a valid email' : undefined
            }
          >
            <input
              id="su-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className="su-input"
              disabled={loading}
              required
            />
          </Field>

          <Field
            id="su-password"
            label="Password"
            icon={<MdLockOutline size={18} color="#64748B" />}
            hint="At least 8 characters — mix letters, numbers and a symbol"
            error={
              touched.password && !passwordValid
                ? 'Password must be at least 8 characters'
                : undefined
            }
          >
            <div className="su-passwordRow">
              <input
                id="su-password"
                type={obscure ? 'password' : 'text'}
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                className="su-input su-inputPassword"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setObscure((v) => !v)}
                className="su-eyeBtn"
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

            {password.length > 0 && (
              <div className="su-strengthWrap">
                <div className="su-strengthBars" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className="su-strengthBar"
                      style={{
                        backgroundColor:
                          n <= strength.score ? strength.color : '#E2E8F0',
                      }}
                    />
                  ))}
                </div>
                <span
                  className="su-strengthLabel"
                  style={{ color: strength.color }}
                >
                  {strength.label}
                </span>
              </div>
            )}
          </Field>

          {error && (
            <div className="su-errorBox" role="alert">
              <MdErrorOutline size={18} color="#991B1B" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!formValid}
            className="su-submit"
            style={{
              opacity: formValid ? 1 : 0.55,
              cursor: formValid ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? (
              <>
                <span className="su-spinner" />
                <span>Creating account…</span>
              </>
            ) : (
              <>
                <span>Create account</span>
                <MdArrowForward size={18} color="#fff" />
              </>
            )}
          </button>

          <p className="su-legal">
            By creating an account you agree to our{' '}
            <a
              href="/terms"
              className="su-legalLink"
              target="_blank"
              rel="noreferrer"
            >
              Terms
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              className="su-legalLink"
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>
        </form>

        <div className="su-footer">
          <span className="su-footerText">Already part of Admerce?</span>
          <Link href="/login" className="su-footerLink">
            Right this way
            <MdArrowForward size={14} color="#0504AA" />
          </Link>
        </div>
      </div>
    </main>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────────
function Field({
  id,
  label,
  icon,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="su-field">
      <label htmlFor={id} className="su-label">
        {icon && (
          <span className="su-labelIcon" aria-hidden>
            {icon}
          </span>
        )}
        <span>{label}</span>
      </label>
      {children}
      {error ? (
        <p className="su-fieldError">
          <MdErrorOutline size={12} color="#DC2626" />
          {error}
        </p>
      ) : hint ? (
        <p className="su-fieldHint">
          <MdCheckCircle size={12} color="#CBD5E1" />
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ─── Page wrapper ───────────────────────────────────────────────────
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: '#F4F5FB',
            color: '#64748B',
            fontSize: 14,
          }}
        >
          Loading…
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────
const CSS = `
  @keyframes suSpin { to { transform: rotate(360deg); } }
  @keyframes suFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .su-root {
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

  .su-shell {
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    animation: suFadeIn 0.3s ease both;
  }

  /* Brand */
  .su-brandRow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 28px;
    padding-top: 4px;
  }
  .su-brandLogo {
    width: 34px;
    height: 34px;
    display: block;
    object-fit: contain;
  }
  .su-brandName {
    font-size: 16px;
    font-weight: 800;
    color: #0B0B1A;
    letter-spacing: -0.02em;
  }

  /* Intent banner */
  .su-intentBanner {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #EEF0FF;
    border: 1px solid #C7CCFF;
    border-radius: 12px;
    margin-bottom: 18px;
    align-self: flex-start;
  }
  .su-intentIcon {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    background: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .su-intentText {
    font-size: 12.5px;
    color: #0504AA;
    font-weight: 600;
  }
  .su-intentText strong {
    font-weight: 800;
  }

  /* Heading */
  .su-heading {
    font-size: 30px;
    line-height: 1.15;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0 0 8px;
    letter-spacing: -0.03em;
  }
  .su-subtitle {
    font-size: 14.5px;
    color: #64748B;
    margin: 0 0 28px;
    line-height: 1.5;
  }

  /* Form */
  .su-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .su-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .su-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    letter-spacing: 0.01em;
  }
  .su-labelIcon {
    display: inline-flex;
    align-items: center;
  }

  .su-input {
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
  .su-input::placeholder {
    color: #94A3B8;
  }
  .su-input:hover:not(:disabled) {
    border-color: #CBD5E1;
  }
  .su-input:focus {
    border-color: #0504AA;
    background: #FFFFFF;
    box-shadow: 0 0 0 4px rgba(5,4,170,0.10);
  }
  .su-input:disabled {
    background: #F8FAFC;
    color: #94A3B8;
    cursor: not-allowed;
  }
  .su-inputPassword {
    padding-right: 52px;
  }

  .su-passwordRow {
    position: relative;
  }
  .su-eyeBtn {
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
  .su-eyeBtn:hover { background: #F1F5F9; }

  /* Strength meter */
  .su-strengthWrap {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 2px;
  }
  .su-strengthBars {
    flex: 1;
    display: flex;
    gap: 4px;
  }
  .su-strengthBar {
    flex: 1;
    height: 4px;
    border-radius: 999px;
    transition: background-color 0.2s;
  }
  .su-strengthLabel {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    min-width: 68px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* Hint / error */
  .su-fieldHint,
  .su-fieldError {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    margin: 0;
    padding-left: 4px;
    line-height: 1.4;
  }
  .su-fieldHint { color: #94A3B8; }
  .su-fieldError { color: #DC2626; font-weight: 600; }

  /* Error box */
  .su-errorBox {
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
    animation: suFadeIn 0.2s ease both;
  }

  /* Submit */
  .su-submit {
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
  .su-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(5,4,170,0.32);
  }
  .su-submit:active:not(:disabled) {
    transform: translateY(0) scale(0.985);
  }

  .su-spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    animation: suSpin 0.7s linear infinite;
  }

  /* Legal */
  .su-legal {
    font-size: 12px;
    color: #94A3B8;
    line-height: 1.55;
    margin: 4px 0 0;
    text-align: center;
  }
  .su-legalLink {
    color: #0504AA;
    text-decoration: none;
    font-weight: 700;
    border-bottom: 1px dotted rgba(5,4,170,0.4);
  }
  .su-legalLink:hover {
    border-bottom-style: solid;
  }

  /* Footer */
  .su-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 28px;
    padding-top: 22px;
    border-top: 1px solid #EAECF3;
  }
  .su-footerText {
    font-size: 13.5px;
    color: #64748B;
  }
  .su-footerLink {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13.5px;
    font-weight: 800;
    color: #0504AA;
    text-decoration: none;
    letter-spacing: -0.01em;
  }
  .su-footerLink:hover { text-decoration: underline; text-underline-offset: 3px; }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;