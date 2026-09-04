'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '../../../services/api';

interface Store {
  store_id: string;
  name: string;
  store_image_url?: string;
  address?: string;
  category?: string[];
  [key: string]: unknown;
}

interface StoreItem {
  listing_id: string;
  title: string;
  image_url?: string;
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const storeId = params.id;

  const [store, setStore] = useState<Store | null>(null);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchStore = async () => {
      try {
        const [storeData, itemsData, followStatus] = await Promise.all([
          api.getStoreById(storeId) as unknown as Store,
          api.getStoreItems(storeId) as unknown as StoreItem[],
          api.getFollowStatus(storeId),
        ]);
        if (cancelled) return;
        setStore(storeData);
        setItems(itemsData);
        setIsFollowing(followStatus);
      } catch (err) {
        console.error('Failed to load store:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStore();

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const toggleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowStore(storeId);
      } else {
        await api.followStore(storeId);
      }
      setIsFollowing(!isFollowing);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setFollowLoading(false);
    }
  };

  const shareStore = async () => {
    if (!store) return;
    const message = `
🌟 Check out ${store.name} on Admerce!

📍 ${store.address ?? 'Address not available'}

🔗 https://admerce.com/store/${storeId}
    `.trim();

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Check out ${store.name} on Admerce!`,
          text: message,
          url: `https://admerce.com/store/${storeId}`,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(message);
        alert('Store link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const resolveImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
  };

  if (loading) {
    return (
      <main style={styles.center}>
        <p>Loading store...</p>
      </main>
    );
  }

  if (!store) {
    return (
      <main style={styles.center}>
        <p>Store not found.</p>
      </main>
    );
  }

  const storeImage = resolveImageUrl(store.store_image_url);
  const categories: string[] = Array.isArray(store.category) ? store.category : [];

  return (
    <main style={styles.container}>
      {/* App Bar */}
      <div style={styles.appBar}>
        <button onClick={() => router.back()} style={styles.backBtn}>←</button>
        <h1 style={styles.title}>{store.name}</h1>
        <div style={styles.actions}>
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            style={{ ...styles.iconBtn, color: isFollowing ? '#FFA000' : '#666' }}
            title={isFollowing ? 'Unfollow' : 'Follow'}
          >
            {isFollowing ? '⭐' : '☆'}
          </button>
          <button onClick={shareStore} style={styles.iconBtn} title="Share">
            📤
          </button>
        </div>
      </div>

      <div style={styles.scrollArea}>
        {/* Store header */}
        <div style={styles.header}>
          <div style={styles.avatar}>
            {storeImage ? (
              <img src={storeImage} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 30 }}>🏪</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={styles.storeName}>{store.name}</h2>
            {store.address && (
              <p style={styles.address}>{store.address}</p>
            )}
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div style={styles.categories}>
            {categories.map((cat, idx) => (
              <span key={idx} style={styles.categoryChip}>{cat}</span>
            ))}
          </div>
        )}

        {/* Items grid */}
        <h3 style={styles.sectionTitle}>Items</h3>
        {items.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No items in this store</p>
        ) : (
          <div style={styles.itemsGrid}>
            {items.map((item) => {
              const itemImage = resolveImageUrl(item.image_url);
              return (
                <div
                  key={item.listing_id}
                  style={styles.itemCard}
                  onClick={() => router.push(`/item-detail/${item.listing_id}`)}
                >
                  <div style={styles.itemImage}>
                    {itemImage ? (
                      <img src={itemImage} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 32, color: '#999' }}>📷</span>
                    )}
                  </div>
                  <div style={styles.itemTitle}>
                    {item.title || 'No Title'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#fff',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#fff',
  },
  appBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    marginRight: 12,
    color: '#333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    margin: 0,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    padding: 4,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#0504AA10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    fontSize: 20,
    fontWeight: 'bold',
    margin: 0,
  },
  address: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  categories: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    padding: '6px 12px',
    backgroundColor: '#0504AA10',
    color: '#0504AA',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
    cursor: 'pointer',
  },
  itemImage: {
    height: 120,
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    padding: '8px',
    fontSize: 14,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};