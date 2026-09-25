'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../services/api';
import { alertDialog } from '../../components/ui/dialogs';
import { MdMarkEmailRead, MdArrowBack, MdCheckCircle } from 'react-icons/md';

const OTP_LENGTH = 6;

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const phone = searchParams.get('phone') || '';
  const intendedRole = searchParams.get('intended_role') || 'shopper';

  const [digits, setDigits] = useState<string[]>(
    Array(OTP_LENGTH).fill(''),
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [resentAt, setResentAt] = useState<number | null>(null);
  const [resentVisible, setResentVisible] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const otp = useMemo(() => digits.join(''), [digits]);
  const isComplete = otp.length === OTP_LENGTH && !digits.includes('');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Countdown timer ─────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
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

  // ── Focus the first box on mount ────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 120);
    return () => clearTimeout(t);
  }, []);

  // ── Reset the auto-submit guard if the user edits the code ──────
  useEffect(() => {
    if (otp.length < OTP_LENGTH) autoSubmittedRef.current = null;
  }, [otp]);

  // ── Verify handler ──────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (loading) return;
    const trimmed = digits.join('');

    if (trimmed.length !== OTP_LENGTH || digits.includes('')) {
      setInlineError('Enter all six digits.');
      // Focus first empty box
      const idx = digits.findIndex((d) => !d);
      if (idx >= 0) inputsRef.current[idx]?.focus();
      return;
    }

    setLoading(true);
    setInlineError(null);

    try {
      const result = (await api.verifyAccount(phone, trimmed)) as {
        purpose?: string;
        access_token?: string;
        user_id?: string;
      };

      if (!isMountedRef.current) return;

      // Password-reset flow — hand off OTP to the reset-password page.
      if (result.purpose === 'reset_password') {
        router.replace(
          `/reset-password?phone=${encodeURIComponent(phone)}` +
            `&otp=${encodeURIComponent(trimmed)}`,
        );
        return;
      }

      // Signup flow — continue to wallet PIN setup.
      router.replace(`/wallet-pin-setup?intended_role=${intendedRole}`);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      const detail = extractErrorDetail(
        err,
        "That code didn't work. Please try again.",
      );

      await alertDialog({
        title: "That code didn't work",
        body: `${detail}\n\nDouble-check the code in your email, or tap Resend to get a fresh one.`,
        kind: 'danger',
        confirmLabel: 'Try again',
      });

      // Clear the input and refocus so the user can retype without
      // having to manually select the old digits.
      setDigits(Array(OTP_LENGTH).fill(''));
      autoSubmittedRef.current = null;
      setTimeout(() => inputsRef.current[0]?.focus(), 60);
      setLoading(false);
    }
  }, [digits, phone, intendedRole, router, loading]);

  // ── Auto-submit when the 6th digit lands ────────────────────────
  useEffect(() => {
    if (!isComplete || loading) return;
    if (autoSubmittedRef.current === otp) return;
    autoSubmittedRef.current = otp;

    // Tiny delay so the user sees the last digit render before the
    // spinner takes over.
    const t = setTimeout(() => {
      handleVerify();
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, otp, loading]);

  // ── Resend handler ──────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      await api.resendVerification(phone);
      if (!isMountedRef.current) return;

      // Inline confirmation, not a modal — resend isn't a decision point.
      setResentAt(Date.now());
      setResentVisible(true);
      startCountdown();
      setTimeout(() => {
        if (isMountedRef.current) setResentVisible(false);
      }, 4000);

      // Clear any half-typed code and put the cursor back on box 1
      setDigits(Array(OTP_LENGTH).fill(''));
      autoSubmittedRef.current = null;
      inputsRef.current[0]?.focus();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      await alertDialog({
        title: "Couldn't resend the code",
        body: extractErrorDetail(err, 'Please try again in a moment.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setResending(false);
    }
  };

  // ── Per-box input handlers ──────────────────────────────────────
  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    // Take only the last digit typed (handles "12" from autofill edge).
    const digit = cleaned.slice(-1);

    if (inlineError && digit) setInlineError(null);

    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);
    if (!pasted) return;

    setInlineError(null);

    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);

    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputsRef.current[focusIdx]?.focus();
  };

  // ── Missing phone — start-over guard ────────────────────────────
  if (!phone) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <div style={styles.iconWrapper}>
            <MdMarkEmailRead size={56} color="#0504AA" />
          </div>
          <h1 style={styles.heading}>Something&apos;s missing</h1>
          <p style={styles.subtitle}>
            We don&apos;t have the phone number to verify. Start over from the
            sign-up page.
          </p>
          <button
            onClick={() => router.replace('/signup')}
            style={styles.primaryBtn}
          >
            Back to sign up
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <style>{PAGE_CSS}</style>

      <div style={styles.card}>
        <button
          onClick={() => router.back()}
          style={styles.backBtn}
          aria-label="Back"
        >
          <MdArrowBack size={18} color="#64748B" />
        </button>

        {/* Hero — icon with pulse rings (same visual language as
            booking-confirmed). */}
        <div style={styles.heroWrap}>
          <div className="otp-pulse otp-pulse-1" aria-hidden />
          <div className="otp-pulse otp-pulse-2" aria-hidden />
          <div style={styles.iconCircle}>
            <MdMarkEmailRead size={36} color="#ffffff" />
          </div>
        </div>

        <h1 style={styles.heading}>Check your inbox</h1>
        <p style={styles.subtitle}>
          We sent a 6-digit code to{' '}
          <strong style={styles.phoneInline}>{phone}</strong>
        </p>

        {/* Six-box OTP input */}
        <div
          className="otp-grid"
          style={styles.otpGrid}
          onPaste={handlePaste}
        >
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.currentTarget.select()}
              className="otp-box"
              style={{
                ...styles.otpBox,
                ...(inlineError ? styles.otpBoxError : null),
                ...(digit ? styles.otpBoxFilled : null),
              }}
              aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
              disabled={loading}
            />
          ))}
        </div>

        {inlineError && <div style={styles.inlineError}>{inlineError}</div>}

        <button
          onClick={handleVerify}
          disabled={loading || !isComplete}
          style={{
            ...styles.primaryBtn,
            opacity: loading || !isComplete ? 0.55 : 1,
            cursor: loading ? 'wait' : !isComplete ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <span style={styles.spinner} />
              <span>Verifying…</span>
            </>
          ) : (
            <span>Verify</span>
          )}
        </button>

        <div style={styles.resendRow}>
          <span style={styles.resendPrompt}>
            Didn&apos;t get the code?{' '}
          </span>
          {countdown > 0 ? (
            <span style={styles.resendCountdown}>
              Resend in {countdown}s
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              style={{
                ...styles.resendBtn,
                opacity: resending ? 0.6 : 1,
                cursor: resending ? 'wait' : 'pointer',
              }}
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </div>

        {/* Inline resend confirmation — a green chip, not a modal */}
        {resentVisible && resentAt && (
          <div className="otp-resent" style={styles.resentChip}>
            <MdCheckCircle size={15} color="#065F46" />
            <span style={styles.resentText}>Fresh code sent</span>
          </div>
        )}

        <p style={styles.footer}>
          Wrong email?{' '}
          <button
            onClick={() => router.replace('/signup')}
            style={styles.footerLink}
          >
            Start over
          </button>
        </p>
      </div>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#FAFAFC',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid #E6E8F0',
              borderTopColor: '#0504AA',
              borderRadius: '50%',
              animation: 'otpSpin 0.9s linear infinite',
            }}
          />
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}

