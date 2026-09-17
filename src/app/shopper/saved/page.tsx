'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import {
  MdRefresh,
  MdNotificationsActive,
  MdEventNote,
  MdLocalShipping,
  MdBuild,
  MdCheckCircle,
  MdCancel,
  MdChevronRight,
  MdInventory,
  MdShoppingBasket,
  MdSearch,
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
  total_amount?: number | string;
  status?: string;
  expires_at?: string;
  created_at?: string;
  pickup_time?: string;
  store_name?: string;
  [key: string]: unknown;
}

interface ServiceBooking {
  service_id?: string;
  service_title?: string;
  title?: string;
  status?: string;
  booking_id?: string;
  amount?: number | string;
  created_at?: string;
  scheduled_for?: string;
  [key: string]: unknown;
}

interface BasketItem {
  id: number;
  listing_id: string;
  title?: string;
  price?: number | string;
  quantity?: number;
  image_url?: string;
  store_name?: string;
  [key: string]: unknown;
}

interface BasketResponse {
  items?: BasketItem[];
  total?: number | string;
  [key: string]: unknown;
}

const TABS = [
  'Items',
  'Wanted',
  'Reservations',
  'Deliveries',
  'Bookings',
  'Basket',
  'History',
] as const;

type Tab = (typeof TABS)[number];

