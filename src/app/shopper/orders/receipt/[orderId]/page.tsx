'use client';

import { Suspense, useReducer, useEffect, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  MdPrint,
  MdShare,
  MdDownload,
  MdReceiptLong,
  MdStore,
  MdPersonOutline,
  MdLocationOn,
  MdPerson,
  MdCheckCircle,
} from 'react-icons/md';
import api from '../../../../../services/api';

export const dynamic = 'force-dynamic';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface OrderDetail {
  order_id: string;
  customer_name: string;
  store_name: string;
  storekeeper_name?: string;
  total_amount?: string | number;
  status?: string;
  item_amount?: string | number;
  delivery_fee?: string | number;
  listing_id?: string;
  quantity?: number;
  created_at?: string;
  expires_at?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items?: OrderItem[];
}

interface OrderDetailResponse extends Record<string, unknown> {
  order_id?: string;
  customer_name?: string;
  store_name?: string;
  storekeeper_name?: string;
  total_amount?: string | number;
  status?: string;
  item_amount?: string | number;
  delivery_fee?: string | number;
  listing_id?: string;
  quantity?: number;
  created_at?: string;
  expires_at?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items?: OrderItem[];
}

interface PageState {
  orderData: OrderDetail | null;
  loading: boolean;
}

type PageAction =
  | { type: 'LOADED'; data: OrderDetail }
  | { type: 'FAILED' };

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case 'LOADED': return { loading: false, orderData: action.data };
    case 'FAILED': return { ...state, loading: false };
  }
}

function shortenId(id: string, head = 8): string {
  if (!id) return '';
  return id.length > head ? id.slice(0, head) : id;
}

function safeNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function statusLabel(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'picked_up' || s === 'completed' || s === 'delivered') return 'Picked up';
  if (s === 'locked' || s === 'pending') return 'Awaiting pickup';
  if (s === 'accepted') return 'Accepted';
  if (s === 'dispatched') return 'Dispatched';
  if (s === 'returned' || s === 'refunded') return 'Refunded';
  if (s === 'declined') return 'Declined';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Paid';
}

