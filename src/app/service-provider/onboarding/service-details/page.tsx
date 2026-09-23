'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { extractErrorDetail } from '../../../../services/api';
import { MdArrowBack, MdStorefront, MdInfoOutline } from 'react-icons/md';
import {
  setOnboardingStatus,
  setActiveRole,
} from '../../../../services/localStorage';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

export default function ServiceProviderOnboardingBusinessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fullName = searchParams.get('fullName') || '';

  const [businessName, setBusinessName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFinish = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const trimmedBusiness = businessName.trim();
      const displayName = fullName.trim() || 'Service Provider';

      // 1. Persist the provider's business name (only if they typed one).
      if (trimmedBusiness) {
        try {
          await api.updateProviderProfile(displayName, trimmedBusiness);
        } catch (err) {
          // Non-fatal — provider can edit from profile later.
          console.warn('Business name save failed:', extractErrorDetail(err, 'unknown'));
        }
      }

      // 2. Record the role on the backend. Underscore matches the rest of the
      //    backend (services.py, wallet.py, etc. all use 'service_provider').
      //    This is what makes the role_onboardings row exist — so deleting
      //    services later doesn't un-onboard the provider.
      try {
        await api.completeOnboarding('service_provider');
      } catch (err) {
        // Fatal — without this row the provider will bounce back to onboarding.
        alert(
          'Could not save your provider account: ' +
            extractErrorDetail(err, 'Please try again.'),
        );
        setIsLoading(false);
        return;
      }

      // 3. Frontend guards (localStorage) use the hyphen form to match the
      //    route segment /service-provider/*.
      setOnboardingStatus('service-provider', true);
      setActiveRole('service-provider');

      router.replace('/service-provider/home');
    } catch (err) {
      alert('Unexpected error: ' + extractErrorDetail(err, 'Please try again.'));
      setIsLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          <MdArrowBack size={24} color="#000" />
        </button>
        <h1 style={styles.headerTitle}>Your Business</h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={styles.scrollArea}>
        <div style={styles.progressRow}>
          <span style={styles.stepText}>Step 2 of 2</span>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: '100%' }} />
          </div>
        </div>

        <h2 style={styles.heading}>
          {fullName ? `Almost there, ${fullName.split(' ')[0]}` : 'Almost there'}
        </h2>
        <p style={styles.subHeading}>
          Add a business name shoppers will see. You&apos;ll create your first service on
          the next screen.
        </p>

        <label style={styles.label}>Business name (optional)</label>
        <div style={styles.inputWrapper}>
          <MdStorefront size={20} color="#888" style={styles.inputIcon} />
          <input
            type="text"
            placeholder="e.g. Hamilton Dry Cleaning"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            style={styles.input}
            autoFocus
          />
        </div>

        <div style={styles.infoRow}>
          <MdInfoOutline size={16} color="#888" />
          <span style={styles.infoText}>
            You can add services, set prices, and upload videos from your dashboard.
            Admerce charges a 5% platform fee on completed bookings.
          </span>
        </div>

        <button
          onClick={handleFinish}
          disabled={isLoading}
          style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1 }}
        >
          {isLoading ? 'Finishing…' : 'Go to Dashboard'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 600, color: '#000', margin: 0 },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '24px' },
  progressRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  stepText: { fontSize: 13, color: '#888' },
  progressBar: { width: 100, height: 4, backgroundColor: '#eee', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#0504AA', borderRadius: 2 },
  heading: { fontSize: 24, fontWeight: 700, color: '#000', margin: 0 },
  subHeading: { fontSize: 14, color: '#888', marginBottom: 32, marginTop: 8, lineHeight: 1.5 },
  inputWrapper: { position: 'relative', marginBottom: 24 },
  inputIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' },
  input: {
    width: '100%',
    padding: '12px 14px 12px 36px',
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 14,
    outline: 'none',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
  },
  label: { fontSize: 14, fontWeight: 500, color: '#000', marginBottom: 6, display: 'block' },
  infoRow: { display: 'flex', alignItems: 'flex-start', marginBottom: 32 },
  infoText: { fontSize: 13, color: '#888', marginLeft: 6, flex: 1, lineHeight: 1.5 },
  submitBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 14,
    border: 'none',
    backgroundColor: '#0504AA',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
};