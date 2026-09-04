'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdRefresh,
  MdEventNote,
  MdLocalShipping,
  MdDeleteOutline,
  MdSwapHoriz,
  MdReceiptLong,
  MdPersonOutline,
  MdAttachMoney,
  MdCheckCircleOutline,
  MdCancel,
  MdCheckCircle,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface StoreOrder {
  order_id: string;
  status?: string;
  total_amount?: number;
  customer_name?: string;
  courier_id?: string;
  courier_name?: string;
  [key: string]: unknown;
}

interface Store {
  store_id?: string;
  name?: string;
}

const TABS = ['All', 'Reservations', 'Pickups', 'Deliveries', 'Dropped', 'Reversed'];

export default function StorekeeperOrdersPage() {
  const router = useRouter();

  const [allOrders, setAllOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const store = (await api.getMyStore()) as Store | null;
      if (store?.store_id) {
        const orders = (await api.getStoreOrders(store.store_id)) as StoreOrder[];
        setAllOrders(orders);
      } else {
        setAllOrders([]);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Derived filtered orders per tab
  const reservations = useMemo(
    () => allOrders.filter((o) => o.status === 'locked' || o.status === 'pending'),
    [allOrders]
  );
  const pickups = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.courier_id == null &&
          o.status !== 'locked' &&
          o.status !== 'pending' &&
          o.status !== 'returned' &&
          o.status !== 'refunded' &&
          o.status !== 'reversed'
      ),
    [allOrders]
  );
  const deliveries = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.courier_id != null &&
          o.status !== 'returned' &&
          o.status !== 'refunded' &&
          o.status !== 'reversed'
      ),
    [allOrders]
  );
  const dropped = useMemo(
    () => allOrders.filter((o) => o.status === 'returned' || o.status === 'refunded'),
    [allOrders]
  );
  const reversed = useMemo(() => allOrders.filter((o) => o.status === 'reversed'), [allOrders]);

  const currentOrders = useMemo(() => {
    switch (activeTab) {
      case 0: return allOrders;
      case 1: return reservations;
      case 2: return pickups;
      case 3: return deliveries;
      case 4: return dropped;
      case 5: return reversed;
      default: return [];
    }
  }, [activeTab, allOrders, reservations, pickups, deliveries, dropped, reversed]);

  // ─── Actions ──────────────────────────────────────────────────────
  const acceptReservation = async (orderId: string) => {
    if (!window.confirm('Accept this reservation?')) return;
    try {
      await api.confirmOrder(orderId);
      await loadOrders();
      alert('Order accepted!');
    } catch (err) {
      alert('Failed to accept: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const declineReservation = async (orderId: string) => {
    if (!window.confirm('Decline this reservation? It will be refunded.')) return;
    try {
      await api.returnOrder(orderId);
      await loadOrders();
      alert('Order declined, refunded.');
    } catch (err) {
      alert('Failed to decline: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const markPickedUp = async (orderId: string) => {
    if (!window.confirm('Mark this order as picked up?')) return;
    try {
      await api.confirmOrder(orderId);
      await loadOrders();
      alert('Order picked up!');
    } catch (err) {
      alert('Failed: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const updateDeliveryStatus = async (orderId: string, newStatus: string) => {
    if (!window.confirm(`Update delivery status to ${newStatus}?`)) return;
    try {
      await api.updateCourierJobStatus(orderId, newStatus);
      await loadOrders();
      alert(`Status updated to ${newStatus}`);
    } catch (err) {
      alert('Failed to update status: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const releaseReversed = async (orderId: string) => {
    if (!window.confirm('Release courier fee for this reversed package?')) return;
    try {
      await api.reversedPackage(orderId);
      await loadOrders();
      alert('Package released, courier fee paid.');
    } catch (err) {
      alert('Failed: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const renderEmptyState = (isReservation: boolean, isDelivery: boolean, isDropped: boolean, isReversed: boolean) => {
    const icon = isReservation ? <MdEventNote size={48} color="#ccc" /> :
                 isDelivery ? <MdLocalShipping size={48} color="#ccc" /> :
                 isDropped ? <MdDeleteOutline size={48} color="#ccc" /> :
                 isReversed ? <MdSwapHoriz size={48} color="#ccc" /> :
                              <MdReceiptLong size={48} color="#ccc" />;
    const text = isReservation ? 'No reservations yet.' :
                 isDelivery ? 'No deliveries yet.' :
                 isDropped ? 'No dropped orders.' :
                 isReversed ? 'No reversed orders.' :
                              'No orders yet.';
    return (
      <div style={styles.center}>
        {icon}
        <p style={{ color: '#888', marginTop: 12 }}>{text}</p>
      </div>
    );
  };

  const renderStatusChip = (status: string) => {
    let color = '#999';
    let label = status;
    const lower = status.toLowerCase();
    if (['completed', 'delivered', 'picked_up'].includes(lower)) { color = '#4CAF50'; label = 'Completed'; }
    else if (['locked', 'pending'].includes(lower)) { color = '#FFA000'; label = 'Pending'; }
    else if (lower === 'dispatched') { color = '#2196F3'; label = 'Dispatched'; }
    else if (['returned', 'refunded'].includes(lower)) { color = '#F44336'; label = 'Dropped'; }
    else if (lower === 'reversed') { color = '#9C27B0'; label = 'Reversed'; }

    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 20,
        backgroundColor: `${color}20`,
        border: `1px solid ${color}50`,
        color,
        fontSize: 12,
        fontWeight: 600,
      }}>
        {label}
      </span>
    );
  };

  const renderOrderCard = (order: StoreOrder, isReservation: boolean, isDelivery: boolean, isDropped: boolean, isReversed: boolean) => {
    const isCompleted = ['completed', 'delivered', 'picked_up'].includes(order.status || '');
    const shortId = order.order_id.length > 8 ? order.order_id.substring(0, 8) : order.order_id;
    const total = Number(order.total_amount || 0).toFixed(2);
    const customer = order.customer_name || 'Customer';

    return (
      <div key={order.order_id} style={styles.orderCard}>
        <div style={styles.orderHeader}>
          <div>
            <span style={styles.customerName}>{customer}</span>
            <span style={styles.orderId}>Order #{shortId}</span>
          </div>
          {renderStatusChip(order.status || 'pending')}
        </div>

        <div style={styles.orderDetail}>
          <MdAttachMoney size={16} color="#888" style={{ marginRight: 6 }} />
          <span style={{ fontWeight: 600, color: '#0504AA' }}>₦{total}</span>
        </div>

        {isDelivery && (
          <div style={styles.orderDetail}>
            <MdLocalShipping size={16} color="#888" style={{ marginRight: 6 }} />
            <span style={{ fontSize: 12, color: '#888' }}>Courier: {order.courier_name || 'Assigned'}</span>
          </div>
        )}
        {isReservation && (
          <div style={styles.orderDetail}>
            <MdEventNote size={16} color="#888" style={{ marginRight: 6 }} />
            <span style={{ fontSize: 12, color: '#888' }}>Reservation</span>
          </div>
        )}
        {isDropped && (
          <div style={styles.orderDetail}>
            <MdDeleteOutline size={16} color="#F44336" style={{ marginRight: 6 }} />
            <span style={{ fontSize: 12, color: '#F44336' }}>Dropped (Refunded)</span>
          </div>
        )}
        {isReversed && (
          <div style={styles.orderDetail}>
            <MdSwapHoriz size={16} color="#FFA000" style={{ marginRight: 6 }} />
            <span style={{ fontSize: 12, color: '#FFA000' }}>Reversed</span>
          </div>
        )}

        {/* Actions */}
        {!isCompleted && (
          <div style={styles.actions}>
            {isReservation && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => acceptReservation(order.order_id)} style={styles.acceptBtn}>
                  <MdCheckCircleOutline size={18} color="#fff" style={{ marginRight: 4 }} />
                  Accept
                </button>
                <button onClick={() => declineReservation(order.order_id)} style={styles.declineBtn}>
                  <MdCancel size={18} color="#F44336" style={{ marginRight: 4 }} />
                  Decline
                </button>
              </div>
            )}

            {isDelivery && (
              <select
                value={order.status || 'pending'}
                onChange={(e) => updateDeliveryStatus(order.order_id, e.target.value)}
                style={styles.select}
              >
                <option value="pending">Pending</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
              </select>
            )}

            {isReversed && (
              <button onClick={() => releaseReversed(order.order_id)} style={styles.releaseBtn}>
                <MdLocalShipping size={18} color="#fff" style={{ marginRight: 4 }} />
                Release Courier Fee
              </button>
            )}

            {!isReservation && !isDelivery && !isDropped && !isReversed && (
              <button onClick={() => markPickedUp(order.order_id)} style={styles.pickedUpBtn}>
                <MdCheckCircleOutline size={18} color="#fff" style={{ marginRight: 4 }} />
                Mark Picked Up
              </button>
            )}
          </div>
        )}

        {isCompleted && (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
            <MdCheckCircle size={18} color="#4CAF50" style={{ marginRight: 6 }} />
            <span style={{ color: '#4CAF50' }}>Completed</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Orders</h1>
        <button onClick={loadOrders} style={styles.refreshBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

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
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : currentOrders.length === 0 ? (
          renderEmptyState(
            activeTab === 1,
            activeTab === 3,
            activeTab === 4,
            activeTab === 5
          )
        ) : (
          <div style={styles.list}>
            {currentOrders.map((order) =>
              renderOrderCard(
                order,
                activeTab === 1,
                activeTab === 3,
                activeTab === 4,
                activeTab === 5
              )
            )}
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1A1A1A',
  },
  orderId: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  orderDetail: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 4,
  },
  actions: {
    marginTop: 12,
  },
  acceptBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600,
  },
  declineBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#F44336',
    border: '1px solid #F44336',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600,
  },
  select: {
    width: '100%',
    padding: '10px',
    borderRadius: 10,
    border: '1px solid #ccc',
    fontSize: 14,
    backgroundColor: '#fff',
    outline: 'none',
  },
  releaseBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    backgroundColor: '#FFA000',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600,
  },
  pickedUpBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600,
  },
};