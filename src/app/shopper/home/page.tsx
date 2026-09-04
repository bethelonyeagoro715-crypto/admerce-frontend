'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdSearch,
  MdShoppingBasket,
  MdNotificationsNone,
  MdTune,
  MdImage,
  MdStorefront,
  MdBusiness,
  MdExpandLess,
  MdExpandMore,
} from 'react-icons/md';

// ─── Constants ─────────────────────────────────────────────────────────────
const kProductCategories = [
  '🔌 Tech & Electronics',
  '🍏 Food, Beverage & Consumables',
  '⚕️ Health, Wellness & Beauty',
  '👗 Fashion, Apparel & Goods',
  '🏗️ Building, Industrial & Hardware',
  '🛋️ Home, Living & Garden',
  '🧸 Kids, Toys & Hobbies',
  '⚽ Sports, Outdoors & Travel',
  '🚗 Automotive & Industrial Vehicles',
  '📚 Media, Office & Education',
];

const serviceCategories = [
  { emoji: '💈', name: 'Barber' },
  { emoji: '💅', name: 'Nail Artist' },
  { emoji: '🧹', name: 'Cleaner' },
  { emoji: '👨‍🏫', name: 'Tutor' },
  { emoji: '🔧', name: 'Handyman' },
  { emoji: '📸', name: 'Photographer' },
  { emoji: '🎵', name: 'Musician' },
  { emoji: '🏋️', name: 'Fitness Trainer' },
];

const noteworthyImages = Array.from({ length: 20 }, (_, i) =>
  `https://picsum.photos/800/400?random=${i * 10}`
);

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}

// ─── Typed response shapes ─────────────────────────────────────────────────
interface RecallCandidate {
  listing_id: string | number;
}

interface RankedItem {
  listing_id: string | number;
  image_url?: string;
  title?: string;
  price?: number;
  store_name?: string;
}

interface StoreLocation {
  store_id: string;
  store_name?: string;
  image_url?: string;
  lat: number;
  lng: number;
}

interface ServiceItem {
  provider_id: string;
  business_name?: string;
  username?: string;
  business_image_url?: string;
  avatar_url?: string;
}

interface Item {
  id: string;
  image: string | null;
  title: string;
  price: string;
  storeName: string;
}

interface Store {
  id: string;
  name: string;
  image: string | null;
  lat: number;
  lng: number;
}

interface Provider {
  id: string;
  name: string;
  image: string | null;
  serviceCount: number;
}

