'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import {
  MdShoppingBasket,
  MdStore,
  MdImage,
  MdRemove,
  MdAdd,
  MdDeleteOutline,
  MdRefresh,
  MdChevronRight,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface BasketItem {
  id: number;
  name?: string;
  price?: number;
  quantity?: number;
  subtotal?: number;
  [key: string]: unknown;
}

interface StoreGroup {
  store_id: string;
  store_name?: string;
  items: BasketItem[];
  subtotal?: number;
  [key: string]: unknown;
}

interface BasketData {
  total?: number;
  store_groups?: StoreGroup[];
  [key: string]: unknown;
}

export default function BasketPage() {
  const router = useRouter();

  const [basket, setBasket] = useState<BasketData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const loadBasket = async () => {
    setIsLoading(true);
    try {
      const data = (await api.getBasket()) as BasketData;
      setBasket(data);
    } catch (err: unknown) {
      alert('Failed to load basket: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBasket();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const updateQuantity = async (itemId: number, newQuantity: number) => {
    try {
      await api.updateBasketItem(itemId, newQuantity);
      await loadBasket();
    } catch (err: unknown) {
      alert('Failed to update: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      await api.removeBasketItem(itemId);
      await loadBasket();
    } catch (err: unknown) {
      alert('Failed to remove: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const checkout = async () => {
    setIsCheckingOut(true);
    try {
      await api.checkoutBasket();
      alert('Reservations placed!');
      router.push('/order-history');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      alert(message.replace('Exception: ', ''));
    } finally {
      setIsCheckingOut(false);
    }
  };

  const total = basket.total ?? 0;
  const storeGroups = basket.store_groups ?? [];

  if (isLoading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  if (storeGroups.length === 0) {
    return (
      <main style={styles.center}>
        <MdShoppingBasket size={80} color="#ccc" />
        <p style={styles.emptyTitle}>Your basket is empty</p>
        <p style={styles.emptySubtitle}>Add items from stores near you</p>
        <button onClick={() => router.push('/shopper/home')} style={styles.startShoppingBtn}>
          Start Shopping
        </button>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Your Basket</h1>
        <button onClick={loadBasket} style={styles.refreshBtn} title="Refresh">
          <MdRefresh size={24} color="#0504AA" />
        </button>
      </div>

      {/* Store groups */}
      <div style={styles.scrollArea}>
        {storeGroups.map((group, index) => (
          <div key={index} style={styles.storeCard}>
            <div style={styles.storeHeader}>
              <MdStore size={18} color="#666" />
              <span style={styles.storeName}>
                {group.store_name || `Store #${group.store_id?.substring(0, 8)}`}
              </span>
              <span style={styles.storeSubtotal}>₦{(group.subtotal ?? 0).toFixed(2)}</span>
            </div>
            <div style={styles.divider} />
            {group.items.map((item) => (
              <div key={item.id} style={styles.itemRow}>
                <div style={styles.itemImage}>
                  <MdImage size={24} color="#888" />
                </div>
                <div style={styles.itemInfo}>
                  <div style={styles.itemName}>{item.name || 'Item'}</div>
                  <div style={styles.itemPrice}>₦{(item.price ?? 0).toFixed(2)}</div>
                </div>
                <div style={styles.qtyControl}>
                  <button
                    style={styles.qtyBtn}
                    onClick={() => item.quantity && item.quantity > 1 && updateQuantity(item.id, item.quantity - 1)}
                    disabled={!item.quantity || item.quantity <= 1}
                  >
                    <MdRemove size={16} />
                  </button>
                  <span style={styles.qtyValue}>{item.quantity ?? 1}</span>
                  <button
                    style={styles.qtyBtn}
                    onClick={() => updateQuantity(item.id, (item.quantity ?? 1) + 1)}
                  >
                    <MdAdd size={16} />
                  </button>
                </div>
                <button onClick={() => removeItem(item.id)} style={styles.deleteBtn} title="Remove">
                  <MdDeleteOutline size={18} color="#FF0000" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Checkout bar */}
      <div style={styles.checkoutBar}>
        <div style={{ flex: 1 }}>
          <div style={styles.totalLabel}>Total</div>
          <div style={styles.totalValue}>₦{(total as number).toFixed(2)}</div>
        </div>
        <button
          onClick={checkout}
          disabled={isCheckingOut}
          style={{
            ...styles.checkoutBtn,
            opacity: isCheckingOut ? 0.7 : 1,
          }}
        >
          {isCheckingOut ? 'Processing...' : 'Place Reservations'}
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
    height: '100vh',
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
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
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
  },
  storeSubtotal: {
    fontWeight: 'bold',
    color: '#0504AA',
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
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 500,
    color: '#1A1A1A',
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
  },
  qtyBtn: {
    background: 'none',
    border: 'none',
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
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
  },
  checkoutBar: {
    display: 'flex',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    boxShadow: '0 -4px 8px rgba(0,0,0,0.05)',
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
    cursor: 'pointer',
  },
};