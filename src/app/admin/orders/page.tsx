'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdSearch,
  MdRefresh,
  MdMoreVert,
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
  MdErrorOutline,
  MdShoppingBag,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface AdminOrder {
  order_id: string;
  shopper_name?: string;
  store_name?: string;
  total_amount?: number;
  created_at?: string;
  status?: string;
  [key: string]: unknown;
}

const ORDER_STATUSES = ['All', 'pending', 'shipped', 'completed', 'cancelled'];

// ─── Normalization helper ──────────────────────────────────────────
function normalizeOrders(data: unknown): AdminOrder[] {
  if (Array.isArray(data)) return data as AdminOrder[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.orders)) return obj.orders as AdminOrder[];
    if (Array.isArray(obj.data)) return obj.data as AdminOrder[];
    if (Array.isArray(obj.results)) return obj.results as AdminOrder[];
  }
  return [];
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#4CAF50',
  pending: '#FF9800',
  shipped: '#2196F3',
  cancelled: '#F44336',
};

export default function AdminOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isMobile, setIsMobile] = useState(false);
  const limit = 20;

  const loadOrders = async (page = 0, query = searchQuery, status = filterStatus) => {
    setCurrentPage(page);
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const offset = page * limit;
      const data = await api.adminGetOrders(
        query.trim() ? query.trim() : undefined,
        status !== 'All' ? status : undefined,
        limit,
        offset
      );
      const list = normalizeOrders(data);
      setOrders(list);
    } catch (err) {
      setErrorMessage('Failed to load orders: ' + (err instanceof Error ? err.message : ''));
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders(0, '', 'All');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.adminUpdateOrderStatus(orderId, newStatus);
      await loadOrders(currentPage, searchQuery, filterStatus);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const nextPage = () => loadOrders(currentPage + 1, searchQuery, filterStatus);
  const prevPage = () => {
    if (currentPage > 0) loadOrders(currentPage - 1, searchQuery, filterStatus);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const formatAmount = (amount?: number) => {
    if (amount === undefined || amount === null) return '—';
    return `₦${amount.toLocaleString()}`;
  };

  const renderStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status] || '#9E9E9E';
    return (
      <span
        style={{
          backgroundColor: `${color}20`,
          color,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'center',
          display: 'inline-block',
        }}
      >
        {status}
      </span>
    );
  };

  const renderStatusMenu = (order: AdminOrder) => (
    <select
      value={order.status || 'pending'}
      onChange={(e) => updateOrderStatus(order.order_id, e.target.value)}
      style={styles.statusSelectSmall}
    >
      <option value="pending">Pending</option>
      <option value="shipped">Shipped</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>
  );

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Orders</h1>
        <button onClick={() => loadOrders(0, searchQuery, filterStatus)} style={styles.iconBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.searchWrapper}>
          <MdSearch size={20} color="#888" style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              loadOrders(0, e.target.value, filterStatus);
            }}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            loadOrders(0, searchQuery, e.target.value);
          }}
          style={styles.statusSelect}
        >
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : errorMessage ? (
          <div style={styles.center}>
            <MdErrorOutline size={48} color="#ef9a9a" />
            <p>{errorMessage}</p>
            <button onClick={() => loadOrders(0, searchQuery, filterStatus)} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div style={styles.center}>
            <MdShoppingBag size={48} color="#ccc" />
            <p>No orders found.</p>
          </div>
        ) : isMobile ? (
          <div style={styles.mobileList}>
            {orders.map((order) => (
              <div key={order.order_id} style={styles.mobileCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.orderId}>{order.order_id || '—'}</div>
                    <div style={styles.shopperName}>{order.shopper_name || '—'}</div>
                  </div>
                  {renderStatusBadge(order.status || 'pending')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={styles.smallLabel}>Store</div>
                    <div>{order.store_name || '—'}</div>
                  </div>
                  <div>
                    <div style={styles.smallLabel}>Amount</div>
                    <div>{formatAmount(order.total_amount)}</div>
                  </div>
                  <div>
                    <div style={styles.smallLabel}>Date</div>
                    <div>{formatDate(order.created_at)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {renderStatusMenu(order)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 1 }}>Order ID</span>
              <span style={{ flex: 2 }}>Shopper</span>
              <span style={{ flex: 2 }}>Store</span>
              <span style={{ flex: 1 }}>Amount</span>
              <span style={{ flex: 1 }}>Date</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Status</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Action</span>
            </div>
            {orders.map((order) => (
              <div key={order.order_id} style={styles.desktopRow}>
                <span style={{ flex: 1, fontWeight: 600 }}>{order.order_id || '—'}</span>
                <span style={{ flex: 2 }}>{order.shopper_name || '—'}</span>
                <span style={{ flex: 2 }}>{order.store_name || '—'}</span>
                <span style={{ flex: 1 }}>{formatAmount(order.total_amount)}</span>
                <span style={{ flex: 1 }}>{formatDate(order.created_at)}</span>
                <span style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  {renderStatusBadge(order.status || 'pending')}
                </span>
                <span style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  {renderStatusMenu(order)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !errorMessage && (
        <div style={styles.pagination}>
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            style={styles.pageBtn}
          >
            <MdKeyboardArrowLeft size={20} color={currentPage === 0 ? '#ccc' : '#0504AA'} />
            Previous
          </button>
          <span style={styles.pageInfo}>Page {currentPage + 1}</span>
          <button
            onClick={nextPage}
            disabled={orders.length < limit}
            style={styles.pageBtn}
          >
            Next
            <MdKeyboardArrowRight size={20} color={orders.length < limit ? '#ccc' : '#0504AA'} />
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#fff', borderBottom: '1px solid #eee' },
  pageTitle: { fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  filters: { display: 'flex', gap: 12, padding: '16px', backgroundColor: '#F8FAFC' },
  searchWrapper: { position: 'relative', flex: 3 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' },
  searchInput: { width: '100%', padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid #E0E0E0', fontSize: 14, outline: 'none', backgroundColor: '#fff' },
  statusSelect: { flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid #E0E0E0', fontSize: 14, outline: 'none', backgroundColor: '#fff' },
  statusSelectSmall: { padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none' },
  content: { flex: 1, overflowY: 'auto', padding: '0 16px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' },
  spinner: { width: 36, height: 36, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  retryBtn: { marginTop: 16, padding: '8px 20px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  tableWrapper: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  tableHeader: { display: 'flex', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #eee' },
  desktopRow: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f5f5f5' },
  mobileCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  mobileList: { display: 'flex', flexDirection: 'column' },
  orderId: { fontWeight: 600, color: '#1A1A1A' },
  shopperName: { fontSize: 12, color: '#888' },
  smallLabel: { fontSize: 10, color: '#999' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', gap: 8 },
  pageBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  pageInfo: { fontSize: 14, color: '#666' },
};