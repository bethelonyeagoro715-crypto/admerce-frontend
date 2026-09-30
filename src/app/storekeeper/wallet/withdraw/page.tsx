'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../services/api';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import {
  MdArrowBack,
  MdAccountBalanceWallet,
  MdCheckCircle,
  MdLockOutline,
  MdVisibility,
  MdVisibilityOff,
} from 'react-icons/md';

type Method = 'mobile_money' | 'bank';

const PRESETS = [1000, 5000, 10000, 20000, 50000, 100000];

function fmt(v: number) {
  return '₦' + v.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export default function WithdrawPage() {
  useAuthGuard();
  const router = useRouter();

  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('mobile_money');
  const [account, setAccount] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    tx: string;
    amount: number;
  } | null>(null);

  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = (await api.getWalletBalance()) as {
        balance?: number;
      };
      setBalance(Number(data.balance ?? 0));
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const handleWithdraw = async () => {
    setError(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError('Enter a valid amount.');
    if (amt > balance)
      return setError('Amount exceeds your balance.');
    if (!account.trim())
      return setError('Enter a mobile money or bank account number.');
    if (pin.length < 4) return setError('Enter your 4+ digit PIN.');

    setSubmitting(true);
    try {
      const result = (await api.withdraw(
        amt,
        method,
        account.trim(),
        pin,
      )) as {
        transaction_id?: string;
        new_balance?: number;
        message?: string;
      };
      setSuccess({ tx: result.transaction_id || '—', amount: amt });
      setPin('');
      setAmount('');
      await load();
    } catch (e: unknown) {
      const msg = extractErrorMessage(e);
      if (msg.toLowerCase().includes('pin not set')) {
        setNeedsPinSetup(true);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePin = async () => {
    setError(null);
    if (!/^\d{4,6}$/.test(newPin))
      return setError('PIN must be 4–6 digits.');
    if (newPin !== confirmPin) return setError('PINs do not match.');

    setSavingPin(true);
    try {
      await api.setWithdrawalPin(newPin);
      setNeedsPinSetup(false);
      setNewPin('');
      setConfirmPin('');
      setError(null);
    } catch (e: unknown) {
      setError(extractErrorMessage(e));
    } finally {
      setSavingPin(false);
    }
  };

  const canSubmit =
    !submitting &&
    !!amount &&
    !!account.trim() &&
    pin.length >= 4 &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= balance;

  if (loading) {
    return (
      <div style={css.center}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={css.spinner} />
      </div>
    );
  }

  if (success) {
    return (
      <main style={css.container}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <style>{SHELL_CSS}</style>
        <div className="wd-shell">
          <div style={css.successCard}>
            <MdCheckCircle size={64} color="var(--success-fg)" />
            <h2 style={css.successTitle}>
              Withdrawal on the way
            </h2>
            <p style={css.successBody}>
              {fmt(success.amount)} sent to your account.
            </p>
            <p style={css.successTx}>Ref: {success.tx}</p>
            <button
              onClick={() => router.back()}
              style={css.primaryBtn}
            >
              Done
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (needsPinSetup) {
    return (
      <main style={css.container}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <style>{SHELL_CSS}</style>
        <div className="wd-shell">
          <div style={css.appBar}>
            <button
              onClick={() => setNeedsPinSetup(false)}
              style={css.backBtn}
            >
              <MdArrowBack
                size={22}
                color="var(--text-primary)"
              />
            </button>
            <h1 style={css.title}>Set Withdrawal PIN</h1>
            <div style={{ width: 32 }} />
          </div>

          <div style={css.body}>
            <div style={css.iconBadge}>
              <MdLockOutline size={28} color="var(--brand-primary)" />
            </div>
            <p style={css.helper}>
              Set a 4–6 digit PIN to protect withdrawals from your
              wallet.
            </p>

            <label style={css.label}>
              New PIN
              <div style={css.inputWrap}>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="••••"
                  style={css.input}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  style={css.eyeBtn}
                >
                  {showPin ? (
                    <MdVisibilityOff
                      size={20}
                      color="var(--text-tertiary)"
                    />
                  ) : (
                    <MdVisibility
                      size={20}
                      color="var(--text-tertiary)"
                    />
                  )}
                </button>
              </div>
            </label>

            <label style={css.label}>
              Confirm PIN
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/\D/g, ''))
                }
                placeholder="••••"
                style={{
                  ...css.input,
                  marginTop: 6,
                  paddingRight: 14,
                }}
              />
            </label>

            {error && <div style={css.error}>{error}</div>}

            <button
              onClick={handleSavePin}
              disabled={savingPin || newPin.length < 4}
              style={{
                ...css.primaryBtn,
                marginTop: 16,
                opacity: savingPin || newPin.length < 4 ? 0.5 : 1,
              }}
            >
              {savingPin ? 'Saving…' : 'Save PIN'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={css.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <style>{SHELL_CSS}</style>
      <div className="wd-shell">
        <div style={css.appBar}>
          <button onClick={() => router.back()} style={css.backBtn}>
            <MdArrowBack size={22} color="var(--text-primary)" />
          </button>
          <h1 style={css.title}>Withdraw</h1>
          <div style={{ width: 32 }} />
        </div>

        <div style={css.body}>
          <div style={css.balanceCard}>
            <MdAccountBalanceWallet
              size={22}
              color="var(--brand-on-gradient)"
            />
            <div style={css.balanceMeta}>
              <span style={css.balanceLabel}>Available</span>
              <span style={css.balanceValue}>{fmt(balance)}</span>
            </div>
          </div>

          <label style={css.label}>
            Amount
            <div style={css.inputWrap}>
              <span style={css.inputPrefix}>₦</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                style={css.input}
              />
            </div>
          </label>

          <div style={css.presets}>
            {PRESETS.map((p) => {
              const active = amount === String(p);
              return (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  style={{
                    ...css.preset,
                    background: active
                      ? 'var(--brand-gradient)'
                      : 'var(--brand-soft)',
                    color: active
                      ? 'var(--brand-on-gradient)'
                      : 'var(--brand-primary)',
                  }}
                >
                  {fmt(p)}
                </button>
              );
            })}
          </div>

          <label style={css.label}>
            Destination
            <div style={css.segmented}>
              <button
                onClick={() => setMethod('mobile_money')}
                style={{
                  ...css.segmentBtn,
                  background:
                    method === 'mobile_money'
                      ? 'var(--brand-gradient)'
                      : 'var(--bg-secondary)',
                  color:
                    method === 'mobile_money'
                      ? 'var(--brand-on-gradient)'
                      : 'var(--brand-primary)',
                  borderColor:
                    method === 'mobile_money'
                      ? 'transparent'
                      : 'var(--border-default)',
                }}
              >
                Mobile money
              </button>
              <button
                onClick={() => setMethod('bank')}
                style={{
                  ...css.segmentBtn,
                  background:
                    method === 'bank'
                      ? 'var(--brand-gradient)'
                      : 'var(--bg-secondary)',
                  color:
                    method === 'bank'
                      ? 'var(--brand-on-gradient)'
                      : 'var(--brand-primary)',
                  borderColor:
                    method === 'bank'
                      ? 'transparent'
                      : 'var(--border-default)',
                }}
              >
                Bank account
              </button>
            </div>
          </label>

          <label style={css.label}>
            Account number
            <input
              type="text"
              inputMode="numeric"
              value={account}
              onChange={(e) =>
                setAccount(e.target.value.replace(/\D/g, ''))
              }
              placeholder="e.g. 08012345678"
              style={{
                ...css.input,
                marginTop: 6,
                paddingRight: 14,
              }}
            />
          </label>

          <label style={css.label}>
            Withdrawal PIN
            <div style={css.inputWrap}>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, ''))
                }
                placeholder="••••"
                style={css.input}
              />
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                style={css.eyeBtn}
              >
                {showPin ? (
                  <MdVisibilityOff
                    size={20}
                    color="var(--text-tertiary)"
                  />
                ) : (
                  <MdVisibility
                    size={20}
                    color="var(--text-tertiary)"
                  />
                )}
              </button>
            </div>
          </label>

          <button
            onClick={() => setNeedsPinSetup(true)}
            style={css.linkBtn}
            type="button"
          >
            Forgot PIN? Reset it
          </button>

          {error && <div style={css.error}>{error}</div>}

          <button
            onClick={handleWithdraw}
            disabled={!canSubmit}
            style={{
              ...css.primaryBtn,
              marginTop: 16,
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Processing…' : 'Withdraw'}
          </button>

          <p style={css.note}>
            Withdrawals are usually processed within a few minutes.
            Mobile money arrives instantly; bank transfers may take
            up to 1 hour.
          </p>
        </div>
      </div>
    </main>
  );
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as {
      response?: { data?: { detail?: unknown } };
      message?: unknown;
    };
    const d = e.response?.data?.detail;
    if (typeof d === 'string') return d;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Withdrawal failed. Please try again.';
}

const SHELL_CSS = `
  .wd-shell {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
`;

const css: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  appBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  body: {
    flex: 1,
    padding: 20,
    width: '100%',
    boxSizing: 'border-box',
  },
  balanceCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    background: 'var(--brand-gradient)',
    marginBottom: 20,
    boxShadow: 'var(--shadow-brand)',
  },
  balanceMeta: { display: 'flex', flexDirection: 'column' },
  balanceLabel: {
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 70%, transparent)',
    fontSize: 12,
  },
  balanceValue: {
    color: 'var(--brand-on-gradient)',
    fontSize: 22,
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 14,
  },
  inputWrap: { position: 'relative', marginTop: 6 },
  input: {
    width: '100%',
    padding: '14px 44px 14px 14px',
    borderRadius: 10,
    border: '1px solid var(--border-default)',
    outline: 'none',
    fontSize: 15,
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-tertiary)',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  inputPrefix: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--brand-primary)',
    fontWeight: 700,
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
  },
  presets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  preset: {
    padding: '8px 14px',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  segmented: { display: 'flex', gap: 8, marginTop: 6 },
  segmentBtn: {
    flex: 1,
    padding: '12px 8px',
    borderRadius: 10,
    border: '1px solid',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--brand-primary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    marginBottom: 12,
    fontFamily: 'inherit',
  },
  error: {
    padding: '10px 12px',
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-strong)',
    borderRadius: 10,
    color: 'var(--danger-fg)',
    fontSize: 13,
  },
  primaryBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    border: 'none',
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  note: {
    fontSize: 12,
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 1.5,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    backgroundColor: 'var(--brand-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
  },
  helper: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 1.5,
  },
  successCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    textAlign: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginTop: 16,
    marginBottom: 8,
  },
  successBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
    margin: 0,
  },
  successTx: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 4,
  },
};