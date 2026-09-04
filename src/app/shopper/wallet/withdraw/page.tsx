'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../services/api';
import {
  MdArrowBack,
  MdAccountBalance,
  MdLock,
  MdCheckCircle,
} from 'react-icons/md';

interface BalanceResponse {
  balance?: number;
}

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

const fmt = (v: number) =>
  '₦' + v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WithdrawPage() {
  const router = useRouter();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadBalance = async () => {
      setLoading(true);
      try {
        const data = (await api.getWalletBalance()) as BalanceResponse;
        setBalance(data.balance ?? 0);
      } catch {
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };
    loadBalance();
  }, []);

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      alert('Enter a valid amount');
      return;
    }
    if (amt > balance) {
      alert('Insufficient balance');
      return;
    }
    if (accountNumber.trim().length < 10) {
      alert('Enter a valid account number');
      return;
    }
    if (!bankName.trim()) {
      alert('Enter your bank name');
      return;
    }
    if (!pin.trim()) {
      alert('Enter your withdrawal PIN');
      return;
    }

    setWithdrawing(true);
    try {
      await api.withdraw(amt, 'bank_transfer', accountNumber.trim(), pin.trim());
      setSuccess(true);
      setTimeout(() => {
        router.push('/shopper/wallet');
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed';
      if (msg.includes('PIN')) {
        setPinError('Incorrect PIN. Please try again.');
      } else {
        alert(msg);
      }
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div style={css.loadScreen}>
        <div style={css.loadRing} />
        <style>{KF}</style>
      </div>
    );
  }

  return (
    <div style={css.root}>
      <style>{KF}</style>

      {/* Header */}
      <div style={css.hero}>
        <div style={css.topBar}>
          <button style={css.ghostBtn} onClick={() => router.back()} aria-label="Back">
            <MdArrowBack size={22} color="#fff" />
          </button>
          <span style={css.heroTitle}>Withdraw</span>
          <div style={{ width: 22 }} />
        </div>
        <div style={css.balanceBlock}>
          <div style={css.balLabel}>Available Balance</div>
          <div style={css.balValue}>{fmt(balance)}</div>
        </div>
      </div>

      {/* Form sheet */}
      <div style={css.sheet}>
        <h2 style={css.sectionTitle}>Withdraw Funds</h2>
        <p style={css.sectionSub}>Withdraw to your bank account</p>

        {/* Preset amounts */}
        <div style={css.presets}>
          {PRESET_AMOUNTS.map(p => (
            <button
              key={p}
              style={{
                ...css.preset,
                backgroundColor: amount === String(p) ? '#0504AA' : '#EEF2FF',
                color: amount === String(p) ? '#fff' : '#0504AA',
              }}
              onClick={() => setAmount(String(p))}
            >
              {fmt(p)}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div style={css.inputWrap}>
          <span style={css.inputPrefix}>₦</span>
          <input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={css.input}
          />
        </div>

        {/* Bank name */}
        <div style={css.inputWrap}>
          <MdAccountBalance size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <input
            type="text"
            placeholder="Bank Name (e.g., GTBank)"
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            style={css.input}
          />
        </div>

        {/* Account number */}
        <div style={css.inputWrap}>
          <MdAccountBalance size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <input
            type="tel"
            placeholder="Account Number"
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            style={css.input}
            maxLength={10}
          />
        </div>

        {/* PIN */}
        <div style={css.inputWrap}>
          <MdLock size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <input
            type="password"
            placeholder="Withdrawal PIN"
            value={pin}
            onChange={e => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
              setPinError('');
            }}
            style={css.input}
            maxLength={4}
          />
        </div>
        {pinError && <p style={css.errorText}>{pinError}</p>}

        <button onClick={handleWithdraw} style={css.withdrawBtn} disabled={withdrawing}>
          {withdrawing ? 'Processing…' : 'Withdraw'}
        </button>
      </div>

      {/* Success overlay */}
      {success && (
        <div style={css.successOverlay}>
          <div style={css.successCard}>
            <MdCheckCircle size={64} color="#4CDE80" />
            <h2 style={css.successTitle}>Withdrawal Successful</h2>
            <p style={css.successSub}>Your money is on the way 💸</p>
          </div>
        </div>
      )}
    </div>
  );
}

const KF = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

const css: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F0F4FF', fontFamily: 'Inter, system-ui, sans-serif' },
  loadScreen: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0504AA' },
  loadRing: { width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  hero: { backgroundColor: '#0504AA', backgroundImage: 'radial-gradient(ellipse at 80% 20%, #1A0FB8 0%, #0504AA 50%, #03037A 100%)', padding: '0 20px 32px' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 24 },
  ghostBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' },
  heroTitle: { fontSize: 16, fontWeight: 600, color: '#fff' },
  balanceBlock: { marginBottom: 8 },
  balLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  balValue: { fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1 },
  sheet: { flex: 1, backgroundColor: '#fff', borderRadius: '24px 24px 0 0', marginTop: -16, padding: '28px 20px 48px', animation: 'fadeUp 0.25s ease' },
  sectionTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 },
  sectionSub: { fontSize: 13, color: '#94A3B8', margin: '4px 0 20px' },
  presets: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  preset: { padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  inputWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '0 16px', marginBottom: 14, backgroundColor: '#F8FAFF' },
  inputPrefix: { fontSize: 20, fontWeight: 700, color: '#0504AA', marginRight: 8 },
  input: { flex: 1, padding: '14px 0', fontSize: 15, fontWeight: 600, border: 'none', outline: 'none', backgroundColor: 'transparent', color: '#0F172A' },
  errorText: { color: '#DC2626', fontSize: 13, marginBottom: 8 },
  withdrawBtn: { width: '100%', padding: 16, backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3 },
  successOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(3,3,90,0.7)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  successCard: { backgroundColor: '#fff', borderRadius: 24, padding: '40px 32px', textAlign: 'center', animation: 'fadeUp 0.3s ease' },
  successTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '16px 0 4px' },
  successSub: { fontSize: 14, color: '#94A3B8', margin: 0 },
};