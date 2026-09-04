'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '../../../services/api';
import {
  MdCalendarToday,
  MdCheckCircle,
  MdCancel,
  MdRefresh,
  MdPersonOutline,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface Booking {
  booking_id: string;
  status?: string;
  amount?: number;
  service_title?: string;
  user_name?: string;       // ← customer name from backend
  booking_date?: string;
  [key: string]: unknown;
}

const TABS = ['Upcoming', 'Completed', 'Cancelled'];

export default function ServiceProviderBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const loadBookings = async () => {
    setLoading(true);
    try {
      // ✅ Use getProviderBookings (hits /services/bookings/provider)
      const data = (await api.getProviderBookings()) as Booking[];
      setBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBookings();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const filteredBookings = useMemo(() => {
    const statusMap = ['locked', 'completed', 'cancelled'];
    const targetStatus = statusMap[activeTab];
    return bookings.filter((b) => (b.status || '').toLowerCase() === targetStatus);
  }, [bookings, activeTab]);

  const markDone = async (bookingId: string) => {
    if (!window.confirm('Mark this booking as completed?')) return;
    try {
      await api.confirmServiceBooking(bookingId);
      await loadBookings();
    } catch (err) {
      alert('Failed to update booking: ' + (err instanceof Error ? err.message : ''));
    }
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Bookings</h1>
        <button onClick={loadBookings} style={styles.refreshBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              ...styles.tab,
              borderBottom: activeTab === i ? '2px solid #0504AA' : '2px solid transparent',
              color: activeTab === i ? '#0504AA' : '#666',
              fontWeight: activeTab === i ? 700 : 400,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div style={styles.center}>
            <MdCalendarToday size={48} color="#ccc" />
            <p style={{ color: '#888', marginTop: 8 }}>None</p>
          </div>
        ) : (
          <div style={styles.list}>
            {filteredBookings.map((booking) => (
              <div key={booking.booking_id} style={styles.bookingCard}>
                <div style={styles.bookingInfo}>
                  <div style={styles.bookingTitle}>
                    {booking.service_title || `Booking ${booking.booking_id}`}
                  </div>
                  {/* ✅ Customer name */}
                  <div style={styles.customerName}>
                    <MdPersonOutline size={14} color="#888" style={{ marginRight: 4 }} />
                    {booking.user_name || 'Customer'}
                  </div>
                  <div style={styles.bookingAmount}>
                    Amount: ₦{Number(booking.amount || 0).toFixed(2)}
                  </div>
                </div>
                {activeTab === 0 && (
                  <button onClick={() => markDone(booking.booking_id)} style={styles.doneBtn}>
                    <MdCheckCircle size={16} color="#fff" style={{ marginRight: 4 }} />
                    Mark Done
                  </button>
                )}
                {activeTab === 1 && <MdCheckCircle size={20} color="#4CAF50" />}
                {activeTab === 2 && <MdCancel size={20} color="#F44336" />}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #eee',
    backgroundColor: '#fff',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    padding: '0 8px',
  },
  tab: {
    background: 'none',
    border: 'none',
    padding: '12px 10px',
    fontSize: 13,
    cursor: 'pointer',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  bookingCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '1px solid #eee',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1A1A1A',
  },
  customerName: {
    fontSize: 13,
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    marginTop: 2,
  },
  bookingAmount: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  doneBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};