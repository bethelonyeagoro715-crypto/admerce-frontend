'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MasonryGrid, getImageSize } from 'react-masonry-virtualized';
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

const REF_WIDTH = 200;

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  return `${base}${url}`;
}

async function computeImageHeight(
  imageUrl: string | null,
  bodyHeight: number,
): Promise<{ width: number; height: number }> {
  const fallbackHeight = REF_WIDTH * 1.1 + bodyHeight;
  if (!imageUrl) return { width: REF_WIDTH, height: fallbackHeight };

  try {
    const { width, height } = await getImageSize(imageUrl);
    if (!width || !height) return { width: REF_WIDTH, height: fallbackHeight };

    const scaled = (height / width) * REF_WIDTH;
    const clamped = Math.max(REF_WIDTH * 0.6, Math.min(scaled, REF_WIDTH * 1.75));
    return { width: REF_WIDTH, height: clamped + bodyHeight };
  } catch {
    return { width: REF_WIDTH, height: fallbackHeight };
  }
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

// ─── Sub-components ────────────────────────────────────────────────────────
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
      <span style={{ flex: 1 }}>
        📍 Location access was denied – showing default results.
      </span>
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
  onPress,
  onVisualSearch,
}: {
  item: Item;
  onPress: (id: string) => void;
  onVisualSearch: (image: string | null) => void;
}) {
  return (
    <div style={styles.card} onClick={() => onPress(item.id)}>
      <div style={styles.imageWrap}>
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" style={styles.image} />
        ) : (
          <div style={styles.imagePlaceholder}>
            <MdImage size={36} color="#9e9e9e" />
          </div>
        )}
        <div
          style={styles.visualSearchBtn}
          onClick={(e) => {
            e.stopPropagation();
            onVisualSearch(item.image);
          }}
          title="Visual Search"
        >
          <MdSearch size={18} color="#0504AA" />
        </div>
      </div>

      <div style={styles.cardBody}>
        <div style={styles.cardTitle} title={item.title}>
          {item.title}
        </div>
        <div style={styles.cardPrice}>{item.price}</div>
        {item.storeName && (
          <div style={styles.cardStore} title={item.storeName}>
            {item.storeName}
          </div>
        )}
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
      <div style={styles.imageWrap}>
        {store.image ? (
          <img src={store.image} alt="" loading="lazy" style={styles.image} />
        ) : (
          <div style={styles.imagePlaceholder}>
            <MdStorefront size={36} color="#9e9e9e" />
          </div>
        )}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitle} title={store.name}>
          {store.name}
        </div>
        <div style={styles.cardStore}>Store</div>
      </div>
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
  const initials = (provider.name || '?')[0].toUpperCase();
  return (
    <div
      style={styles.card}
      onClick={() => onPress(provider.id, provider.name)}
    >
      <div style={styles.imageWrap}>
        {provider.image ? (
          <img
            src={provider.image}
            alt=""
            loading="lazy"
            style={styles.image}
          />
        ) : (
          <div style={styles.providerPlaceholder}>
            <span style={styles.providerInitials}>{initials}</span>
          </div>
        )}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitle} title={provider.name}>
          {provider.name}
        </div>
        <div style={styles.cardStore}>
          {provider.serviceCount} service{provider.serviceCount > 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
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

  const [cachedPosition, setCachedPosition] =
    useState<GeolocationPosition | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const [showFilter, setShowFilter] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const noteworthyTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionItemsShown = useRef<string[]>([]);

  const touchStartY = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const axisDecided = useRef(false);
  const isDraggingRef = useRef(false);

  // ─── Location ───────────────────────────────────────────────────────
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
        { timeout: 10000, maximumAge: 0 },
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
        'Location access was denied. Please enable it in your browser settings (click the lock icon in the address bar) and try again.',
      );
    }
  };

  useEffect(() => {
    getCurrentLocation().then(setCachedPosition);
  }, []);

  // ─── New & Noteworthy rotation ───────────────────────────────────────
  useEffect(() => {
    noteworthyTimer.current = setInterval(() => {
      setNoteworthyIndex((prev) => (prev + 1) % noteworthyImages.length);
    }, 3000);
    return () => {
      if (noteworthyTimer.current) clearInterval(noteworthyTimer.current);
    };
  }, []);

  // ─── Feed loaders ─────────────────────────────────────────────────────
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

      const candidates: RecallCandidate[] = Array.isArray(
        recallData.candidates,
      )
        ? (recallData.candidates as RecallCandidate[])
        : [];
      if (!candidates.length) {
        if (!loadMore) setLoadingItems(false);
        return;
      }

      const candidateIds = candidates.map((c) => c.listing_id.toString());
      const rankData = await api.rankFeed(
        lat,
        lng,
        candidateIds,
        sessionItemsShown.current,
      );
      const feed: RankedItem[] = Array.isArray(rankData?.feed)
        ? (rankData.feed as RankedItem[])
        : [];

      feed.forEach((item, index) => {
        api.logSeaiEvent(
          'impression',
          item.listing_id.toString(),
          lat,
          lng,
          index,
        );
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
      const locations =
        (await api.getStoreLocations()) as unknown as StoreLocation[];
      setStores(
        locations.map((loc) => ({
          id: loc.store_id,
          name: loc.store_name ?? 'Store',
          image: resolveImageUrl(loc.image_url),
          lat: loc.lat,
          lng: loc.lng,
        })),
      );
    } catch {
      // ignore
    } finally {
      setLoadingStores(false);
    }
  };

  const loadServices = async (_lat: number, _lng: number) => {
    try {
      const services =
        (await api.listServices()) as unknown as ServiceItem[];
      const providerMap = new Map<string, Provider>();

      for (const s of services) {
        if (!s.provider_id) continue;
        if (!providerMap.has(s.provider_id)) {
          providerMap.set(s.provider_id, {
            id: s.provider_id,
            name: s.business_name ?? s.username ?? 'Service Provider',
            image:
              resolveImageUrl(s.business_image_url) ??
              resolveImageUrl(s.avatar_url),
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

  // ─── Touch handlers ─────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
    dragOffsetRef.current = 0;
    axisDecided.current = false;
    isDraggingRef.current = false;

    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    if (touchStartY.current !== null && !isDraggingRef.current) {
      const deltaY = currentY - touchStartY.current;
      if (deltaY > 80 && !isRefreshing) {
        setIsRefreshing(true);
        touchStartY.current = null;
        onRefresh().finally(() => setIsRefreshing(false));
        return;
      }
    }

    if (dragStartX.current === null || dragStartY.current === null) return;
    const deltaX = currentX - dragStartX.current;
    const deltaY = currentY - dragStartY.current;

    if (!axisDecided.current) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        axisDecided.current = true;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          isDraggingRef.current = true;
          setIsDragging(true);
        }
      }
    }

    if (!isDraggingRef.current) return;

    let offset = deltaX;
    if (
      (currentTab === 0 && offset > 0) ||
      (currentTab === 2 && offset < 0)
    ) {
      offset = offset * 0.3;
    }
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  };

  const handleTouchEnd = () => {
    if (isDraggingRef.current) {
      const threshold = (window.innerWidth || 375) * 0.2;
      const offset = dragOffsetRef.current;

      if (offset < -threshold && currentTab < 2) {
        setCurrentTab(currentTab + 1);
      } else if (offset > threshold && currentTab > 0) {
        setCurrentTab(currentTab - 1);
      }

      setDragOffset(0);
      dragOffsetRef.current = 0;
      isDraggingRef.current = false;
      setIsDragging(false);
    }
    axisDecided.current = false;
    dragStartX.current = null;
    dragStartY.current = null;
    touchStartY.current = null;
  };

  // ─── Navigation ─────────────────────────────────────────────────────
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
  // ✅ Fixed: was `/providers/${id}` (404). Actual route is `/provider-services/${id}`.
  const handleProviderPress = (id: string, name: string) =>
    router.push(
      `/provider-services/${id}?name=${encodeURIComponent(name)}`,
    );

  // ─── Size functions for the masonry library ─────────────────────────
  const getItemCardSize = useCallback(
    async (item: Item) => computeImageHeight(item.image, 76),
    [],
  );
  const getStoreCardSize = useCallback(
    async (store: Store) => computeImageHeight(store.image, 56),
    [],
  );
  const getProviderCardSize = useCallback(
    async (provider: Provider) => computeImageHeight(provider.image, 60),
    [],
  );

  const trackTransform = `translateX(calc(-${currentTab * 33.3333}% + ${dragOffset}px))`;

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* App Bar */}
      <div style={styles.appBar}>
        <div style={{ fontWeight: 600, color: '#0504AA', fontSize: 18 }}>
          Admerce
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.iconBtn} onClick={openSearch} title="Search">
            <MdSearch size={24} color="#0504AA" />
          </button>
          <button style={styles.iconBtn} onClick={openBasket} title="Basket">
            <MdShoppingBasket size={24} color="#0504AA" />
          </button>
          <button
            style={styles.iconBtn}
            onClick={openNotifications}
            title="Notifications"
          >
            <MdNotificationsNone size={24} color="#0504AA" />
          </button>
          <button style={styles.iconBtn} onClick={openFilter} title="Filters">
            <MdTune size={24} color="#0504AA" />
          </button>
        </div>
      </div>

      <LocationBanner
        locationDenied={locationDenied}
        onEnableLocation={requestLocationManually}
      />

      {/* New & Noteworthy */}
      <div style={{ marginBottom: 8 }}>
        {!isNoteworthyCollapsed ? (
          <>
            <div style={{ padding: '0 16px', marginBottom: 4 }}>
              <div
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  position: 'relative',
                  height: 180,
                }}
              >
                <img
                  src={noteworthyImages[noteworthyIndex]}
                  alt="Noteworthy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'opacity 0.8s',
                  }}
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
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0504AA',
                  cursor: 'pointer',
                }}
                onClick={() => setIsNoteworthyCollapsed(true)}
              >
                <MdExpandLess size={24} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'right', paddingRight: 16 }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: '#0504AA',
                cursor: 'pointer',
              }}
              onClick={() => setIsNoteworthyCollapsed(false)}
            >
              <MdExpandMore size={24} />
            </button>
          </div>
        )}
      </div>

      {/* Pill Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        {['BUYTEMS', 'SHOPNSTORE', 'SERVOOKS'].map((tab, i) => (
          <button
            key={i}
            onClick={() => setCurrentTab(i)}
            style={{
              padding: '8px 20px',
              borderRadius: 20,
              border:
                currentTab === i
                  ? '1px solid #0504AA'
                  : '1px solid rgba(26,26,26,0.3)',
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

      {/* Slidable tab content */}
      <div
        style={styles.tabContent}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {isRefreshing && (
          <div style={styles.refreshIndicator}>
            <div style={styles.spinner} />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            width: '300%',
            height: '100%',
            transform: trackTransform,
            transition: isDragging
              ? 'none'
              : 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)',
            willChange: 'transform',
            touchAction: 'pan-y',
          }}
        >
          {/* Panel 0 — BUYTEMS */}
          <div style={styles.panel}>
            {loadingItems ? (
              <div style={styles.centeredMsg}>Loading items…</div>
            ) : items.length === 0 ? (
              <div style={styles.centeredMsg}>No items yet.</div>
            ) : (
              <MasonryGrid
                items={items}
                renderItem={(item: Item) => (
                  <ItemCard
                    item={item}
                    onPress={handleItemPress}
                    onVisualSearch={handleVisualSearch}
                  />
                )}
                getItemSize={getItemCardSize}
                gap={10}
                minWidth={160}
              />
            )}
          </div>

          {/* Panel 1 — SHOPNSTORE */}
          <div style={styles.panel}>
            {loadingStores ? (
              <div style={styles.centeredMsg}>Loading stores…</div>
            ) : stores.length === 0 ? (
              <div style={styles.centeredMsg}>No stores yet.</div>
            ) : (
              <MasonryGrid
                items={stores}
                renderItem={(store: Store) => (
                  <StoreCard store={store} onPress={handleStorePress} />
                )}
                getItemSize={getStoreCardSize}
                gap={10}
                minWidth={160}
              />
            )}
          </div>

          {/* Panel 2 — SERVOOKS */}
          <div style={styles.panel}>
            {loadingServices ? (
              <div style={styles.centeredMsg}>Loading service providers…</div>
            ) : providers.length === 0 ? (
              <div style={styles.centeredMsg}>No service providers yet.</div>
            ) : (
              <MasonryGrid
                items={providers}
                renderItem={(provider: Provider) => (
                  <ProviderCard
                    provider={provider}
                    onPress={handleProviderPress}
                  />
                )}
                getItemSize={getProviderCardSize}
                gap={10}
                minWidth={160}
              />
            )}
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilter && (
        <div style={styles.modalOverlay} onClick={closeFilter}>
          <div
            style={styles.filterSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                margin: '0 auto 16px',
              }}
            />
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>
              {currentTab === 2 ? 'Filter Services' : 'Filter Items'}
            </h3>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}
            >
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
                <input
                  type="range"
                  min="1000"
                  max="200000"
                  step="1000"
                  style={{ width: '100%' }}
                  disabled
                />
                <div>Distance: -- km</div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  style={{ width: '100%' }}
                  disabled
                />
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
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  panel: {
    width: '33.3333%',
    flex: '0 0 33.3333%',
    minHeight: 0,
    alignSelf: 'flex-start',
  },
  centeredMsg: {
    textAlign: 'center',
    padding: 40,
    color: '#888',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    cursor: 'pointer',
    width: '100%',
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  image: {
    display: 'block',
    width: '100%',
    height: 'auto',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: '1 / 1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0',
  },
  providerPlaceholder: {
    width: '100%',
    aspectRatio: '1 / 1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #7B1FA2, #9C27B0)',
  },
  providerInitials: {
    fontSize: 48,
    fontWeight: 700,
    color: '#fff',
  },
  visualSearchBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  cardBody: {
    padding: '8px 10px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: 13,
    lineHeight: 1.3,
    color: '#0F172A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  cardPrice: {
    color: '#0504AA',
    fontWeight: 700,
    fontSize: 13,
  },
  cardStore: {
    fontSize: 11,
    color: '#64748B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    padding: 8,
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