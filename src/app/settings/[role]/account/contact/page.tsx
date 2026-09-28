'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../../services/api';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { alertDialog } from '../../../../../components/ui/dialogs';
import {
  SettingsShell,
  SettingsSection,
  SettingsRow,
} from '../../../../../components/settings/SettingsUI';
import PhoneField from '../../../../../components/ui/PhoneField';
import {
  MdPhone,
  MdEmail,
  MdClose,
  MdVerified,
  MdChevronRight,
  MdInfo,
} from 'react-icons/md';

interface Profile {
  phone?: string;
  email?: string;
  phone_verified?: boolean;
  email_verified?: boolean;
  [key: string]: unknown;
}

type Kind = 'phone' | 'email';
type Stage = 'input' | 'code';

export default function ContactPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Sheet state
  const [open, setOpen] = useState<Kind | null>(null);
  const [stage, setStage] = useState<Stage>('input');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const p = (await api.getMyProfile()) as Profile;
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setProfile(p);
    } catch (err) {
      if (seq === reqSeq.current && isMountedRef.current) {
        await alertDialog({
          title: 'Could not load',
          body: extractErrorDetail(err, 'Please try again.'),
          kind: 'danger',
        });
      }
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}`);
    }
  };

  const openSheet = (kind: Kind) => {
    setOpen(kind);
    setStage('input');
    setPhone('');
    setEmail('');
    setCode('');
    setError(null);
  };

  const closeSheet = () => {
    setOpen(null);
    setStage('input');
    setError(null);
  };

  const validateInput = (): boolean => {
    setError(null);
    if (open === 'phone') {
      if (!phone.trim() || !phone.startsWith('+')) {
        setError('Enter a valid phone number with country code');
        return false;
      }
      if (phone === profile?.phone) {
        setError('That is already your current number');
        return false;
      }
    }
    if (open === 'email') {
      const v = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        setError('Enter a valid email address');
        return false;
      }
      if (v === (profile?.email || '').toLowerCase()) {
        setError('That is already your current email');
        return false;
      }
    }
    return true;
  };

  const sendCode = async () => {
    if (!open || !validateInput()) return;
    setBusy(true);
    try {
      if (open === 'phone') {
        await api.requestPhoneChange(phone);
      } else {
        await api.requestEmailChange(email.trim().toLowerCase());
      }
      setStage('code');
      setCode('');
    } catch (err) {
      await alertDialog({
        title: 'Could not send code',
        body: extractErrorDetail(err, 'Please try again in a moment.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!open) return;
    if (code.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (open === 'phone') {
        await api.confirmPhoneChange(phone, code);
      } else {
        await api.confirmEmailChange(email.trim().toLowerCase(), code);
      }
      closeSheet();
      await load();
    } catch (err) {
      await alertDialog({
        title: 'Could not verify',
        body: extractErrorDetail(err, 'The code may be wrong or expired.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  if (loading) {
    return (
      <SettingsShell title="Phone & email" onBack={goBack}>
        {[0, 1].map((i) => (
          <div key={i} style={css.skeleton} />
        ))}
      </SettingsShell>
    );
  }

  const phoneVal = profile?.phone || '';
  const emailVal = profile?.email || '';
  const phoneVerified = profile?.phone_verified === true;
  const emailVerified = profile?.email_verified === true;

  return (
    <SettingsShell title="Phone & email" onBack={goBack}>
      <style>{`
        .cc-input:focus { border-color: #0504AA; box-shadow: 0 0 0 3px rgba(5,4,170,0.10); }
      `}</style>

      <SettingsSection
        label="Contact methods"
        footer="We use these to sign you in, send receipts, and reach you about deliveries."
      >
        <SettingsRow
          icon={<MdPhone size={18} color="#0891B2" />}
          iconBg="#E0F2FE"
          label="Phone number"
          subtitle={phoneVerified ? 'Verified' : 'Not verified'}
          value={phoneVal || 'Not set'}
          onClick={() => openSheet('phone')}
        />
        <SettingsRow
          icon={<MdEmail size={18} color="#7E22CE" />}
          iconBg="#F3E8FF"
          label="Email address"
          subtitle={emailVerified ? 'Verified' : 'Not verified'}
          value={emailVal || 'Not set'}
          onClick={() => openSheet('email')}
        />
      </SettingsSection>

      <div style={css.notice}>
        <MdInfo size={16} color="#0891B2" />
        <span>
          Changing your phone or email requires a 6-digit code sent to the new
          value.
        </span>
      </div>

      {open && (
        <div style={css.overlay} onClick={closeSheet}>
          <div style={css.sheet} onClick={(e) => e.stopPropagation()}>
            <button onClick={closeSheet} style={css.close} aria-label="Close">
              <MdClose size={20} color="#64748B" />
            </button>

            {stage === 'input' ? (
              <>
                <h3 style={css.title}>
                  Change {open === 'phone' ? 'phone number' : 'email address'}
                </h3>
                <p style={css.sub}>
                  We&apos;ll send a 6-digit code to your new{' '}
                  {open === 'phone' ? 'number' : 'email'} to confirm.
                </p>

                {open === 'phone' ? (
                  <div style={css.field}>
                    <label style={css.fieldLabel}>New phone number</label>
                    <PhoneField
                      id="new-phone"
                      value={phone}
                      onChange={setPhone}
                    />
                    {error && <span style={css.fieldError}>{error}</span>}
                  </div>
                ) : (
                  <div style={css.field}>
                    <label style={css.fieldLabel}>New email address</label>
                    <input
                      className="cc-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      style={{
                        ...css.input,
                        borderColor: error ? '#FCA5A5' : '#E6E8F0',
                      }}
                    />
                    {error && <span style={css.fieldError}>{error}</span>}
                  </div>
                )}

                <button
                  onClick={sendCode}
                  disabled={busy}
                  style={{ ...css.primary, opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? 'Sending…' : 'Send code'}
                </button>
              </>
            ) : (
              <>
                <h3 style={css.title}>Enter the 6-digit code</h3>
                <p style={css.sub}>
                  We sent a code to{' '}
                  <strong style={{ color: '#0B0B1A' }}>
                    {open === 'phone' ? phone : email.trim()}
                  </strong>
                </p>

                <OtpInput value={code} onChange={setCode} />

                {error && (
                  <span style={{ ...css.fieldError, marginTop: 8 }}>
                    {error}
                  </span>
                )}

                <button
                  onClick={verifyCode}
                  disabled={busy || code.length !== 6}
                  style={{
                    ...css.primary,
                    opacity: busy || code.length !== 6 ? 0.5 : 1,
                  }}
                >
                  {busy ? 'Verifying…' : 'Verify and save'}
                </button>

                <button
                  onClick={() => setStage('input')}
                  disabled={busy}
                  style={css.secondary}
                >
                  Use a different {open === 'phone' ? 'number' : 'email'}
                </button>

                <button
                  onClick={sendCode}
                  disabled={busy}
                  style={css.linkBtn}
                >
                  Resend code
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </SettingsShell>
  );
}

function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  const handle = (i: number, raw: string) => {
    const ch = raw.replace(/\D/g, '').slice(-1);
    const next = value.padEnd(6, ' ').split('');
    next[i] = ch || ' ';
    const joined = next.join('').replace(/\s+$/g, '');
    onChange(joined.replace(/\s/g, ''));
    if (ch && i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <div style={css.otpRow}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="cc-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => handle(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          style={css.otpBox}
        />
      ))}
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  notice: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    padding: '12px 14px',
    backgroundColor: '#ECFEFF',
    border: '1px solid #A5F3FC',
    borderRadius: 14,
    fontSize: 12.5,
    color: '#155E75',
    lineHeight: 1.5,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.48)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#fff',
    borderRadius: '24px 24px 0 0',
    padding: '24px 22px calc(28px + env(safe-area-inset-bottom))',
    boxShadow: '0 -8px 40px rgba(5,4,170,0.2)',
    position: 'relative',
    maxHeight: '92vh',
    overflowY: 'auto',
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: '0 0 6px',
    letterSpacing: -0.3,
  },
  sub: { fontSize: 13, color: '#64748B', margin: '0 0 20px', lineHeight: 1.5 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#334155',
    letterSpacing: 0.1,
  },
  fieldError: { fontSize: 12, color: '#DC2626', fontWeight: 600 },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    fontWeight: 500,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  otpRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpBox: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: 22,
    fontWeight: 800,
    color: '#0B0B1A',
    textAlign: 'center',
    fontFamily: 'inherit',
    outline: 'none',
    padding: 0,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  primary: {
    width: '100%',
    padding: 16,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 10px 24px rgba(5,4,170,0.24)',
    marginTop: 4,
  },
  secondary: {
    width: '100%',
    padding: 14,
    backgroundColor: 'transparent',
    color: '#0504AA',
    border: '1.5px solid #E6E8F0',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 10,
  },
  linkBtn: {
    width: '100%',
    padding: 12,
    backgroundColor: 'transparent',
    color: '#64748B',
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 4,
  },
  skeleton: {
    height: 140,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};