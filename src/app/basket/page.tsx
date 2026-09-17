'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import {
  MdShoppingBasket,
  MdStore,
  MdImage,
  MdRemove,
  MdAdd,
  MdDeleteOutline,
  MdRefresh,
  MdChevronRight,
  MdErrorOutline,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
// The API returns listing_id + store_id + quantity. Name/price may come
// from a joined listing row — the backend isn't consistent, so we accept
// every plausible key name.
interface BasketItem {
  id: number;
  listing_id?: string;
  store_id?: string;
  quantity?: number;
  // Joined fields — may or may not be present depending on backend
  name?: string;
  title?: string;
  price?: number | string;
  image_url?: string | null;
  subtotal?: number | string;
  [key: string]: unknown;
}

interface StoreGroup {
  store_id: string;
  store_name?: string;
  items: BasketItem[];
  subtotal?: number | string;
  [key: string]: unknown;
}

interface BasketData {
  total?: number | string;
  store_groups?: StoreGroup[];
  items?: BasketItem[];
  [key: string]: unknown;
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

function fmtNaira(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '₦0';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function itemName(item: BasketItem): string {
  return (
    (item.name as string) ||
    (item.title as string) ||
    (item.listing_id ? `Item ${String(item.listing_id).slice(0, 6)}` : 'Item')
  );
}

function itemPrice(item: BasketItem): number {
  const n = Number(item.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function BasketPage() {
  useAuthGuard();

  const router = useRouter();

  const [basket, setBasket] = useState<BasketData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBasket = useCallback(async () => {
    setError(null);
    try {
      const data = (await api.getBasket()) as BasketData;
      setBasket(data || {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load your basket.';
      setError(msg);
      setBasket({});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      await loadBasket();
      if (!cancelled) setIsLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadBasket]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadBasket();
    setIsRefreshing(false);
  };

  const updateQuantity = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    setPendingItemId(itemId);
    setError(null);
    try {
      await api.updateBasketItem(itemId, newQuantity);
      await loadBasket();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update quantity.';
      setError(msg);
    } finally {
      setPendingItemId(null);
    }
  };

  const removeItem = async (itemId: number) => {
    setPendingItemId(itemId);
    setError(null);
    try {
      await api.removeBasketItem(itemId);
      await loadBasket();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not remove item.';
      setError(msg);
    } finally {
      setPendingItemId(null);
    }
  };

  const checkout = async () => {
    setIsCheckingOut(true);
    setError(null);
    try {
      await api.checkoutBasket();
      // ✅ Route to the unified saved screen's History tab
      router.push('/shopper/saved?tab=History');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.replace('Exception: ', '')
          : 'Checkout failed. Please try again.';
      setError(msg);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const total = Number(basket.total ?? 0);

  // ✅ Accept both shapes the backend might return: store_groups (grouped)
  //    or a flat items array. Flatten into groups if we only get items.
  const storeGroups: StoreGroup[] = (() => {
    if (Array.isArray(basket.store_groups) && basket.store_groups.length > 0) {
      return basket.store_groups;
    }
    if (Array.isArray(basket.items) && basket.items.length > 0) {
      const byStore: Record<string, StoreGroup> = {};
      for (const item of basket.items) {
        const sid = String(item.store_id ?? 'unknown');
        if (!byStore[sid]) {
          byStore[sid] = { store_id: sid, items: [], subtotal: 0 };
        }
        byStore[sid].items.push(item);
        byStore[sid].subtotal =
          Number(byStore[sid].subtotal ?? 0) + itemPrice(item) * (item.quantity ?? 1);
      }
      return Object.values(byStore);
    }
    return [];
  })();

  // ── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  // ── Error state (no data at all) ────────────────────────────
  if (error && storeGroups.length === 0) {
    return (
      <main style={styles.center}>
        <MdErrorOutline size={64} color="#EF9A9A" />
        <p style={styles.emptyTitle}>Couldn&apos;t load your basket</p>
        <p style={styles.emptySubtitle}>{error}</p>
        <button onClick={handleRefresh} style={styles.startShoppingBtn}>
          Try again
        </button>
      </main>
    );
  }

  // ── Empty state ────────────────────────────────────────────
  if (storeGroups.length === 0) {
    return (
      <main style={styles.center}>
        <MdShoppingBasket size={80} color="#ccc" />
        <p style={styles.emptyTitle}>Your basket is empty</p>
        <p style={styles.emptySubtitle}>Add items from stores near you</p>
        <button
          onClick={() => router.push('/shopper/home')}
          style={styles.startShoppingBtn}
        >
          Start Shopping
        </button>
      </main>
    );
  }

  // ── Loaded ────────────────────────────────────────────────
  return (
    <main className="basket-container" style={styles.container}>
      <style>{`
        .basket-container {
          height: 100vh;
          height: 100dvh;
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Your Basket</h1>
        <button
          onClick={handleRefresh}
          style={styles.refreshBtn}
          title="Refresh"
          aria-label="Refresh"
        >
          <MdRefresh
            size={24}
            color="#0504AA"
            style={{
              animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
            }}
          />
        </button>
      </div>

      {/* Inline error banner (non-blocking) */}
      {error && (
        <div style={styles.errorBanner}>
          <MdErrorOutline size={16} color="#B71C1C" />
          <span style={{ marginLeft: 8, flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={styles.errorDismiss}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Store groups */}
      <div style={styles.scrollArea}>
        {storeGroups.map((group) => (
          <div key={group.store_id} style={styles.storeCard}>
            <div style={styles.storeHeader}>
              <MdStore size={18} color="#666" />
              <span style={styles.storeName}>
                {group.store_name ||
                  `Store #${String(group.store_id).slice(0, 8)}`}
              </span>
              <span style={styles.storeSubtotal}>
                {fmtNaira(group.subtotal ?? 0)}
              </span>
            </div>
            <div style={styles.divider} />

            {group.items.map((item) => {
              const img = resolveImageUrl(item.image_url ?? null);
              const qty = item.quantity ?? 1;
              const busy = pendingItemId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    ...styles.itemRow,
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <div style={styles.itemImage}>
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      <MdImage size={24} color="#888" />
                    )}
                  </div>

                  <div style={styles.itemInfo}>
                    <div style={styles.itemName}>{itemName(item)}</div>
                    <div style={styles.itemPrice}>
                      {fmtNaira(itemPrice(item))} each
                    </div>
                  </div>

                  <div style={styles.qtyControl}>
                    <button
                      style={{
                        ...styles.qtyBtn,
                        cursor: busy || qty <= 1 ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() =>
                        qty > 1 && updateQuantity(item.id, qty - 1)
                      }
                      disabled={busy || qty <= 1}
                      aria-label="Decrease quantity"
                    >
                      <MdRemove size={16} />
                    </button>
                    <span style={styles.qtyValue}>{qty}</span>
                    <button
                      style={{
                        ...styles.qtyBtn,
                        cursor: busy ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() => updateQuantity(item.id, qty + 1)}
                      disabled={busy}
                      aria-label="Increase quantity"
                    >
                      <MdAdd size={16} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    style={styles.deleteBtn}
                    title="Remove"
                    disabled={busy}
                  >
                    <MdDeleteOutline size={18} color="#FF0000" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Checkout bar */}
      <div style={styles.checkoutBar}>
        <div style={{ flex: 1 }}>
          <div style={styles.totalLabel}>Total</div>
          <div style={styles.totalValue}>{fmtNaira(total)}</div>
        </div>
        <button
          onClick={checkout}
          disabled={isCheckingOut}
          style={{
            ...styles.checkoutBtn,
            opacity: isCheckingOut ? 0.7 : 1,
            cursor: isCheckingOut ? 'not-allowed' : 'pointer',
          }}
        >
          {isCheckingOut ? 'Processing…' : 'Place Reservations'}
        </button>
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
    backgroundColor: '#F8F9FA',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#fff',
    padding: 16,
    textAlign: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 600,
    margin: '16px 0 8px',
    color: '#1A1A1A',
  },
  emptySubtitle: {
    color: '#888',
    marginBottom: 24,
    maxWidth: 320,
    lineHeight: 1.5,
  },
  startShoppingBtn: {
    padding: '12px 32px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #eee',
    flexShrink: 0,
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
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    margin: '8px 12px 0',
    padding: '10px 12px',
    backgroundColor: '#FFEBEE',
    border: '1px solid #FFCDD2',
    borderRadius: 10,
    color: '#B71C1C',
    fontSize: 13,
    flexShrink: 0,
  },
  errorDismiss: {
    background: 'none',
    border: 'none',
    color: '#B71C1C',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    padding: '0 4px',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  storeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: 600,
    color: '#1A1A1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  storeSubtotal: {
    fontWeight: 'bold',
    color: '#0504AA',
    whiteSpace: 'nowrap',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    margin: '12px 0',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 12,
    transition: 'opacity 0.15s ease',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 500,
    color: '#1A1A1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemPrice: {
    fontSize: 13,
    color: '#888',
  },
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #ddd',
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  qtyBtn: {
    background: 'none',
    border: 'none',
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#333',
  },
  qtyValue: {
    width: 28,
    textAlign: 'center',
    fontWeight: 600,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  checkoutBar: {
    display: 'flex',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    boxShadow: '0 -4px 8px rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  totalLabel: {
    fontSize: 12,
    color: '#888',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0504AA',
  },
  checkoutBtn: {
    padding: '14px 32px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
  },
};