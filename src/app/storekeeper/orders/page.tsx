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
  MdSearch,
  MdClose,
  MdSend,
} from 'react-icons/md';

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
  return (
    s === 'completed' || s === 'delivered' || s === 'picked_up'
  );
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

interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
}

function statusMeta(status: string): StatusMeta {
  const s = (status || 'pending').toLowerCase();
  if (s === 'completed' || s === 'delivered' || s === 'picked_up') {
    return {
      label: 'Picked up',
      bg: 'var(--success-bg)',
      fg: 'var(--success-fg)',
    };
  }
  if (s === 'locked' || s === 'pending') {
    return {
      label: 'Awaiting your hold',
      bg: 'var(--warning-bg)',
      fg: 'var(--warning-fg)',
    };
  }
  if (s === 'accepted') {
    return {
      label: 'Awaiting pickup',
      bg: 'var(--purple-bg)',
      fg: 'var(--purple-fg)',
    };
  }
  if (s === 'dispatched') {
    return {
      label: 'Dispatched',
      bg: 'var(--info-bg)',
      fg: 'var(--info-fg)',
    };
  }
  if (s === 'returned' || s === 'refunded') {
    return {
      label: 'Dropped by shopper',
      bg: 'var(--danger-bg)',
      fg: 'var(--danger-fg)',
    };
  }
  if (s === 'declined') {
    return {
      label: 'Declined by you',
      bg: 'var(--danger-bg)',
      fg: 'var(--danger-fg)',
    };
  }
  if (s === 'reversed') {
    return {
      label: 'Reversed',
      bg: 'var(--warning-bg)',
      fg: 'var(--warning-fg)',
    };
  }
  return {
    label: status || 'Pending',
    bg: 'var(--bg-tertiary)',
    fg: 'var(--text-secondary)',
  };
}

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
      const orders = (await api.getStoreOrders(
        store.store_id,
      )) as StoreOrder[];
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setAllOrders(Array.isArray(orders) ? orders : []);
    } catch {
      if (seq === reqSeq.current && isMountedRef.current)
        setErrored(true);
    } finally {
      if (seq === reqSeq.current && isMountedRef.current)
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOrders();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOrders]);

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
      else if (
        s !== 'completed' &&
        s !== 'delivered' &&
        s !== 'picked_up'
      ) {
        awaiting.push(o);
      }
    }
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

  if (errored) {
    return (
      <main style={css.centerRoot} className="sk-orders">
        <style>{CSS}</style>
        <div style={css.errorHalo}>
          <MdErrorOutline size={40} color="var(--danger-fg)" />
        </div>
        <h2 style={css.centerTitle}>
          Couldn&apos;t load your orders
        </h2>
        <p style={css.centerBody}>
          Check your connection and try again. If this keeps happening,
          sign out and back in.
        </p>
        <button
          onClick={() => void loadOrders()}
          style={css.centerPrimary}
        >
          <MdRefresh size={18} color="var(--brand-on-gradient)" />
          <span>Retry</span>
        </button>
      </main>
    );
  }

  if (!storeId && allOrders.length === 0) {
    return (
      <main style={css.centerRoot} className="sk-orders">
        <style>{CSS}</style>
        <div style={css.setupHalo}>
          <MdStorefront size={40} color="var(--brand-primary)" />
        </div>
        <h2 style={css.centerTitle}>No store yet</h2>
        <p style={css.centerBody}>
          Set up your store first. Orders will start appearing here
          once shoppers reserve your items.
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
  const hasNoMatches =
    !hasNoOrders && filteredOrders.length === 0;

  return (
    <main style={css.root} className="sk-orders">
      <style>{CSS}</style>

      <div style={css.headerWrap}>
        <div style={css.headerInner}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={css.title}>Orders</h1>
            <div style={css.subtitle}>
              {hasNoOrders
                ? storeName
                  ? `${storeName} · no orders yet`
                  : 'Orders will show up here'
                : `${counts.all} total · ${
                    counts.reservations
                  } need${
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
            <MdRefresh size={20} color="var(--brand-on-gradient)" />
          </button>
        </div>
      </div>

      <div style={css.sheet}>
        {hasNoOrders ? (
          <div style={css.emptyState}>
            <div style={css.emptyHalo}>
              <MdReceiptLong size={44} color="var(--brand-primary)" />
            </div>
            <h2 style={css.emptyTitle}>No orders yet</h2>
            <p style={css.emptyBody}>
              Once shoppers reserve your items, they show up here.
              Keep your listings stocked and visible to get your first
              sale.
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
            <div style={css.searchWrap}>
              <MdSearch size={18} color="var(--text-muted)" />
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
                  <MdClose size={14} color="var(--text-tertiary)" />
                </button>
              )}
            </div>

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
                      borderColor: active
                        ? 'var(--brand-primary)'
                        : 'var(--border-default)',
                      backgroundColor: active
                        ? 'var(--brand-soft)'
                        : 'var(--bg-secondary)',
                    }}
                    className="sk-pill"
                  >
                    <span
                      style={{
                        color: active
                          ? 'var(--brand-primary)'
                          : 'var(--text-secondary)',
                        fontWeight: active ? 800 : 700,
                        fontSize: 12.5,
                      }}
                    >
                      {f.label}
                    </span>
                    <span
                      style={{
                        ...css.pillCount,
                        backgroundColor: active
                          ? 'var(--bg-secondary)'
                          : 'var(--bg-tertiary)',
                        color: active
                          ? 'var(--brand-primary)'
                          : 'var(--text-tertiary)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {hasNoMatches ? (
              <div style={css.noMatchWrap}>
                <div style={css.noMatchHalo}>
                  <MdSearch size={32} color="var(--text-muted)" />
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
      <div style={css.cardTop}>
        <div style={css.avatar}>{initialOf(customer)}</div>
        <div style={css.cardTopMeta}>
          <div style={css.customerName} title={customer}>
            {customer}
          </div>
          <div style={css.orderId}>
            Order #{shortId(order.order_id)}
          </div>
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

      <div style={css.amount}>{formatNaira(total)}</div>

      {isDelivery && (
        <div style={css.contextRow}>
          <MdLocalShipping size={15} color="var(--info-fg)" />
          <span style={css.contextText}>
            Courier: {order.courier_name || 'Assigned'}
          </span>
        </div>
      )}
      {isDropped && (
        <div style={{ ...css.contextRow, ...css.contextRowDanger }}>
          <MdDeleteOutline size={15} color="var(--danger-fg)" />
          <span
            style={{ ...css.contextText, color: 'var(--danger-fg)' }}
          >
            Dropped by shopper · Refunded
          </span>
        </div>
      )}
      {isDeclined && (
        <div style={{ ...css.contextRow, ...css.contextRowDanger }}>
          <MdCancel size={15} color="var(--danger-fg)" />
          <span
            style={{ ...css.contextText, color: 'var(--danger-fg)' }}
          >
            Declined by you · Refunded
          </span>
        </div>
      )}
      {isReversed && (
        <div style={{ ...css.contextRow, ...css.contextRowWarn }}>
          <MdSwapHoriz size={15} color="var(--warning-fg)" />
          <span
            style={{ ...css.contextText, color: 'var(--warning-fg)' }}
          >
            Package reversed
          </span>
        </div>
      )}

      {isAccepted && !isPickedUp && (
        <div style={css.holdingNote}>
          <MdAccessTime size={15} color="var(--purple-fg)" />
          <span style={css.holdingNoteText}>
            Waiting for <strong>{customer}</strong> to pick up. Your{' '}
            <strong>{formatNaira(total)}</strong> is held in escrow and
            releases to your wallet when they confirm.
          </span>
        </div>
      )}

      {!isPickedUp && !isDropped && !isDeclined && !isReversed && (
        <div style={css.actions}>
          {isReservation && (
            <>
              <button
                type="button"
                onClick={onHold}
                disabled={busy}
                style={{
                  ...css.primaryBtn,
                  opacity: busy ? 0.6 : 1,
                }}
                className="sk-action-btn"
              >
                <MdCheckCircleOutline
                  size={18}
                  color="var(--brand-on-gradient)"
                />
                <span>Hold for pickup</span>
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={busy}
                style={{
                  ...css.dangerBtn,
                  opacity: busy ? 0.6 : 1,
                }}
                className="sk-action-btn"
              >
                <MdCancel size={18} color="var(--danger-fg)" />
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
            style={{
              ...css.warnBtn,
              opacity: busy ? 0.6 : 1,
            }}
            className="sk-action-btn"
          >
            <MdSend size={16} color="#FFFFFF" />
            <span>Release courier fee</span>
          </button>
        </div>
      )}

      {isPickedUp && (
        <div style={css.doneRow}>
          <MdCheckCircle size={18} color="var(--success-fg)" />
          <span style={css.doneText}>
            Picked up · Funds released
          </span>
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
        background: active
          ? 'var(--brand-gradient)'
          : 'var(--bg-secondary)',
        borderColor: active
          ? 'transparent'
          : 'var(--border-default)',
        color: active
          ? 'var(--brand-on-gradient)'
          : 'var(--text-secondary)',
        cursor: active || disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

const CSS = `
  @keyframes skSpin { to { transform: rotate(360deg); } }
  @keyframes skShimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  .sk-orders, .sk-orders *, .sk-orders *::before, .sk-orders *::after {
    box-sizing: border-box;
  }

  .sk-refresh {
    transition: transform 0.12s, background-color 0.15s;
  }
  .sk-refresh:hover {
    background-color:
      color-mix(in srgb, var(--brand-on-gradient) 18%, transparent);
  }
  .sk-refresh:active { transform: scale(0.94); }

  .sk-pill { transition: background-color 0.15s, border-color 0.15s; }
  .sk-pill:active { transform: scale(0.97); }

  .sk-order-card {
    transition: box-shadow 0.15s ease, background-color 0.18s ease,
      border-color 0.18s ease;
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

const css: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    overflowX: 'hidden',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },

  headerWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--brand-gradient)',
    padding: '14px 20px',
    transition: 'background 0.18s ease',
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
    color: 'var(--brand-on-gradient)',
    margin: 0,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    color:
      'color-mix(in srgb, var(--brand-on-gradient) 78%, transparent)',
    fontWeight: 600,
    marginTop: 3,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 12%, transparent)',
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
    backgroundColor:
      'color-mix(in srgb, var(--brand-on-gradient) 22%, transparent)',
  },

  sheet: {
    flex: 1,
    padding: '16px 20px 40px',
    maxWidth: 1080,
    margin: '0 auto',
    width: '100%',
  },

  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 14,
    border: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14.5,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  searchClear: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'var(--bg-tertiary)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },

  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 18,
    border: '1px solid var(--border-default)',
    padding: '16px 18px',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
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
    backgroundColor: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
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
    color: 'var(--text-primary)',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  orderId: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
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

  amount: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    letterSpacing: -0.6,
    fontVariantNumeric: 'tabular-nums',
    marginTop: 12,
    lineHeight: 1.1,
  },

  contextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: '8px 10px',
    backgroundColor: 'var(--info-bg)',
    borderRadius: 10,
  },
  contextRowDanger: { backgroundColor: 'var(--danger-bg)' },
  contextRowWarn: { backgroundColor: 'var(--warning-bg)' },
  contextText: {
    fontSize: 12,
    color: 'var(--info-fg)',
    fontWeight: 600,
  },

  holdingNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '11px 13px',
    marginTop: 12,
    backgroundColor: 'var(--purple-bg)',
    border:
      '1px solid color-mix(in srgb, var(--purple-fg) 30%, transparent)',
    borderRadius: 12,
  },
  holdingNoteText: {
    fontSize: 12.5,
    color: 'var(--purple-fg)',
    fontWeight: 500,
    lineHeight: 1.5,
  },

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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },
  dangerBtn: {
    flex: 1,
    minWidth: 100,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--danger-fg)',
    border: '1.5px solid var(--danger-strong)',
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
    backgroundColor: 'var(--warning-fg)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow:
      '0 8px 18px color-mix(in srgb, var(--warning-fg) 22%, transparent)',
  },

  segmentRow: {
    display: 'flex',
    gap: 6,
    width: '100%',
    padding: 4,
    backgroundColor: 'var(--bg-tertiary)',
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

  doneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: '10px 12px',
    backgroundColor: 'var(--success-bg)',
    borderRadius: 10,
  },
  doneText: {
    fontSize: 13,
    color: 'var(--success-fg)',
    fontWeight: 700,
  },

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
    backgroundColor: 'var(--brand-soft)',
    border: '1px solid var(--brand-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },

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
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noMatchTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  noMatchBody: {
    fontSize: 13.5,
    color: 'var(--text-tertiary)',
    marginTop: 4,
    lineHeight: 1.5,
  },
  clearAllBtn: {
    marginTop: 16,
    padding: '10px 18px',
    borderRadius: 12,
    backgroundColor: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
    border: 'none',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  centerRoot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: 24,
    textAlign: 'center',
    transition: 'background-color 0.18s ease, color 0.18s ease',
  },
  errorHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  setupHalo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'var(--brand-soft)',
    border: '1px solid var(--brand-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.3,
  },
  centerBody: {
    fontSize: 14,
    color: 'var(--text-tertiary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },

  searchSkeleton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  pillRowSkeleton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    marginTop: 12,
    maxWidth: 480,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
  orderSkeleton: {
    height: 180,
    borderRadius: 18,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    marginTop: 12,
    animation: 'skShimmer 1.4s ease-in-out infinite',
  },
};