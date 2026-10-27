'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { alertDialog, confirmDialog } from '../../../components/ui/dialogs';
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
  MdClose,
  MdAccessTime,
  MdStorefront,
  MdInventory2,
  MdCalendarToday,
  MdClose as MdClear,
  MdFavoriteBorder,
  MdFavorite,
  MdBookmark,
  MdMoreHoriz,
  MdChatBubbleOutline,
  MdSend,
  MdVerified,
  MdShoppingBag,
  MdHistory,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────
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
  store_id?: string;
  [key: string]: unknown;
}

interface BasketResponse {
  items?: BasketItem[];
  total?: number | string;
  [key: string]: unknown;
}

interface InstantCounterparty {
  user_id?: string;
  display_name?: string;
  role?: string;
  store_name?: string | null;
  business_name?: string | null;
}

interface InstantTransaction {
  id?: number;
  reference: string;
  amount?: number | string;
  description?: string;
  status?: string;
  created_at?: string;
  counterparty?: InstantCounterparty | null;
  listing_title?: string;
  listing_image_url?: string;
  store_image_url?: string;
  service_title?: string;
  service_image_url?: string;
  provider_image_url?: string;
  [key: string]: unknown;
}

const TABS = [
  'Items',
  'Wanted',
  'Pickups',
  'Jobs',
  'Reservations',
  'Deliveries',
  'Bookings',
  'Basket',
  'History',
] as const;

type Tab = (typeof TABS)[number];

// ─── Tab icons ──────────────────────────────────────────────────
type TabIcon = React.ComponentType<{
  size?: number | string;
  color?: string;
}>;

const TAB_ICON: Record<Tab, TabIcon> = {
  Items: MdBookmark,
  Wanted: MdSearch,
  Pickups: MdShoppingBag,
  Jobs: MdBuild,
  Reservations: MdEventNote,
  Deliveries: MdLocalShipping,
  Bookings: MdCalendarToday,
  Basket: MdShoppingBasket,
  History: MdHistory,
};

function isValidTab(value: string | null): value is Tab {
  return !!value && (TABS as readonly string[]).includes(value);
}

// ─── Formatters ─────────────────────────────────────────────────
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