// ─── Keyframes (once-injected CSS) ────────────────────────────────
const PAGE_CSS = `
  @keyframes otpSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes otpPulse {
    0%   { transform: scale(0.9); opacity: 0.55; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes otpRise {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: none; }
  }
  .otp-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 74px;
    height: 74px;
    margin-left: -37px;
    margin-top: -37px;
    border-radius: 50%;
    border: 2px solid rgba(5, 4, 170, 0.25);
    pointer-events: none;
  }
  .otp-pulse-1 { animation: otpPulse 2.6s ease-out infinite; }
  .otp-pulse-2 { animation: otpPulse 2.6s ease-out infinite; animation-delay: 1.3s; }

  /* OTP box focus treatment */
  .otp-box:focus {
    outline: none;
    border-color: #0504AA !important;
    box-shadow: 0 0 0 4px rgba(5, 4, 170, 0.10) !important;
    background-color: #FFFFFF !important;
  }

  /* Entrance animation for the resend chip */
  .otp-resent {
    animation: otpRise 220ms ease-out both;
  }

  @media (prefers-reduced-motion: reduce) {
    .otp-pulse { animation: none !important; }
    .otp-resent { animation: none !important; }
  }
`;

// ─── Styles ───────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#FAFAFC',
    padding: 24,
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: '36px 28px 28px',
    boxShadow:
      '0 1px 2px rgba(15,23,42,0.03), 0 8px 28px rgba(15,23,42,0.06)',
    border: '1px solid #EEF0F7',
    textAlign: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 34,
    height: 34,
    borderRadius: 12,
    border: 'none',
    background: '#F6F7FB',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroWrap: {
    position: 'relative',
    width: 74,
    height: 74,
    margin: '0 auto 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    position: 'relative',
    width: 74,
    height: 74,
    borderRadius: 24,
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 32px rgba(5,4,170,0.28)',
  },

  heading: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: '#5A6178',
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 1.5,
  },
  phoneInline: {
    color: '#0B0B1A',
    fontWeight: 700,
  },

  otpGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  otpBox: {
    width: 46,
    height: 56,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 800,
    color: '#0B0B1A',
    border: '1.5px solid #E6E8F0',
    borderRadius: 12,
    backgroundColor: '#FAFAFC',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s, background-color 0.15s',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    caretColor: '#0504AA',
  },
  otpBoxFilled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7CCFF',
  },
  otpBoxError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  inlineError: {
    fontSize: 12.5,
    color: '#991B1B',
    fontWeight: 600,
    marginTop: 8,
    marginBottom: 4,
  },

  primaryBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    transition: 'transform 0.12s, box-shadow 0.18s, opacity 0.15s',
  },
  spinner: {
    display: 'inline-block',
    width: 18,
    height: 18,
    border: '2.5px solid rgba(255,255,255,0.35)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'otpSpin 0.7s linear infinite',
  },

  resendRow: {
    marginTop: 18,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 13.5,
    flexWrap: 'wrap',
    gap: 4,
  },
  resendPrompt: {
    color: '#64748B',
  },
  resendCountdown: {
    color: '#94A3B8',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: '#0504AA',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13.5,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    padding: 0,
    fontFamily: 'inherit',
  },

  resentChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '6px 12px',
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
  },
  resentText: {
    fontSize: 12,
    fontWeight: 700,
    color: '#065F46',
    letterSpacing: 0.2,
  },

  footer: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 22,
    marginBottom: 0,
  },
  footerLink: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 12.5,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    padding: 0,
    fontFamily: 'inherit',
  },
};