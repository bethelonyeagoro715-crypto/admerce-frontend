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
  MdAccessTime,
  MdTimer,
  MdStorefront,
  MdLocationOn,
  MdInventory2,
  MdCalendarToday,
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
  item_amount?: number | string;
  status?: string;
  expires_at?: string;
  created_at?: string;
  quantity?: number;
  listing_id?: string;
  store_name?: string;
  store_image_url?: string;
  store_address?: string;
  store_latitude?: number;
  store_longitude?: number;
  storekeeper_name?: string;
  listing_title?: string;
  listing_image_url?: string;
  listing_category?: string;
  customer_name?: string;
  [key: string]: unknown;
}

interface ServiceBooking {
  booking_id?: string;
  service_id?: string;
  service_title?: string;
  service_image_url?: string;
  service_duration?: number;
  title?: string;
  provider_id?: string;
  provider_name?: string;
  provider_image_url?: string;
  provider_avatar?: string;
  customer_id?: string;
  customer_name?: string;
  customer_avatar?: string;
  amount?: number | string;
  status?: string;
  scheduled_for?: string;
  created_at?: string;
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

function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
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

// ─── Time helpers ───────────────────────────────────────────────────
function parseAsUtc(iso?: string | null): number {
  if (!iso) return NaN;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const trimmed = iso.replace(/(\.\d{3})\d+/, '$1');
  return new Date(hasTz ? trimmed : `${trimmed}Z`).getTime();
}

function formatRemaining(expiresMs: number, nowMs: number): string {
  if (!Number.isFinite(expiresMs)) return '';
  const ms = expiresMs - nowMs;
  if (ms <= 0) return 'expired';

  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 60) return `in ${totalSecs}s`;

  const totalMins = Math.floor(totalSecs / 60);
  if (totalMins < 60) {
    return totalMins === 1 ? 'in 1 min' : `in ${totalMins} mins`;
  }

  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 24) {
    return mins > 0 ? `in ${hrs}h ${mins}m` : `in ${hrs}h`;
  }

  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `in ${days}d ${remHrs}h` : `in ${days}d`;
}

// Order status → chip. Colors resolve through CSS vars so the chip
// flips correctly between light and dark.
function statusMeta(status?: string): {
  label: string;
  bg: string;
  fg: string;
  border: string;
} {
  switch ((status || '').toLowerCase()) {
    case 'locked':
      return {
        label: 'Reserved',
        bg: 'var(--brand-soft)',
        fg: 'var(--brand-primary)',
        border: 'var(--brand-primary)',
      };
    case 'accepted':
      return {
        label: 'Holding for pickup',
        bg: 'var(--purple-bg)',
        fg: 'var(--purple-fg)',
        border:
          'color-mix(in srgb, var(--purple-fg) 40%, transparent)',
      };
    case 'picked_up':
      return {
        label: 'Picked up',
        bg: 'var(--success-bg)',
        fg: 'var(--success-fg)',
        border: 'var(--success-strong)',
      };
    case 'dispatched':
      return {
        label: 'Out for delivery',
        bg: 'var(--info-bg)',
        fg: 'var(--info-fg)',
        border:
          'color-mix(in srgb, var(--info-fg) 40%, transparent)',
      };
    case 'returned':
      return {
        label: 'Returned',
        bg: 'var(--bg-tertiary)',
        fg: 'var(--text-secondary)',
        border: 'var(--border-default)',
      };
    case 'expired':
      return {
        label: 'Expired',
        bg: 'var(--bg-tertiary)',
        fg: 'var(--text-muted)',
        border: 'var(--border-default)',
      };
    case 'reversed':
      return {
        label: 'Reversed',
        bg: 'var(--bg-tertiary)',
        fg: 'var(--text-secondary)',
        border: 'var(--border-default)',
      };
    default:
      return {
        label: status ? status : 'Unknown',
        bg: 'var(--bg-tertiary)',
        fg: 'var(--text-secondary)',
        border: 'var(--border-default)',
      };
  }
}

