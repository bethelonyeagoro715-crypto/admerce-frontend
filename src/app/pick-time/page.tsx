'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { MdArrowBack } from 'react-icons/md';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

const PICKUP_OPTIONS = [
  { label: 'Now - 2 hours', value: '2 hours' },
  { label: '2 - 4 hours', value: '4 hours' },
  { label: 'Tomorrow', value: 'Tomorrow' },
];

export default function PickTimePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (pickupTime: string) => {
    // Preserve existing query parameters (store_lat, store_lng, etc.)
    const params = new URLSearchParams(searchParams.toString());
    params.set('pickupTime', pickupTime);

    // Navigate to the reservation confirmed page (root path, as you have it)
    router.push(`/reservation-confirmed?${params.toString()}`);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => router.back()}>
          <MdArrowBack size={24} color="#000" />
        </button>
        <h1 style={styles.title}>Select Pickup Time</h1>
        <div style={{ width: 24 }} />
      </div>

      {/* Body */}
      <div style={styles.content}>
        <p style={styles.prompt}>Choose your preferred pickup window:</p>

        <div style={styles.optionsList}>
          {PICKUP_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              style={styles.optionButton}
            >
              <span style={styles.optionLabel}>{option.label}</span>
              <span style={styles.optionArrow}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #F0F0F0',
    position: 'sticky',
    top: 0,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1A1A1A',
    margin: 0,
  },
  content: {
    padding: '16px',
  },
  prompt: {
    fontSize: '16px',
    color: '#1A1A1A',
    marginBottom: '16px',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  optionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    backgroundColor: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontSize: '16px',
  },
  optionLabel: {
    color: '#1A1A1A',
    fontWeight: 500,
  },
  optionArrow: {
    color: '#6B7280',
    fontSize: '20px',
  },
};