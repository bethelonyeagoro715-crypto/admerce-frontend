'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../services/api';
import { alertDialog } from '../../components/ui/dialogs';
import {
  MdVerifiedUser,
  MdArrowBack,
  MdCheckCircle,
  MdMailOutline,
  MdPhoneIphone,
} from 'react-icons/md';

const OTP_LENGTH = 6;

// ─── Masking helpers ────────────────────────────────────────────────
function maskEmail(email: string): string {
  const e = (email || '').trim();
  const at = e.indexOf('@');
  if (at <= 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at);
  if (local.length <= 1) return `*${domain}`;
  return `${local[0]}${'*'.repeat(Math.max(1, Math.min(local.length - 1, 4)))}${domain}`;
}

function maskPhone(phone: string): string {
  const p = (phone || '').trim();
  if (p.length < 6) return p;
  // Show first 4 + last 3, mask the middle.
  const head = p.slice(0, 4);
  const tail = p.slice(-3);
  const middle = '*'.repeat(Math.max(2, p.length - 7));
  return `${head}${middle}${tail}`;
}

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const phone = searchParams.get('phone') || '';
  const email = searchParams.get('email') || '';
  const intendedRole = searchParams.get('intended_role') || 'shopper';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
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

  useEffect(() => {
    const t = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (otp.length < OTP_LENGTH) autoSubmittedRef.current = null;
  }, [otp]);

  const handleVerify = useCallback(async () => {
    if (loading) return;
    const trimmed = digits.join('');

    if (trimmed.length !== OTP_LENGTH || digits.includes('')) {
      setInlineError('Enter all six digits.');
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

      if (result.purpose === 'reset_password') {
        router.replace(
          `/reset-password?phone=${encodeURIComponent(phone)}` +
            `&otp=${encodeURIComponent(trimmed)}`,
        );
        return;
      }

      router.replace(`/wallet-pin-setup?intended_role=${intendedRole}`);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      const detail = extractErrorDetail(
        err,
        "That code didn't work. Please try again.",
      );

      await alertDialog({
        title: "That code didn't work",
        body: `${detail}\n\nDouble-check the code and try again, or tap Resend to get a fresh one.`,
        kind: 'danger',
        confirmLabel: 'Try again',
      });

      setDigits(Array(OTP_LENGTH).fill(''));
      autoSubmittedRef.current = null;
      setTimeout(() => inputsRef.current[0]?.focus(), 60);
      setLoading(false);
    }
  }, [digits, phone, intendedRole, router, loading]);

  useEffect(() => {
    if (!isComplete || loading) return;
    if (autoSubmittedRef.current === otp) return;
    autoSubmittedRef.current = otp;

    const t = setTimeout(() => {
      handleVerify();
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, otp, loading]);

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      await api.resendVerification(phone);
      if (!isMountedRef.current) return;

      setResentAt(Date.now());
      setResentVisible(true);
      startCountdown();
      setTimeout(() => {
        if (isMountedRef.current) setResentVisible(false);
      }, 4000);

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

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
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

  if (!phone) {
    return (
      <main className="vo-root">
        <style>{PAGE_CSS}</style>
        <div className="vo-card">
          <div className="vo-missingIcon">
            <MdVerifiedUser size={40} color="#0504AA" />
          </div>
          <h1 className="vo-heading">Something&apos;s missing</h1>
          <p className="vo-subtitle">
            We don&apos;t have the phone number to verify. Start over from the
            sign-up page.
          </p>
          <button
            onClick={() => router.replace('/signup')}
            className="vo-primaryBtn"
          >
            Back to sign up
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="vo-root">
      <style>{PAGE_CSS}</style>

      <div className="vo-shell">
        <header className="vo-brandRow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/admerce_symbol.png"
            alt="Admerce"
            className="vo-brandLogo"
          />
          <span className="vo-brandName">Admerce</span>
        </header>

        <div className="vo-card">
          <button
            onClick={() => router.back()}
            className="vo-backBtn"
            aria-label="Back"
          >
            <MdArrowBack size={18} color="#64748B" />
          </button>

          <div className="vo-heroWrap">
            <div className="vo-pulse vo-pulse-1" aria-hidden />
            <div className="vo-pulse vo-pulse-2" aria-hidden />
            <div className="vo-iconCircle">
              <MdVerifiedUser size={36} color="#ffffff" />
            </div>
          </div>

          <h1 className="vo-heading">Verify your account</h1>
          <p className="vo-subtitle">
            Enter the 6-digit code we just sent you.
          </p>

          {/* Where it went — dual-channel pill */}
          {(email || phone) && (
            <div className="vo-channels">
              {email && (
                <span className="vo-channelChip">
                  <MdMailOutline size={13} color="#0504AA" />
                  <span>{maskEmail(email)}</span>
                </span>
              )}
              {phone && (
                <span className="vo-channelChip">
                  <MdPhoneIphone size={13} color="#0504AA" />
                  <span>{maskPhone(phone)}</span>
                </span>
              )}
            </div>
          )}

          <div className="vo-otpGrid" onPaste={handlePaste}>
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
                className="vo-otpBox"
                style={{
                  borderColor: inlineError ? '#FCA5A5' : undefined,
                  backgroundColor: inlineError ? '#FEF2F2' : undefined,
                }}
                aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                disabled={loading}
              />
            ))}
          </div>

          {inlineError && <div className="vo-inlineError">{inlineError}</div>}

          <button
            onClick={handleVerify}
            disabled={loading || !isComplete}
            className="vo-primaryBtn"
            style={{
              opacity: loading || !isComplete ? 0.55 : 1,
              cursor: loading
                ? 'wait'
                : !isComplete
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {loading ? (
              <>
                <span className="vo-spinner" />
                <span>Verifying…</span>
              </>
            ) : (
              <span>Verify</span>
            )}
          </button>

          <div className="vo-resendRow">
            <span className="vo-resendPrompt">Didn&apos;t get the code?</span>
            {countdown > 0 ? (
              <span className="vo-resendCountdown">
                Resend in {countdown}s
              </span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="vo-resendBtn"
                style={{
                  opacity: resending ? 0.6 : 1,
                  cursor: resending ? 'wait' : 'pointer',
                }}
              >
                {resending ? 'Sending…' : 'Resend code'}
              </button>
            )}
          </div>

          {resentVisible && resentAt && (
            <div className="vo-resentChip">
              <MdCheckCircle size={15} color="#065F46" />
              <span>Fresh code sent</span>
            </div>
          )}

          <p className="vo-footer">
            Wrong details?{' '}
            <button
              onClick={() => router.replace('/signup')}
              className="vo-footerLink"
            >
              Start over
            </button>
          </p>
        </div>
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
            backgroundColor: '#F4F5FB',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid #E6E8F0',
              borderTopColor: '#0504AA',
              borderRadius: '50%',
              animation: 'voSpin 0.9s linear infinite',
            }}
          />
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────
const PAGE_CSS = `
  @keyframes voSpin { to { transform: rotate(360deg); } }
  @keyframes voPulse {
    0%   { transform: scale(0.9); opacity: 0.55; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes voRise {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes voFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .vo-root {
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

  .vo-shell {
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    animation: voFadeIn 0.3s ease both;
  }

  .vo-brandRow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    padding-top: 4px;
  }
  .vo-brandLogo {
    width: 34px;
    height: 34px;
    display: block;
    object-fit: contain;
  }
  .vo-brandName {
    font-size: 16px;
    font-weight: 800;
    color: #0B0B1A;
    letter-spacing: -0.02em;
  }

  .vo-card {
    position: relative;
    width: 100%;
    background: #FFFFFF;
    border-radius: 24px;
    padding: 36px 28px 28px;
    box-shadow:
      0 1px 2px rgba(15,23,42,0.03),
      0 8px 28px rgba(15,23,42,0.06);
    border: 1px solid #EEF0F7;
    text-align: center;
  }

  .vo-backBtn {
    position: absolute;
    top: 14px;
    left: 14px;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border: none;
    background: #F6F7FB;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .vo-backBtn:hover { background: #EEF0F7; }

  .vo-heroWrap {
    position: relative;
    width: 74px;
    height: 74px;
    margin: 0 auto 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .vo-iconCircle {
    position: relative;
    width: 74px;
    height: 74px;
    border-radius: 24px;
    background: linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 12px 32px rgba(5,4,170,0.28);
  }
  .vo-pulse {
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
  .vo-pulse-1 { animation: voPulse 2.6s ease-out infinite; }
  .vo-pulse-2 { animation: voPulse 2.6s ease-out infinite; animation-delay: 1.3s; }

  .vo-heading {
    font-size: 24px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.6px;
  }
  .vo-subtitle {
    font-size: 14px;
    color: #5A6178;
    margin: 8px 0 20px;
    line-height: 1.5;
  }

  /* Channel chips — where the code was sent */
  .vo-channels {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-bottom: 22px;
  }
  .vo-channelChip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 11px;
    border-radius: 999px;
    background: #EEF0FF;
    border: 1px solid #C7CCFF;
    color: #0504AA;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.01em;
    font-variant-numeric: tabular-nums;
  }

  .vo-otpGrid {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .vo-otpBox {
    width: 46px;
    height: 56px;
    text-align: center;
    font-size: 22px;
    font-weight: 800;
    color: #0B0B1A;
    border: 1.5px solid #E6E8F0;
    border-radius: 12px;
    background-color: #FAFAFC;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
    font-family: inherit;
    box-sizing: border-box;
    caret-color: #0504AA;
  }
  .vo-otpBox:focus {
    border-color: #0504AA;
    box-shadow: 0 0 0 4px rgba(5,4,170,0.10);
    background-color: #FFFFFF;
  }

  .vo-inlineError {
    font-size: 12.5px;
    color: #991B1B;
    font-weight: 600;
    margin-top: 8px;
    margin-bottom: 4px;
  }

  .vo-primaryBtn {
    width: 100%;
    padding: 16px;
    background-image: linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%);
    background-color: #0504AA;
    color: #fff;
    border: none;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 8px 20px rgba(5,4,170,0.24);
    font-family: inherit;
    letter-spacing: -0.1px;
    transition: transform 0.12s, box-shadow 0.18s, opacity 0.15s;
  }
  .vo-primaryBtn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 26px rgba(5,4,170,0.3);
  }
  .vo-primaryBtn:active:not(:disabled) {
    transform: translateY(0) scale(0.985);
  }

  .vo-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255,255,255,0.35);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: voSpin 0.7s linear infinite;
  }

  .vo-resendRow {
    margin-top: 18px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 13.5px;
    flex-wrap: wrap;
    gap: 4px;
  }
  .vo-resendPrompt { color: #64748B; }
  .vo-resendCountdown {
    color: #94A3B8;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .vo-resendBtn {
    background: none;
    border: none;
    color: #0504AA;
    font-weight: 700;
    cursor: pointer;
    font-size: 13.5px;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 0;
    font-family: inherit;
  }

  .vo-resentChip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 6px 12px;
    border-radius: 999px;
    background-color: #ECFDF5;
    border: 1px solid #A7F3D0;
    animation: voRise 220ms ease-out both;
  }
  .vo-resentChip span {
    font-size: 12px;
    font-weight: 700;
    color: #065F46;
    letter-spacing: 0.2px;
  }

  .vo-footer {
    font-size: 12.5px;
    color: #94A3B8;
    margin: 22px 0 0;
  }
  .vo-footerLink {
    background: none;
    border: none;
    color: #94A3B8;
    font-weight: 700;
    cursor: pointer;
    font-size: 12.5px;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 0;
    font-family: inherit;
  }

  /* Missing-phone guard */
  .vo-missingIcon {
    width: 84px;
    height: 84px;
    border-radius: 26px;
    background: linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
  }

  @media (prefers-reduced-motion: reduce) {
    .vo-pulse { animation: none !important; }
    .vo-resentChip { animation: none !important; }
    .vo-shell { animation: none !important; }
  }
`;