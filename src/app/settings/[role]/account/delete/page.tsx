'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../../services/api';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { alertDialog, confirmDialog } from '../../../../../components/ui/dialogs';
import { clear as clearLocalStorage } from '../../../../../services/localStorage';
import { SettingsShell, SettingsSection } from '../../../../../components/settings/SettingsUI';
import {
  MdWarningAmber,
  MdDeleteForever,
  MdCheckCircle,
} from 'react-icons/md';

const CONFIRM_WORD = 'DELETE';

const REASONS = [
  'I don\'t use the app anymore',
  'I have privacy concerns',
  'I found a better alternative',
  'Too many notifications',
  'The app is not working properly',
  'Other',
];

export default function DeleteAccountPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<string>('');
  const [detail, setDetail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}`);
    }
  };

  const deleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) {
      await alertDialog({
        title: 'Text doesn\'t match',
        body: `Please type "${CONFIRM_WORD}" exactly to confirm.`,
        kind: 'danger',
      });
      return;
    }
    const ok = await confirmDialog({
      title: 'Delete account permanently?',
      body: 'This cannot be undone. All your data, orders, and wallet history will be removed.',
      kind: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteAccount({
        reason: reason || null,
        detail: detail.trim() || null,
      });
      clearLocalStorage();
      router.replace('/');
    } catch (err) {
      await alertDialog({
        title: 'Could not delete account',
        body: extractErrorDetail(err, 'Please try again or contact support.'),
        kind: 'danger',
      });
      if (isMountedRef.current) setBusy(false);
    }
  };

  return (
    <SettingsShell title="Delete account" onBack={goBack}>
      <style>{`
        .da-textarea:focus { border-color: #DC2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.10); }
        .da-input:focus { border-color: #DC2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.10); }
      `}</style>

      {/* Warning hero */}
      <div style={css.hero}>
        <div style={css.heroIcon}>
          <MdWarningAmber size={36} color="#991B1B" />
        </div>
        <div style={css.heroTitle}>This action is permanent</div>
        <div style={css.heroSub}>
          Your account, listings, orders, wallet balance, and all history will
          be permanently deleted. This cannot be undone.
        </div>
      </div>

      {/* Step indicator */}
      <div style={css.steps}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={css.stepItem}>
            <div
              style={{
                ...css.stepDot,
                backgroundColor: step >= n ? '#DC2626' : '#E6E8F0',
                color: step >= n ? '#fff' : '#94A3B8',
              }}
            >
              {step > n ? <MdCheckCircle size={14} color="#fff" /> : n}
            </div>
            {n < 3 && (
              <div
                style={{
                  ...css.stepLine,
                  backgroundColor: step > n ? '#DC2626' : '#E6E8F0',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <SettingsSection
          label="Step 1 — Tell us why"
          footer="Your feedback helps us improve. This is optional."
        >
          <div style={css.reasonsWrap}>
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setReason(r);
                  setStep(2);
                }}
                style={{
                  ...css.reasonBtn,
                  borderColor: reason === r ? '#DC2626' : '#E6E8F0',
                  backgroundColor: reason === r ? '#FEF2F2' : '#FFFFFF',
                }}
              >
                <span style={css.reasonText}>{r}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setReason('');
              setStep(2);
            }}
            style={css.skipBtn}
          >
            Skip and continue
          </button>
        </SettingsSection>
      )}

      {step === 2 && (
        <SettingsSection
          label="Step 2 — Anything else to tell us?"
          footer="Optional. You can leave this blank."
        >
          <div style={css.textareaWrap}>
            <textarea
              className="da-textarea"
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 500))}
              placeholder="Tell us more (optional)"
              rows={5}
              style={css.textarea}
            />
            <div style={css.charCount}>{detail.length}/500</div>
          </div>
          <div style={css.stepActions}>
            <button onClick={() => setStep(1)} style={css.secondary}>
              Back
            </button>
            <button onClick={() => setStep(3)} style={css.primaryDanger}>
              Continue
            </button>
          </div>
        </SettingsSection>
      )}

      {step === 3 && (
        <SettingsSection
          label="Step 3 — Confirm deletion"
          footer={`Type ${CONFIRM_WORD} to confirm. This is your final warning.`}
        >
          <div style={css.confirmWrap}>
            <label style={css.fieldLabel}>
              Type <strong style={{ color: '#DC2626' }}>{CONFIRM_WORD}</strong>{' '}
              to confirm
            </label>
            <input
              className="da-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoCapitalize="characters"
              spellCheck={false}
              style={css.input}
            />
          </div>

          <div style={css.stepActions}>
            <button
              onClick={() => setStep(2)}
              style={css.secondary}
              disabled={busy}
            >
              Back
            </button>
            <button
              onClick={deleteAccount}
              disabled={
                busy ||
                confirmText.trim().toUpperCase() !== CONFIRM_WORD
              }
              style={{
                ...css.dangerBtn,
                opacity:
                  busy || confirmText.trim().toUpperCase() !== CONFIRM_WORD
                    ? 0.5
                    : 1,
                cursor:
                  busy || confirmText.trim().toUpperCase() !== CONFIRM_WORD
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              <MdDeleteForever size={18} color="#fff" />
              <span>{busy ? 'Deleting…' : 'Delete my account'}</span>
            </button>
          </div>
        </SettingsSection>
      )}

      <div style={css.altPath}>
        <strong style={css.altPathTitle}>Not sure?</strong>
        <p style={css.altPathBody}>
          You can pause notifications or log out without deleting your
          account. If you need help first, contact support from the Help
          Center.
        </p>
      </div>
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
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    textAlign: 'center',
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#991B1B',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 1.55,
    maxWidth: 340,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    padding: '4px 20px',
  },
  stepItem: { display: 'flex', alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    transition: 'background-color 0.2s',
  },
  stepLine: {
    width: 40,
    height: 2,
    margin: '0 4px',
    transition: 'background-color 0.2s',
  },
  reasonsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 16px',
  },
  reasonBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderRadius: 14,
    border: '1.5px solid #E6E8F0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  reasonText: { fontSize: 14.5, color: '#0B0B1A', fontWeight: 600 },
  skipBtn: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'transparent',
    color: '#64748B',
    border: 'none',
    borderTop: '1px solid #F1F5F9',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  textareaWrap: { padding: '14px 16px', position: 'relative' },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 500,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.5,
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  charCount: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
    fontVariantNumeric: 'tabular-nums',
  },
  stepActions: {
    display: 'flex',
    gap: 10,
    padding: '0 16px 16px',
  },
  secondary: {
    flex: 1,
    padding: 14,
    backgroundColor: 'transparent',
    color: '#475569',
    border: '1.5px solid #E6E8F0',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryDanger: {
    flex: 1,
    padding: 14,
    backgroundColor: '#DC2626',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmWrap: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  fieldLabel: { fontSize: 13, color: '#334155', fontWeight: 600 },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    fontWeight: 700,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    outline: 'none',
    letterSpacing: 1,
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  dangerBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#DC2626',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(220,38,38,0.24)',
  },
  altPath: {
    padding: '14px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #EAECF3',
  },
  altPathTitle: {
    display: 'block',
    fontSize: 13,
    color: '#0B0B1A',
    marginBottom: 4,
  },
  altPathBody: {
    fontSize: 12.5,
    color: '#64748B',
    margin: 0,
    lineHeight: 1.55,
  },
};