function bookingStatusMeta(status?: string): {
  label: string;
  bg: string;
  fg: string;
  border: string;
} {
  switch ((status || '').toLowerCase()) {
    case 'locked':
      return {
        label: 'Booked',
        bg: 'var(--brand-soft)',
        fg: 'var(--brand-primary)',
        border: 'var(--brand-primary)',
      };
    case 'accepted':
      return {
        label: 'Provider confirmed',
        bg: 'var(--purple-bg)',
        fg: 'var(--purple-fg)',
        border:
          'color-mix(in srgb, var(--purple-fg) 40%, transparent)',
      };
    case 'completed':
      return {
        label: 'Completed',
        bg: 'var(--success-bg)',
        fg: 'var(--success-fg)',
        border: 'var(--success-strong)',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        bg: 'var(--bg-tertiary)',
        fg: 'var(--text-secondary)',
        border: 'var(--border-default)',
      };
    case 'declined':
      return {
        label: 'Declined',
        bg: 'var(--danger-bg)',
        fg: 'var(--danger-fg)',
        border: 'var(--danger-strong)',
      };
    default:
      return {
        label: status ? status : 'Unknown',
        bg: 'var(--bg-tertiary)',
        fg: 'var(--text-secondary)',
        border: 'var(--border-default)',
      };
  }
}

function shortAddress(addr?: string | null): string {
  if (!addr) return '';
  const s = String(addr).trim();
  if (s.length <= 42) return s;
  return `${s.slice(0, 40)}…`;
}

