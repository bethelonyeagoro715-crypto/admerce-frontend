'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api, { extractErrorDetail } from '../../../services/api';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import {
  confirmDialog,
  alertDialog,
  promptDialog,
} from '../../../components/ui/dialogs';
import {
  MdRefresh,
  MdEventNote,
  MdLocalShipping,
  MdDeleteOutline,
  MdSwapHoriz,
  MdReceiptLong,
  MdCheckCircleOutline,
  MdCancel,
  MdCheckCircle,
  MdAccessTime,
  MdStorefront,
  MdErrorOutline,
  MdPerson,
  MdSearch,
  MdClose,
  MdSend,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface StoreOrder {
  order_id: string;
  status?: string;
  total_amount?: number;
  customer_name?: string;
  courier_id?: string | null;
  courier_name?: string;
  [key: string]: unknown;
}

interface Store {
  store_id?: string;
  name?: string;
}

type FilterKey =
  | 'all'
  | 'reservations'
  | 'awaiting'
  | 'deliveries'
  | 'cancelled'
  | 'reversed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'awaiting', label: 'Awaiting pickup' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'reversed', label: 'Reversed' },
];

// ─── Helpers ────────────────────────────────────────────────────────
function formatNaira(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '₦0';
  return `₦${Math.round(v).toLocaleString('en-NG')}`;
}

function shortId(id: string): string {
  return id.length > 8 ? id.substring(0, 8) : id;
}

function initialOf(name?: string): string {
  const s = (name || '').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
}

function isReservationStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'locked' || s === 'pending';
}

function isPickedUpStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'completed' || s === 'delivered' || s === 'picked_up';
}

function isCancelledStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'returned' || s === 'refunded' || s === 'declined';
}

function isReversedStatus(status: string): boolean {
  return status.toLowerCase() === 'reversed';
}

function isDeliveryStatus(order: StoreOrder): boolean {
  const s = (order.status || '').toLowerCase();
  return (
    order.courier_id != null &&
    !isPickedUpStatus(s) &&
    !isCancelledStatus(s) &&
    !isReversedStatus(s)
  );
}

// ─── Status metadata ────────────────────────────────────────────────
interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
}

function statusMeta(status: string): StatusMeta {
  const s = (status || 'pending').toLowerCase();
  if (s === 'completed' || s === 'delivered' || s === 'picked_up') {
    return { label: 'Picked up', bg: '#DCFCE7', fg: '#166534' };
  }
  if (s === 'locked' || s === 'pending') {
    return { label: 'Awaiting your hold', bg: '#FEF3C7', fg: '#92400E' };
  }
  if (s === 'accepted') {
    return { label: 'Awaiting pickup', bg: '#F3E8FF', fg: '#6B21A8' };
  }
  if (s === 'dispatched') {
    return { label: 'Dispatched', bg: '#E0F2FE', fg: '#075985' };
  }
  if (s === 'returned' || s === 'refunded') {
    return { label: 'Dropped by shopper', bg: '#FEE2E2', fg: '#991B1B' };
  }
  if (s === 'declined') {
    return { label: 'Declined by you', bg: '#FEE2E2', fg: '#991B1B' };
  }
  if (s === 'reversed') {
    return { label: 'Reversed', bg: '#FEF3C7', fg: '#92400E' };
  }
  return { label: status || 'Pending', bg: '#F1F5F9', fg: '#475569' };
}

