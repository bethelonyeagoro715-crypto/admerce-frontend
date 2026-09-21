'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
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
  MdErrorOutline,
  MdPerson,
  MdChat,
} from 'react-icons/md';
import api from '../../services/api';

interface BookingDetail {
  booking_id?: string;
  service_id?: string;
  service_title?: string;
  title?: string;
  provider_id?: string;
  provider_name?: string;
  customer_id?: string;
  customer_name?: string;
  status?: string;
  amount?: number | string;
  scheduled_for?: string;
  created_at?: string;
  notes?: string;
  [key: string]: unknown;
}

function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return 'Not specified';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function BookingConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingIdFromUrl = searchParams.get('booking_id') || '';

  const [serviceName, setServiceName] = useState(
    searchParams.get('service_name') || 'Service',
  );
  const [providerName, setProviderName] = useState(
    searchParams.get('provider_name') || 'Provider',
  );
  const [customerName, setCustomerName] = useState(
    searchParams.get('customer_name') || '',
  );
  const [scheduledFor, setScheduledFor] = useState(
    searchParams.get('scheduled_for') || '',
  );
  const [amount, setAmount] = useState(searchParams.get('amount') || '0');
  const [bookingId, setBookingId] = useState(bookingIdFromUrl);
  const [status, setStatus] = useState<string>('');

  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (!bookingIdFromUrl) return;

    const hasFullUrl =
      !!searchParams.get('service_name') &&
      !!searchParams.get('provider_name') &&
      !!searchParams.get('amount');

    if (hasFullUrl) return;

    let cancelled = false;

    (async () => {
      setEnriching(true);
      setEnrichError(null);
      try {
        const data = (await api.getServiceBookingDetail(
          bookingIdFromUrl,
        )) as BookingDetail;

        if (cancelled) return;

        setBookingId(data.booking_id || bookingIdFromUrl);
        setServiceName(data.service_title || data.title || 'Service');
        setProviderName(data.provider_name || 'Provider');
        setCustomerName(data.customer_name || '');
        setScheduledFor(data.scheduled_for || data.created_at || '');
        setAmount(String(data.amount ?? 0));
        setStatus(data.status || '');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not load booking details.';
        setEnrichError(msg);
      } finally {
        if (!cancelled) setEnriching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingIdFromUrl]);

  // ✅ Receipt navigation helper — used by both the button and Job Done
  const goToReceipt = useCallback(
    (overrideStatus?: string) => {
      if (!bookingId) {
        alert('Booking ID missing');
        return;
      }
      const qs = new URLSearchParams();
      if (serviceName) qs.set('service_name', serviceName);
      if (providerName) qs.set('provider_name', providerName);
      if (customerName) qs.set('customer_name', customerName);
      if (amount) qs.set('amount', String(amount));
      const s = overrideStatus || status;
      if (s) qs.set('status', s);
      if (scheduledFor) qs.set('scheduled_for', scheduledFor);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      router.push(`/receipt/service/${bookingId}${suffix}`);
    },
    [
      bookingId,
      serviceName,
      providerName,
      customerName,
      amount,
      status,
      scheduledFor,
      router,
    ],
  );

  const handleViewReceipt = useCallback(() => {
    goToReceipt();
  }, [goToReceipt]);

  // ✅ FIX: after Job Done, auto-navigate to the receipt.
  //    700ms delay so the user sees the green checkmark flip to "Completed".
  const handleJobDone = useCallback(async () => {
    if (!bookingId) {
      alert('Booking ID missing');
      return;
    }
    setCompleting(true);
    try {
      await api.completeServiceBooking(bookingId);

      // Try to refresh the status so the UI reflects "completed"
      try {
        const refreshed = (await api.getServiceBookingDetail(
          bookingId,
        )) as BookingDetail;
        setStatus(refreshed.status || 'completed');
      } catch {
        setStatus('completed');
      }

      setJustCompleted(true);

      // Brief pause so the "Booking Complete!" state registers, then
      // navigate to the receipt with status=completed pre-filled.
      setTimeout(() => {
        goToReceipt('completed');
      }, 700);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to complete job';
      alert(detail);
      setCompleting(false);
    }
  }, [bookingId, goToReceipt]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/shopper/home');
    }
  };

  const formattedDate = fmtDateTime(scheduledFor);
  const amountNumber = Number(amount) || 0;
  const isCompleted = status === 'completed';

  if (enriching) {
    return (
      <main style={styles.container}>
        <div style={styles.spinner} />
      </main>
    );
  }

  if (enrichError && !bookingId) {
    return (
      <main style={styles.container}>
        <MdErrorOutline size={56} color="#EF9A9A" />
        <p style={{ marginTop: 12, color: '#B71C1C', textAlign: 'center' }}>
          {enrichError}
        </p>
        <button
          onClick={handleBack}
          style={{ ...styles.button, backgroundColor: '#0504AA', marginTop: 16 }}
        >
          Back
        </button>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={styles.iconWrapper}
      >
        <MdCheckCircle size={64} color={isCompleted ? '#16A34A' : '#16A34A'} />
      </motion.div>

      <h2 style={styles.heading}>
        {isCompleted ? 'Booking Complete!' : 'Booking Confirmed!'}
      </h2>
      <p style={styles.subheading}>
        {justCompleted
          ? 'Redirecting to your receipt…'
          : isCompleted
            ? 'Funds have been released to the provider.'
            : 'Your service has been booked successfully.'}
      </p>

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
        {customerName && (
          <div style={styles.row}>
            <MdPerson size={20} color="#0504AA" />
            <span style={styles.label}>Customer</span>
            <span style={styles.value}>{customerName}</span>
          </div>
        )}
        <div style={styles.row}>
          <MdCalendarToday size={20} color="#0504AA" />
          <span style={styles.label}>When</span>
          <span style={styles.value}>{formattedDate}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Amount</span>
          <span style={styles.value}>₦{amountNumber.toFixed(0)}</span>
        </div>
        {bookingId && (
          <div style={styles.row}>
            <span style={styles.label}>Booking ID</span>
            <span style={styles.value}>{bookingId.slice(0, 8)}</span>
          </div>
        )}
        {status && (
          <div style={styles.row}>
            <span style={styles.label}>Status</span>
            <span
              style={{
                ...styles.value,
                color: isCompleted ? '#166534' : '#92400E',
              }}
            >
              {isCompleted ? 'Completed' : status}
            </span>
          </div>
        )}
      </div>

      <div style={styles.actions}>
        {bookingId && (
          <button
            onClick={handleViewReceipt}
            style={{
              ...styles.button,
              backgroundColor: 'transparent',
              border: '2px solid #0504AA',
              color: '#0504AA',
            }}
          >
            <MdReceiptLong size={20} color="#0504AA" />
            View Receipt
          </button>
        )}

        {!isCompleted && bookingId && (
          <button
            onClick={handleJobDone}
            disabled={completing}
            style={{
              ...styles.button,
              backgroundColor: '#27AE60',
              opacity: completing ? 0.6 : 1,
              cursor: completing ? 'not-allowed' : 'pointer',
            }}
          >
            <MdWork size={20} color="#fff" />
            {completing ? 'Completing…' : 'Job Done'}
          </button>
        )}

        {bookingId && (
          <button
            onClick={() => {
              router.push('/shopper/inbox');
            }}
            style={{
              ...styles.button,
              backgroundColor: 'transparent',
              border: '1px solid #0504AA',
              color: '#0504AA',
            }}
          >
            <MdChat size={20} color="#0504AA" />
            Message
          </button>
        )}

        <button
          onClick={() => router.push('/shopper/home')}
          style={{ ...styles.button, backgroundColor: '#0504AA' }}
        >
          <MdHome size={20} color="#fff" />
          Back to Home
        </button>

        <button
          onClick={() => router.push('/shopper/saved?tab=Bookings')}
          style={{
            ...styles.button,
            backgroundColor: 'transparent',
            border: '1px solid #0504AA',
            color: '#0504AA',
          }}
        >
          <MdListAlt size={20} color="#0504AA" />
          View all bookings
        </button>
      </div>
    </main>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.container}>
          <div style={styles.spinner} />
        </div>
      }
    >
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
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  iconWrapper: { marginBottom: 16 },
  heading: { fontSize: 28, fontWeight: 800, color: '#1A1A1A', margin: 0 },
  subheading: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
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
  label: { color: '#888', fontWeight: 600, minWidth: 90 },
  value: { color: '#1A1A1A', fontWeight: 600, flex: 1, textAlign: 'right' },
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

if (typeof document !== 'undefined' && !document.getElementById('booking-kf')) {
  const s = document.createElement('style');
  s.id = 'booking-kf';
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
}