function statusColors(status?: string): { bg: string; fg: string } {
  const s = (status || '').toLowerCase();
  if (s === 'picked_up' || s === 'completed' || s === 'delivered')
    return { bg: 'var(--success-bg)', fg: 'var(--success-fg)' };
  if (s === 'returned' || s === 'refunded' || s === 'declined')
    return { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' };
  if (s === 'dispatched') return { bg: 'var(--info-bg)', fg: 'var(--info-fg)' };
  return { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' };
}

function ReceiptContent() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();

  const orderId = params.orderId || searchParams.get('order_id') || 'Unknown';

  const [{ orderData, loading }, dispatch] = useReducer(reducer, {
    orderData: null,
    loading: true,
  });

  const fallbackItems: OrderItem[] = useMemo(() => {
    try { return JSON.parse(searchParams.get('items') || '[]') as OrderItem[]; }
    catch { return []; }
  }, [searchParams]);

  const fallback = useMemo(() => ({
    customer_name: searchParams.get('customer_name') || '',
    store_name: searchParams.get('store_name') || '',
    storekeeper_name: searchParams.get('storekeeper_name') || '',
    total_amount: safeNumber(searchParams.get('total')),
    items: fallbackItems,
  }), [searchParams, fallbackItems]);

  useEffect(() => {
    api.getOrderDetail(orderId)
      .then((raw: unknown) => {
        const res = raw as OrderDetailResponse;
        dispatch({
          type: 'LOADED',
          data: {
            order_id: res.order_id ?? orderId,
            customer_name: res.customer_name ?? '',
            store_name: res.store_name ?? '',
            storekeeper_name: res.storekeeper_name ?? '',
            total_amount: res.total_amount,
            status: res.status,
            item_amount: res.item_amount,
            delivery_fee: res.delivery_fee,
            listing_id: res.listing_id,
            quantity: res.quantity,
            created_at: res.created_at,
            expires_at: res.expires_at,
            address: res.address,
            latitude: res.latitude,
            longitude: res.longitude,
            items: res.items,
          },
        });
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch order, using fallback:', err);
        dispatch({ type: 'FAILED' });
      });
  }, [orderId]);

  const rawCustomerName = orderData?.customer_name || fallback.customer_name;
  const rawStoreName = orderData?.store_name || fallback.store_name;
  const rawStorekeeperName = orderData?.storekeeper_name || fallback.storekeeper_name;

  const customerName = (rawCustomerName && rawCustomerName !== 'Customer') ? rawCustomerName : 'Customer';
  const storeName = (rawStoreName && rawStoreName !== 'Store') ? rawStoreName : '—';
  const storekeeperName = (rawStorekeeperName && rawStorekeeperName !== 'Storekeeper') ? rawStorekeeperName : '';

  const total = orderData?.total_amount != null ? safeNumber(orderData.total_amount) : fallback.total_amount;
  const itemAmount = safeNumber(orderData?.item_amount);
  const deliveryFee = safeNumber(orderData?.delivery_fee);
  const quantity = Number(orderData?.quantity ?? 1);
  const listingId = orderData?.listing_id ?? '';
  const createdAt = orderData?.created_at;
  const status = orderData?.status || searchParams.get('status') || '';

  const items = orderData?.items?.length ? orderData.items : fallback.items;
  const storeAddress = orderData?.address || searchParams.get('store_address') || '';

  const synthesizedItems: OrderItem[] = items.length === 0 && listingId
    ? [{
        name: `Item #${shortenId(listingId)}`,
        price: quantity > 0 ? itemAmount / quantity : itemAmount,
        quantity,
      }]
    : [];

  const displayItems = items.length > 0 ? items : synthesizedItems;
  const colors = statusColors(status);
  const receiptDate = formatDate(createdAt) || formatDate(new Date().toISOString());

  const handlePrint = () => window.print();
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Receipt',
          text: `Order #${shortenId(orderId)} — ₦${total.toFixed(0)}`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      alert('Share is not supported on this device.');
    }
  };

  if (loading) {
    return (
      <div style={css.loadScreen}>
        <div style={css.spinner} />
        <style>{KF}</style>
      </div>
    );
  }

  const infoRows = [
    { icon: <MdPersonOutline size={18} color="var(--brand-primary)" />, label: 'Customer', value: customerName },
    { icon: <MdStore size={18} color="var(--brand-primary)" />, label: 'Store', value: storeName },
    ...(storekeeperName
      ? [{ icon: <MdPerson size={18} color="var(--brand-primary)" />, label: 'Storekeeper', value: storekeeperName }]
      : []),
    ...(storeAddress
      ? [{ icon: <MdLocationOn size={18} color="var(--brand-primary)" />, label: 'Address', value: storeAddress }]
      : []),
  ];

  return (
    <main style={css.container}>
      <style>{KF}</style>
      <style>{PRINT_CSS}</style>

      <div style={css.header} className="no-print">
        <button onClick={() => router.back()} style={css.backBtn} aria-label="Back">←</button>
        <h1 style={css.title}>Receipt</h1>
        <div style={css.headerActions}>
          <button onClick={handlePrint} style={css.iconBtn} title="Print" aria-label="Print">
            <MdPrint size={22} color="var(--text-secondary)" />
          </button>
          <button onClick={handleShare} style={css.iconBtn} title="Share" aria-label="Share">
            <MdShare size={22} color="var(--text-secondary)" />
          </button>
          <button onClick={handlePrint} style={css.iconBtn} title="Save as PDF" aria-label="Download PDF">
            <MdDownload size={22} color="var(--text-secondary)" />
          </button>
        </div>
      </div>

      <div style={css.cardWrap}>
        <div style={css.receiptCard} className="receipt-print-area">
          <div style={css.cardHeader}>
            <div style={css.receiptIconWrapper}>
              <MdReceiptLong size={32} color="var(--brand-on-gradient)" />
            </div>
            <h2 style={css.cardTitle}>Transaction Receipt</h2>
            <p style={css.orderId}>Order #{shortenId(orderId)}</p>
            <p style={css.dateTime}>{receiptDate}</p>
          </div>

          {status && (
            <div style={css.statusRow}>
              <span style={{ ...css.statusBadge, backgroundColor: colors.bg, color: colors.fg }}>
                <MdCheckCircle size={14} style={{ marginRight: 4 }} />
                {statusLabel(status)}
              </span>
            </div>
          )}

          <div style={css.infoSection}>
            {infoRows.map(({ icon, label, value }) => (
              <div key={label} style={css.infoRow}>
                <div style={css.infoLabel}>{icon}<span>{label}</span></div>
                <span style={css.infoValue}>{value}</span>
              </div>
            ))}
          </div>

          <div style={css.itemsSection}>
            <h3 style={css.itemsTitle}>Items</h3>
            {displayItems.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No items in this order.</p>
            ) : (
              <div style={css.itemsList}>
                {displayItems.map((item, index) => {
                  const qty = item.quantity || 1;
                  const price = safeNumber(item.price);
                  const subtotal = qty * price;
                  return (
                    <div key={index} style={css.itemRow}>
                      <span style={css.itemName}>{item.name || 'Item'}</span>
                      <span style={css.itemQty}>×{qty}</span>
                      <span style={css.itemSubtotal}>₦{subtotal.toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {deliveryFee > 0 && (
              <div style={{ ...css.itemRow, marginTop: 8 }}>
                <span style={{ ...css.itemName, color: 'var(--text-tertiary)' }}>Delivery fee</span>
                <span style={css.itemQty} />
                <span style={{ ...css.itemSubtotal, color: 'var(--text-secondary)' }}>
                  ₦{deliveryFee.toFixed(0)}
                </span>
              </div>
            )}
          </div>

          <div style={css.totalSection}>
            <span style={css.totalLabel}>Total Amount</span>
            <span style={css.totalValue}>₦{total.toFixed(0)}</span>
          </div>

          <div style={css.footerNote}>
            <div style={css.footerBrand}>Admerce</div>
            <div style={css.footerSub}>Thank you for your purchase</div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            color: 'var(--text-primary)',
          }}
        >
          Loading receipt…
        </div>
      }
    >
      <ReceiptContent />
    </Suspense>
  );
}

const KF = `@keyframes spin { to { transform: rotate(360deg); } }`;

const PRINT_CSS = `
  @media print {
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
    }
    body * {
      visibility: hidden !important;
    }
    .receipt-print-area,
    .receipt-print-area * {
      visibility: visible !important;
    }
    .receipt-print-area {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 20px !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      border: none !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    .receipt-print-area * {
      color: #000000 !important;
      background-image: none !important;
    }
    .receipt-print-area [style*="background"] {
      background: #ffffff !important;
    }
    .no-print {
      display: none !important;
    }
  }
`;

const css: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    paddingBottom: 20,
  },
  loadScreen: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-default)',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: 0,
    width: 24,
    textAlign: 'left',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
    flex: 1,
    marginLeft: 12,
  },
  headerActions: { display: 'flex', gap: 12 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },

  cardWrap: {
    maxWidth: 520,
    width: '100%',
    margin: '0 auto',
    padding: '16px',
  },
  receiptCard: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 24,
    padding: 20,
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  cardHeader: {
    background: 'var(--brand-gradient)',
    margin: -20,
    marginBottom: 20,
    padding: 24,
    textAlign: 'center',
    color: 'var(--brand-on-gradient)',
  },
  receiptIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    backgroundColor: 'color-mix(in srgb, var(--brand-on-gradient) 15%, transparent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
  },
  cardTitle: { fontSize: 22, fontWeight: 800, margin: 0 },
  orderId: { fontSize: 14, opacity: 0.9, marginTop: 4 },
  dateTime: { fontSize: 12, opacity: 0.8, marginTop: 2 },

  statusRow: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: 0.2,
  },

  infoSection: {
    padding: '8px 0',
    marginBottom: 12,
    borderBottom: '1px dashed var(--border-default)',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    fontSize: 14,
    gap: 12,
  },
  infoLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--brand-primary)',
    fontWeight: 600,
    flexShrink: 0,
  },
  infoValue: {
    color: 'var(--text-primary)',
    fontWeight: 600,
    textAlign: 'right',
    maxWidth: '65%',
    wordBreak: 'break-word',
  },

  itemsSection: { marginTop: 16 },
  itemsTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--text-tertiary)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  itemsList: { display: 'flex', flexDirection: 'column', gap: 8 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 12 },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemQty: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    fontWeight: 600,
    minWidth: 30,
    textAlign: 'right',
  },
  itemSubtotal: {
    width: 90,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
  },

  totalSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 18,
    borderTop: '1px dashed var(--border-default)',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  totalValue: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: -0.5,
  },

  footerNote: {
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid var(--border-subtle)',
    textAlign: 'center',
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--brand-primary)',
    letterSpacing: 0.5,
  },
  footerSub: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
};