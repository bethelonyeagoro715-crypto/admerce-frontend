'use client';

import { useReducer, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  MdPrint,
  MdShare,
  MdDownload,
  MdReceiptLong,
  MdStore,
  MdPersonOutline,
  MdLocationOn,
} from 'react-icons/md';
// ✅ Fixed: file is at src/app/receipt/[orderId]/page.tsx → 3 levels up to reach src/
import api from '../../../../../services/api';

// ✅ Next.js 16.3 fix: prevent static prerendering because we use useSearchParams and useParams
export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────
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

// ─── API response shape ──────────────────────────────────────────────
interface OrderDetailResponse extends Record<string, unknown> {
  order_id?: string;
  customer_name?: string;
  store_name?: string;
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

// ─── Reducer (fixes cascading-setState ESLint warning) ───────────────
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

// ─── Component ───────────────────────────────────────────────────────
export default function ReceiptPage() {
  const router       = useRouter();
  const params       = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();

  const orderId = params.orderId || searchParams.get('order_id') || 'Unknown';

  const [{ orderData, loading }, dispatch] = useReducer(reducer, {
    orderData: null,
    loading: true,
  });

  // Fallback values from query params (used when API fetch fails)
  const fallbackItems: OrderItem[] = (() => {
    try { return JSON.parse(searchParams.get('items') || '[]') as OrderItem[]; }
    catch { return []; }
  })();

  const fallback = {
    customer_name: searchParams.get('customer_name') || 'Customer',
    store_name:    searchParams.get('store_name')    || 'Store',
    total_amount:  parseFloat(searchParams.get('total') || '0'),
    items:         fallbackItems,
  };

  useEffect(() => {
    api.adminGetOrderDetail(orderId)
      .then((raw: unknown) => {
        const res = raw as OrderDetailResponse;
        dispatch({
          type: 'LOADED',
          data: {
            order_id:      res.order_id      ?? orderId,
            customer_name: res.customer_name ?? '',
            store_name:    res.store_name    ?? '',
            total_amount:  res.total_amount,
            status:        res.status,
            item_amount:   res.item_amount,
            delivery_fee:  res.delivery_fee,
            listing_id:    res.listing_id,
            quantity:      res.quantity,
            created_at:    res.created_at,
            expires_at:    res.expires_at,
            address:       res.address,
            latitude:      res.latitude,
            longitude:     res.longitude,
            items:         res.items,
          },
        });
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch order, using fallback:', err);
        dispatch({ type: 'FAILED' });
      });
  }, [orderId]);

  // Resolved display values (API wins over fallback)
  const customerName = orderData?.customer_name || fallback.customer_name;
  const storeName    = orderData?.store_name    || fallback.store_name;
  const total        = orderData?.total_amount != null
    ? parseFloat(String(orderData.total_amount))
    : fallback.total_amount;
  const items        = orderData?.items?.length ? orderData.items : fallback.items;
  const storeAddress = orderData?.address || searchParams.get('store_address') || '';

  // ── Actions ─────────────────────────────────────────────────────
  const handlePrint = () => window.print();
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Receipt', text: `Order #${orderId}`, url: window.location.href });
      } catch (err: unknown) {
        console.error('Share failed:', err);
      }
    } else {
      alert('Share is not supported on this device.');
    }
  };

  if (loading) return (
    <div style={css.loadScreen}>
      <div style={css.spinner} />
      <style>{KF}</style>
    </div>
  );

  const now = new Date();

  return (
    <main style={css.container}>
      <style>{KF}</style>

      {/* Header */}
      <div style={css.header}>
        <button onClick={() => router.back()} style={css.backBtn}>←</button>
        <h1 style={css.title}>Receipt</h1>
        <div style={css.headerActions}>
          <button onClick={handlePrint} style={css.iconBtn} title="Print"><MdPrint size={22} color="#333" /></button>
          <button onClick={handleShare} style={css.iconBtn} title="Share"><MdShare size={22} color="#333" /></button>
          <button onClick={handlePrint} style={css.iconBtn} title="Download (PDF via print)"><MdDownload size={22} color="#333" /></button>
        </div>
      </div>

      {/* Receipt Card */}
      <div style={css.receiptCard}>

        {/* Gradient header */}
        <div style={css.cardHeader}>
          <div style={css.receiptIconWrapper}>
            <MdReceiptLong size={32} color="#fff" />
          </div>
          <h2 style={css.cardTitle}>Transaction Receipt</h2>
          <p style={css.orderId}>Order #{orderId}</p>
          <p style={css.dateTime}>
            {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>

        {/* Info rows */}
        <div style={css.infoSection}>
          {[
            { icon: <MdPersonOutline size={18} color="#0504AA" />, label: 'Customer', value: customerName },
            { icon: <MdStore        size={18} color="#0504AA" />, label: 'Store',    value: storeName    },
            ...(storeAddress ? [{ icon: <MdLocationOn size={18} color="#0504AA" />, label: 'Address', value: storeAddress }] : []),
          ].map(({ icon, label, value }) => (
            <div key={label} style={css.infoRow}>
              <div style={css.infoLabel}>{icon}<span>{label}</span></div>
              <span style={css.infoValue}>{value}</span>
            </div>
          ))}
        </div>

        {/* Items */}
        <div style={css.itemsSection}>
          <h3 style={css.itemsTitle}>Items</h3>
          {items.length === 0 ? (
            <p style={{ color: '#888' }}>No items in this order.</p>
          ) : (
            <div style={css.itemsList}>
              {items.map((item, index) => {
                const qty      = item.quantity || 1;
                const price    = parseFloat(String(item.price || 0));
                const subtotal = qty * price;
                return (
                  <div key={index} style={css.itemRow}>
                    <span style={css.itemName}>{item.name || 'Item'}</span>
                    <span style={css.itemQty}>x{qty}</span>
                    <span style={css.itemSubtotal}>₦{subtotal.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Total */}
        <div style={css.totalSection}>
          <span style={css.totalLabel}>Total Amount</span>
          <span style={css.totalValue}>₦{total.toFixed(0)}</span>
        </div>

        <p style={css.footerNote}>Thank you for your purchase!</p>
      </div>
    </main>
  );
}

// ─── Keyframes ───────────────────────────────────────────────────────
const KF = `@keyframes spin { to { transform: rotate(360deg); } }`;

// ─── Styles ──────────────────────────────────────────────────────────
const css: Record<string, React.CSSProperties> = {
  container:        { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F8F9FA', paddingBottom: 20 },
  loadScreen:       { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  spinner:          { width: 40, height: 40, border: '4px solid #eee', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header:           { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#fff', borderBottom: '1px solid #eee' },
  backBtn:          { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#333', padding: 0, width: 24, textAlign: 'left' },
  title:            { fontSize: 20, fontWeight: 700, color: '#1A1A1A', flex: 1, marginLeft: 12 },
  headerActions:    { display: 'flex', gap: 16 },
  iconBtn:          { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  receiptCard:      { margin: '16px', backgroundColor: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', overflow: 'hidden' },
  cardHeader:       { background: 'linear-gradient(135deg, #0504AA 0%, #3B82F6 100%)', margin: -20, marginBottom: 20, padding: 24, textAlign: 'center', color: '#fff' },
  receiptIconWrapper:{ width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  cardTitle:        { fontSize: 22, fontWeight: 800, margin: 0 },
  orderId:          { fontSize: 14, opacity: 0.9, marginTop: 4 },
  dateTime:         { fontSize: 12, opacity: 0.8, marginTop: 2 },
  infoSection:      { padding: '4px 0', marginBottom: 12 },
  infoRow:          { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 14 },
  infoLabel:        { display: 'flex', alignItems: 'center', gap: 6, color: '#0504AA', fontWeight: 600 },
  infoValue:        { color: '#1A1A1A', fontWeight: 600, textAlign: 'right', maxWidth: '60%' },
  itemsSection:     { marginTop: 20 },
  itemsTitle:       { fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 },
  itemsList:        { display: 'flex', flexDirection: 'column', gap: 8 },
  itemRow:          { display: 'flex', alignItems: 'center', gap: 12 },
  itemName:         { flex: 2, fontSize: 14, fontWeight: 500 },
  itemQty:          { fontSize: 14, color: '#666' },
  itemSubtotal:     { width: 70, textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#0504AA' },
  totalSection:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px dashed #E5E7EB' },
  totalLabel:       { fontSize: 18, fontWeight: 700, color: '#1A1A1A' },
  totalValue:       { fontSize: 22, fontWeight: 800, color: '#0504AA' },
  footerNote:       { marginTop: 20, textAlign: 'center', color: '#888', fontSize: 13 },
};