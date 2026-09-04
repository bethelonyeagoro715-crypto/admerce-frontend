'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdRefresh,
  MdNotificationsActive,
  MdEventNote,
  MdLocalShipping,
  MdBuild,
  MdCheckCircle,
  MdCancel,
  MdChevronRight,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface SavedItem {
  id: string;
  name: string;
  price: string;
  store: string;
}

interface WantedAlert {
  id: string;
  name: string;
  notes: string;
}

interface WalletOrder {
  order_id: string;
  total_amount?: number;
  status?: string;
  expires_at?: string;
  created_at?: string;
  pickup_time?: string;
  [key: string]: unknown;
}

interface ServiceBooking {
  service_id?: string;
  service_title?: string;
  status?: string;
  booking_id?: string;
  [key: string]: unknown;
}

const TABS = ['Items', 'Wanted', 'Reservations', 'Deliveries', 'Bookings', 'Basket', 'History'];

export default function SavedPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [wantedAlerts, setWantedAlerts] = useState<WantedAlert[]>([]);
  const [reservations, setReservations] = useState<WalletOrder[]>([]);
  const [deliveries, setDeliveries] = useState<WalletOrder[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [history, setHistory] = useState<WalletOrder[]>([]);

  const loadAllData = async () => {
    setIsLoading(true);

    // Load saved items (placeholder)
    setSavedItems([
      { id: '1', name: 'Meat Pie', price: '₦200', store: 'Norman Eateries' },
    ]);

    // Load wanted alerts (placeholder)
    setWantedAlerts([
      { id: '1', name: 'Chicken Pie', notes: 'Looking for good quality' },
    ]);

    // Load reservations
    try {
      const data = (await api.getWalletOrders(['locked', 'accepted'])) as WalletOrder[];
      setReservations(data);
    } catch {
      setReservations([]);
    }

    // Load deliveries
    try {
      const data = (await api.getWalletOrders(['dispatched'])) as WalletOrder[];
      setDeliveries(data);
    } catch {
      setDeliveries([]);
    }

    // Load service bookings
    try {
      const data = (await api.getServiceBookings()) as ServiceBooking[];
      setBookings(data);
    } catch {
      setBookings([]);
    }

    // Load history
    try {
      const data = (await api.getWalletOrders([
        'picked_up',
        'returned',
        'expired',
        'reversed',
      ])) as WalletOrder[];
      setHistory(data);
    } catch {
      setHistory([]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAllData();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const renderItemsTab = () => {
    if (savedItems.length === 0) return <EmptyState text="No saved items yet." />;
    return (
      <div style={styles.list}>
        {savedItems.map((item) => (
          <div key={item.id} style={styles.card} onClick={() => router.push(`/item-detail/${item.id}`)}>
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>{item.name}</div>
              <div style={styles.cardSubtitle}>{item.store}</div>
            </div>
            <div style={styles.cardTrailing}>{item.price}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderWantedTab = () => {
    if (wantedAlerts.length === 0) return <EmptyState text="No wanted alerts." />;
    return (
      <div style={styles.list}>
        {wantedAlerts.map((alert) => (
          <div key={alert.id} style={styles.card}>
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>{alert.name}</div>
              <div style={styles.cardSubtitle}>{alert.notes}</div>
            </div>
            <MdNotificationsActive size={20} color="#0504AA" style={{ marginLeft: 8 }} />
          </div>
        ))}
      </div>
    );
  };

  const renderReservationsTab = () => {
    if (reservations.length === 0) return <EmptyState text="No active reservations." />;
    return (
      <div style={styles.list}>
        {reservations.map((order, i) => (
          <div
            key={i}
            style={styles.card}
            onClick={() =>
              router.push(
                `/reservation-confirmed?order_id=${order.order_id}&pickup_time=${encodeURIComponent(
                  order.pickup_time || 'Now'
                )}`
              )
            }
          >
            <MdEventNote size={20} color="#0504AA" style={{ marginRight: 8 }} />
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>Order #{order.order_id?.substring(0, 8)}</div>
              <div style={styles.cardSubtitle}>₦{order.total_amount} · Pickup</div>
            </div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}
      </div>
    );
  };

  const renderDeliveriesTab = () => {
    if (deliveries.length === 0) return <EmptyState text="No active deliveries." />;
    return (
      <div style={styles.list}>
        {deliveries.map((order, i) => (
          <div key={i} style={styles.card}>
            <MdLocalShipping size={20} color="#0504AA" style={{ marginRight: 8 }} />
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>Order #{order.order_id?.substring(0, 8)}</div>
              <div style={styles.cardSubtitle}>₦{order.total_amount} · {order.status}</div>
            </div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}
      </div>
    );
  };

  const renderBookingsTab = () => {
    if (bookings.length === 0) return <EmptyState text="No service bookings." />;
    return (
      <div style={styles.list}>
        {bookings.map((booking, i) => (
          <div key={i} style={styles.card}>
            <MdBuild size={20} color="#0504AA" style={{ marginRight: 8 }} />
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>{booking.service_title || 'Booking'}</div>
              <div style={styles.cardSubtitle}>Status: {booking.status}</div>
            </div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}
      </div>
    );
  };

  const renderBasketTab = () => {
    return <EmptyState text="Basket is empty." />;
  };

  const renderHistoryTab = () => {
    if (history.length === 0) return <EmptyState text="No past orders." />;
    return (
      <div style={styles.list}>
        {history.map((order, i) => (
          <div
            key={i}
            style={styles.card}
            onClick={() => router.push(`/shopper/orders/receipt/${order.order_id}`)} // ✅ corrected path
          >
            {order.status === 'returned' || order.status === 'expired' ? (
              <MdCancel size={20} color="#FF0000" style={{ marginRight: 8 }} />
            ) : (
              <MdCheckCircle size={20} color="#00AA00" style={{ marginRight: 8 }} />
            )}
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>Order #{order.order_id?.substring(0, 8)}</div>
              <div style={styles.cardSubtitle}>
                ₦{order.total_amount} · {order.status} · {order.created_at?.substring(0, 10)}
              </div>
            </div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}
      </div>
    );
  };

  return (
    <main style={styles.container}>
      {/* Tab bar */}
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
        <button onClick={loadAllData} style={styles.refreshBtn} title="Refresh">
          <MdRefresh size={22} color="#0504AA" />
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.loading}>Loading...</div>
        ) : (
          <>
            {activeTab === 0 && renderItemsTab()}
            {activeTab === 1 && renderWantedTab()}
            {activeTab === 2 && renderReservationsTab()}
            {activeTab === 3 && renderDeliveriesTab()}
            {activeTab === 4 && renderBookingsTab()}
            {activeTab === 5 && renderBasketTab()}
            {activeTab === 6 && renderHistoryTab()}
          </>
        )}
      </div>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888' }}>
      {text}
    </div>
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
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
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
  refreshBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#888',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '1px solid #eee',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    cursor: 'pointer',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1A1A1A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  cardTrailing: {
    fontSize: 15,
    fontWeight: 600,
    color: '#0504AA',
    marginLeft: 8,
  },
};