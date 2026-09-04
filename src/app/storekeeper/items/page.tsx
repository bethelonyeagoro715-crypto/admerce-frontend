'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdSearch,
  MdInventory,
  MdEdit,
  MdDelete,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface StoreItem {
  listing_id: string;
  title?: string;
  price?: number | string;
  image_url?: string;
  [key: string]: unknown;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}

export default function StorekeeperItemsPage() {
  const router = useRouter();

  const [allItems, setAllItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadItems = async () => {
    setLoading(true);
    try {
      const store = (await api.getMyStore()) as { store_id?: string } | null;
      if (store?.store_id) {
        const items = (await api.getStoreItems(store.store_id)) as StoreItem[];
        setAllItems(items);
      } else {
        setAllItems([]);
      }
    } catch {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadItems();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Derived filtered items – no setState in effect
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) =>
      (item.title || '').toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  const handleEdit = (id: string) => {
    router.push(`/storekeeper/edit-item/${id}`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this item?')) {
      alert(`Delete item ${id} – not implemented yet`);
    }
  };

  return (
    <main style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>My Items</h1>
      </div>

      {/* Search bar */}
      <div style={styles.searchBar}>
        <MdSearch size={20} color="#888" />
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={styles.center}>
            <MdInventory size={48} color="#ccc" />
            <p style={{ color: '#888', marginTop: 8 }}>No items found</p>
          </div>
        ) : (
          <div style={styles.list}>
            {filteredItems.map((item) => {
              const image = resolveImageUrl(item.image_url);
              return (
                <div key={item.listing_id} style={styles.itemCard}>
                  <div style={styles.itemAvatar}>
                    {image ? (
                      <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <MdInventory size={24} color="#888" />
                    )}
                  </div>
                  <div style={styles.itemInfo}>
                    <div style={styles.itemTitle}>{item.title || 'Untitled'}</div>
                    <div style={styles.itemPrice}>₦{Number(item.price || 0).toFixed(0)}</div>
                  </div>
                  <div style={styles.itemActions}>
                    <button
                      onClick={() => handleEdit(item.listing_id)}
                      style={styles.iconBtn}
                      title="Edit"
                    >
                      <MdEdit size={20} color="#0504AA" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.listing_id)}
                      style={styles.iconBtn}
                      title="Delete"
                    >
                      <MdDelete size={20} color="#FF0000" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    margin: '8px 16px',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14,
    color: '#1A1A1A',
    padding: '8px 0',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px 16px',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
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
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  itemCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '1px solid #eee',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  itemAvatar: {
    width: 48,
    height: 48,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1A1A1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemPrice: {
    fontSize: 14,
    color: '#0504AA',
    marginTop: 2,
  },
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
  },
};