function fmtNaira(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '₦0';
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function shortId(id: string | undefined): string {
  if (!id) return '—';
  return id.length > 8 ? id.slice(0, 8) : id;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function SavedPage() {
  useAuthGuard();

  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('Items');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [wantedAlerts, setWantedAlerts] = useState<WantedAlert[]>([]);
  const [reservations, setReservations] = useState<WalletOrder[]>([]);
  const [deliveries, setDeliveries] = useState<WalletOrder[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [basketTotal, setBasketTotal] = useState<number>(0);
  const [history, setHistory] = useState<WalletOrder[]>([]);

  const loadAllData = useCallback(async () => {
    setError(null);

    // Placeholder data — no backend endpoints yet for these two.
    // Replace when /shopper/saved/list and /shopper/wanted/list exist.
    setSavedItems([
      { id: '1', name: 'Meat Pie', price: '₦200', store: 'Norman Eateries' },
    ]);
    setWantedAlerts([
      { id: '1', name: 'Chicken Pie', notes: 'Looking for good quality' },
    ]);

    // Parallel fetch — one round-trip instead of five.
    const results = await Promise.allSettled([
      api.getWalletOrders(['locked', 'accepted']),
      api.getWalletOrders(['dispatched']),
      api.getServiceBookings(),
      api.getBasket(),
      api.getWalletOrders(['picked_up', 'returned', 'expired', 'reversed']),
    ]);

    const [
      reservationsResult,
      deliveriesResult,
      bookingsResult,
      basketResult,
      historyResult,
    ] = results;

    if (reservationsResult.status === 'fulfilled') {
      const raw = reservationsResult.value;
      setReservations(Array.isArray(raw) ? (raw as WalletOrder[]) : []);
    } else {
      setReservations([]);
    }

    if (deliveriesResult.status === 'fulfilled') {
      const raw = deliveriesResult.value;
      setDeliveries(Array.isArray(raw) ? (raw as WalletOrder[]) : []);
    } else {
      setDeliveries([]);
    }

    if (bookingsResult.status === 'fulfilled') {
      const raw = bookingsResult.value;
      setBookings(Array.isArray(raw) ? (raw as ServiceBooking[]) : []);
    } else {
      setBookings([]);
    }

    if (basketResult.status === 'fulfilled') {
      const raw = basketResult.value as BasketResponse | null;
      const items = Array.isArray(raw?.items) ? (raw!.items as BasketItem[]) : [];
      setBasketItems(items);
      setBasketTotal(Number(raw?.total ?? 0));
    } else {
      setBasketItems([]);
      setBasketTotal(0);
    }

    if (historyResult.status === 'fulfilled') {
      const raw = historyResult.value;
      setHistory(Array.isArray(raw) ? (raw as WalletOrder[]) : []);
    } else {
      setHistory([]);
    }

    // Only flag an error if EVERYTHING failed — otherwise partial data is
    // still useful and we degrade gracefully.
    const allFailed = results.every((r) => r.status === 'rejected');
    if (allFailed) {
      setError(
        'Could not load your saved data. Please check your connection and try again.',
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      await loadAllData();
      if (!cancelled) setIsLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadAllData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllData();
    setIsRefreshing(false);
  };

  const openReservation = (order: WalletOrder) => {
    router.push(
      `/reservation-confirmed?order_id=${order.order_id}&pickup_time=${encodeURIComponent(
        order.pickup_time || 'Now',
      )}`,
    );
  };

  const openDelivery = (order: WalletOrder) => {
    // Same confirmation screen — deliveries are just a later escrow state
    router.push(
      `/reservation-confirmed?order_id=${order.order_id}&pickup_time=${encodeURIComponent(
        order.pickup_time || 'Now',
      )}`,
    );
  };

  const openBooking = (booking: ServiceBooking) => {
    // Route to the booking detail page if it exists; fall back to the
    // service detail page otherwise (which shows the provider).
    if (booking.booking_id) {
      router.push(`/shopper/bookings/${booking.booking_id}`);
    } else if (booking.service_id) {
      router.push(`/service-detail/${booking.service_id}`);
    }
  };

  const openReceipt = (order: WalletOrder) => {
    router.push(`/shopper/orders/receipt/${order.order_id}`);
  };

  // ── Search filter ────────────────────────────────────────────
  const q = query.trim().toLowerCase();

  const applyFilter = <T extends Record<string, unknown>>(
    list: T[],
    fields: (keyof T)[],
  ): T[] => {
    if (!q) return list;
    return list.filter((item) =>
      fields.some((f) => String(item[f] ?? '').toLowerCase().includes(q)),
    );
  };

  const filteredReservations = useMemo(
    () => applyFilter(reservations, ['order_id', 'store_name', 'status']),
    [reservations, q],
  );
  const filteredDeliveries = useMemo(
    () => applyFilter(deliveries, ['order_id', 'store_name', 'status']),
    [deliveries, q],
  );
  const filteredBookings = useMemo(
    () => applyFilter(bookings, ['service_title', 'title', 'status', 'booking_id']),
    [bookings, q],
  );
  const filteredHistory = useMemo(
    () => applyFilter(history, ['order_id', 'store_name', 'status']),
    [history, q],
  );

  // ── Tab renderers ────────────────────────────────────────────
  const renderItemsTab = () => {
    if (savedItems.length === 0) {
      return <EmptyState icon={<MdInventory size={44} color="#C7D2FE" />} text="No saved items yet." />;
    }
    return (
      <div style={styles.list}>
        {savedItems.map((item) => (
          <div
            key={item.id}
            style={styles.card}
            onClick={() => router.push(`/item-detail/${item.id}`)}
            role="button"
            tabIndex={0}
          >
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>{item.name}</div>
              <div style={styles.cardSubtitle}>{item.store}</div>
            </div>
            <div style={styles.cardTrailing}>{item.price}</div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}
      </div>
    );
  };

  const renderWantedTab = () => {
    if (wantedAlerts.length === 0) {
      return <EmptyState icon={<MdNotificationsActive size={44} color="#C7D2FE" />} text="No wanted alerts." />;
    }
    return (
      <div style={styles.list}>
        {wantedAlerts.map((alert) => (
          <div key={alert.id} style={styles.card}>
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>{alert.name}</div>
              <div style={styles.cardSubtitle}>{alert.notes}</div>
            </div>
            <MdNotificationsActive size={20} color="#0504AA" />
          </div>
        ))}
      </div>
    );
  };

  const renderReservationsTab = () => {
    if (filteredReservations.length === 0) {
      return (
        <EmptyState
          icon={<MdEventNote size={44} color="#C7D2FE" />}
          text={q ? `No reservations match "${query}"` : 'No active reservations.'}
        />
      );
    }
    return (
      <div style={styles.list}>
        {filteredReservations.map((order, i) => (
          <div
            key={order.order_id || i}
            style={styles.card}
            onClick={() => openReservation(order)}
            role="button"
            tabIndex={0}
          >
            <MdEventNote size={20} color="#0504AA" style={{ marginRight: 8 }} />
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>Order #{shortId(order.order_id)}</div>
              <div style={styles.cardSubtitle}>
                {fmtNaira(order.total_amount)} · {order.store_name || 'Pickup'}
              </div>
            </div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}
      </div>
    );
  };

  const renderDeliveriesTab = () => {
    if (filteredDeliveries.length === 0) {
      return (
        <EmptyState
          icon={<MdLocalShipping size={44} color="#C7D2FE" />}
          text={q ? `No deliveries match "${query}"` : 'No active deliveries.'}
        />
      );
    }
    return (
      <div style={styles.list}>
        {filteredDeliveries.map((order, i) => (
          <div
            key={order.order_id || i}
            style={styles.card}
            onClick={() => openDelivery(order)}
            role="button"
            tabIndex={0}
          >
            <MdLocalShipping size={20} color="#0504AA" style={{ marginRight: 8 }} />
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>Order #{shortId(order.order_id)}</div>
              <div style={styles.cardSubtitle}>
                {fmtNaira(order.total_amount)} · {order.status || 'In transit'}
              </div>
            </div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}
      </div>
    );
  };

  const renderBookingsTab = () => {
    if (filteredBookings.length === 0) {
      return (
        <EmptyState
          icon={<MdBuild size={44} color="#C7D2FE" />}
          text={q ? `No bookings match "${query}"` : 'No service bookings.'}
        />
      );
    }
    return (
      <div style={styles.list}>
        {filteredBookings.map((booking, i) => (
          <div
            key={booking.booking_id || i}
            style={styles.card}
            onClick={() => openBooking(booking)}
            role="button"
            tabIndex={0}
          >
            <MdBuild size={20} color="#0504AA" style={{ marginRight: 8 }} />
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>
                {booking.service_title || booking.title || 'Booking'}
              </div>
              <div style={styles.cardSubtitle}>
                Status: {booking.status || '—'} · {fmtDate(booking.created_at)}
              </div>
            </div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}
      </div>
    );
  };

  const renderBasketTab = () => {
    if (basketItems.length === 0) {
      return (
        <EmptyState
          icon={<MdShoppingBasket size={44} color="#C7D2FE" />}
          text="Basket is empty."
        />
      );
    }
    return (
      <div style={styles.list}>
        {basketItems.map((item, i) => (
          <div
            key={item.id || item.listing_id || i}
            style={styles.card}
            onClick={() => router.push(`/item-detail/${item.listing_id}`)}
            role="button"
            tabIndex={0}
          >
            <MdShoppingBasket size={20} color="#0504AA" style={{ marginRight: 8 }} />
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>
                {item.title || 'Item'} × {item.quantity ?? 1}
              </div>
              <div style={styles.cardSubtitle}>
                {fmtNaira(Number(item.price || 0) * (item.quantity ?? 1))}
              </div>
            </div>
            <MdChevronRight size={16} color="#999" />
          </div>
        ))}

        <div style={styles.basketFooter}>
          <div style={styles.basketTotalRow}>
            <span style={styles.basketLabel}>Subtotal</span>
            <span style={styles.basketValue}>{fmtNaira(basketTotal)}</span>
          </div>
          <button
            onClick={() => router.push('/basket')}
            style={styles.primaryBtn}
          >
            View basket & checkout
          </button>
        </div>
      </div>
    );
  };

  const renderHistoryTab = () => {
    if (filteredHistory.length === 0) {
      return (
        <EmptyState
          icon={<MdCheckCircle size={44} color="#C7D2FE" />}
          text={q ? `No orders match "${query}"` : 'No past orders.'}
        />
      );
    }
    return (
      <div style={styles.list}>
        {filteredHistory.map((order, i) => {
          const isReturnedOrExpired =
            order.status === 'returned' || order.status === 'expired';
          return (
            <div
              key={order.order_id || i}
              style={styles.card}
              onClick={() => openReceipt(order)}
              role="button"
              tabIndex={0}
            >
              {isReturnedOrExpired ? (
                <MdCancel size={20} color="#FF0000" style={{ marginRight: 8 }} />
              ) : (
                <MdCheckCircle size={20} color="#00AA00" style={{ marginRight: 8 }} />
              )}
              <div style={styles.cardContent}>
                <div style={styles.cardTitle}>Order #{shortId(order.order_id)}</div>
                <div style={styles.cardSubtitle}>
                  {fmtNaira(order.total_amount)} · {order.status || '—'} ·{' '}
                  {fmtDate(order.created_at)}
                </div>
              </div>
              <MdChevronRight size={16} color="#999" />
            </div>
          );
        })}
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Items':
        return renderItemsTab();
      case 'Wanted':
        return renderWantedTab();
      case 'Reservations':
        return renderReservationsTab();
      case 'Deliveries':
        return renderDeliveriesTab();
      case 'Bookings':
        return renderBookingsTab();
      case 'Basket':
        return renderBasketTab();
      case 'History':
        return renderHistoryTab();
    }
  };

  return (
    <main style={styles.container}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              borderBottom:
                activeTab === tab ? '2px solid #0504AA' : '2px solid transparent',
              color: activeTab === tab ? '#0504AA' : '#666',
              fontWeight: activeTab === tab ? 700 : 400,
            }}
          >
            {tab}
          </button>
        ))}
        <button
          onClick={handleRefresh}
          style={styles.refreshBtn}
          title="Refresh"
          aria-label="Refresh"
        >
          <MdRefresh
            size={22}
            color="#0504AA"
            style={{
              animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
            }}
          />
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchWrap}>
        <MdSearch size={18} color="#94A3B8" />
        <input
          type="text"
          placeholder={`Search ${activeTab.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Content */}
      <div style={styles.content}>
        {isLoading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : error ? (
          <div style={styles.center}>
            <MdCancel size={44} color="#EF9A9A" />
            <p style={styles.errorText}>{error}</p>
            <button onClick={handleRefresh} style={styles.primaryBtn}>
              Try again
            </button>
          </div>
        ) : (
          renderActiveTab()
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={styles.center}>
      {icon}
      <p style={styles.emptyText}>{text}</p>
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
    flexShrink: 0,
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
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '8px 12px 4px',
    padding: '8px 12px',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    border: '1px solid #E2E8F0',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14,
    backgroundColor: 'transparent',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px 24px',
    minHeight: 0,
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '48px 24px',
    gap: 12,
    textAlign: 'center',
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
  errorText: {
    color: '#B71C1C',
    fontSize: 14,
    margin: 0,
    maxWidth: 320,
    lineHeight: 1.5,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '1px solid #EEF2FF',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s ease',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1A1A1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardTrailing: {
    fontSize: 15,
    fontWeight: 600,
    color: '#0504AA',
    marginLeft: 8,
    whiteSpace: 'nowrap',
  },
  basketFooter: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    border: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  basketTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  basketLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: 500,
  },
  basketValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0504AA',
  },
  primaryBtn: {
    padding: '12px 20px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
};