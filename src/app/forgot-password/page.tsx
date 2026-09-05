'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '../../services/api';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone.trim()) {
      alert('Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(phone.trim());
      alert('OTP sent to your phone');
      router.push(`/verify-otp?phone=${encodeURIComponent(phone.trim())}`);
    } catch (err) {
      alert('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Forgot Password</h1>
        <p style={styles.subtitle}>Enter your phone number to receive an OTP</p>
        <input
          style={styles.input}
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
        />
        <button style={styles.button} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Sending...' : 'Send OTP'}
        </button>
        <button style={styles.backButton} onClick={() => router.back()}>
          Back to Login
        </button>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#F8F9FA',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: '#1A1A1A',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    width: '100%',
    padding: 14,
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 12,
  },
  backButton: {
    width: '100%',
    padding: 14,
    backgroundColor: 'transparent',
    color: '#0504AA',
    border: '1px solid #0504AA',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};