// ─── Hoisted sub-components ────────────────────────────────────────────────
function LocationBanner({
  locationDenied,
  onEnableLocation,
}: {
  locationDenied: boolean;
  onEnableLocation: () => void;
}) {
  if (!locationDenied) return null;
  return (
    <div
      style={{
        background: '#FFF3E0',
        padding: '10px 16px',
        fontSize: 13,
        textAlign: 'center',
        color: '#E65100',
        borderBottom: '1px solid #FFE0B2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <span style={{ flex: 1 }}>📍 Location access was denied – showing default results.</span>
      <button
        onClick={onEnableLocation}
        style={{
          background: '#0504AA',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '6px 12px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        Enable Location
      </button>
    </div>
  );
}

function ItemCard({
  item,
  index,
  onPress,
  onVisualSearch,
}: {
  item: Item;
  index: number;
  onPress: (id: string) => void;
  onVisualSearch: (image: string | null) => void;
}) {
  const aspectRatio = 0.7 + (index % 3) * 0.15;
  const height = 180 / aspectRatio;

  return (
    <div style={styles.card} onClick={() => onPress(item.id)}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            height: `${height}px`,
            background: item.image ? `url(${item.image}) center/cover` : '#e0e0e0',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!item.image && <MdImage size={32} color="#9e9e9e" />}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onVisualSearch(item.image);
          }}
          title="Visual Search"
        >
          <MdSearch size={20} color="#0504AA" />
        </div>
      </div>
      <div style={{ padding: '8px' }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1.3,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </div>
        <div style={{ color: '#0504AA', fontWeight: 600 }}>{item.price}</div>
      </div>
    </div>
  );
}

function StoreCard({
  store,
  onPress,
}: {
  store: Store;
  onPress: (id: string) => void;
}) {
  return (
    <div style={styles.card} onClick={() => onPress(store.id)}>
      <div
        style={{
          height: 140,
          background: store.image ? `url(${store.image}) center/cover` : '#e0e0e0',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!store.image && <MdStorefront size={32} color="#9e9e9e" />}
      </div>
      <div style={{ padding: '8px', fontWeight: 700, fontSize: 14 }}>{store.name}</div>
    </div>
  );
}

function ProviderCard({
  provider,
  onPress,
}: {
  provider: Provider;
  onPress: (id: string, name: string) => void;
}) {
  return (
    <div style={styles.card} onClick={() => onPress(provider.id, provider.name)}>
      <div
        style={{
          height: 140,
          background: provider.image
            ? `url(${provider.image}) center/cover`
            : 'linear-gradient(135deg, #7B1FA2, #9C27B0)',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!provider.image && <MdBusiness size={40} color="#fff" />}
      </div>
      <div style={{ padding: '8px' }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {provider.name}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {provider.serviceCount} service{provider.serviceCount > 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

// ─── Main page component ───────────────────────────────────────────────────
export default function ShopperHomePage() {
  const router = useRouter();

  const [currentTab, setCurrentTab] = useState(0);
  const [noteworthyIndex, setNoteworthyIndex] = useState(0);
  const [isNoteworthyCollapsed, setIsNoteworthyCollapsed] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);

  const [cachedPosition, setCachedPosition] = useState<GeolocationPosition | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const [showFilter, setShowFilter] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const noteworthyTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionItemsShown = useRef<string[]>([]);

  // Touch tracking for pull-to-refresh and swipe
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const swipeTriggered = useRef(false);

  // ─── Location helpers ──────────────────────────────────────────────────
  const getCurrentLocation = async (): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationDenied(true);
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationDenied(false);
          resolve(pos);
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
          setLocationDenied(true);
          resolve(null);
        },
        { timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const requestLocationManually = async () => {
    const pos = await getCurrentLocation();
    if (pos) {
      setCachedPosition(pos);
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      await Promise.all([
        loadItems(lat, lng, false),
        loadStores(lat, lng),
        loadServices(lat, lng),
      ]);
    } else {
      alert(
        'Location access was denied. Please enable it in your browser settings (click the lock icon in the address bar) and try again.'
      );
    }
  };

  useEffect(() => {
    getCurrentLocation().then(setCachedPosition);
  }, []);

  // ─── New & Noteworthy rotation ─────────────────────────────────────────
  useEffect(() => {
    noteworthyTimer.current = setInterval(() => {
      setNoteworthyIndex((prev) => (prev + 1) % noteworthyImages.length);
    }, 3000);
    return () => {
      if (noteworthyTimer.current) clearInterval(noteworthyTimer.current);
    };
  }, []);

  // ─── Feed loaders ──────────────────────────────────────────────────────
  const loadItems = async (lat: number, lng: number, loadMore = false) => {
    if (!loadMore) {
      setLoadingItems(true);
      sessionItemsShown.current = [];
    }
    try {
      const recallData = await api.recallFeed(lat, lng, 50, {
        geo: 0.4,
        forage: 0.15,
        trending: 0.1,
        following: 0.1,
        embedding: 0.15,
        collab: 0.1,
      });

      const candidates: RecallCandidate[] = Array.isArray(recallData.candidates)
        ? (recallData.candidates as RecallCandidate[])
        : [];
      if (!candidates.length) {
        if (!loadMore) setLoadingItems(false);
        return;
      }

      const candidateIds = candidates.map((c) => c.listing_id.toString());
      const rankData = await api.rankFeed(lat, lng, candidateIds, sessionItemsShown.current);
      const feed: RankedItem[] = Array.isArray(rankData?.feed)
        ? (rankData.feed as RankedItem[])
        : [];

      feed.forEach((item, index) => {
        api.logSeaiEvent('impression', item.listing_id.toString(), lat, lng, index);
      });

      const newItems: Item[] = feed.map((item) => ({
        id: item.listing_id?.toString() ?? '',
        image: resolveImageUrl(item.image_url),
        title: item.title ?? 'No Title',
        price: item.price ? `₦${Number(item.price).toFixed(0)}` : '₦0',
        storeName: item.store_name ?? 'Unknown',
      }));

      newItems.forEach((item) => sessionItemsShown.current.push(item.id));

      if (loadMore) {
        setItems((prev) => [...prev, ...newItems]);
      } else {
        setItems(newItems);
        setLoadingItems(false);
      }
    } catch {
      if (!loadMore) setLoadingItems(false);
    }
  };

  const loadStores = async (_lat: number, _lng: number) => {
    try {
      const locations = (await api.getStoreLocations()) as unknown as StoreLocation[];
      setStores(
        locations.map((loc) => ({
          id: loc.store_id,
          name: loc.store_name ?? 'Store',
          image: resolveImageUrl(loc.image_url),
          lat: loc.lat,
          lng: loc.lng,
        }))
      );
    } catch {
      // ignore
    } finally {
      setLoadingStores(false);
    }
  };

  const loadServices = async (_lat: number, _lng: number) => {
    try {
      const services = (await api.listServices()) as unknown as ServiceItem[];
      const providerMap = new Map<string, Provider>();

      for (const s of services) {
        if (!s.provider_id) continue;
        if (!providerMap.has(s.provider_id)) {
          providerMap.set(s.provider_id, {
            id: s.provider_id,
            name: s.business_name ?? s.username ?? 'Service Provider',
            image: resolveImageUrl(s.business_image_url) ?? resolveImageUrl(s.avatar_url),
            serviceCount: 0,
          });
        }
        providerMap.get(s.provider_id)!.serviceCount += 1;
      }

      setProviders(Array.from(providerMap.values()));
    } catch {
      // ignore
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    if (cachedPosition !== undefined) {
      const lat = cachedPosition?.coords.latitude ?? 5.5103;
      const lng = cachedPosition?.coords.longitude ?? 7.0265;
      loadItems(lat, lng, false);
      loadStores(lat, lng);
      loadServices(lat, lng);
    }
  }, [cachedPosition]);

  // ─── Refresh handler (returns Promise) ────────────────────────────────
  const onRefresh = async (): Promise<void> => {
    const pos = await getCurrentLocation();
    const lat = pos?.coords.latitude ?? 5.5103;
    const lng = pos?.coords.longitude ?? 7.0265;
    await Promise.all([
      loadItems(lat, lng, false),
      loadStores(lat, lng),
      loadServices(lat, lng),
    ]);
  };

  // ─── Touch handlers (pull-to-refresh + swipe tabs) ───────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
    touchStartX.current = e.touches[0].clientX;
    swipeTriggered.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Pull-to-refresh (vertical)
    if (touchStartY.current !== null) {
      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY > 80 && !isRefreshing) {
        setIsRefreshing(true);
        touchStartY.current = null;
        onRefresh().finally(() => setIsRefreshing(false));
        return;
      }
    }

    // Swipe-to-change-tabs (horizontal)
    if (touchStartX.current !== null && !swipeTriggered.current) {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      const deltaY = touchStartY.current !== null
        ? e.touches[0].clientY - touchStartY.current
        : 0;

      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeTriggered.current = true;
        if (deltaX < 0) {
          setCurrentTab((prev) => Math.min(prev + 1, 2));
        } else {
          setCurrentTab((prev) => Math.max(prev - 1, 0));
        }
        // Reset to avoid re-triggering
        touchStartX.current = null;
        touchStartY.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    swipeTriggered.current = false;
  };

  // ─── Navigation helpers ────────────────────────────────────────────────
  const openSearch = () => router.push('/seai-search');
  const openBasket = () => router.push('/basket');
  const openNotifications = () => router.push('/notifications');
  const openFilter = () => setShowFilter(true);
  const closeFilter = () => setShowFilter(false);

  const handleItemPress = (id: string) => router.push(`/item-detail/${id}`);
  const handleVisualSearch = (image: string | null) => {
    if (image) {
      router.push(`/seai-lens?image=${encodeURIComponent(image)}`);
    } else {
      alert('No image available for visual search.');
    }
  };
  const handleStorePress = (id: string) => router.push(`/store-detail/${id}`);
  const handleProviderPress = (id: string, name: string) =>
    router.push(`/provider-services/${id}?name=${encodeURIComponent(name)}`);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* App Bar */}
      <div style={styles.appBar}>
        <div style={{ fontWeight: 600, color: '#0504AA', fontSize: 18 }}>Admerce</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.iconBtn} onClick={openSearch} title="Search">
            <MdSearch size={24} color="#0504AA" />
          </button>
          <button style={styles.iconBtn} onClick={openBasket} title="Basket">
            <MdShoppingBasket size={24} color="#0504AA" />
          </button>
          <button style={styles.iconBtn} onClick={openNotifications} title="Notifications">
            <MdNotificationsNone size={24} color="#0504AA" />
          </button>
          <button style={styles.iconBtn} onClick={openFilter} title="Filters">
            <MdTune size={24} color="#0504AA" />
          </button>
        </div>
      </div>

      {/* Location denied banner */}
      <LocationBanner
        locationDenied={locationDenied}
        onEnableLocation={requestLocationManually}
      />

      {/* New & Noteworthy */}
      <div style={{ marginBottom: 8 }}>
        {!isNoteworthyCollapsed ? (
          <>
            <div style={{ padding: '0 16px', marginBottom: 4 }}>
              <div style={{ borderRadius: 20, overflow: 'hidden', position: 'relative', height: 180 }}>
                <img
                  src={noteworthyImages[noteworthyIndex]}
                  alt="Noteworthy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.8s' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    fontWeight: 700,
                    padding: 12,
                  }}
                >
                  New & Noteworthy
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', paddingRight: 16 }}>
              <button
                style={{ background: 'none', border: 'none', color: '#0504AA', cursor: 'pointer' }}
                onClick={() => setIsNoteworthyCollapsed(true)}
              >
                <MdExpandLess size={24} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'right', paddingRight: 16 }}>
            <button
              style={{ background: 'none', border: 'none', color: '#0504AA', cursor: 'pointer' }}
              onClick={() => setIsNoteworthyCollapsed(false)}
            >
              <MdExpandMore size={24} />
            </button>
          </div>
        )}
      </div>

      {/* Pill Tabs (no refresh button) */}
      <div style={{ display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', marginBottom: 12 }}>
        {['BUYTEMS', 'SHOPNSTORE', 'SERVOOKS'].map((tab, i) => (
          <button
            key={i}
            onClick={() => setCurrentTab(i)}
            style={{
              padding: '8px 20px',
              borderRadius: 20,
              border: currentTab === i ? '1px solid #0504AA' : '1px solid rgba(26,26,26,0.3)',
              background: currentTab === i ? '#0504AA' : 'transparent',
              color: currentTab === i ? '#fff' : '#1A1A1A',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s',
              flex: 1,
              margin: '0 4px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content (with pull-to-refresh and swipeable tabs) */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '0 12px', position: 'relative' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isRefreshing && (
          <div style={styles.refreshIndicator}>
            <div style={styles.spinner} />
          </div>
        )}

        {currentTab === 0 && (
          <>
            {loadingItems ? (
              <div style={{ textAlign: 'center', padding: 40 }}>Loading items...</div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>No items yet.</div>
            ) : (
              <div style={{ columns: '2 1px', columnGap: 12 }}>
                {items.map((item, idx) => (
                  <div key={item.id} style={{ breakInside: 'avoid', marginBottom: 12 }}>
                    <ItemCard
                      item={item}
                      index={idx}
                      onPress={handleItemPress}
                      onVisualSearch={handleVisualSearch}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {currentTab === 1 && (
          <>
            {loadingStores ? (
              <div style={{ textAlign: 'center', padding: 40 }}>Loading stores...</div>
            ) : stores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>No stores yet.</div>
            ) : (
              <div style={{ columns: '2 1px', columnGap: 12 }}>
                {stores.map((store) => (
                  <div key={store.id} style={{ breakInside: 'avoid', marginBottom: 12 }}>
                    <StoreCard store={store} onPress={handleStorePress} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {currentTab === 2 && (
          <>
            {loadingServices ? (
              <div style={{ textAlign: 'center', padding: 40 }}>Loading service providers...</div>
            ) : providers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>No service providers yet.</div>
            ) : (
              <div style={{ columns: '2 1px', columnGap: 12 }}>
                {providers.map((provider) => (
                  <div key={provider.id} style={{ breakInside: 'avoid', marginBottom: 12 }}>
                    <ProviderCard provider={provider} onPress={handleProviderPress} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Modal */}
      {showFilter && (
        <div style={styles.modalOverlay} onClick={closeFilter}>
          <div style={styles.filterSheet} onClick={(e) => e.stopPropagation()}>
            <div
              style={{ width: 40, height: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 2, margin: '0 auto 16px' }}
            />
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>
              {currentTab === 2 ? 'Filter Services' : 'Filter Items'}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {(currentTab === 2
                ? serviceCategories.map((c) => `${c.emoji} ${c.name}`)
                : kProductCategories
              ).map((cat) => (
                <button
                  key={cat}
                  onClick={closeFilter}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: '1px solid #ccc',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            {currentTab !== 2 && (
              <div style={{ marginTop: 16 }}>
                <div>Max Price: ₦--</div>
                <input type="range" min="1000" max="200000" step="1000" style={{ width: '100%' }} disabled />
                <div>Distance: -- km</div>
                <input type="range" min="1" max="50" style={{ width: '100%' }} disabled />
              </div>
            )}
            <button
              onClick={closeFilter}
              style={{
                marginTop: 20,
                width: '100%',
                padding: 12,
                backgroundColor: '#0504AA',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  appBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 8px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  filterSheet: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 500,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70vh',
    overflowY: 'auto',
  },
  refreshIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    padding: '8px',
    zIndex: 5,
    background: 'rgba(248,249,250,0.9)',
  },
  spinner: {
    width: 24,
    height: 24,
    border: '3px solid #ccc',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};