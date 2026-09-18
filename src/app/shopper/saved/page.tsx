'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  MdImage,
  MdAdd,
  MdDeleteOutline,
  MdToggleOn,
  MdToggleOff,
  MdClose,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface SavedListing {
  listing_id: string;
  title?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  store_id?: string | null;
  store_name?: string | null;
  saved_at?: string | null;
}

interface WantedAlert {
  id: number;
  user_id: string;
  title: string;
  notes?: string | null;
  category?: string | null;
  budget?: number | null;
  is_active: boolean;
  created_at?: string | null;
  expires_at?: string | null;
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

function isValidTab(value: string | null): value is Tab {
  return !!value && (TABS as readonly string[]).includes(value);
}

function fmtNaira(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '₦0';
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function shortId(id: string | undefined): string {
  if (!id) return '—';
  return id.length > 8 ? id.slice(0, 8) : id;
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso ?? '—';
  }
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    '';
  if (!base) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function SavedPageContent() {
  useAuthGuard();

  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab: Tab = isValidTab(searchParams.get('tab'))
    ? (searchParams.get('tab') as Tab)
    : 'Items';

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [savedItems, setSavedItems] = useState<SavedListing[]>([]);
  const [wantedAlerts, setWantedAlerts] = useState<WantedAlert[]>([]);
  const [reservations, setReservations] = useState<WalletOrder[]>([]);
  const [deliveries, setDeliveries] = useState<WalletOrder[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [basketTotal, setBasketTotal] = useState<number>(0);
  const [history, setHistory] = useState<WalletOrder[]>([]);

  // Create-alert sheet
  const [showCreateWanted, setShowCreateWanted] = useState(false);
  const [newWantedTitle, setNewWantedTitle] = useState('');
  const [newWantedNotes, setNewWantedNotes] = useState('');
  const [newWantedBudget, setNewWantedBudget] = useState('');
  const [creatingWanted, setCreatingWanted] = useState(false);
  const [createWantedError, setCreateWantedError] = useState<string | null>(null);

  // Sync URL with tab
  useEffect(() => {
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams.toString());
      next.set('tab', activeTab);
      router.replace(`/shopper/saved?${next.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadAllData = useCallback(async () => {
    setError(null);

    const results = await Promise.allSettled([
      api.getSavedItems(),
      api.getWantedAlerts(),
      api.getWalletOrders(['locked', 'accepted']),
      api.getWalletOrders(['dispatched']),
      api.getServiceBookings(),
      api.getBasket(),
      api.getWalletOrders(['picked_up', 'returned', 'expired', 'reversed']),
    ]);

    const [
      savedResult,
      wantedResult,
      reservationsResult,
      deliveriesResult,
      bookingsResult,
      basketResult,
      historyResult,
    ] = results;

    if (savedResult.status === 'fulfilled') {
      const raw = savedResult.value;
      setSavedItems(Array.isArray(raw) ? (raw as SavedListing[]) : []);
    } else {
      setSavedItems([]);
    }

    if (wantedResult.status === 'fulfilled') {
      const raw = wantedResult.value;
      setWantedAlerts(Array.isArray(raw) ? (raw as WantedAlert[]) : []);
    } else {
      setWantedAlerts([]);
    }

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

  // ─── Navigation ───────────────────────────────────────────────
  const openReservation = (order: WalletOrder) => {
    router.push(
      `/reservation-confirmed?order_id=${order.order_id}&pickup_time=${encodeURIComponent(
        order.pickup_time || 'Now',
      )}`,
    );
  };

  const openDelivery = (order: WalletOrder) => openReservation(order);

  // ✅ Route to the same screen the fresh-booking flow uses. We only pass
  //    the booking_id — the confirmation page enriches the rest from the API.
  const openBooking = (booking: ServiceBooking) => {
    if (booking.booking_id) {
      router.push(
        `/booking-confirmed?booking_id=${encodeURIComponent(booking.booking_id)}`,
      );
    } else if (booking.service_id) {
      // Fallback for old rows that predate booking_id support
      router.push(`/service-detail/${booking.service_id}`);
    }
  };

  const openReceipt = (order: WalletOrder) => {
    router.push(`/shopper/orders/receipt/${order.order_id}`);
  };

  // ─── Wanted actions ────────────────────────────────────────────
  const handleCreateWanted = async () => {
    const title = newWantedTitle.trim();
    if (!title) {
      setCreateWantedError("Please enter what you're looking for.");
      return;
    }
    setCreatingWanted(true);
    setCreateWantedError(null);
    try {
      const budgetNum = newWantedBudget.trim()
        ? Number(newWantedBudget)
        : undefined;
      if (
        budgetNum !== undefined &&
        (!Number.isFinite(budgetNum) || budgetNum < 0)
      ) {
        setCreateWantedError('Budget must be a positive number.');
        setCreatingWanted(false);
        return;
      }
      await api.createWantedAlert({
        title,
        notes: newWantedNotes.trim() || undefined,
        budget: budgetNum,
      });
      setShowCreateWanted(false);
      setNewWantedTitle('');
      setNewWantedNotes('');
      setNewWantedBudget('');
      await loadAllData();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not create alert.';
      setCreateWantedError(msg);
    } finally {
      setCreatingWanted(false);
    }
  };

  const handleDeleteWanted = async (id: number) => {
    if (!window.confirm('Delete this wanted alert?')) return;
    try {
      await api.deleteWantedAlert(id);
      setWantedAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete.');
    }
  };

  const handleToggleWanted = async (id: number) => {
    try {
      const res = (await api.toggleWantedAlert(id)) as { is_active?: boolean };
      setWantedAlerts((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, is_active: res.is_active ?? !a.is_active }
            : a,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle.');
    }
  };

  // ─── Filtering ─────────────────────────────────────────────────
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

  const filteredSaved = useMemo(
    () =>
      applyFilter(savedItems as unknown as Record<string, unknown>[], [
        'title',
        'store_name',
      ]) as unknown as SavedListing[],
    [savedItems, q],
  );
  const filteredWanted = useMemo(
    () =>
      applyFilter(wantedAlerts as unknown as Record<string, unknown>[], [
        'title',
        'notes',
        'category',
      ]) as unknown as WantedAlert[],
    [wantedAlerts, q],
  );
  const filteredReservations = useMemo(
    () => applyFilter(reservations, ['order_id', 'store_name', 'status']),
    [reservations, q],
  );
  const filteredDeliveries = useMemo(
    () => applyFilter(deliveries, ['order_id', 'store_name', 'status']),
    [deliveries, q],
  );
  const filteredBookings = useMemo(
    () =>
      applyFilter(bookings, [
        'service_title',
        'title',
        'status',
        'booking_id',
      ]),
    [bookings, q],
  );
  const filteredHistory = useMemo(
    () => applyFilter(history, ['order_id', 'store_name', 'status']),
    [history, q],
  );

  // ─── Tab renderers ─────────────────────────────────────────────
  const renderItemsTab = () => {
    if (filteredSaved.length === 0) {
      return (
        <EmptyState
          icon={<MdInventory size={44} color="#C7D2FE" />}
          text={q ? `No saved items match "${query}"` : 'No saved items yet.'}
        />
      );
    }

    return (
      <div style={styles.list}>
        {filteredSaved.map((item) => {
          const image = resolveImageUrl(item.image_url);
          return (
            <div
              key={item.listing_id}
              style={styles.card}
              onClick={() => router.push(`/item-detail/${item.listing_id}`)}
              role="button"
              tabIndex={0}
            >
              <div style={styles.thumb}>
                {image ? (
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <MdImage size={22} color="#94A3B8" />
                )}
              </div>
              <div style={styles.cardContent}>
                <div style={styles.cardTitle}>{item.title || 'Listing'}</div>
                <div style={styles.cardSubtitle}>
                  {item.store_name || 'Store'}
                  {item.saved_at ? ` · Saved ${fmtDate(item.saved_at)}` : ''}
                </div>
              </div>
              <div style={styles.cardTrailing}>{fmtNaira(item.price)}</div>
              <MdChevronRight size={16} color="#999" />
            </div>
          );
        })}
      </div>
    );
  };

  const renderWantedTab = () => {
    return (
      <>
        <button
          onClick={() => setShowCreateWanted(true)}
          style={styles.createAlertBtn}
        >
          <MdAdd size={20} color="#fff" />
          <span style={{ marginLeft: 6 }}>
            Post what you&apos;re looking for
          </span>
        </button>

        {filteredWanted.length === 0 ? (
          <EmptyState
            icon={<MdNotificationsActive size={44} color="#C7D2FE" />}
            text={
              q
                ? `No alerts match "${query}"`
                : 'No wanted alerts yet. Post one so sellers can find you.'
            }
          />
        ) : (
          <div style={styles.list}>
            {filteredWanted.map((alert) => (
              <div
                key={alert.id}
                style={{
                  ...styles.card,
                  opacity: alert.is_active ? 1 : 0.55,
                }}
              >
                <MdNotificationsActive
                  size={20}
                  color={alert.is_active ? '#0504AA' : '#94A3B8'}
                  style={{ marginRight: 8 }}
                />
                <div style={styles.cardContent}>
                  <div style={styles.cardTitle}>{alert.title}</div>
                  {alert.notes ? (
                    <div style={styles.cardSubtitle}>{alert.notes}</div>
                  ) : null}
                  <div style={styles.cardMeta}>
                    {alert.budget != null &&
                      `Budget: ${fmtNaira(alert.budget)} · `}
                    {alert.is_active ? 'Active' : 'Paused'}
                    {alert.created_at ? ` · ${fmtDate(alert.created_at)}` : ''}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleWanted(alert.id)}
                  style={styles.iconBtn}
                  title={alert.is_active ? 'Pause alert' : 'Resume alert'}
                >
                  {alert.is_active ? (
                    <MdToggleOn size={24} color="#0504AA" />
                  ) : (
                    <MdToggleOff size={24} color="#94A3B8" />
                  )}
                </button>
                <button
                  onClick={() => handleDeleteWanted(alert.id)}
                  style={styles.iconBtn}
                  title="Delete"
                >
                  <MdDeleteOutline size={20} color="#EF4444" />
                </button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  const renderReservationsTab = () => {
    if (filteredReservations.length === 0) {
      return (
        <EmptyState
          icon={<MdEventNote size={44} color="#C7D2FE" />}
          text={
            q
              ? `No reservations match "${query}"`
              : 'No active reservations.'
          }
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
              <div style={styles.cardTitle}>
                Order #{shortId(order.order_id)}
              </div>
              <div style={styles.cardSubtitle}>
                {fmtNaira(order.total_amount)} ·{' '}
                {order.store_name || 'Pickup'}
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
          text={
            q
              ? `No deliveries match "${query}"`
              : 'No active deliveries.'
          }
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
            <MdLocalShipping
              size={20}
              color="#0504AA"
              style={{ marginRight: 8 }}
            />
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>
                Order #{shortId(order.order_id)}
              </div>
              <div style={styles.cardSubtitle}>
                {fmtNaira(order.total_amount)} ·{' '}
                {order.status || 'In transit'}
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
                Status: {booking.status || '—'} ·{' '}
                {fmtDate(booking.created_at)}
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
            <MdShoppingBasket
              size={20}
              color="#0504AA"
              style={{ marginRight: 8 }}
            />
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
                <MdCancel
                  size={20}
                  color="#FF0000"
                  style={{ marginRight: 8 }}
                />
              ) : (
                <MdCheckCircle
                  size={20}
                  color="#00AA00"
                  style={{ marginRight: 8 }}
                />
              )}
              <div style={styles.cardContent}>
                <div style={styles.cardTitle}>
                  Order #{shortId(order.order_id)}
                </div>
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
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              borderBottom:
                activeTab === tab
                  ? '2px solid #0504AA'
                  : '2px solid transparent',
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

      {/* Create wanted alert sheet */}
      {showCreateWanted && (
        <div
          style={styles.modalOverlay}
          onClick={() => !creatingWanted && setShowCreateWanted(false)}
        >
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHeader}>
              <h3 style={styles.sheetTitle}>Post a wanted alert</h3>
              <button
                onClick={() => setShowCreateWanted(false)}
                style={styles.iconBtn}
                disabled={creatingWanted}
              >
                <MdClose size={22} color="#666" />
              </button>
            </div>

            <p style={styles.sheetHelper}>
              Tell sellers what you&apos;re looking for. Your alert stays
              active for 30 days.
            </p>

            <label style={styles.fieldLabel}>
              What are you looking for?
              <input
                type="text"
                value={newWantedTitle}
                onChange={(e) => setNewWantedTitle(e.target.value)}
                placeholder="e.g. Chicken Pie, iPhone 14, Standing fan"
                style={styles.textInput}
                maxLength={120}
                autoFocus
              />
            </label>

            <label style={styles.fieldLabel}>
              Details (optional)
              <textarea
                value={newWantedNotes}
                onChange={(e) => setNewWantedNotes(e.target.value)}
                placeholder="Any specific requirements?"
                style={{
                  ...styles.textInput,
                  minHeight: 72,
                  resize: 'vertical',
                }}
                maxLength={500}
              />
            </label>

            <label style={styles.fieldLabel}>
              Budget (optional, ₦)
              <input
                type="number"
                inputMode="decimal"
                value={newWantedBudget}
                onChange={(e) => setNewWantedBudget(e.target.value)}
                placeholder="e.g. 5000"
                style={styles.textInput}
                min={0}
              />
            </label>

            {createWantedError && (
              <div style={styles.inlineError}>{createWantedError}</div>
            )}

            <button
              onClick={handleCreateWanted}
              disabled={creatingWanted || !newWantedTitle.trim()}
              style={{
                ...styles.primaryBtn,
                marginTop: 16,
                opacity:
                  creatingWanted || !newWantedTitle.trim() ? 0.5 : 1,
                cursor:
                  creatingWanted || !newWantedTitle.trim()
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {creatingWanted ? 'Posting…' : 'Post alert'}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

export default function SavedPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          Loading…
        </div>
      }
    >
      <SavedPageContent />
    </Suspense>
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
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 300,
    lineHeight: 1.5,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '1px solid #EEF2FF',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
    flexShrink: 0,
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
  cardMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  cardTrailing: {
    fontSize: 15,
    fontWeight: 600,
    color: '#0504AA',
    marginLeft: 8,
    whiteSpace: 'nowrap',
  },
  createAlertBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 20px',
    marginBottom: 12,
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
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
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.5)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 200,
  },
  sheet: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85vh',
    overflowY: 'auto',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: '16px 20px 32px',
    boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
  },
  sheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1A1A1A',
    margin: 0,
  },
  sheetHelper: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 1.5,
    margin: '4px 0 16px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  textInput: {
    display: 'block',
    width: '100%',
    marginTop: 6,
    padding: '12px 14px',
    fontSize: 14,
    color: '#1A1A1A',
    backgroundColor: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  inlineError: {
    padding: '10px 12px',
    backgroundColor: '#FEE2E2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    color: '#B71C1C',
    fontSize: 13,
  },
};