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

interface Strength {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
  bg: string;
}

function evaluatePassword(pw: string): Strength {
  if (!pw)
    return {
      score: 0,
      label: '',
      color: 'var(--border-default)',
      bg: 'var(--border-default)',
    };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;

  if (s <= 1)
    return {
      score: 1,
      label: 'Weak',
      color: 'var(--danger-fg)',
      bg: 'var(--danger-bg)',
    };
  if (s === 2)
    return {
      score: 2,
      label: 'Fair',
      color: 'var(--warning-fg)',
      bg: 'var(--warning-bg)',
    };
  if (s === 3)
    return {
      score: 3,
      label: 'Good',
      color: 'var(--info-fg)',
      bg: 'var(--info-bg)',
    };
  if (s === 4)
    return {
      score: 4,
      label: 'Strong',
      color: 'var(--success-fg)',
      bg: 'var(--success-bg)',
    };
  return {
    score: 5,
    label: 'Excellent',
    color: 'var(--success-fg)',
    bg: 'var(--success-bg)',
  };
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intendedRole = searchParams.get('intended_role') ?? undefined;

  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const strength = useMemo(() => evaluatePassword(password), [password]);

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

      await api.signup(phone, password, trimmedEmail, username.trim());

      const params = new URLSearchParams();
      params.set('phone', phone);
      params.set('email', trimmedEmail);
      if (intendedRole) params.set('intended_role', intendedRole);
      router.push(`/verify-otp?${params.toString()}`);
    } catch (err) {
      setError(
        extractErrorDetail(
          err,
          "We couldn't create your account. Try again.",
        ),
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
                <MdHandyman size={16} color="var(--brand-primary)" />
              ) : (
                <MdStorefront size={16} color="var(--brand-primary)" />
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
            icon={
              <MdPersonOutline
                size={18}
                color="var(--text-tertiary)"
              />
            }
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
            icon={
              <MdMailOutline size={18} color="var(--text-tertiary)" />
            }
            hint="For receipts and account recovery"
            error={
              touched.email && !emailValid
                ? 'Enter a valid email'
                : undefined
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
            icon={
              <MdLockOutline size={18} color="var(--text-tertiary)" />
            }
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
                onBlur={() =>
                  setTouched((t) => ({ ...t, password: true }))
                }
                className="su-input su-inputPassword"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setObscure((v) => !v)}
                className="su-eyeBtn"
                aria-label={
                  obscure ? 'Show password' : 'Hide password'
                }
                tabIndex={-1}
              >
                {obscure ? (
                  <MdVisibility
                    size={18}
                    color="var(--text-tertiary)"
                  />
                ) : (
                  <MdVisibilityOff
                    size={18}
                    color="var(--text-tertiary)"
                  />
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
                          n <= strength.score
                            ? strength.color
                            : 'var(--border-default)',
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
              <MdErrorOutline size={18} color="var(--danger-fg)" />
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
                <MdArrowForward
                  size={18}
                  color="var(--brand-on-gradient)"
                />
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
          <span className="su-footerText">
            Already part of Admerce?
          </span>
          <Link href="/login" className="su-footerLink">
            Right this way
            <MdArrowForward size={14} color="var(--brand-primary)" />
          </Link>
        </div>
      </div>
    </main>
  );
}

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
          <MdErrorOutline size={12} color="var(--danger-fg)" />
          {error}
        </p>
      ) : hint ? (
        <p className="su-fieldHint">
          <MdCheckCircle size={12} color="var(--border-strong)" />
          {hint}
        </p>
      ) : null}
    </div>
  );
}

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
            background: 'var(--bg-primary)',
            color: 'var(--text-tertiary)',
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

const CSS = `
  @keyframes suSpin { to { transform: rotate(360deg); } }
  @keyframes suFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .su-root {
    min-height: 100vh;
    background:
      radial-gradient(ellipse at 15% 0%,
        color-mix(in srgb, var(--brand-primary) 8%, transparent) 0%,
        transparent 55%),
      var(--bg-primary);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 24px 20px 48px;
    font-family: inherit;
    color: var(--text-primary);
    transition: background-color 0.18s ease, color 0.18s ease;
  }

  .su-shell {
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    animation: suFadeIn 0.3s ease both;
  }

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
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .su-intentBanner {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--brand-soft);
    border: 1px solid
      color-mix(in srgb, var(--brand-primary) 40%, transparent);
    border-radius: 12px;
    margin-bottom: 18px;
    align-self: flex-start;
  }
  .su-intentIcon {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    background: var(--bg-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .su-intentText {
    font-size: 12.5px;
    color: var(--brand-primary);
    font-weight: 600;
  }
  .su-intentText strong {
    font-weight: 800;
  }

  .su-heading {
    font-size: 30px;
    line-height: 1.15;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0 0 8px;
    letter-spacing: -0.03em;
  }
  .su-subtitle {
    font-size: 14.5px;
    color: var(--text-tertiary);
    margin: 0 0 28px;
    line-height: 1.5;
  }

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
    color: var(--text-secondary);
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
    border: 1.5px solid var(--border-default);
    background: var(--bg-tertiary);
    font-size: 15.5px;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  .su-input::placeholder {
    color: var(--text-muted);
  }
  .su-input:hover:not(:disabled) {
    border-color: var(--border-strong);
  }
  .su-input:focus {
    border-color: var(--brand-primary);
    background: var(--bg-secondary);
    box-shadow: 0 0 0 4px
      color-mix(in srgb, var(--brand-primary) 12%, transparent);
  }
  .su-input:disabled {
    background: var(--bg-tertiary);
    color: var(--text-muted);
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
  .su-eyeBtn:hover { background: var(--bg-hover); }

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
  .su-fieldHint { color: var(--text-muted); }
  .su-fieldError { color: var(--danger-fg); font-weight: 600; }

  .su-errorBox {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-strong);
    color: var(--danger-fg);
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.45;
    animation: suFadeIn 0.2s ease both;
  }

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
    background: var(--brand-gradient);
    color: var(--brand-on-gradient);
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.01em;
    box-shadow: var(--shadow-brand);
    transition: transform 0.12s, box-shadow 0.15s, opacity 0.15s;
  }
  .su-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-brand);
  }
  .su-submit:active:not(:disabled) {
    transform: translateY(0) scale(0.985);
  }

  .su-spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid
      color-mix(in srgb, var(--brand-on-gradient) 35%, transparent);
    border-top-color: var(--brand-on-gradient);
    animation: suSpin 0.7s linear infinite;
  }

  .su-legal {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.55;
    margin: 4px 0 0;
    text-align: center;
  }
  .su-legalLink {
    color: var(--brand-primary);
    text-decoration: none;
    font-weight: 700;
    border-bottom: 1px dotted
      color-mix(in srgb, var(--brand-primary) 40%, transparent);
  }
  .su-legalLink:hover {
    border-bottom-style: solid;
  }

  .su-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 28px;
    padding-top: 22px;
    border-top: 1px solid var(--border-default);
  }
  .su-footerText {
    font-size: 13.5px;
    color: var(--text-tertiary);
  }
  .su-footerLink {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13.5px;
    font-weight: 800;
    color: var(--brand-primary);
    text-decoration: none;
    letter-spacing: -0.01em;
  }
  .su-footerLink:hover {
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