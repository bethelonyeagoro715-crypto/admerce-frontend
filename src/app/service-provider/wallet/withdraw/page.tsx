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
  const [success, setSuccess] = useState<{ tx: string; amount: number } | null>(null);

  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = (await api.getWalletBalance()) as { balance?: number };
      setBalance(Number(data.balance ?? 0));
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer to avoid synchronous setState inside the effect
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const handleWithdraw = async () => {
    setError(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError('Enter a valid amount.');
    if (amt > balance) return setError('Amount exceeds your balance.');
    if (!account.trim()) return setError('Enter a mobile money or bank account number.');
    if (pin.length < 4) return setError('Enter your 4+ digit PIN.');

    setSubmitting(true);
    try {
      const result = (await api.withdraw(amt, method, account.trim(), pin)) as {
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
    if (!/^\d{4,6}$/.test(newPin)) return setError('PIN must be 4–6 digits.');
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
        <div style={css.spinner} />
      </div>
    );
  }

  if (success) {
    return (
      <main style={css.container}>
        <div style={css.successCard}>
          <MdCheckCircle size={64} color="#16A34A" />
          <h2 style={css.successTitle}>Withdrawal on the way</h2>
          <p style={css.successBody}>{fmt(success.amount)} sent to your account.</p>
          <p style={css.successTx}>Ref: {success.tx}</p>
          <button onClick={() => router.back()} style={css.primaryBtn}>
            Done
          </button>
        </div>
      </main>
    );
  }

  if (needsPinSetup) {
    return (
      <main style={css.container}>
        <div style={css.appBar}>
          <button onClick={() => setNeedsPinSetup(false)} style={css.backBtn}>
            <MdArrowBack size={22} color="#1A1A1A" />
          </button>
          <h1 style={css.title}>Set Withdrawal PIN</h1>
          <div style={{ width: 32 }} />
        </div>

        <div style={css.body}>
          <div style={css.iconBadge}>
            <MdLockOutline size={28} color="#0504AA" />
          </div>
          <p style={css.helper}>
            Set a 4–6 digit PIN to protect withdrawals from your wallet.
          </p>

          <label style={css.label}>
            New PIN
            <div style={css.inputWrap}>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                style={css.input}
              />
              <button type="button" onClick={() => setShowPin((s) => !s)} style={css.eyeBtn}>
                {showPin ? (
                  <MdVisibilityOff size={20} color="#888" />
                ) : (
                  <MdVisibility size={20} color="#888" />
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
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              style={{ ...css.input, marginTop: 6, paddingRight: 14 }}
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
      </main>
    );
  }

  return (
    <main style={css.container}>
      <div style={css.appBar}>
        <button onClick={() => router.back()} style={css.backBtn}>
          <MdArrowBack size={22} color="#1A1A1A" />
        </button>
        <h1 style={css.title}>Withdraw</h1>
        <div style={{ width: 32 }} />
      </div>

      <div style={css.body}>
        <div style={css.balanceCard}>
          <MdAccountBalanceWallet size={22} color="#fff" />
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
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              style={{
                ...css.preset,
                backgroundColor: amount === String(p) ? '#0504AA' : '#EEF2FF',
                color: amount === String(p) ? '#fff' : '#0504AA',
              }}
            >
              {fmt(p)}
            </button>
          ))}
        </div>

        <label style={css.label}>
          Destination
          <div style={css.segmented}>
            <button
              onClick={() => setMethod('mobile_money')}
              style={{
                ...css.segmentBtn,
                backgroundColor: method === 'mobile_money' ? '#0504AA' : '#fff',
                color: method === 'mobile_money' ? '#fff' : '#0504AA',
              }}
            >
              Mobile money
            </button>
            <button
              onClick={() => setMethod('bank')}
              style={{
                ...css.segmentBtn,
                backgroundColor: method === 'bank' ? '#0504AA' : '#fff',
                color: method === 'bank' ? '#fff' : '#0504AA',
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
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 08012345678"
            style={{ ...css.input, marginTop: 6, paddingRight: 14 }}
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
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              style={css.input}
            />
            <button type="button" onClick={() => setShowPin((s) => !s)} style={css.eyeBtn}>
              {showPin ? (
                <MdVisibilityOff size={20} color="#888" />
              ) : (
                <MdVisibility size={20} color="#888" />
              )}
            </button>
          </div>
        </label>

        <button onClick={() => setNeedsPinSetup(true)} style={css.linkBtn} type="button">
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
          Withdrawals are usually processed within a few minutes. Mobile money
          arrives instantly; bank transfers may take up to 1 hour.
        </p>
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

const css: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F8F9FA' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  spinner: { width: 40, height: 40, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  appBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#fff', borderBottom: '1px solid #eee' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: 600, color: '#1A1A1A', margin: 0 },
  body: { flex: 1, padding: 20, maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  balanceCard: { display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, #0504AA, #3D3BFF)', marginBottom: 20 },
  balanceMeta: { display: 'flex', flexDirection: 'column' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  balanceValue: { color: '#fff', fontSize: 22, fontWeight: 800 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 14 },
  inputWrap: { position: 'relative', marginTop: 6 },
  input: { width: '100%', padding: '14px 44px 14px 14px', borderRadius: 10, border: '1px solid #E2E8F0', outline: 'none', fontSize: 15, color: '#1A1A1A', backgroundColor: '#fff', boxSizing: 'border-box' },
  inputPrefix: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#0504AA', fontWeight: 700 },
  eyeBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  presets: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  preset: { padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  segmented: { display: 'flex', gap: 8, marginTop: 6 },
  segmentBtn: { flex: 1, padding: '12px 8px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#0504AA', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12 },
  error: { padding: '10px 12px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, color: '#991B1B', fontSize: 13 },
  primaryBtn: { width: '100%', padding: 16, borderRadius: 14, border: 'none', backgroundColor: '#0504AA', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  note: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 16, lineHeight: 1.5 },
  iconBadge: { width: 56, height: 56, borderRadius: '50%', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  helper: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 },
  successCard: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' },
  successTitle: { fontSize: 22, fontWeight: 800, color: '#1A1A1A', marginTop: 16, marginBottom: 8 },
  successBody: { fontSize: 14, color: '#64748B', margin: 0 },
  successTx: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
};

if (typeof document !== 'undefined' && !document.getElementById('withdraw-kf')) {
  const s = document.createElement('style');
  s.id = 'withdraw-kf';
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
}