function fmtRelative(iso?: string | null): string {
  if (!iso) return '';
  const t = parseAsUtc(iso);
  if (Number.isNaN(t)) return '';
  const secs = Math.floor((Date.now() - t) / 1000);
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(days / 365)}y`;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  if (t.startsWith('http') || t.startsWith('blob:') || t.startsWith('data:')) {
    return t;
  }
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    '';
  if (!base) return t;

  const cleanBase = base.replace(/\/+$/, '');
  return `${cleanBase}${t.startsWith('/') ? '' : '/'}${t}`;
}

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

function statusMeta(status?: string): {
  label: string;
  bg: string;
  fg: string;
} {
  switch ((status || '').toLowerCase()) {
    case 'locked':
      return { label: 'Reserved', bg: 'var(--brand-soft)', fg: 'var(--brand-primary)' };
    case 'accepted':
      return { label: 'Holding', bg: 'var(--purple-bg)', fg: 'var(--purple-fg)' };
    case 'picked_up':
      return { label: 'Picked up', bg: 'var(--success-bg)', fg: 'var(--success-fg)' };
    case 'dispatched':
      return { label: 'Out for delivery', bg: 'var(--info-bg)', fg: 'var(--info-fg)' };
    case 'returned':
      return { label: 'Returned', bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };
    case 'expired':
      return { label: 'Expired', bg: 'var(--bg-tertiary)', fg: 'var(--text-muted)' };
    case 'reversed':
      return { label: 'Reversed', bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };
    default:
      return { label: status ?? 'Unknown', bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };
  }
}

function bookingStatusMeta(status?: string): {
  label: string;
  bg: string;
  fg: string;
} {
  switch ((status || '').toLowerCase()) {
    case 'locked':
      return { label: 'Booked', bg: 'var(--brand-soft)', fg: 'var(--brand-primary)' };
    case 'accepted':
      return { label: 'Confirmed', bg: 'var(--purple-bg)', fg: 'var(--purple-fg)' };
    case 'completed':
      return { label: 'Completed', bg: 'var(--success-bg)', fg: 'var(--success-fg)' };
    case 'cancelled':
      return { label: 'Cancelled', bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };
    case 'declined':
      return { label: 'Declined', bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' };
    default:
      return { label: status ?? 'Unknown', bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };
  }
}

function shortAddress(addr?: string | null): string {
  if (!addr) return '';
  const s = String(addr).trim();
  if (s.length <= 42) return s;
  return `${s.slice(0, 40)}…`;
}

// ─── Main component ─────────────────────────────────────────────
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
  const [searchOpen, setSearchOpen] = useState(false);

  const [savedItems, setSavedItems] = useState<SavedListing[]>([]);
  const [wantedAlerts, setWantedAlerts] = useState<WantedAlert[]>([]);
  const [instantPickups, setInstantPickups] = useState<InstantTransaction[]>([]);
  const [instantJobs, setInstantJobs] = useState<InstantTransaction[]>([]);
  const [reservations, setReservations] = useState<WalletOrder[]>([]);
  const [deliveries, setDeliveries] = useState<WalletOrder[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [basketTotal, setBasketTotal] = useState<number>(0);
  const [history, setHistory] = useState<WalletOrder[]>([]);

  const [liked, setLiked] = useState<Set<string>>(new Set());

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
  const [createWantedError, setCreateWantedError] = useState<string | null>(null);

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
      api.getInstantTransactions(),
    ]);

    const [
      savedResult,
      wantedResult,
      reservationsResult,
      deliveriesResult,
      bookingsResult,
      basketResult,
      historyResult,
      instantResult,
    ] = results;

    setSavedItems(
      savedResult.status === 'fulfilled' && Array.isArray(savedResult.value)
        ? (savedResult.value as SavedListing[])
        : [],
    );
    setWantedAlerts(
      wantedResult.status === 'fulfilled' && Array.isArray(wantedResult.value)
        ? (wantedResult.value as WantedAlert[])
        : [],
    );
    setReservations(
      reservationsResult.status === 'fulfilled' &&
        Array.isArray(reservationsResult.value)
        ? (reservationsResult.value as WalletOrder[])
        : [],
    );
    setDeliveries(
      deliveriesResult.status === 'fulfilled' &&
        Array.isArray(deliveriesResult.value)
        ? (deliveriesResult.value as WalletOrder[])
        : [],
    );
    setBookings(
      bookingsResult.status === 'fulfilled' &&
        Array.isArray(bookingsResult.value)
        ? (bookingsResult.value as ServiceBooking[])
        : [],
    );
    if (basketResult.status === 'fulfilled') {
      const raw = basketResult.value as BasketResponse | null;
      setBasketItems(
        Array.isArray(raw?.items) ? (raw!.items as BasketItem[]) : [],
      );
      setBasketTotal(Number(raw?.total ?? 0));
    } else {
      setBasketItems([]);
      setBasketTotal(0);
    }
    setHistory(
      historyResult.status === 'fulfilled' &&
        Array.isArray(historyResult.value)
        ? (historyResult.value as WalletOrder[])
        : [],
    );
    if (instantResult.status === 'fulfilled') {
      const raw = instantResult.value as {
        pickups: unknown[];
        services: unknown[];
      };
      setInstantPickups(
        Array.isArray(raw?.pickups)
          ? (raw.pickups as InstantTransaction[])
          : [],
      );
      setInstantJobs(
        Array.isArray(raw?.services)
          ? (raw.services as InstantTransaction[])
          : [],
      );
    } else {
      setInstantPickups([]);
      setInstantJobs([]);
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

  const toggleLike = (key: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Delete Handlers ──────────────────────────────────────────────
  const handleDeleteSaved = async (listingId: string) => {
    const ok = await confirmDialog({
      title: 'Remove item?',
      body: 'This will remove the item from your saved list.',
      kind: 'danger',
    });
    if (!ok) return;
    try {
      await api.unsaveListing(listingId);
      setSavedItems((prev) => prev.filter((i) => i.listing_id !== listingId));
    } catch {
      await alertDialog({
        title: 'Failed',
        body: 'Could not remove saved item.',
        kind: 'danger',
      });
    }
  };

  const handleDeleteBasket = async (basketItemId: number) => {
    const ok = await confirmDialog({
      title: 'Remove from basket?',
      body: 'This will remove the item from your basket.',
      kind: 'danger',
    });
    if (!ok) return;
    try {
      await api.removeBasketItem(basketItemId);
      setBasketItems((prev) => prev.filter((i) => i.id !== basketItemId));
    } catch {
      await alertDialog({
        title: 'Failed',
        body: 'Could not remove basket item.',
        kind: 'danger',
      });
    }
  };

  const handleLocalRemove = async (tab: Tab, id: string | number) => {
    const ok = await confirmDialog({
      title: `Remove ${tab.toLowerCase()}?`,
      body: `This will remove this ${tab.toLowerCase()} from your view.`,
      kind: 'danger',
    });
    if (!ok) return;
    
    if (tab === 'Pickups')
      setInstantPickups((prev) =>
        prev.filter((i) => (i.id || i.reference) !== id),
      );
    else if (tab === 'Jobs')
      setInstantJobs((prev) =>
        prev.filter((i) => (i.id || i.reference) !== id),
      );
    else if (tab === 'Reservations')
      setReservations((prev) => prev.filter((i) => i.order_id !== id));
    else if (tab === 'Deliveries')
      setDeliveries((prev) => prev.filter((i) => i.order_id !== id));
    else if (tab === 'Bookings')
      setBookings((prev) =>
        prev.filter((i) => (i.booking_id || i.service_id) !== id),
      );
    else if (tab === 'History')
      setHistory((prev) => prev.filter((i) => i.order_id !== id));
  };

  const openReservation = (order: WalletOrder) =>
    router.push(`/reservation-confirmed?order_id=${order.order_id}`);

  const openBooking = (booking: ServiceBooking) => {
    if (booking.booking_id) {
      router.push(
        `/booking-confirmed?booking_id=${encodeURIComponent(booking.booking_id)}`,
      );
    } else if (booking.service_id) {
      router.push(`/service-detail/${booking.service_id}`);
    }
  };

  const openInstantReceipt = (reference: string) =>
    router.push(`/receipt/instant/${encodeURIComponent(reference)}`);

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
    const ok = await confirmDialog({
      title: 'Delete alert?',
      body: 'This wanted alert will be permanently deleted.',
      kind: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteWantedAlert(id);
      setWantedAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      await alertDialog({
        title: 'Failed',
        body: err instanceof Error ? err.message : 'Failed to delete.',
        kind: 'danger',
      });
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
      await alertDialog({
        title: 'Failed',
        body: err instanceof Error ? err.message : 'Failed to toggle.',
        kind: 'danger',
      });
    }
  };

  // ─── Filtering ──────────────────────────────────────────────────
  const q = query.trim().toLowerCase();

  const applyFilter = <T extends Record<string, unknown>>(
    list: T[],
    fields: (keyof T)[],
  ): T[] => {
    if (!q) return list;
    return list.filter((item) =>
      fields.some((f) =>
        String(item[f] ?? '').toLowerCase().includes(q),
      ),
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
  const filteredPickups = useMemo(
    () =>
      applyFilter(instantPickups as unknown as Record<string, unknown>[], [
        'description',
        'reference',
      ]) as unknown as InstantTransaction[],
    [instantPickups, q],
  );
  const filteredJobs = useMemo(
    () =>
      applyFilter(instantJobs as unknown as Record<string, unknown>[], [
        'description',
        'reference',
      ]) as unknown as InstantTransaction[],
    [instantJobs, q],
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

  // ─── Tab counts ────────────────────────────────────────────────
  const tabCounts = useMemo<Record<Tab, number>>(
    () => ({
      Items: savedItems.length,
      Wanted: wantedAlerts.length,
      Pickups: instantPickups.length,
      Jobs: instantJobs.length,
      Reservations: reservations.length,
      Deliveries: deliveries.length,
      Bookings: bookings.length,
      Basket: basketItems.length,
      History: history.length,
    }),
    [
      savedItems.length,
      wantedAlerts.length,
      instantPickups.length,
      instantJobs.length,
      reservations.length,
      deliveries.length,
      bookings.length,
      basketItems.length,
      history.length,
    ],
  );

  // ─── Instagram-style post card ─────────────────────────────────
  interface PostProps {
    postKey: string;
    avatarUrl: string | null;
    avatarFallback: React.ReactNode;
    authorName: string;
    authorSubtitle?: string;
    verified?: boolean;
    timestamp?: string;
    mediaUrl: string | null;
    mediaFallback: React.ReactNode;
    mediaAspect?: string;
    title?: string;
    caption?: string;
    price?: string;
    chipLabel?: string;
    chipBg?: string;
    chipFg?: string;
    footerLeft?: React.ReactNode;
    onPrimary: () => void;
    primaryLabel: string;
    onDelete?: () => void;
    onChat?: () => void; // 🚨 NEW
  }

  const renderPost = ({
    postKey,
    avatarUrl,
    avatarFallback,
    authorName,
    authorSubtitle,
    verified,
    timestamp,
    mediaUrl,
    mediaFallback,
    mediaAspect = '1 / 1',
    title,
    caption,
    price,
    chipLabel,
    chipBg,
    chipFg,
    footerLeft,
    onPrimary,
    primaryLabel,
    onDelete,
    onChat, // 🚨 NEW
  }: PostProps) => {
    const isLiked = liked.has(postKey);
    
    const realListingId = postKey.startsWith('saved-') 
      ? postKey.replace('saved-', '') 
      : postKey;

    const handleShare = async () => {
      const url = `${window.location.origin}/item-detail/${realListingId}`;
      const shareData = {
        title: title || 'Admerce Item',
        text: `Check out ${title || 'this item'} on Admerce!`,
        url,
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(url);
          await alertDialog({
            title: 'Link Copied',
            body: 'The item link has been copied to your clipboard.',
            kind: 'success',
          });
        }
      } catch (err) {
        // User cancelled
      }
    };

    return (
      <article key={postKey} style={styles.post} className="sv-post">
        {/* ─── Post header ─── */}
        <div style={styles.postHeader}>
          <div style={styles.postAvatar}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                loading="lazy"
                style={styles.postAvatarImg}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div style={styles.postAvatarFallback}>{avatarFallback}</div>
            )}
          </div>

          <div style={styles.postHeaderText}>
            <div style={styles.postAuthorRow}>
              <span style={styles.postAuthorName} title={authorName}>
                {authorName}
              </span>
              {verified && (
                <MdVerified
                  size={14}
                  color="var(--brand-primary)"
                  aria-label="Verified"
                />
              )}
              {authorSubtitle && (
                <span style={styles.postAuthorSub}>
                  · {authorSubtitle}
                </span>
              )}
            </div>
            {timestamp && (
              <span style={styles.postTimestamp}>{timestamp}</span>
            )}
          </div>

          {onDelete ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={styles.postMenuBtn}
              aria-label="Delete"
              title="Delete / Remove"
            >
              <MdDeleteOutline size={20} color="var(--text-tertiary)" />
            </button>
          ) : (
            <button
              type="button"
              style={styles.postMenuBtn}
              aria-label="More"
            >
              <MdMoreHoriz size={20} color="var(--text-tertiary)" />
            </button>
          )}
        </div>

        {/* ─── Media ─── */}
        <button
          type="button"
          onClick={onPrimary}
          style={{ ...styles.postMedia, aspectRatio: mediaAspect }}
          aria-label={title || primaryLabel}
        >
          {mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt=""
              loading="lazy"
              style={styles.postMediaImg}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                const fallback = parent?.querySelector('.sv-fallback');
                if (fallback) (fallback as HTMLElement).style.display = 'flex';
              }}
            />
          ) : null}
          
          <div 
            className="sv-fallback" 
            style={{ 
              ...styles.postMediaFallback, 
              display: mediaUrl ? 'none' : 'flex' 
            }}
          >
            {mediaFallback}
          </div>

          {chipLabel && (
            <span
              style={{
                ...styles.postChipOverlay,
                backgroundColor: chipBg || 'rgba(0,0,0,0.7)',
                color: chipFg || '#fff',
              }}
            >
              {chipLabel}
            </span>
          )}
        </button>

        {/* ─── Action row ─── */}
        <div style={styles.postActions}>
          <button
            type="button"
            onClick={() => toggleLike(postKey)}
            style={styles.postActionBtn}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            {isLiked ? (
              <MdFavorite size={24} color="#ED4956" />
            ) : (
              <MdFavoriteBorder size={24} color="var(--text-primary)" />
            )}
          </button>

          <button
            type="button"
            onClick={onChat || onPrimary} // 🚨 Changed to use onChat
            style={styles.postActionBtn}
            aria-label="Comment"
          >
            <MdChatBubbleOutline size={24} color="var(--text-primary)" />
          </button>

          <button
            type="button"
            onClick={handleShare}
            style={styles.postActionBtn}
            aria-label="Share"
          >
            <MdSend size={22} color="var(--text-primary)" />
          </button>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={onDelete || onPrimary}
            style={styles.postActionBtn}
            aria-label="Save"
            title="Saved"
          >
            <MdBookmark size={24} color="var(--text-primary)" />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div style={styles.postBody}>
          {price && (
            <div style={styles.postPrice}>{price}</div>
          )}

          {title && (
            <div style={styles.postTitle}>
              <span style={styles.postAuthorInline}>{authorName}</span>{' '}
              {title}
            </div>
          )}

          {caption && (
            <div style={styles.postCaption}>{caption}</div>
          )}

          {footerLeft && (
            <div style={styles.postFooterLeft}>{footerLeft}</div>
          )}

          <button
            type="button"
            onClick={onPrimary}
            style={styles.postCtaRow}
          >
            <span>{primaryLabel}</span>
            <MdChevronRight size={16} color="var(--brand-primary)" />
          </button>
        </div>
      </article>
    );
  };

  // ─── Renderers per tab ─────────────────────────────────────────
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
          text={
            q
              ? `No saved items match "${query}"`
              : 'No saved items yet. Tap the bookmark on any listing to save it.'
          }
        />
      );
    }

    return (
      <div style={styles.feed} className="sv-feed">
        {filteredSaved.map((item) => {
          const image = resolveImageUrl(item.image_url);
          const key = `saved-${item.listing_id}`;
          return renderPost({
            postKey: key,
            avatarUrl: null,
            avatarFallback: (
              <span style={styles.avatarInitial}>
                {(item.store_name || 'S').charAt(0).toUpperCase()}
              </span>
            ),
            authorName: item.store_name || 'Store',
            timestamp: item.saved_at ? fmtRelative(item.saved_at) : undefined,
            mediaUrl: image,
            mediaFallback: (
              <MdImage size={44} color="var(--text-muted)" />
            ),
            title: item.title || 'Listing',
            price: fmtNaira(item.price),
            primaryLabel: 'View listing',
            onPrimary: () => router.push(`/item-detail/${item.listing_id}`),
            onDelete: () => handleDeleteSaved(item.listing_id),
            onChat: item.store_id ? () => router.push(`/chat/${item.store_id}`) : undefined,
          });
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
          <div style={styles.feed} className="sv-feed">
            {filteredWanted.map((alert) => {
              const key = `wanted-${alert.id}`;
              return (
                <article key={key} style={styles.post} className="sv-post">
                  <div style={styles.postHeader}>
                    <div
                      style={{
                        ...styles.postAvatar,
                        backgroundColor: alert.is_active
                          ? 'var(--brand-soft)'
                          : 'var(--bg-tertiary)',
                      }}
                    >
                      <MdNotificationsActive
                        size={20}
                        color={
                          alert.is_active
                            ? 'var(--brand-primary)'
                            : 'var(--text-muted)'
                        }
                      />
                    </div>
                    <div style={styles.postHeaderText}>
                      <div style={styles.postAuthorRow}>
                        <span style={styles.postAuthorName}>
                          Your wanted alert
                        </span>
                        <span
                          style={{
                            ...styles.wantedStatusPill,
                            backgroundColor: alert.is_active
                              ? 'var(--success-bg)'
                              : 'var(--bg-tertiary)',
                            color: alert.is_active
                              ? 'var(--success-fg)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {alert.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      {alert.created_at && (
                        <span style={styles.postTimestamp}>
                          {fmtRelative(alert.created_at)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteWanted(alert.id)}
                      style={styles.postMenuBtn}
                      aria-label="Delete Alert"
                      title="Delete Alert"
                    >
                      <MdDeleteOutline size={20} color="var(--text-tertiary)" />
                    </button>
                  </div>

                  <div style={styles.wantedBody}>
                    <div style={styles.wantedTitle}>{alert.title}</div>
                    {alert.notes && (
                      <div style={styles.wantedNotes}>{alert.notes}</div>
                    )}
                    {alert.budget != null && (
                      <div style={styles.wantedBudget}>
                        Budget: {fmtNaira(alert.budget)}
                      </div>
                    )}
                  </div>

                  <div style={styles.wantedActions}>
                    <button
                      onClick={() => handleToggleWanted(alert.id)}
                      style={styles.wantedActionBtn}
                    >
                      {alert.is_active ? 'Pause' : 'Resume'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const renderOrderPost = (
    order: WalletOrder,
    opts: { showExpiry: boolean; tab: Tab }
  ) => {
    const storeImage = resolveImageUrl(order.store_image_url);
    const listingImage = resolveImageUrl(order.listing_image_url);
    const media = listingImage || storeImage;
    const storeName = (order.store_name as string) || 'Store';
    const itemTitle = (order.listing_title as string) || '';
    const address = (order.store_address as string) || '';
    const expiresMs = parseAsUtc(order.expires_at);
    const expired =
      Number.isFinite(expiresMs) &&
      expiresMs <= nowMs &&
      order.status !== 'picked_up';
    const meta = statusMeta(order.status);
    const qty = Number(order.quantity ?? 1);
    const key = `order-${order.order_id}`;

    const caption = address ? `📍 ${shortAddress(address)}` : undefined;

    return renderPost({
      postKey: key,
      avatarUrl: storeImage,
      avatarFallback: (
        <span style={styles.avatarInitial}>
          {storeName.charAt(0).toUpperCase()}
        </span>
      ),
      authorName: storeName,
      timestamp: order.created_at ? fmtRelative(order.created_at) : undefined,
      mediaUrl: media,
      mediaFallback: (
        <MdStorefront size={44} color="var(--text-muted)" />
      ),
      mediaAspect: '1 / 1',
      title: itemTitle
        ? `${itemTitle}${qty > 1 ? ` × ${qty}` : ''}`
        : `Order #${shortId(order.order_id)}`,
      caption,
      price: fmtNaira(order.total_amount),
      chipLabel: meta.label.toUpperCase(),
      chipBg: meta.bg,
      chipFg: meta.fg,
      footerLeft: opts.showExpiry && Number.isFinite(expiresMs) ? (
        <div
          style={{
            ...styles.expiryRow,
            ...(expired ? styles.expiryRowMuted : null),
          }}
        >
          <MdAccessTime size={13} />
          <span>
            {expired
              ? 'Expired'
              : `Expires ${formatRemaining(expiresMs, nowMs)}`}
          </span>
        </div>
      ) : (
        <div style={styles.expiryRow}>
          <MdAccessTime size={13} />
          <span>Ordered {fmtDate(order.created_at)}</span>
        </div>
      ),
      primaryLabel: 'Open order',
      onPrimary: () => openReservation(order),
      onDelete: () => handleLocalRemove(opts.tab, order.order_id),
    });
  };

  const renderBookingPost = (booking: ServiceBooking) => {
    const providerImage = resolveImageUrl(
      booking.provider_image_url || booking.provider_avatar
    );
    const serviceImage = resolveImageUrl(booking.service_image_url);
    const media = serviceImage || providerImage;
    const title =
      booking.service_title || booking.title || 'Service booking';
    const providerName = booking.provider_name || 'Provider';
    const meta = bookingStatusMeta(booking.status);
    const scheduled = booking.scheduled_for
      ? fmtDateTime(booking.scheduled_for)
      : null;
    const key = `booking-${booking.booking_id || booking.service_id}`;

    return renderPost({
      postKey: key,
      avatarUrl: providerImage,
      avatarFallback: (
        <span style={styles.avatarInitial}>
          {providerName.charAt(0).toUpperCase()}
        </span>
      ),
      authorName: providerName,
      timestamp: booking.created_at
        ? fmtRelative(booking.created_at)
        : undefined,
      mediaUrl: media,
      mediaFallback: <MdBuild size={44} color="var(--text-muted)" />,
      mediaAspect: '16 / 10',
      title,
      caption: scheduled ? `📅 ${scheduled}` : undefined,
      price: fmtNaira(booking.amount),
      chipLabel: meta.label.toUpperCase(),
      chipBg: meta.bg,
      chipFg: meta.fg,
      primaryLabel: 'View booking',
      onPrimary: () => openBooking(booking),
      onDelete: () =>
        handleLocalRemove(
          'Bookings',
          booking.booking_id || booking.service_id || ''
        ),
      onChat: booking.provider_id ? () => router.push(`/chat/${booking.provider_id}`) : undefined,
    });
  };

  const renderInstantPost = (
    txn: InstantTransaction,
    kind: 'pickup' | 'job'
  ) => {
    const ref = txn.reference;
    const amount = Number(txn.amount ?? 0);
    const description =
      txn.description ||
      (kind === 'pickup' ? 'Instant pickup' : 'Service payment');
    const status = (txn.status || 'completed').toLowerCase();
    const cp = txn.counterparty || null;

    const counterpartyLabel =
      kind === 'pickup'
        ? cp?.store_name || cp?.display_name || 'Store'
        : cp?.business_name || cp?.display_name || 'Provider';

    const statusChip =
      status === 'completed'
        ? { bg: 'var(--success-bg)', fg: 'var(--success-fg)' }
        : status === 'pending'
          ? { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' }
          : { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' };

    const key = `instant-${ref}`;

    const mediaUrl = resolveImageUrl(
      kind === 'pickup'
        ? txn.listing_image_url || txn.store_image_url
        : txn.service_image_url || txn.provider_image_url
    );

    return renderPost({
      postKey: key,
      avatarUrl: null,
      avatarFallback:
        kind === 'pickup' ? (
          <MdInventory2 size={20} color="var(--brand-primary)" />
        ) : (
          <MdBuild size={20} color="var(--brand-primary)" />
        ),
      authorName: counterpartyLabel,
      timestamp: txn.created_at ? fmtRelative(txn.created_at) : undefined,
      mediaUrl: mediaUrl,
      mediaFallback:
        kind === 'pickup' ? (
          <MdInventory2 size={44} color="var(--text-muted)" />
        ) : (
          <MdBuild size={44} color="var(--text-muted)" />
        ),
      mediaAspect: '16 / 9',
      title: description,
      price: fmtNaira(amount),
      chipLabel: status === 'completed' ? 'PAID' : status.toUpperCase(),
      chipBg: statusChip.bg,
      chipFg: statusChip.fg,
      primaryLabel: 'View receipt',
      onPrimary: () => openInstantReceipt(ref),
      onDelete: () =>
        handleLocalRemove(kind === 'pickup' ? 'Pickups' : 'Jobs', txn.id || ref),
      onChat: cp?.user_id ? () => router.push(`/chat/${cp.user_id}`) : undefined,
    });
  };

  const renderBasketPost = (item: BasketItem, index: number) => {
    const image = resolveImageUrl(item.image_url);
    const lineTotal = Number(item.price || 0) * (item.quantity ?? 1);
    const key = `basket-${item.id || item.listing_id || index}`;
    const storeName = item.store_name || 'Store';

    return renderPost({
      postKey: key,
      avatarUrl: null,
      avatarFallback: (
        <span style={styles.avatarInitial}>
          {storeName.charAt(0).toUpperCase()}
        </span>
      ),
      authorName: storeName,
      timestamp: 'in basket',
      mediaUrl: image,
      mediaFallback: <MdImage size={44} color="var(--text-muted)" />,
      title: item.title || 'Item',
      caption: `Qty ${item.quantity ?? 1}`,
      price: fmtNaira(lineTotal),
      primaryLabel: 'View listing',
      onPrimary: () => router.push(`/item-detail/${item.listing_id}`),
      onDelete: () => handleDeleteBasket(item.id),
      onChat: item.store_id ? () => router.push(`/chat/${item.store_id}`) : undefined,
    });
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Items':
        return renderItemsTab();
      case 'Wanted':
        return renderWantedTab();
      case 'Pickups':
        if (filteredPickups.length === 0) {
          return (
            <EmptyState
              icon={
                <MdInventory
                  size={44}
                  color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
                />
              }
              text={
                q
                  ? `No pickups match "${query}"`
                  : 'No instant pickups yet. Pay at a store to see them here.'
              }
            />
          );
        }
        return (
          <div style={styles.feed} className="sv-feed">
            {filteredPickups.map((p) => renderInstantPost(p, 'pickup'))}
          </div>
        );
      case 'Jobs':
        if (filteredJobs.length === 0) {
          return (
            <EmptyState
              icon={
                <MdBuild
                  size={44}
                  color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
                />
              }
              text={
                q
                  ? `No jobs match "${query}"`
                  : 'No instant service payments yet.'
              }
            />
          );
        }
        return (
          <div style={styles.feed} className="sv-feed">
            {filteredJobs.map((j) => renderInstantPost(j, 'job'))}
          </div>
        );
      case 'Reservations':
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
        return (
          <div style={styles.feed} className="sv-feed">
            {[...filteredReservations]
              .sort((a, b) => {
                const ta = parseAsUtc(a.expires_at);
                const tb = parseAsUtc(b.expires_at);
                if (Number.isNaN(ta)) return 1;
                if (Number.isNaN(tb)) return -1;
                return ta - tb;
              })
              .map((order) =>
                renderOrderPost(order, {
                  showExpiry: true,
                  tab: 'Reservations',
                })
              )}
          </div>
        );
      case 'Deliveries':
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
                q
                  ? `No deliveries match "${query}"`
                  : 'No active deliveries.'
              }
            />
          );
        }
        return (
          <div style={styles.feed} className="sv-feed">
            {[...filteredDeliveries]
              .sort((a, b) => {
                const ta = parseAsUtc(a.created_at);
                const tb = parseAsUtc(b.created_at);
                if (Number.isNaN(ta)) return 1;
                if (Number.isNaN(tb)) return -1;
                return tb - ta;
              })
              .map((order) =>
                renderOrderPost(order, {
                  showExpiry: false,
                  tab: 'Deliveries',
                })
              )}
          </div>
        );
      case 'Bookings':
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
                q
                  ? `No bookings match "${query}"`
                  : 'No service bookings.'
              }
            />
          );
        }
        return (
          <div style={styles.feed} className="sv-feed">
            {[...filteredBookings]
              .sort((a, b) => {
                const ta = parseAsUtc(a.created_at);
                const tb = parseAsUtc(b.created_at);
                if (Number.isNaN(ta)) return 1;
                if (Number.isNaN(tb)) return -1;
                return tb - ta;
              })
              .map((booking) => renderBookingPost(booking))}
          </div>
        );
      case 'Basket':
        if (filteredBasket.length === 0) {
          return (
            <EmptyState
              icon={
                <MdShoppingBasket
                  size={44}
                  color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
                />
              }
              text={
                q ? `No basket items match "${query}"` : 'Basket is empty.'
              }
            />
          );
        }
        return (
          <div style={styles.feed} className="sv-feed">
            {filteredBasket.map((item, i) => renderBasketPost(item, i))}
            <div style={styles.basketFooter}>
              <div style={styles.basketTotalRow}>
                <span style={styles.basketLabel}>Subtotal</span>
                <span style={styles.basketValue}>
                  {fmtNaira(basketTotal)}
                </span>
              </div>
              <button
                onClick={() => router.push('/basket')}
                style={styles.primaryBtn}
              >
                View basket &amp; checkout
              </button>
            </div>
          </div>
        );
      case 'History':
        if (filteredHistory.length === 0) {
          return (
            <EmptyState
              icon={
                <MdCheckCircle
                  size={44}
                  color="color-mix(in srgb, var(--brand-primary) 55%, transparent)"
                />
              }
              text={
                q ? `No orders match "${query}"` : 'No past orders.'
              }
            />
          );
        }
        return (
          <div style={styles.feed} className="sv-feed">
            {[...filteredHistory]
              .sort((a, b) => {
                const ta = parseAsUtc(a.created_at);
                const tb = parseAsUtc(b.created_at);
                if (Number.isNaN(ta)) return 1;
                if (Number.isNaN(tb)) return -1;
                return tb - ta;
              })
              .map((order) =>
                renderOrderPost(order, {
                  showExpiry: false,
                  tab: 'History',
                })
              )}
          </div>
        );
    }
  };

  const totalActivity =
    savedItems.length +
    wantedAlerts.length +
    instantPickups.length +
    instantJobs.length +
    reservations.length +
    deliveries.length +
    bookings.length +
    basketItems.length +
    history.length;

  return (
    <main style={styles.root} className="sv-root">
      <style>{KF}</style>
      <style>{CSS}</style>

      {/* ═══ Header ══════════════════════════════════════════ */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerText}>
            <h1 style={styles.headerTitle}>Saved</h1>
            <p style={styles.headerSub}>
              {isLoading
                ? 'Loading…'
                : totalActivity === 0
                  ? 'Your bookmarks, orders, and alerts'
                  : `${totalActivity} ${totalActivity === 1 ? 'item' : 'items'} in your activity`}
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              style={{
                ...styles.iconBtn,
                backgroundColor: searchOpen
                  ? 'var(--brand-soft)'
                  : 'transparent',
                color: searchOpen
                  ? 'var(--brand-primary)'
                  : 'var(--text-primary)',
              }}
              aria-label="Search"
              title="Search"
            >
              <MdSearch size={22} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={styles.iconBtn}
              aria-label="Refresh"
              title="Refresh"
            >
              <MdRefresh
                size={22}
                style={{
                  animation: isRefreshing
                    ? 'spin 0.8s linear infinite'
                    : 'none',
                }}
              />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div style={styles.searchBar}>
            <MdSearch size={18} color="var(--text-muted)" />
            <input
              autoFocus
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={styles.searchInput}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={styles.searchClear}
                aria-label="Clear search"
              >
                <MdClear size={16} color="var(--text-tertiary)" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* ═══ Tab pills ═══════════════════════════════════════ */}
      <nav style={styles.tabStrip} className="sv-tab-strip" role="tablist">
        {TABS.map((tab) => {
          const active = activeTab === tab;
          const count = tabCounts[tab];
          const Icon = TAB_ICON[tab];
          const iconColor = active
            ? 'var(--brand-on-gradient)'
            : 'var(--text-secondary)';
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab)}
              className={active ? 'sv-pill sv-pill-active' : 'sv-pill'}
              style={{
                ...styles.pill,
                backgroundColor: active
                  ? 'var(--brand-primary)'
                  : 'var(--bg-secondary)',
                backgroundImage: active ? 'var(--brand-gradient)' : 'none',
                color: active
                  ? 'var(--brand-on-gradient)'
                  : 'var(--text-secondary)',
                borderColor: active
                  ? 'transparent'
                  : 'var(--border-default)',
                boxShadow: active ? 'var(--shadow-brand)' : 'none',
              }}
            >
              <Icon size={16} color={iconColor} />
              <span>{tab}</span>
              {count > 0 && (
                <span
                  style={{
                    ...styles.pillBadge,
                    backgroundColor: active
                      ? 'color-mix(in srgb, var(--brand-on-gradient) 22%, transparent)'
                      : 'var(--bg-tertiary)',
                    color: active
                      ? 'var(--brand-on-gradient)'
                      : 'var(--text-tertiary)',
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ═══ Content ═════════════════════════════════════════ */}
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

      {/* ═══ Wanted modal ════════════════════════════════════ */}
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
                aria-label="Close"
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
    <div style={styles.emptyCenter}>
      <div style={styles.emptyIconWrap}>{icon}</div>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

// ─── Keyframes + layout CSS ─────────────────────────────────────
const KF = `
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const CSS = `
  .sv-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.18s ease, color 0.18s ease;
    max-width: 100%;
    overflow-x: hidden;
  }

  .sv-tab-strip {
    display: flex;
    gap: 8px;
    padding: 10px 16px 14px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-primary);
    transition: background-color 0.18s ease, border-color 0.18s ease;
  }
  .sv-tab-strip::-webkit-scrollbar { display: none; }

  .sv-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      transform 0.12s ease,
      box-shadow 0.18s ease,
      background 0.2s ease,
      color 0.2s ease,
      border-color 0.2s ease;
  }
  .sv-pill:hover:not(.sv-pill-active) {
    background-color: var(--bg-hover) !important;
    border-color: var(--border-strong) !important;
    transform: translateY(-1px);
  }
  .sv-pill:active {
    transform: scale(0.97);
  }

  .sv-feed {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;
  }

  @media (min-width: 900px) {
    .sv-root {
      max-width: 100%;
      margin: 0 auto;
    }
    .sv-tab-strip {
      padding: 12px 32px 16px;
      justify-content: center;
    }
    .sv-content {
      padding: 24px 32px 40px !important;
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .sv-pill {
      padding: 10px 18px;
      font-size: 13.5px;
    }
    .sv-feed {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      width: 100%;
    }
    .sv-post {
      background: var(--bg-secondary);
      border: 1px solid var(--border-default) !important;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      margin-bottom: 0;
      transition: transform 0.2s;
      min-width: 0;
      width: 100%;
    }
    .sv-post:hover {
      border-color: color-mix(in srgb, var(--brand-primary) 30%, transparent) !important;
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

  @media (min-width: 1440px) {
    .sv-content {
      max-width: 1100px;
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

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },

  header: {
    padding: '14px 16px 8px',
    backgroundColor: 'var(--bg-primary)',
    transition: 'background-color 0.18s ease',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { minWidth: 0, flex: 1 },
  headerTitle: {
    fontSize: 24,
    lineHeight: 1.1,
    fontWeight: 850,
    letterSpacing: '-0.03em',
    margin: 0,
    color: 'var(--text-primary)',
  },
  headerSub: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    margin: '4px 0 0',
    fontWeight: 500,
  },
  headerActions: { display: 'flex', gap: 6, flexShrink: 0 },
  iconBtn: {
    width: 38,
    height: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s, transform 0.12s',
  },

  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: '10px 14px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 14,
    border: '1.5px solid transparent',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14.5,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
  },
  searchClear: {
    width: 22,
    height: 22,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    border: 'none',
    backgroundColor: 'var(--border-default)',
    cursor: 'pointer',
    padding: 0,
  },

  tabStrip: {
    display: 'flex',
    gap: 8,
    padding: '10px 16px 14px',
    overflowX: 'auto',
    borderBottom: '1px solid var(--border-default)',
    backgroundColor: 'var(--bg-primary)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 14px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
  pillBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1,
  },

  content: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '14px 0 32px',
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
  emptyCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '56px 24px',
    gap: 12,
    textAlign: 'center',
  },
  emptyIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
    margin: 0,
    maxWidth: 320,
    lineHeight: 1.5,
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

  feed: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },

  post: {
    backgroundColor: 'var(--bg-primary)',
    borderTop: '1px solid var(--border-default)',
    borderBottom: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },

  postHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
  },
  postAvatar: {
    width: 36,
    height: 36,
    flex: '0 0 36px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow:
      '0 0 0 2px var(--bg-primary), 0 0 0 3.5px var(--brand-primary)',
  },
  postAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  postAvatarFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--brand-primary)',
    backgroundColor: 'var(--brand-soft)',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--brand-primary)',
  },
  postHeaderText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  postAuthorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  postAuthorName: {
    fontSize: 13.5,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  postAuthorSub: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-tertiary)',
  },
  postTimestamp: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  postMenuBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },

  postMedia: {
    position: 'relative',
    width: '100%',
    padding: 0,
    border: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    cursor: 'pointer',
    overflow: 'hidden',
    fontFamily: 'inherit',
    display: 'block',
  },
  postMediaImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  postMediaFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-tertiary)',
  },
  postChipOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
    pointerEvents: 'none',
  },

  postActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px 2px',
  },
  postActionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    transition: 'transform 0.12s',
  },

  postBody: {
    padding: '0 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  postPrice: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  postTitle: {
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
  },
  postAuthorInline: {
    fontWeight: 800,
    marginRight: 4,
  },
  postCaption: {
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  postFooterLeft: {
    marginTop: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  postCtaRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'var(--brand-primary)',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },

  expiryRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
  },
  expiryRowMuted: {
    color: 'var(--text-muted)',
  },

  wantedBody: {
    padding: '4px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  wantedTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  wantedNotes: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    wordBreak: 'break-word',
  },
  wantedBudget: {
    fontSize: 13.5,
    fontWeight: 700,
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  wantedStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginLeft: 6,
  },
  wantedActions: {
    display: 'flex',
    gap: 8,
    padding: '0 14px 14px',
  },
  wantedActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '7px 14px',
    borderRadius: 999,
    border: '1px solid var(--border-default)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  createAlertBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 20px',
    marginBottom: 18,
    backgroundColor: 'var(--brand-primary)',
    backgroundImage: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },

  basketFooter: {
    marginTop: 10,
    padding: 16,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 14,
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
    borderRadius: 12,
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
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
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
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
    borderRadius: 12,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  inlineError: {
    padding: '10px 12px',
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-strong)',
    borderRadius: 12,
    color: 'var(--danger-fg)',
    fontSize: 13,
  },
};