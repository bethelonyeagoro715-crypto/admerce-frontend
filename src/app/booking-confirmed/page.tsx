'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MdCheckCircle,
  MdCalendarToday,
  MdStore,
  MdReceiptLong,
  MdHome,
  MdListAlt,
  MdWork,
} from 'react-icons/md';
import api from '../../services/api';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams
export const dynamic = 'force-dynamic';

function BookingConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const serviceName = searchParams.get('service_name') || 'Service';
  const providerName = searchParams.get('provider_name') || 'Provider';
  const scheduledFor = searchParams.get('scheduled_for') || '';
  const amount = searchParams.get('amount') || '0';
  const bookingId = searchParams.get('booking_id') || '';

  const formattedDate = scheduledFor
    ? new Date(scheduledFor).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not specified';

  const handleJobDone = async () => {
    if (!bookingId) {
      alert('Booking ID missing');
      return;
    }
    try {
      await api.completeServiceBooking(bookingId);
      const query = new URLSearchParams({
        service_name: serviceName,
        provider_name: providerName,
        amount,
        booking_id: bookingId,
      });
      router.push(`/service-success?${query.toString()}`);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      const detail = error?.response?.data?.detail || error?.message || 'Failed to complete job';
      alert(detail);
    }
  };

  return (
    <main style={styles.container}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={styles.iconWrapper}
      >
        <MdCheckCircle size={64} color="#16A34A" />
      </motion.div>

      <h2 style={styles.heading}>Booking Confirmed!</h2>
      <p style={styles.subheading}>Your service has been booked successfully.</p>

      <div style={styles.card}>
        <div style={styles.row}>
          <MdStore size={20} color="#0504AA" />
          <span style={styles.label}>Service</span>
          <span style={styles.value}>{serviceName}</span>
        </div>
        <div style={styles.row}>
          <MdReceiptLong size={20} color="#0504AA" />
          <span style={styles.label}>Provider</span>
          <span style={styles.value}>{providerName}</span>
        </div>
        <div style={styles.row}>
          <MdCalendarToday size={20} color="#0504AA" />
          <span style={styles.label}>When</span>
          <span style={styles.value}>{formattedDate}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Amount</span>
          <span style={styles.value}>₦{Number(amount).toFixed(0)}</span>
        </div>
        {bookingId && (
          <div style={styles.row}>
            <span style={styles.label}>Booking ID</span>
            <span style={styles.value}>{bookingId}</span>
          </div>
        )}
      </div>

      <div style={styles.actions}>
        <button
          onClick={handleJobDone}
          style={{ ...styles.button, backgroundColor: '#27AE60' }}
        >
          <MdWork size={20} color="#fff" />
          Job Done
        </button>

        <button
          onClick={() => router.push('/shopper/home')}
          style={{ ...styles.button, backgroundColor: '#0504AA' }}
        >
          <MdHome size={20} color="#fff" />
          Back to Home
        </button>
        <button
          onClick={() => router.push('/order-history')}
          style={{ ...styles.button, backgroundColor: 'transparent', border: '1px solid #0504AA', color: '#0504AA' }}
        >
          <MdListAlt size={20} color="#0504AA" />
          View Bookings
        </button>
      </div>
    </main>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>}>
      <BookingConfirmedContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#F8F9FA',
    padding: 24,
  },
  iconWrapper: { marginBottom: 16 },
  heading: { fontSize: 28, fontWeight: 800, color: '#1A1A1A', margin: 0 },
  subheading: { fontSize: 16, color: '#666', marginTop: 4, marginBottom: 24 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  label: { color: '#888', fontWeight: 600, minWidth: 80 },
  value: { color: '#1A1A1A', fontWeight: 600, flex: 1 },
  actions: {
    width: '100%',
    maxWidth: 400,
    marginTop: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
};