// ─── Component ──────────────────────────────────────────────────────
export default function StorekeeperOrdersPage() {
  useAuthGuard();
  const router = useRouter();

  const [allOrders, setAllOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadOrders = useCallback(async (showSpinner = true) => {
    const seq = ++reqSeq.current;
    if (showSpinner) setLoading(true);
    setErrored(false);
    try {
      const store = (await api.getMyStore()) as Store | null;
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      if (!store?.store_id) {
        setStoreId(null);
        setStoreName('');
        setAllOrders([]);
        return;
      }
      setStoreId(store.store_id);
      setStoreName(store.name || '');
      const orders = (await api.getStoreOrders(store.store_id)) as StoreOrder[];
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setAllOrders(Array.isArray(orders) ? orders : []);
    } catch {
      if (seq === reqSeq.current && isMountedRef.current) setErrored(true);
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOrders();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOrders]);

  // ── Derived buckets ────────────────────────────────────────────
  const buckets = useMemo(() => {
    const reservations: StoreOrder[] = [];
    const awaiting: StoreOrder[] = [];
    const deliveries: StoreOrder[] = [];
    const cancelled: StoreOrder[] = [];
    const reversed: StoreOrder[] = [];

    for (const o of allOrders) {
      const s = (o.status || '').toLowerCase();
      if (isReservationStatus(s)) reservations.push(o);
      else if (isReversedStatus(s)) reversed.push(o);
      else if (isCancelledStatus(s)) cancelled.push(o);
      else if (isDeliveryStatus(o)) deliveries.push(o);
      else if (s !== 'completed' && s !== 'delivered' && s !== 'picked_up') {
        awaiting.push(o);
      } else {
        // picked up — appears in "All" only
      }
    }
    // Pickup-complete orders also belong in awaiting? No — they're done.
    // Add them to a hidden bucket for "All" only.
    return { reservations, awaiting, deliveries, cancelled, reversed };
  }, [allOrders]);

  const counts = useMemo(
    () => ({
      all: allOrders.length,
      reservations: buckets.reservations.length,
      awaiting: buckets.awaiting.length,
      deliveries: buckets.deliveries.length,
      cancelled: buckets.cancelled.length,
      reversed: buckets.reversed.length,
    }),
    [allOrders, buckets],
  );

  const filteredOrders = useMemo(() => {
    let base: StoreOrder[];
    switch (activeFilter) {
      case 'reservations':
        base = buckets.reservations;
        break;
      case 'awaiting':
        base = buckets.awaiting;
        break;
      case 'deliveries':
        base = buckets.deliveries;
        break;
      case 'cancelled':
        base = buckets.cancelled;
        break;
      case 'reversed':
        base = buckets.reversed;
        break;
      default:
        base = allOrders;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((o) => {
      const customer = (o.customer_name || '').toLowerCase();
      const orderId = (o.order_id || '').toLowerCase();
      return customer.includes(q) || orderId.includes(q);
    });
  }, [activeFilter, buckets, allOrders, searchQuery]);

  // ── Actions ────────────────────────────────────────────────────
  const holdForPickup = async (
    orderId: string,
    customer: string,
    amount: number,
  ) => {
    const ok = await confirmDialog({
      title: 'Hold this item for the shopper?',
      body:
        `The shopper will be notified. Your payment of ${formatNaira(amount)} ` +
        `stays in escrow until they arrive and confirm pickup. That's when ` +
        `your wallet is credited.`,
      kind: 'info',
      confirmLabel: 'Hold for pickup',
      cancelLabel: 'Not yet',
    });
    if (!ok) return;
    setBusyOrderId(orderId);
    try {
      await api.acceptOrder(orderId);
      await loadOrders(false);
      await alertDialog({
        title: 'Item held',
        body: `${customer}'s order is on hold. You'll receive your payment when they confirm pickup.`,
        kind: 'success',
        confirmLabel: 'Got it',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't hold the item",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyOrderId(null);
    }
  };

  const declineReservation = async (
    orderId: string,
    customer: string,
    amount: number,
  ) => {
    const reason = await promptDialog({
      title: 'Decline this reservation?',
      body:
        `${customer} will be refunded ${formatNaira(amount)} in full and ` +
        `notified. You can add a reason to help them understand — it's optional.`,
      kind: 'warning',
      placeholder: 'e.g. Out of stock, Store is closed today…',
      multiline: true,
      confirmLabel: 'Decline & refund',
      cancelLabel: 'Keep reservation',
      required: false,
    });
    if (reason === null) return;
    setBusyOrderId(orderId);
    try {
      await api.declineOrder(orderId, reason.trim() || undefined);
      await loadOrders(false);
      await alertDialog({
        title: 'Reservation declined',
        body: `${customer} has been refunded and notified.`,
        kind: 'success',
        confirmLabel: 'Done',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't decline",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyOrderId(null);
    }
  };

  const updateDeliveryStatus = async (
    orderId: string,
    newStatus: string,
    customer: string,
  ) => {
    const ok = await confirmDialog({
      title: 'Update delivery status?',
      body: `Set ${customer}'s delivery to "${newStatus}"?`,
      kind: 'warning',
      confirmLabel: 'Update',
    });
    if (!ok) return;
    setBusyOrderId(orderId);
    try {
      await api.updateCourierJobStatus(orderId, newStatus);
      await loadOrders(false);
      await alertDialog({
        title: 'Status updated',
        body: `Delivery is now "${newStatus}".`,
        kind: 'success',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't update",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyOrderId(null);
    }
  };

  const releaseReversed = async (orderId: string) => {
    const ok = await confirmDialog({
      title: 'Release courier fee?',
      body: 'The courier will be paid from this reversed package.',
      kind: 'info',
      confirmLabel: 'Release',
    });
    if (!ok) return;
    setBusyOrderId(orderId);
    try {
      await api.reversedPackage(orderId);
      await loadOrders(false);
      await alertDialog({
        title: 'Fee released',
        body: 'The courier has been paid.',
        kind: 'success',
      });
    } catch (err) {
      await alertDialog({
        title: "Couldn't release",
        body: extractErrorDetail(err, 'Please try again.'),
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyOrderId(null);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────
  if (loading) {
    return (
      <main style={css.root} className="sk-orders">
        <style>{CSS}</style>
        <div style={css.headerWrap}>
          <div style={css.headerInner}>
            <div style={css.headerSkel} />
            <div style={{ ...css.headerSkel, width: 100 }} />
          </div>
        </div>
        <div style={css.sheet}>
          <div style={css.searchSkeleton} />
          <div style={css.pillRowSkeleton} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={css.orderSkeleton} />
          ))}
        </div>
      </main>
    );
  }

  // ── Error ──────────────────────────────────────────────────────
  if (errored) {
    return (
      <main style={css.centerRoot} className="sk-orders">
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="#B91C1C" />
        </div>
        <h2 style={css.centerTitle}>Couldn&apos;t load your orders</h2>
        <p style={css.centerBody}>
          Check your connection and try again. If this keeps happening, sign
          out and back in.
        </p>
        <button onClick={() => void loadOrders()} style={css.centerPrimary}>
          <MdRefresh size={18} color="#fff" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  // ── No store ───────────────────────────────────────────────────
  if (!storeId && allOrders.length === 0) {
    return (
      <main style={css.centerRoot} className="sk-orders">
        <style>{CSS}</style>
        <div style={css.setupHalo}>
          <MdStorefront size={40} color="#0504AA" />
        </div>
        <h2 style={css.centerTitle}>No store yet</h2>
        <p style={css.centerBody}>
          Set up your store first. Orders will start appearing here once
          shoppers reserve your items.
        </p>
        <button
          onClick={() => router.push('/storekeeper/onboarding')}
          style={css.centerPrimary}
        >
          <span>Set up store</span>
        </button>
      </main>
    );
  }

  const hasNoOrders = allOrders.length === 0;
  const hasNoMatches = !hasNoOrders && filteredOrders.length === 0;

  return (
    <main style={css.root} className="sk-orders">
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={css.title}>Orders</h1>
            <div style={css.subtitle}>
              {hasNoOrders
                ? storeName
                  ? `${storeName} · no orders yet`
                  : 'Orders will show up here'
                : `${counts.all} total · ${counts.reservations} need${
                    counts.reservations === 1 ? 's' : ''
                  } your attention`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders()}
            style={css.refreshBtn}
            aria-label="Refresh"
            className="sk-refresh"
          >
            <MdRefresh size={20} color="#fff" />
          </button>
        </div>
      </div>

      <div style={css.sheet}>
        {hasNoOrders ? (
          // ── EMPTY STATE ──────────────────────────────────────
          <div style={css.emptyState}>
            <div style={css.emptyHalo}>
              <MdReceiptLong size={44} color="#0504AA" />
            </div>
            <h2 style={css.emptyTitle}>No orders yet</h2>
            <p style={css.emptyBody}>
              Once shoppers reserve your items, they show up here. Keep your
              listings stocked and visible to get your first sale.
            </p>
            <button
              onClick={() => router.push('/storekeeper/items')}
              style={css.emptyPrimary}
            >
              <span>Manage my items</span>
            </button>
          </div>
        ) : (
          <>
            {/* SEARCH */}
            <div style={css.searchWrap}>
              <MdSearch size={18} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search by customer or order ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                style={css.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={css.searchClear}
                  aria-label="Clear search"
                >
                  <MdClose size={14} color="#64748B" />
                </button>
              )}
            </div>

            {/* FILTER PILLS */}
            <div style={css.pillRow}>
              {FILTERS.map((f) => {
                const active = activeFilter === f.key;
                const count = counts[f.key];
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActiveFilter(f.key)}
                    style={{
                      ...css.pill,
                      borderColor: active ? '#0504AA' : '#E6E8F0',
                      backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
                    }}
                    className="sk-pill"
                  >
                    <span
                      style={{
                        color: active ? '#0504AA' : '#475569',
                        fontWeight: active ? 800 : 700,
                        fontSize: 12.5,
                      }}
                    >
                      {f.label}
                    </span>
                    <span
                      style={{
                        ...css.pillCount,
                        backgroundColor: active ? '#FFFFFF' : '#F1F5F9',
                        color: active ? '#0504AA' : '#64748B',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* LIST */}
            {hasNoMatches ? (
              <div style={css.noMatchWrap}>
                <div style={css.noMatchHalo}>
                  <MdSearch size={32} color="#94A3B8" />
                </div>
                <div style={css.noMatchTitle}>No matches</div>
                <div style={css.noMatchBody}>
                  Try a different word, or clear the filters.
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                  style={css.clearAllBtn}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div style={css.list} className="sk-order-list">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.order_id}
                    order={order}
                    busy={busyOrderId === order.order_id}
                    onHold={() =>
                      holdForPickup(
                        order.order_id,
                        order.customer_name || 'The customer',
                        Number(order.total_amount || 0),
                      )
                    }
                    onDecline={() =>
                      declineReservation(
                        order.order_id,
                        order.customer_name || 'The customer',
                        Number(order.total_amount || 0),
                      )
                    }
                    onUpdateStatus={(status) =>
                      updateDeliveryStatus(
                        order.order_id,
                        status,
                        order.customer_name || 'the customer',
                      )
                    }
                    onRelease={() => releaseReversed(order.order_id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ height: 32 }} />
      </div>
    </main>
  );
}

// ─── Order card ─────────────────────────────────────────────────────
function OrderCard({
  order,
  busy,
  onHold,
  onDecline,
  onUpdateStatus,
  onRelease,
}: {
  order: StoreOrder;
  busy: boolean;
  onHold: () => void;
  onDecline: () => void;
  onUpdateStatus: (status: string) => void;
  onRelease: () => void;
}) {
  const status = (order.status || '').toLowerCase();
  const meta = statusMeta(order.status || 'pending');
  const total = Number(order.total_amount || 0);
  const customer = order.customer_name || 'Customer';
  const isReservation = isReservationStatus(status);
  const isAccepted = status === 'accepted';
  const isPickedUp = isPickedUpStatus(status);
  const isDropped = status === 'returned' || status === 'refunded';
  const isDeclined = status === 'declined';
  const isReversed = status === 'reversed';
  const isDelivery = isDeliveryStatus(order);

  return (
    <div
      style={{ ...css.card, opacity: busy ? 0.55 : 1 }}
      className="sk-order-card"
    >
      {/* TOP: avatar + name/id + status chip */}
      <div style={css.cardTop}>
        <div style={css.avatar}>
          {initialOf(customer)}
        </div>
        <div style={css.cardTopMeta}>
          <div style={css.customerName} title={customer}>
            {customer}
          </div>
          <div style={css.orderId}>Order #{shortId(order.order_id)}</div>
        </div>
        <span
          style={{
            ...css.statusChip,
            backgroundColor: meta.bg,
            color: meta.fg,
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* AMOUNT */}
      <div style={css.amount}>{formatNaira(total)}</div>

      {/* CONTEXT ROW */}
      {isDelivery && (
        <div style={css.contextRow}>
          <MdLocalShipping size={15} color="#0891B2" />
          <span style={css.contextText}>
            Courier: {order.courier_name || 'Assigned'}
          </span>
        </div>
      )}
      {isDropped && (
        <div style={{ ...css.contextRow, ...css.contextRowDanger }}>
          <MdDeleteOutline size={15} color="#991B1B" />
          <span style={{ ...css.contextText, color: '#991B1B' }}>
            Dropped by shopper · Refunded
          </span>
        </div>
      )}
      {isDeclined && (
        <div style={{ ...css.contextRow, ...css.contextRowDanger }}>
          <MdCancel size={15} color="#991B1B" />
          <span style={{ ...css.contextText, color: '#991B1B' }}>
            Declined by you · Refunded
          </span>
        </div>
      )}
      {isReversed && (
        <div style={{ ...css.contextRow, ...css.contextRowWarn }}>
          <MdSwapHoriz size={15} color="#92400E" />
          <span style={{ ...css.contextText, color: '#92400E' }}>
            Package reversed
          </span>
        </div>
      )}

      {/* HOLDING NOTE */}
      {isAccepted && !isPickedUp && (
        <div style={css.holdingNote}>
          <MdAccessTime size={15} color="#6B21A8" />
          <span style={css.holdingNoteText}>
            Waiting for <strong>{customer}</strong> to pick up. Your{' '}
            <strong>{formatNaira(total)}</strong> is held in escrow and
            releases to your wallet when they confirm.
          </span>
        </div>
      )}

      {/* ACTIONS */}
      {!isPickedUp && !isDropped && !isDeclined && !isReversed && (
        <div style={css.actions}>
          {isReservation && (
            <>
              <button
                type="button"
                onClick={onHold}
                disabled={busy}
                style={{ ...css.primaryBtn, opacity: busy ? 0.6 : 1 }}
                className="sk-action-btn"
              >
                <MdCheckCircleOutline size={18} color="#fff" />
                <span>Hold for pickup</span>
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={busy}
                style={{ ...css.dangerBtn, opacity: busy ? 0.6 : 1 }}
                className="sk-action-btn"
              >
                <MdCancel size={18} color="#DC2626" />
                <span>Decline</span>
              </button>
            </>
          )}

          {isDelivery && (
            <div style={css.segmentRow}>
              <DeliverySegment
                label="Pending"
                active={status === 'pending'}
                onClick={() => onUpdateStatus('pending')}
                disabled={busy}
              />
              <DeliverySegment
                label="Dispatched"
                active={status === 'dispatched'}
                onClick={() => onUpdateStatus('dispatched')}
                disabled={busy}
              />
              <DeliverySegment
                label="Delivered"
                active={status === 'delivered'}
                onClick={() => onUpdateStatus('delivered')}
                disabled={busy}
              />
            </div>
          )}
        </div>
      )}

      {isReversed && (
        <div style={css.actions}>
          <button
            type="button"
            onClick={onRelease}
            disabled={busy}
            style={{ ...css.warnBtn, opacity: busy ? 0.6 : 1 }}
            className="sk-action-btn"
          >
            <MdSend size={16} color="#fff" />
            <span>Release courier fee</span>
          </button>
        </div>
      )}

      {/* COMPLETED FOOTNOTE */}
      {isPickedUp && (
        <div style={css.doneRow}>
          <MdCheckCircle size={18} color="#166534" />
          <span style={css.doneText}>Picked up · Funds released</span>
        </div>
      )}
    </div>
  );
}

function DeliverySegment({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || active}
      style={{
        ...css.segment,
        backgroundColor: active ? '#0504AA' : '#FFFFFF',
        borderColor: active ? '#0504AA' : '#E6E8F0',
        color: active ? '#FFFFFF' : '#475569',
        cursor: active || disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ─── Interaction CSS + desktop layout ───────────────────────────────
const CSS = `
  @keyframes skSpin { to { transform: rotate(360deg); } }
  @keyframes skShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  .sk-orders, .sk-orders *, .sk-orders *::before, .sk-orders *::after {
    box-sizing: border-box;
  }

  .sk-refresh {
    transition: transform 0.12s, background-color 0.15s;
  }
  .sk-refresh:hover { background-color: rgba(255,255,255,0.18); }
  .sk-refresh:active { transform: scale(0.94); }

  .sk-pill { transition: background-color 0.15s, border-color 0.15s; }
  .sk-pill:active { transform: scale(0.97); }

  .sk-order-card {
    transition: box-shadow 0.15s ease;
  }
  .sk-order-card:hover {
    box-shadow: 0 10px 24px rgba(15,23,42,0.06) !important;
  }

  .sk-action-btn { transition: transform 0.12s, opacity 0.15s; }
  .sk-action-btn:active:not(:disabled) { transform: scale(0.98); }

  @media (min-width: 1024px) {
    .sk-order-list {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .sk-order-list > div {
      margin-bottom: 0 !important;
    }
  }
`;

// ─── Styles ─────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    overflowX: 'hidden',
  },

  // HEADER
  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    backgroundColor: '#0504AA',
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    padding: '14px 20px',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: 600,
    marginTop: 3,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  headerSkel: {
    height: 20,
    width: 180,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // SHEET
  sheet: {
    flex: 1,
    padding: '16px 20px 40px',
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },

  // SEARCH
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    border: '1px solid #EAECF3',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14.5,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  searchClear: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // PILLS
  pillRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 8px 7px 14px',
    borderRadius: 999,
    border: '1.5px solid',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s, border-color 0.15s',
  },
  pillCount: {
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontVariantNumeric: 'tabular-nums',
  },

  // LIST
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },

  // CARD
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #EAECF3',
    padding: '16px 18px',
    boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 17,
    fontWeight: 800,
    flexShrink: 0,
  },
  cardTopMeta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  customerName: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  orderId: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  statusChip: {
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.2,
    padding: '5px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  // AMOUNT
  amount: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0504AA',
    letterSpacing: -0.6,
    fontVariantNumeric: 'tabular-nums',
    marginTop: 12,
    lineHeight: 1.1,
  },

  // CONTEXT
  contextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: '8px 10px',
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
  },
  contextRowDanger: { backgroundColor: '#FEF2F2' },
  contextRowWarn: { backgroundColor: '#FEF3C7' },
  contextText: {
    fontSize: 12,
    color: '#075985',
    fontWeight: 600,
  },

  // HOLDING NOTE
  holdingNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '11px 13px',
    marginTop: 12,
    backgroundColor: '#F3E8FF',
    border: '1px solid #D8B4FE',
    borderRadius: 12,
  },
  holdingNoteText: {
    fontSize: 12.5,
    color: '#6B21A8',
    fontWeight: 500,
    lineHeight: 1.5,
  },

  // ACTIONS
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flex: 1,
    minWidth: 140,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: '#0504AA',
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 18px rgba(5,4,170,0.22)',
  },
  dangerBtn: {
    flex: 1,
    minWidth: 100,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    color: '#DC2626',
    border: '1.5px solid #FECACA',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  warnBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: '#D97706',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 18px rgba(217,119,6,0.22)',
  },

  // DELIVERY SEGMENT
  segmentRow: {
    display: 'flex',
    gap: 6,
    width: '100%',
    padding: 4,
    backgroundColor: '#F4F5FB',
    borderRadius: 12,
  },
  segment: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 9,
    border: '1.5px solid',
    fontSize: 13,
    fontWeight: 800,
    fontFamily: 'inherit',
    transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
  },

  // DONE
  doneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '10px 12px',
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
  },
  doneText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: 700,
  },

  // EMPTY
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '56px 24px',
    textAlign: 'center',
  },
  emptyHalo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7D2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
    margin: '8px 0 24px',
    maxWidth: 340,
    lineHeight: 1.55,
  },
  emptyPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 22px',
    borderRadius: 14,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 12px 24px rgba(5,4,170,0.28)',
  },

  // NO MATCH
  noMatchWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  noMatchHalo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noMatchTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0B0B1A',
  },
  noMatchBody: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 1.5,
  },
  clearAllBtn: {
    marginTop: 16,
    padding: '10px 18px',
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
    color: '#0504AA',
    border: 'none',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // CENTER SCREENS
  centerRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#F4F5FB',
    padding: 24,
    textAlign: 'center',
  },
  errorHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  setupHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#EEF0FF',
    border: '1px solid #C7D2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.3,
  },
  centerBody: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    maxWidth: 340,
    lineHeight: 1.55,
  },
  centerPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: '13px 24px',
    borderRadius: 14,
    backgroundImage: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5,4,170,0.24)',
  },

  // SKELETONS
  searchSkeleton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  pillRowSkeleton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 12,
    maxWidth: 480,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  orderSkeleton: {
    height: 180,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAECF3',
    marginTop: 12,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
};