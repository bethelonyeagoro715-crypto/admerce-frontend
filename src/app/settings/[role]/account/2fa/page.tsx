'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../../services/api';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { alertDialog, confirmDialog } from '../../../../../components/ui/dialogs';
import {
  SettingsShell,
  SettingsSection,
  SettingsRow,
} from '../../../../../components/settings/SettingsUI';
import PhoneField from '../../../../../components/ui/PhoneField';
import {
  MdSecurity,
  MdCheckCircle,
  MdClose,
  MdSms,
  MdEmail,
  MdVerifiedUser,
} from 'react-icons/md';

type Method = 'sms' | 'email';
type Stage = 'choose' | 'code';

export default function TwoFactorPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('choose');
  const [chosen, setChosen] = useState<Method>('sms');
  const [phone, setPhone] = useState('');
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
      const s = (await api.getSettings(role)) as Record<string, unknown>;
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setEnabled((s.two_factor_enabled as boolean) ?? false);
      setMethod((s.two_factor_method as Method) ?? null);
      setMaskedTarget((s.two_factor_target as string) ?? null);
    } catch {
      // Silent
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, [role]);

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

  const openSetup = () => {
    setSheetOpen(true);
    setStage('choose');
    setChosen('sms');
    setPhone('');
    setCode('');
    setError(null);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setError(null);
  };

  const sendCode = async () => {
    setError(null);
    if (chosen === 'sms' && (!phone.trim() || !phone.startsWith('+'))) {
      setError('Enter a valid phone number with country code');
      return;
    }
    setBusy(true);
    try {
      await api.start2FA(chosen, chosen === 'sms' ? phone : undefined);
      setStage('code');
      setCode('');
    } catch (err) {
      await alertDialog({
        title: 'Could not start setup',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.verify2FA(chosen, code, chosen === 'sms' ? phone : undefined);
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

  const disable = async () => {
    const ok = await confirmDialog({
      title: 'Turn off 2FA?',
      body: 'Your account will be less secure. You can turn it back on anytime.',
      kind: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.disable2FA();
      await load();
    } catch (err) {
      await alertDialog({
        title: 'Could not disable',
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  if (loading) {
    return (
      <SettingsShell title="Two-factor authentication" onBack={goBack}>
        <div style={css.skeleton} />
      </SettingsShell>
    );
  }

  const methodLabel =
    method === 'sms' ? 'Text message (SMS)' : method === 'email' ? 'Email' : '—';

  return (
    <SettingsShell title="Two-factor authentication" onBack={goBack}>
      {/* Status hero */}
      <div
        style={{
          ...css.hero,
          backgroundImage: enabled
            ? 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)'
            : 'linear-gradient(135deg, #64748B 0%, #94A3B8 100%)',
        }}
      >
        <div style={css.heroIconWrap}>
          {enabled ? (
            <MdVerifiedUser size={36} color="#fff" />
          ) : (
            <MdSecurity size={36} color="#fff" />
          )}
        </div>
        <div style={css.heroTitle}>
          {enabled ? 'Two-factor is on' : 'Two-factor is off'}
        </div>
        <div style={css.heroSub}>
          {enabled
            ? 'You will be asked for a code when signing in from a new device.'
            : 'Add a second layer of security to your account.'}
        </div>
      </div>

      {enabled ? (
        <SettingsSection label="Current method">
          <SettingsRow
            icon={
              method === 'sms' ? (
                <MdSms size={18} color="#0891B2" />
              ) : (
                <MdEmail size={18} color="#7E22CE" />
              )
            }
            iconBg={method === 'sms' ? '#E0F2FE' : '#F3E8FF'}
            label={methodLabel}
            value={maskedTarget || ''}
            onClick={openSetup}
          />
          <SettingsRow
            icon={<MdClose size={18} color="#DC2626" />}
            iconBg="#FEE2E2"
            label="Turn off two-factor"
            danger
            onClick={disable}
          />
        </SettingsSection>
      ) : (
        <SettingsSection label="Enable protection">
          <SettingsRow
            icon={<MdSecurity size={18} color="#0504AA" />}
            iconBg="#EEF0FF"
            label="Set up two-factor"
            subtitle="SMS or email"
            onClick={openSetup}
          />
        </SettingsSection>
      )}

      <SettingsSection label="How it works">
        <div style={css.helpItem}>
          <span style={css.helpNum}>1</span>
          <span style={css.helpText}>
            Enter your password when signing in from a new device.
          </span>
        </div>
        <div style={css.helpItem}>
          <span style={css.helpNum}>2</span>
          <span style={css.helpText}>
            We&apos;ll send a 6-digit code via your chosen method.
          </span>
        </div>
        <div style={css.helpItem}>
          <span style={css.helpNum}>3</span>
          <span style={css.helpText}>
            Enter the code to finish signing in.
          </span>
        </div>
      </SettingsSection>

      {sheetOpen && (
        <div style={css.overlay} onClick={closeSheet}>
          <div style={css.sheet} onClick={(e) => e.stopPropagation()}>
            <button onClick={closeSheet} style={css.close} aria-label="Close">
              <MdClose size={20} color="#64748B" />
            </button>

            {stage === 'choose' ? (
              <>
                <h3 style={css.title}>
                  {enabled ? 'Change method' : 'Set up two-factor'}
                </h3>
                <p style={css.sub}>
                  Choose how you want to receive your verification code.
                </p>

                <button
                  onClick={() => setChosen('sms')}
                  style={{
                    ...css.methodBtn,
                    borderColor: chosen === 'sms' ? '#0504AA' : '#E6E8F0',
                    backgroundColor:
                      chosen === 'sms' ? '#EEF0FF' : '#FFFFFF',
                  }}
                >
                  <span style={css.methodIcon}>
                    <MdSms size={20} color="#0504AA" />
                  </span>
                  <span style={css.methodText}>
                    <span style={css.methodLabel}>Text message (SMS)</span>
                    <span style={css.methodSub}>
                      Fastest — code arrives in seconds
                    </span>
                  </span>
                  {chosen === 'sms' && (
                    <MdCheckCircle size={20} color="#0504AA" />
                  )}
                </button>

                <button
                  onClick={() => setChosen('email')}
                  style={{
                    ...css.methodBtn,
                    borderColor: chosen === 'email' ? '#0504AA' : '#E6E8F0',
                    backgroundColor:
                      chosen === 'email' ? '#EEF0FF' : '#FFFFFF',
                  }}
                >
                  <span style={css.methodIcon}>
                    <MdEmail size={20} color="#0504AA" />
                  </span>
                  <span style={css.methodText}>
                    <span style={css.methodLabel}>Email</span>
                    <span style={css.methodSub}>
                      Uses the email on your account
                    </span>
                  </span>
                  {chosen === 'email' && (
                    <MdCheckCircle size={20} color="#0504AA" />
                  )}
                </button>

                {chosen === 'sms' && (
                  <div style={{ ...css.field, marginTop: 12 }}>
                    <label style={css.fieldLabel}>Phone number</label>
                    <PhoneField value={phone} onChange={setPhone} />
                  </div>
                )}

                {error && <span style={css.fieldError}>{error}</span>}

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
                  Sent to{' '}
                  <strong style={{ color: '#0B0B1A' }}>
                    {chosen === 'sms' ? phone : 'your email'}
                  </strong>
                </p>

                <div style={css.otpRow}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={code[i] || ''}
                      onChange={(e) => {
                        const ch = e.target.value.replace(/\D/g, '').slice(-1);
                        const next = code.padEnd(6, ' ').split('');
                        next[i] = ch || ' ';
                        setCode(next.join('').trimEnd().replace(/\s/g, ''));
                      }}
                      style={css.otpBox}
                    />
                  ))}
                </div>

                {error && <span style={css.fieldError}>{error}</span>}

                <button
                  onClick={verify}
                  disabled={busy || code.length !== 6}
                  style={{
                    ...css.primary,
                    opacity: busy || code.length !== 6 ? 0.5 : 1,
                  }}
                >
                  {busy ? 'Verifying…' : 'Turn on two-factor'}
                </button>

                <button
                  onClick={() => setStage('choose')}
                  disabled={busy}
                  style={css.secondary}
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </SettingsShell>
  );
}

const css: Record<string, React.CSSProperties> = {
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '22px 20px',
    borderRadius: 20,
    color: '#fff',
    boxShadow: '0 12px 30px rgba(5,4,170,0.16)',
  },
  heroIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 1.5,
  },
  helpItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid #F1F5F9',
  },
  helpNum: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  helpText: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 1.5,
    paddingTop: 2,
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
  sub: { fontSize: 13, color: '#64748B', margin: '0 0 18px', lineHeight: 1.5 },
  methodBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: '1.5px solid #E6E8F0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    marginBottom: 10,
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodText: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  methodLabel: { fontSize: 14.5, fontWeight: 700, color: '#0B0B1A' },
  methodSub: { fontSize: 12, color: '#94A3B8' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#334155',
    letterSpacing: 0.1,
  },
  fieldError: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: 600,
    display: 'block',
    marginTop: 4,
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
    marginTop: 8,
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
  skeleton: {
    height: 200,
    borderRadius: 18,
    backgroundColor: '#EAECF3',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};