const EXPIRING_SOON_MS = 30 * 60 * 1000;

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

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [showCreateWanted, setShowCreateWanted] = useState(false);
  const [newWantedTitle, setNewWantedTitle] = useState('');
  const [newWantedNotes, setNewWantedNotes] = useState('');
  const [newWantedBudget, setNewWantedBudget] = useState('');
  const [creatingWanted, setCreatingWanted] = useState(false);
  const [createWantedError, setCreateWantedError] = useState<string | null>(
    null,
  );

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
    } else setSavedItems([]);

    if (wantedResult.status === 'fulfilled') {
      const raw = wantedResult.value;
      setWantedAlerts(Array.isArray(raw) ? (raw as WantedAlert[]) : []);
    } else setWantedAlerts([]);

    if (reservationsResult.status === 'fulfilled') {
      const raw = reservationsResult.value;
      setReservations(Array.isArray(raw) ? (raw as WalletOrder[]) : []);
    } else setReservations([]);

    if (deliveriesResult.status === 'fulfilled') {
      const raw = deliveriesResult.value;
      setDeliveries(Array.isArray(raw) ? (raw as WalletOrder[]) : []);
    } else setDeliveries([]);

    if (bookingsResult.status === 'fulfilled') {
      const raw = bookingsResult.value;
      setBookings(Array.isArray(raw) ? (raw as ServiceBooking[]) : []);
    } else setBookings([]);

    if (basketResult.status === 'fulfilled') {
      const raw = basketResult.value as BasketResponse | null;
      const items = Array.isArray(raw?.items)
        ? (raw!.items as BasketItem[])
        : [];
      setBasketItems(items);
      setBasketTotal(Number(raw?.total ?? 0));
    } else {
      setBasketItems([]);
      setBasketTotal(0);
    }

    if (historyResult.status === 'fulfilled') {
      const raw = historyResult.value;
      setHistory(Array.isArray(raw) ? (raw as WalletOrder[]) : []);
    } else setHistory([]);

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
    router.push(`/reservation-confirmed?order_id=${order.order_id}`);
  };

  const openBooking = (booking: ServiceBooking) => {
    if (booking.booking_id) {
      router.push(
        `/booking-confirmed?booking_id=${encodeURIComponent(
          booking.booking_id,
        )}`,
      );
    } else if (booking.service_id) {
      router.push(`/service-detail/${booking.service_id}`);
    }
  };

  const openReceipt = (order: WalletOrder) => {
    router.push(`/shopper/orders/receipt/${order.order_id}`);
  };

  const openStoreOnMap = (order: WalletOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const lat = Number(order.store_latitude ?? NaN);
    const lng = Number(order.store_longitude ?? NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const dest = encodeURIComponent(order.store_name || 'Store');
    router.push(`/map?lat=${lat}&lng=${lng}&destination=${dest}&navigate=true`);
  };

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
      const res = (await api.toggleWantedAlert(id)) as {
        is_active?: boolean;
      };
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
    () =>
      applyFilter(reservations, [
        'order_id',
        'store_name',
        'status',
        'listing_title',
        'store_address',
      ]),
    [reservations, q],
  );
  const filteredDeliveries = useMemo(
    () =>
      applyFilter(deliveries, [
        'order_id',
        'store_name',
        'status',
        'listing_title',
        'store_address',
      ]),
    [deliveries, q],
  );
  const filteredBookings = useMemo(
    () =>
      applyFilter(bookings, [
        'service_title',
        'title',
        'status',
        'booking_id',
        'provider_name',
        'customer_name',
      ]),
    [bookings, q],
  );
  const filteredHistory = useMemo(
    () =>
      applyFilter(history, [
        'order_id',
        'store_name',
        'status',
        'listing_title',
      ]),
    [history, q],
  );
  const filteredBasket = useMemo(
    () =>
      applyFilter(basketItems as unknown as Record<string, unknown>[], [
        'title',
        'store_name',
      ]) as unknown as BasketItem[],
    [basketItems, q],
  );

  const renderOrderCard = (
    order: WalletOrder,
    opts: { showExpiry: boolean },
  ) => {
    const storeImage = resolveImageUrl(order.store_image_url);
    const itemTitle = (order.listing_title as string) || '';
    const storeName = (order.store_name as string) || 'Store';
    const address = (order.store_address as string) || '';
    const expiresMs = parseAsUtc(order.expires_at);
    const expired =
      Number.isFinite(expiresMs) &&
      expiresMs <= nowMs &&
      order.status !== 'picked_up';
    const expiresSoon =
      !expired &&
      opts.showExpiry &&
      Number.isFinite(expiresMs) &&
      expiresMs - nowMs < EXPIRING_SOON_MS &&
      expiresMs - nowMs > 0;
    const meta = statusMeta(order.status);
    const qty = Number(order.quantity ?? 1);
    const hasCoords =
      Number.isFinite(Number(order.store_latitude)) &&
      Number.isFinite(Number(order.store_longitude));

    return (
      <div
        key={order.order_id}
        style={{
          ...styles.resCard,
          ...(expired ? styles.resCardExpired : null),
        }}
        onClick={() => openReservation(order)}
        role="button"
        tabIndex={0}
      >
        <div style={styles.resTopRow}>
          <div style={styles.resThumb}>
            {storeImage ? (
              <img
                src={storeImage}
                alt=""
                loading="lazy"
                style={styles.resThumbImg}
              />
            ) : (
              <MdStorefront size={22} color="var(--text-muted)" />
            )}
          </div>

          <div style={styles.resInfo}>
            <div style={styles.resStoreName} title={storeName}>
              {storeName}
            </div>

            {itemTitle ? (
              <div style={styles.resItemLine} title={itemTitle}>
                <MdInventory2 size={12} color="var(--text-tertiary)" />
                <span style={styles.resItemText}>
                  {itemTitle}
                  {qty > 1 ? ` × ${qty}` : ''}
                </span>
              </div>
            ) : (
              <div style={styles.resItemLine}>
                <MdInventory2 size={12} color="var(--text-muted)" />
                <span
                  style={{ ...styles.resItemText, color: 'var(--text-muted)' }}
                >
                  Order #{shortId(order.order_id)}
                </span>
              </div>
            )}

            {address ? (
              <button
                type="button"
                onClick={(e) => openStoreOnMap(order, e)}
                style={styles.resAddressBtn}
                disabled={!hasCoords}
                title={hasCoords ? 'Open in map' : address}
              >
                <MdLocationOn size={12} color="var(--text-tertiary)" />
                <span style={styles.resAddressText}>
                  {shortAddress(address)}
                </span>
              </button>
            ) : null}
          </div>

          <div style={styles.resAmount}>{fmtNaira(order.total_amount)}</div>
        </div>

        <div style={styles.resBottomRow}>
          <span
            style={{
              ...styles.resChip,
              backgroundColor: meta.bg,
              color: meta.fg,
              borderColor: meta.border,
            }}
          >
            {meta.label}
          </span>

          {opts.showExpiry && Number.isFinite(expiresMs) ? (
            <span
              style={{
                ...styles.resCountdown,
                ...(expired ? styles.resCountdownExpired : null),
                ...(expiresSoon ? styles.resCountdownWarn : null),
              }}
            >
              <MdAccessTime size={13} />
              <span>
                {expired
                  ? 'Expired'
                  : `Expires ${formatRemaining(expiresMs, nowMs)}`}
              </span>
            </span>
          ) : (
            <span style={styles.resCountdown}>
              <MdAccessTime size={13} />
              <span>Ordered {fmtDate(order.created_at)}</span>
            </span>
          )}
        </div>

        {expiresSoon && (
          <div style={styles.resWarnRow}>
            <MdTimer size={14} color="var(--warning-fg)" />
            <span>Expiring soon — pick up before it&apos;s cancelled</span>
          </div>
        )}
      </div>
    );
  };

  const renderBookingCard = (booking: ServiceBooking) => {
    const providerImage = resolveImageUrl(
      booking.provider_image_url || booking.provider_avatar,
    );
    const serviceImage = resolveImageUrl(booking.service_image_url);
    const thumb = providerImage || serviceImage;
    const title =
      booking.service_title || booking.title || 'Service booking';
    const meta = bookingStatusMeta(booking.status);
    const scheduled = booking.scheduled_for
      ? fmtDateTime(booking.scheduled_for)
      : null;
    const created = booking.created_at ? fmtDate(booking.created_at) : '';

    return (
      <div
        key={booking.booking_id || booking.service_id}
        style={styles.resCard}
        onClick={() => openBooking(booking)}
        role="button"
        tabIndex={0}
      >
        <div style={styles.resTopRow}>
          <div style={styles.resThumb}>
            {thumb ? (
              <img
                src={thumb}
                alt=""
                loading="lazy"
                style={styles.resThumbImg}
              />
            ) : (
              <MdBuild size={22} color="var(--text-muted)" />
            )}
          </div>

          <div style={styles.resInfo}>
            <div style={styles.resStoreName} title={title}>
              {title}
            </div>

            {booking.provider_name ? (
              <div style={styles.resItemLine}>
                <MdStorefront size={12} color="var(--text-tertiary)" />
                <span style={styles.resItemText}>
                  {booking.provider_name}
                </span>
              </div>
            ) : null}

            {scheduled ? (
              <div style={styles.resItemLine}>
                <MdCalendarToday size={12} color="var(--text-tertiary)" />
                <span style={styles.resItemText}>{scheduled}</span>
              </div>
            ) : null}
          </div>

          <div style={styles.resAmount}>{fmtNaira(booking.amount)}</div>
        </div>

        <div style={styles.resBottomRow}>
          <span
            style={{
              ...styles.resChip,
              backgroundColor: meta.bg,
              color: meta.fg,
              borderColor: meta.border,
            }}
          >
            {meta.label}
          </span>

          <span style={styles.resCountdown}>
            <MdAccessTime size={13} />
            <span>{created ? `Booked ${created}` : 'View booking'}</span>
          </span>
        </div>
      </div>
    );
  };

  const renderItemsTab = () => {
    if (filteredSaved.length === 0) {
      return (
        <EmptyState
          icon={
            <MdInventory
              size={44}
              color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
            />
          }
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
                  <MdImage size={22} color="var(--text-muted)" />
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
              <MdChevronRight size={16} color="var(--text-muted)" />
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
          <MdAdd size={20} color="var(--brand-on-gradient)" />
          <span style={{ marginLeft: 6 }}>
            Post what you&apos;re looking for
          </span>
        </button>

        {filteredWanted.length === 0 ? (
          <EmptyState
            icon={
              <MdNotificationsActive
                size={44}
                color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
              />
            }
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
                  color={
                    alert.is_active
                      ? 'var(--brand-primary)'
                      : 'var(--text-muted)'
                  }
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
                    {alert.created_at
                      ? ` · ${fmtDate(alert.created_at)}`
                      : ''}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleWanted(alert.id)}
                  style={styles.iconBtn}
                  title={alert.is_active ? 'Pause alert' : 'Resume alert'}
                >
                  {alert.is_active ? (
                    <MdToggleOn size={24} color="var(--brand-primary)" />
                  ) : (
                    <MdToggleOff size={24} color="var(--text-muted)" />
                  )}
                </button>
                <button
                  onClick={() => handleDeleteWanted(alert.id)}
                  style={styles.iconBtn}
                  title="Delete"
                >
                  <MdDeleteOutline size={20} color="var(--danger-fg)" />
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
          icon={
            <MdEventNote
              size={44}
              color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
            />
          }
          text={
            q
              ? `No reservations match "${query}"`
              : 'No active reservations.'
          }
        />
      );
    }
    const sorted = [...filteredReservations].sort((a, b) => {
      const ta = parseAsUtc(a.expires_at);
      const tb = parseAsUtc(b.expires_at);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb;
    });
    return (
      <div style={styles.list}>
        {sorted.map((order) =>
          renderOrderCard(order, { showExpiry: true }),
        )}
      </div>
    );
  };

  const renderDeliveriesTab = () => {
    if (filteredDeliveries.length === 0) {
      return (
        <EmptyState
          icon={
            <MdLocalShipping
              size={44}
              color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
            />
          }
          text={
            q ? `No deliveries match "${query}"` : 'No active deliveries.'
          }
        />
      );
    }
    const sorted = [...filteredDeliveries].sort((a, b) => {
      const ta = parseAsUtc(a.created_at);
      const tb = parseAsUtc(b.created_at);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
    return (
      <div style={styles.list}>
        {sorted.map((order) =>
          renderOrderCard(order, { showExpiry: false }),
        )}
      </div>
    );
  };

  const renderBookingsTab = () => {
    if (filteredBookings.length === 0) {
      return (
        <EmptyState
          icon={
            <MdBuild
              size={44}
              color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
            />
          }
          text={
            q ? `No bookings match "${query}"` : 'No service bookings.'
          }
        />
      );
    }
    const sorted = [...filteredBookings].sort((a, b) => {
      const ta = parseAsUtc(a.created_at);
      const tb = parseAsUtc(b.created_at);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
    return (
      <div style={styles.list}>
        {sorted.map((booking) => renderBookingCard(booking))}
      </div>
    );
  };

  const renderBasketTab = () => {
    if (filteredBasket.length === 0) {
      return (
        <EmptyState
          icon={
            <MdShoppingBasket
              size={44}
              color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
            />
          }
          text={q ? `No basket items match "${query}"` : 'Basket is empty.'}
        />
      );
    }
    return (
      <div style={styles.list}>
        {filteredBasket.map((item, i) => {
          const image = resolveImageUrl(item.image_url);
          const lineTotal =
            Number(item.price || 0) * (item.quantity ?? 1);
          return (
            <div
              key={item.id || item.listing_id || i}
              style={styles.resCard}
              onClick={() =>
                router.push(`/item-detail/${item.listing_id}`)
              }
              role="button"
              tabIndex={0}
            >
              <div style={styles.resTopRow}>
                <div style={styles.resThumb}>
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      style={styles.resThumbImg}
                    />
                  ) : (
                    <MdImage size={22} color="var(--text-muted)" />
                  )}
                </div>
                <div style={styles.resInfo}>
                  <div
                    style={styles.resStoreName}
                    title={item.title || 'Item'}
                  >
                    {item.title || 'Item'}
                  </div>
                  {item.store_name ? (
                    <div style={styles.resItemLine}>
                      <MdStorefront
                        size={12}
                        color="var(--text-tertiary)"
                      />
                      <span style={styles.resItemText}>
                        {item.store_name}
                      </span>
                    </div>
                  ) : null}
                  <div style={styles.resItemLine}>
                    <MdInventory2
                      size={12}
                      color="var(--text-tertiary)"
                    />
                    <span style={styles.resItemText}>
                      Qty {item.quantity ?? 1}
                    </span>
                  </div>
                </div>
                <div style={styles.resAmount}>{fmtNaira(lineTotal)}</div>
              </div>
            </div>
          );
        })}

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
          icon={
            <MdCheckCircle
              size={44}
              color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
            />
          }
          text={q ? `No orders match "${query}"` : 'No past orders.'}
        />
      );
    }
    const sorted = [...filteredHistory].sort((a, b) => {
      const ta = parseAsUtc(a.created_at);
      const tb = parseAsUtc(b.created_at);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
    return (
      <div style={styles.list}>
        {sorted.map((order) =>
          renderOrderCard(order, { showExpiry: false }),
        )}
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
    <main style={styles.container} className="sv-main">
      <style>{CSS}</style>

      <div style={styles.tabBar} className="sv-tabbar">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="sv-tab"
            style={{
              ...styles.tab,
              borderBottom:
                activeTab === tab
                  ? '2px solid var(--brand-primary)'
                  : '2px solid transparent',
              color:
                activeTab === tab
                  ? 'var(--brand-primary)'
                  : 'var(--text-tertiary)',
              fontWeight: activeTab === tab ? 700 : 500,
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
            color="var(--brand-primary)"
            style={{
              animation: isRefreshing
                ? 'spin 0.8s linear infinite'
                : 'none',
            }}
          />
        </button>
      </div>

      <div style={styles.searchWrap} className="sv-search-wrap">
        <MdSearch size={18} color="var(--text-muted)" />
        <input
          type="text"
          placeholder={`Search ${activeTab.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.content} className="sv-content">
        {isLoading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : error ? (
          <div style={styles.center}>
            <MdCancel size={44} color="var(--danger-fg)" />
            <p style={styles.errorText}>{error}</p>
            <button onClick={handleRefresh} style={styles.primaryBtn}>
              Try again
            </button>
          </div>
        ) : (
          renderActiveTab()
        )}
      </div>

      {showCreateWanted && (
        <div
          style={styles.modalOverlay}
          className="sv-modal-overlay"
          onClick={() => !creatingWanted && setShowCreateWanted(false)}
        >
          <div
            style={styles.sheet}
            className="sv-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.sheetHeader}>
              <h3 style={styles.sheetTitle}>Post a wanted alert</h3>
              <button
                onClick={() => setShowCreateWanted(false)}
                style={styles.iconBtn}
                disabled={creatingWanted}
              >
                <MdClose size={22} color="var(--text-tertiary)" />
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
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
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

function EmptyState({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
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
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-default)',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'border-color 0.18s ease',
  },
  tab: {
    background: 'none',
    border: 'none',
    fontSize: 13,
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'inherit',
    transition: 'color 0.15s',
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
    padding: '8px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 10,
    border: '1px solid var(--border-default)',
    flexShrink: 0,
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14,
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
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
    color: 'var(--text-muted)',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorText: {
    color: 'var(--danger-fg)',
    fontSize: 14,
    margin: 0,
    maxWidth: 320,
    lineHeight: 1.5,
  },
  emptyText: {
    fontSize: 14,
    color: 'var(--text-muted)',
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
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 12,
    border: '1px solid var(--border-default)',
    cursor: 'pointer',
    transition: 'background-color 0.15s, border-color 0.15s',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'var(--bg-tertiary)',
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
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 3,
  },
  cardTrailing: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--brand-primary)',
    marginLeft: 8,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },

  resCard: {
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 14,
    border: '1px solid var(--border-default)',
    cursor: 'pointer',
    transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  resCardExpired: {
    backgroundColor: 'var(--bg-tertiary)',
    borderColor: 'var(--border-subtle)',
  },
  resTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  resThumb: {
    width: 48,
    height: 48,
    flex: '0 0 48px',
    borderRadius: 12,
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  resInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  resStoreName: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },
  resItemLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  resItemText: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resAddressBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: 0,
    border: 'none',
    background: 'none',
    textAlign: 'left',
    minWidth: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 1,
  },
  resAddressText: {
    fontSize: 11.5,
    fontWeight: 500,
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resAmount: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
    marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },
  resBottomRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  resChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  resCountdown: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
  },
  resCountdownWarn: {
    color: 'var(--warning-fg)',
    fontWeight: 800,
  },
  resCountdownExpired: {
    color: 'var(--text-muted)',
  },
  resWarnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    marginTop: 2,
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-strong)',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--warning-fg)',
    lineHeight: 1.4,
  },

  createAlertBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 20px',
    marginBottom: 12,
    backgroundColor: 'var(--brand-primary)',
    backgroundImage: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  basketFooter: {
    marginTop: 12,
    padding: 16,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 12,
    border: '1px solid var(--border-default)',
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
    color: 'var(--text-tertiary)',
    fontWeight: 600,
  },
  basketValue: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  primaryBtn: {
    padding: '12px 20px',
    backgroundImage: 'var(--brand-gradient)',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--overlay)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 200,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  sheet: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85vh',
    overflowY: 'auto',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: '16px 20px 32px',
    boxShadow: 'var(--shadow-lg)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
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
    color: 'var(--text-primary)',
    margin: 0,
  },
  sheetHelper: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    lineHeight: 1.5,
    margin: '4px 0 16px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 12,
  },
  textInput: {
    display: 'block',
    width: '100%',
    marginTop: 6,
    padding: '12px 14px',
    fontSize: 14,
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-default)',
    borderRadius: 10,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  inlineError: {
    padding: '10px 12px',
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-strong)',
    borderRadius: 10,
    color: 'var(--danger-fg)',
    fontSize: 13,
  },
};

// ─── Responsive layout ─────────────────────────────────────────────
// Padding/margin for tabbar, searchWrap and content live in CSS so the
// desktop media query can restyle them without !important.
const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }

  .sv-tabbar {
    padding: 0 8px;
  }
  .sv-tab {
    padding: 12px 10px;
  }
  .sv-search-wrap {
    margin: 8px 12px 4px;
  }
  .sv-content {
    padding: 12px 16px 24px;
  }

  @media (min-width: 1024px) {
    .sv-tabbar {
      max-width: 900px;
      width: 100%;
      margin: 0 auto;
      padding: 0 24px;
      justify-content: center;
      overflow-x: visible;
    }
    .sv-tab {
      padding: 14px 20px;
      font-size: 13.5px;
    }
    .sv-search-wrap {
      width: calc(100% - 48px);
      max-width: 900px;
      margin: 16px auto 8px;
      box-sizing: border-box;
    }
    .sv-content {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px 24px 32px;
      box-sizing: border-box;
    }
    .sv-modal-overlay {
      align-items: center !important;
      padding: 24px;
    }
    .sv-sheet {
      border-radius: 20px !important;
      max-height: 80vh;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;