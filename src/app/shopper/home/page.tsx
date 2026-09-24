'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import ServiceReelCard from '../../../components/ServiceReelCard';
import {
  MdSearch,
  MdShoppingBasket,
  MdNotificationsNone,
  MdTune,
  MdImage,
  MdStorefront,
  MdExpandLess,
  MdExpandMore,
  MdClose,
  MdCheckCircle,
} from 'react-icons/md';

// ─── Constants ─────────────────────────────────────────────────────────────
const PULL_THRESHOLD_PX = 180;
const PULL_DEAD_ZONE_PX = 25;

const INITIAL_VISIBLE = 100;
const BATCH_SIZE = 40;

const REEL_WEIGHT = 1.78;
const ITEM_WEIGHT = 1;

const SPOTLIGHT_INTERVAL_MS = 4200;

type FeedFilter = 'mixed' | 'items' | 'services';

const FILTER_OPTIONS: { value: FeedFilter; label: string; hint: string }[] = [
  { value: 'mixed', label: 'Mixed', hint: 'Items and services, interleaved' },
  { value: 'items', label: 'Items only', hint: 'Hide the service reels' },
  { value: 'services', label: 'Services only', hint: 'Hide item cards' },
];

// ✅ RESTORED — category lists with real DB values as ids.
//    Item categories come from `validate_product_category` in storekeeper.py.
//    Service categories match `SERVICE_CATEGORIES` in add-service/page.tsx.
const PRODUCT_CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'tech_electronics', label: 'Tech', emoji: '🔌' },
  { id: 'food_beverage', label: 'Food', emoji: '🍏' },
  { id: 'health_wellness', label: 'Health', emoji: '⚕️' },
  { id: 'fashion_apparel', label: 'Fashion', emoji: '👗' },
  { id: 'building_industrial', label: 'Building', emoji: '🏗️' },
  { id: 'home_garden', label: 'Home', emoji: '🛋️' },
  { id: 'kids_toys', label: 'Kids', emoji: '🧸' },
  { id: 'sports_outdoors', label: 'Sports', emoji: '⚽' },
  { id: 'automotive', label: 'Automotive', emoji: '🚗' },
  { id: 'media_office', label: 'Media', emoji: '📚' },
];

const SERVICE_CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'grooming_beauty', label: 'Grooming', emoji: '💈' },
  { id: 'repair_maintenance', label: 'Repair', emoji: '🔧' },
  { id: 'cleaning_care', label: 'Cleaning', emoji: '🧹' },
  { id: 'education', label: 'Education', emoji: '👨‍🏫' },
  { id: 'event_entertainment', label: 'Events', emoji: '📸' },
  { id: 'digital_creative', label: 'Digital', emoji: '🎨' },
];

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function formatPrice(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return 'Free';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface RecallCandidate {
  listing_id: string | number;
}
interface RankedItem {
  listing_id: string | number;
  image_url?: string;
  title?: string;
  price?: number;
  store_name?: string;
  category?: string | null;
}
interface StoreLocation {
  store_id: string;
  store_name?: string;
  image_url?: string;
  lat: number;
  lng: number;
}
interface ServiceItem {
  service_id: string;
  provider_id: string;
  title?: string;
  price?: number | string;
  image_url?: string;
  video_url?: string | null;
  category?: string | null;
  duration_minutes?: number;
  description?: string;
  business_name?: string;
  username?: string;
  business_image_url?: string;
  avatar_url?: string;
}

type FeedKind = 'item' | 'service';

interface Item {
  id: string;
  kind: FeedKind;
  image: string | null;
  video: string | null;
  title: string;
  price: string;
  storeName: string;
  category: string | null;
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

// ─── Height-balanced masonry ───────────────────────────────────────────────
function MasonryColumns<T>({
  items,
  columns,
  gap,
  renderItem,
  keyFor,
  weightOf,
}: {
  items: T[];
  columns: number;
  gap: number;
  renderItem: (item: T) => React.ReactNode;
  keyFor: (item: T, index: number) => string;
  weightOf: (item: T) => number;
}) {
  if (items.length === 0) return null;

  const cols: T[][] = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);

  for (const item of items) {
    let target = 0;
    for (let c = 1; c < columns; c++) {
      if (heights[c] < heights[target]) target = c;
    }
    cols[target].push(item);
    heights[target] += weightOf(item) + gap;
  }

  return (
    <div style={{ display: 'flex', gap, alignItems: 'flex-start', width: '100%' }}>
      {cols.map((col, colIdx) => (
        <div
          key={colIdx}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap,
            minWidth: 0,
          }}
        >
          {col.map((item, i) => (
            <div key={keyFor(item, i)} style={{ width: '100%' }}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── LocationBanner ────────────────────────────────────────────────────────
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
        background: '#FEF3C7',
        padding: '10px 16px',
        fontSize: 13,
        color: '#78350F',
        borderBottom: '1px solid #FDE68A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        fontWeight: 600,
      }}
    >
      <span style={{ flex: 1 }}>
        📍 Location access denied — showing default results.
      </span>
      <button
        onClick={onEnableLocation}
        style={{
          background: '#78350F',
          color: '#FEF3C7',
          border: 'none',
          borderRadius: 10,
          padding: '6px 14px',
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'inherit',
        }}
      >
        Enable
      </button>
    </div>
  );
}

// ─── StoreSpotlight ────────────────────────────────────────────────────────
function StoreSpotlight({
  stores,
  collapsed,
  onToggleCollapsed,
  onPress,
}: {
  stores: Store[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onPress: (storeId: string) => void;
}) {
  const withImages = useMemo(
    () => stores.filter((s) => Boolean(s.image)),
    [stores],
  );
  const [index, setIndex] = useState(0);
  const touchPaused = useRef(false);

  useEffect(() => {
    if (collapsed || withImages.length <= 1) return;
    const id = setInterval(() => {
      if (touchPaused.current) return;
      setIndex((prev) => (prev + 1) % withImages.length);
    }, SPOTLIGHT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [collapsed, withImages.length]);

  if (withImages.length === 0) return null;

  const current = withImages[index] || withImages[0];

  return (
    <div style={{ marginBottom: 10 }}>
      {!collapsed ? (
        <>
          <div style={{ padding: '0 16px 6px' }}>
            <button
              type="button"
              onClick={() => onPress(current.id)}
              onTouchStart={() => {
                touchPaused.current = true;
              }}
              onTouchEnd={() => {
                setTimeout(() => {
                  touchPaused.current = false;
                }, 300);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: 20,
                overflow: 'hidden',
                position: 'relative',
                height: 160,
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
              aria-label={`Featured store: ${current.name}`}
            >
              <img
                key={current.id}
                src={current.image!}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  animation: 'spotlightFade 0.9s ease',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '14px 16px',
                  color: '#fff',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 1.5,
                    opacity: 0.75,
                    marginBottom: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  Featured store
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: '-0.3px',
                    textShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {current.name}
                </div>
              </div>
              {withImages.length > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 14,
                    display: 'flex',
                    gap: 5,
                  }}
                  aria-hidden="true"
                >
                  {withImages.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: i === index ? 16 : 6,
                        height: 4,
                        borderRadius: 2,
                        background:
                          i === index ? '#fff' : 'rgba(255,255,255,0.45)',
                        transition: 'width 0.25s, background 0.25s',
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          </div>
          <div style={{ textAlign: 'right', paddingRight: 16 }}>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Collapse featured stores"
              style={{
                background: 'none',
                border: 'none',
                color: '#0504AA',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <MdExpandLess size={22} />
            </button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'right', paddingRight: 16 }}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expand featured stores"
            style={{
              background: 'none',
              border: 'none',
              color: '#0504AA',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <MdExpandMore size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ItemCard ──────────────────────────────────────────────────────────────
function ItemCard({
  item,
  onPress,
  onVisualSearch,
}: {
  item: Item;
  onPress: (item: Item) => void;
  onVisualSearch: (image: string | null) => void;
}) {
  if (item.kind === 'service') {
    return (
      <ServiceReelCard
        service={{
          id: item.id,
          title: item.title,
          price: item.price,
          videoUrl: item.video,
          imageUrl: item.image,
          providerName: item.storeName,
        }}
        onOpen={() => onPress(item)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPress(item)}
      style={styles.card}
    >
      <div style={styles.imageWrap}>
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" style={styles.image} />
        ) : (
          <div style={styles.imagePlaceholder}>
            <MdImage size={36} color="#9e9e9e" />
          </div>
        )}

        <div style={styles.kindBadge}>ITEM</div>

        <div
          onClick={(e) => {
            e.stopPropagation();
            onVisualSearch(item.image);
          }}
          role="button"
          aria-label="Visual search"
          title="Visual search"
          style={styles.visualSearchBtn}
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
    </button>
  );
}

// ─── StoreCard ─────────────────────────────────────────────────────────────
function StoreCard({
  store,
  onPress,
}: {
  store: Store;
  onPress: (id: string) => void;
}) {
  return (
    <button type="button" onClick={() => onPress(store.id)} style={styles.card}>
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
    </button>
  );
}

// ─── ProviderCard ──────────────────────────────────────────────────────────
function ProviderCard({
  provider,
  onPress,
}: {
  provider: Provider;
  onPress: (id: string, name: string) => void;
}) {
  const initials = (provider.name || '?')[0].toUpperCase();
  return (
    <button
      type="button"
      onClick={() => onPress(provider.id, provider.name)}
      style={styles.card}
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
    </button>
  );
}

// ─── FeedEmpty ─────────────────────────────────────────────────────────────
function FeedEmpty({
  icon,
  title,
  body,
  onClear,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClear?: () => void;
}) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIconWrap} aria-hidden="true">
        {icon}
      </div>
      <div style={styles.emptyTitle}>{title}</div>
      <div style={styles.emptyBody}>{body}</div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          style={styles.clearFiltersBtn}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
function FeedSkeleton({ columns }: { columns: number }) {
  const cards = 8;
  return (
    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div
          key={colIdx}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minWidth: 0,
          }}
        >
          {Array.from({ length: Math.ceil(cards / columns) }).map((_, i) => (
            <div key={i} style={styles.skeletonCard}>
              <div style={styles.skeletonImage} />
              <div style={{ padding: '10px 12px' }}>
                <div style={styles.skeletonLine} />
                <div
                  style={{ ...styles.skeletonLine, width: '40%', marginTop: 6 }}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function ShopperHomePage() {
  const router = useRouter();

  const [currentTab, setCurrentTab] = useState(0);
  const [isSpotlightCollapsed, setIsSpotlightCollapsed] = useState(false);

  const [listingItems, setListingItems] = useState<Item[]>([]);
  const [serviceItems, setServiceItems] = useState<Item[]>([]);

  const [stores, setStores] = useState<Store[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);

  const [cachedPosition, setCachedPosition] =
    useState<GeolocationPosition | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const [showFilter, setShowFilter] = useState(false);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('mixed');
  // ✅ RESTORED — selected category id from the chip list, or null for All
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [columns, setColumns] = useState(2);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const sessionItemsShown = useRef<string[]>([]);

  const itemsReqSeq = useRef(0);
  const storesReqSeq = useRef(0);
  const servicesReqSeq = useRef(0);

  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const axisDecided = useRef(false);
  const isDraggingRef = useRef(false);

  const pullStartY = useRef<number | null>(null);
  const pullTriggered = useRef(false);
  const activePanelRef = useRef<HTMLDivElement>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef(0);

  const getScrollPositions = () => {
    const panelTop = activePanelRef.current?.scrollTop ?? 0;
    const windowTop =
      typeof window !== 'undefined'
        ? window.scrollY || document.documentElement.scrollTop || 0
        : 0;
    return { panelTop, windowTop };
  };

  const isAtTop = () => {
    const { panelTop, windowTop } = getScrollPositions();
    return panelTop <= 0 && windowTop <= 0;
  };

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 500) setColumns(2);
      else if (w < 800) setColumns(3);
      else if (w < 1200) setColumns(4);
      else setColumns(5);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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
        'Location access was denied. Please enable it in your browser settings and try again.',
      );
    }
  };

  useEffect(() => {
    getCurrentLocation().then(setCachedPosition);
  }, []);

  const loadItems = useCallback(
    async (lat: number, lng: number, loadMore = false) => {
      const mySeq = ++itemsReqSeq.current;

      if (!loadMore) {
        setLoadingItems(true);
        sessionItemsShown.current = [];
        setVisibleCount(INITIAL_VISIBLE);
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

        if (mySeq !== itemsReqSeq.current) return;

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

        if (mySeq !== itemsReqSeq.current) return;

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
          kind: 'item',
          image: resolveImageUrl(item.image_url),
          video: null,
          title: item.title ?? 'No Title',
          price: formatPrice(item.price),
          storeName: item.store_name ?? 'Unknown',
          // ✅ NEW — carry category through
          category: item.category ?? null,
        }));

        newItems.forEach((item) => sessionItemsShown.current.push(item.id));

        if (loadMore) {
          setListingItems((prev) => [...prev, ...newItems]);
        } else {
          setListingItems(newItems);
          setLoadingItems(false);
        }
      } catch {
        if (mySeq === itemsReqSeq.current && !loadMore) setLoadingItems(false);
      }
    },
    [],
  );

  const loadStores = useCallback(async (_lat: number, _lng: number) => {
    const mySeq = ++storesReqSeq.current;
    try {
      const locations =
        (await api.getStoreLocations()) as unknown as StoreLocation[];
      if (mySeq !== storesReqSeq.current) return;
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
      if (mySeq === storesReqSeq.current) setLoadingStores(false);
    }
  }, []);

  const loadServices = useCallback(async (_lat: number, _lng: number) => {
    const mySeq = ++servicesReqSeq.current;
    try {
      const services = (await api.listServices()) as unknown as ServiceItem[];

      if (mySeq !== servicesReqSeq.current) return;

      const svcItems: Item[] = services
        .filter((s) => s && s.service_id)
        .map((s) => ({
          id: s.service_id,
          kind: 'service',
          image: resolveImageUrl(s.image_url),
          video: resolveImageUrl(s.video_url ?? null),
          title: s.title ?? 'Service',
          price: formatPrice(s.price),
          storeName: s.business_name ?? s.username ?? 'Service Provider',
          // ✅ NEW — carry category through
          category: s.category ?? null,
        }));
      setServiceItems(svcItems);

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
      if (mySeq === servicesReqSeq.current) setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    if (cachedPosition !== undefined) {
      const lat = cachedPosition?.coords.latitude ?? 5.5103;
      const lng = cachedPosition?.coords.longitude ?? 7.0265;
      loadItems(lat, lng, false);
      loadStores(lat, lng);
      loadServices(lat, lng);
    }
  }, [cachedPosition, loadItems, loadStores, loadServices]);

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

  // ✅ Applied filters: kind AND category, before interleave
  const filteredListingItems = useMemo(() => {
    if (feedFilter === 'services') return [];
    if (!selectedCategory) return listingItems;
    return listingItems.filter((it) => it.category === selectedCategory);
  }, [feedFilter, selectedCategory, listingItems]);

  const filteredServiceItems = useMemo(() => {
    if (feedFilter === 'items') return [];
    if (!selectedCategory) return serviceItems;
    return serviceItems.filter((it) => it.category === selectedCategory);
  }, [feedFilter, selectedCategory, serviceItems]);

  const feedItems = useMemo(
    () => interleave(filteredListingItems, filteredServiceItems),
    [filteredListingItems, filteredServiceItems],
  );
  const displayedFeed = feedItems.slice(0, visibleCount);

  useEffect(() => {
    totalRef.current = feedItems.length;
  }, [feedItems.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentTab !== 0) return;
    if (loadingItems || loadingServices) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        setVisibleCount((c) => {
          const total = totalRef.current;
          if (c >= total) return c;
          return Math.min(c + BATCH_SIZE, total);
        });
      },
      { rootMargin: '300px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentTab, loadingItems, loadingServices, feedItems.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragStartX.current = t.clientX;
    dragStartY.current = t.clientY;
    dragOffsetRef.current = 0;
    axisDecided.current = false;
    isDraggingRef.current = false;

    pullStartY.current = isAtTop() ? t.clientY : null;
    pullTriggered.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const currentX = t.clientX;
    const currentY = t.clientY;

    if (
      pullStartY.current !== null &&
      !pullTriggered.current &&
      !isRefreshing &&
      !isDraggingRef.current
    ) {
      if (!isAtTop()) {
        pullStartY.current = null;
      } else {
        const deltaY = currentY - pullStartY.current;

        if (deltaY < 0) {
          pullStartY.current = null;
        } else if (deltaY > PULL_DEAD_ZONE_PX + PULL_THRESHOLD_PX) {
          pullTriggered.current = true;
          setIsRefreshing(true);
          onRefresh().finally(() => setIsRefreshing(false));
          return;
        }
      }
    }

    if (dragStartX.current === null || dragStartY.current === null) return;
    const deltaX = currentX - dragStartX.current;
    const deltaY = currentY - dragStartY.current;

    if (!axisDecided.current) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        axisDecided.current = true;
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
          isDraggingRef.current = true;
          setIsDragging(true);
          pullStartY.current = null;
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
    pullStartY.current = null;
    pullTriggered.current = false;
  };

  const openSearch = () => router.push('/seai-search');
  const openBasket = () => router.push('/basket');
  const openNotifications = () => router.push('/notifications');
  const openFilter = () => setShowFilter(true);
  const closeFilter = () => setShowFilter(false);

  const handleItemPress = (item: Item) => {
    if (item.kind === 'service') {
      router.push(`/service-detail/${item.id}`);
    } else {
      router.push(`/item-detail/${item.id}`);
    }
  };

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

  const clearAllFilters = () => {
    setFeedFilter('mixed');
    setSelectedCategory(null);
    setVisibleCount(INITIAL_VISIBLE);
  };

  const hasActiveFilters = feedFilter !== 'mixed' || selectedCategory !== null;

  const trackTransform = `translateX(calc(-${currentTab * 33.3333}% + ${dragOffset}px))`;

  const loadingFeed = loadingItems || loadingServices;
  const hasMoreToReveal = visibleCount < feedItems.length;

  const TAB_LABELS = ['BUYTEMS', 'SHOPNSTORE', 'SERVOOKS'];

  const activeCategoryLabel = selectedCategory
    ? PRODUCT_CATEGORIES.find((c) => c.id === selectedCategory)?.label ||
      SERVICE_CATEGORIES.find((c) => c.id === selectedCategory)?.label ||
      selectedCategory
    : null;

  return (
    <div style={styles.container}>
      <style>{CSS}</style>

      {/* App bar */}
      <div style={styles.appBar}>
        <div style={styles.brand}>Admerce</div>
        <div style={styles.appBarActions}>
          <button
            style={styles.iconBtn}
            onClick={openSearch}
            aria-label="Search"
            title="Search"
          >
            <MdSearch size={22} color="#0504AA" />
          </button>
          <button
            style={styles.iconBtn}
            onClick={openBasket}
            aria-label="Basket"
            title="Basket"
          >
            <MdShoppingBasket size={22} color="#0504AA" />
          </button>
          <button
            style={styles.iconBtn}
            onClick={openNotifications}
            aria-label="Notifications"
            title="Notifications"
          >
            <MdNotificationsNone size={22} color="#0504AA" />
          </button>
          <button
            style={{
              ...styles.iconBtn,
              // ✅ Highlight the tune icon when a filter is active
              backgroundColor: hasActiveFilters ? '#EEF0FF' : 'transparent',
            }}
            onClick={openFilter}
            aria-label="Feed options"
            title="Feed options"
          >
            <MdTune size={22} color="#0504AA" />
          </button>
        </div>
      </div>

      <LocationBanner
        locationDenied={locationDenied}
        onEnableLocation={requestLocationManually}
      />

      {!loadingStores && (
        <StoreSpotlight
          stores={stores}
          collapsed={isSpotlightCollapsed}
          onToggleCollapsed={() => setIsSpotlightCollapsed((c) => !c)}
          onPress={handleStorePress}
        />
      )}

      {/* Tabs */}
      <div style={styles.tabsWrap} role="tablist">
        {TAB_LABELS.map((label, i) => {
          const active = currentTab === i;
          return (
            <button
              key={i}
              role="tab"
              aria-selected={active}
              onClick={() => setCurrentTab(i)}
              style={{
                ...styles.tabBtn,
                background: active ? '#0504AA' : 'transparent',
                color: active ? '#fff' : '#334155',
                borderColor: active ? '#0504AA' : 'rgba(15,23,42,0.12)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Active filter chip strip */}
      {currentTab === 0 && hasActiveFilters && (
        <div style={styles.activeFilters}>
          <span style={styles.activeFiltersLabel}>Showing:</span>
          {feedFilter !== 'mixed' && (
            <span style={styles.activeFilterChip}>
              {feedFilter === 'items' ? 'Items' : 'Services'}
              <button
                type="button"
                onClick={() => setFeedFilter('mixed')}
                aria-label="Remove kind filter"
                style={styles.activeFilterClose}
              >
                <MdClose size={12} color="#0504AA" />
              </button>
            </span>
          )}
          {activeCategoryLabel && (
            <span style={styles.activeFilterChip}>
              {activeCategoryLabel}
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                aria-label="Remove category filter"
                style={styles.activeFilterClose}
              >
                <MdClose size={12} color="#0504AA" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            style={styles.activeFiltersClear}
          >
            Clear
          </button>
        </div>
      )}

      {/* Panels */}
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
          {/* Tab 0 — feed */}
          <div
            ref={currentTab === 0 ? activePanelRef : null}
            style={styles.panel}
          >
            <div style={styles.panelInner}>
              {loadingFeed ? (
                <FeedSkeleton columns={columns} />
              ) : feedItems.length === 0 ? (
                hasActiveFilters ? (
                  <FeedEmpty
                    icon={<MdTune size={40} color="#94a3b8" />}
                    title="No matches"
                    body="Try a different category or clear the filters."
                    onClear={clearAllFilters}
                  />
                ) : (
                  <FeedEmpty
                    icon={<MdImage size={40} color="#94a3b8" />}
                    title="Nothing to show yet"
                    body="Pull down to refresh, or check back soon."
                  />
                )
              ) : (
                <>
                  <MasonryColumns
                    items={displayedFeed}
                    columns={columns}
                    gap={10}
                    keyFor={(item) => `${item.kind}-${item.id}`}
                    weightOf={(item) =>
                      item.kind === 'service' ? REEL_WEIGHT : ITEM_WEIGHT
                    }
                    renderItem={(item) => (
                      <ItemCard
                        item={item}
                        onPress={handleItemPress}
                        onVisualSearch={handleVisualSearch}
                      />
                    )}
                  />
                  {hasMoreToReveal && (
                    <div ref={sentinelRef} style={{ height: 1 }} />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tab 1 — stores */}
          <div
            ref={currentTab === 1 ? activePanelRef : null}
            style={styles.panel}
          >
            <div style={styles.panelInner}>
              {loadingStores ? (
                <FeedSkeleton columns={columns} />
              ) : stores.length === 0 ? (
                <FeedEmpty
                  icon={<MdStorefront size={40} color="#94a3b8" />}
                  title="No stores yet"
                  body="Stores will appear here as storekeepers open them."
                />
              ) : (
                <MasonryColumns
                  items={stores}
                  columns={columns}
                  gap={10}
                  keyFor={(store) => store.id}
                  weightOf={() => ITEM_WEIGHT}
                  renderItem={(store) => (
                    <StoreCard store={store} onPress={handleStorePress} />
                  )}
                />
              )}
            </div>
          </div>

          {/* Tab 2 — providers */}
          <div
            ref={currentTab === 2 ? activePanelRef : null}
            style={styles.panel}
          >
            <div style={styles.panelInner}>
              {loadingServices ? (
                <FeedSkeleton columns={columns} />
              ) : providers.length === 0 ? (
                <FeedEmpty
                  icon={<MdStorefront size={40} color="#94a3b8" />}
                  title="No service providers yet"
                  body="Providers will appear here as they list services."
                />
              ) : (
                <MasonryColumns
                  items={providers}
                  columns={columns}
                  gap={10}
                  keyFor={(provider) => provider.id}
                  weightOf={() => ITEM_WEIGHT}
                  renderItem={(provider) => (
                    <ProviderCard
                      provider={provider}
                      onPress={handleProviderPress}
                    />
                  )}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feed options sheet */}
      {showFilter && (
        <div style={styles.modalOverlay} onClick={closeFilter}>
          <div
            style={styles.filterSheet}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Feed options"
          >
            <div style={styles.sheetGrabber} />
            <div style={styles.sheetHeaderRow}>
              <h3 style={styles.sheetTitle}>Feed options</h3>
              <button
                type="button"
                onClick={closeFilter}
                aria-label="Close"
                style={styles.sheetClose}
              >
                <MdClose size={20} color="#64748b" />
              </button>
            </div>

            {/* Show */}
            <div style={styles.filterSection}>
              <div style={styles.filterSectionLabel}>Show</div>
              <div style={styles.filterOptions}>
                {FILTER_OPTIONS.map((opt) => {
                  const active = feedFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setFeedFilter(opt.value);
                        setVisibleCount(INITIAL_VISIBLE);
                      }}
                      style={{
                        ...styles.filterOption,
                        background: active ? '#EEF0FF' : '#fff',
                        borderColor: active ? '#0504AA' : '#E5E7EF',
                      }}
                    >
                      <span style={styles.filterOptionText}>
                        <span
                          style={{
                            ...styles.filterOptionLabel,
                            color: active ? '#0504AA' : '#0F172A',
                          }}
                        >
                          {opt.label}
                        </span>
                        <span style={styles.filterOptionHint}>{opt.hint}</span>
                      </span>
                      {active && <MdCheckCircle size={20} color="#0504AA" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product categories */}
            <div style={styles.filterSection}>
              <div style={styles.filterSectionLabel}>Products</div>
              <div style={styles.chipGrid}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setVisibleCount(INITIAL_VISIBLE);
                  }}
                  style={{
                    ...styles.categoryChip,
                    background: !selectedCategory ? '#0504AA' : '#fff',
                    borderColor: !selectedCategory ? '#0504AA' : '#E5E7EF',
                    color: !selectedCategory ? '#fff' : '#334155',
                  }}
                >
                  All
                </button>
                {PRODUCT_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(active ? null : cat.id);
                        setVisibleCount(INITIAL_VISIBLE);
                      }}
                      style={{
                        ...styles.categoryChip,
                        background: active ? '#0504AA' : '#fff',
                        borderColor: active ? '#0504AA' : '#E5E7EF',
                        color: active ? '#fff' : '#334155',
                      }}
                    >
                      <span aria-hidden="true">{cat.emoji}</span>
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Service categories */}
            <div style={styles.filterSection}>
              <div style={styles.filterSectionLabel}>Services</div>
              <div style={styles.chipGrid}>
                {SERVICE_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(active ? null : cat.id);
                        setVisibleCount(INITIAL_VISIBLE);
                      }}
                      style={{
                        ...styles.categoryChip,
                        background: active ? '#0504AA' : '#fff',
                        borderColor: active ? '#0504AA' : '#E5E7EF',
                        color: active ? '#fff' : '#334155',
                      }}
                    >
                      <span aria-hidden="true">{cat.emoji}</span>
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.sheetActions}>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  style={styles.clearBtn}
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={closeFilter}
                style={styles.applyBtn}
              >
                Done
              </button>
            </div>
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
    backgroundColor: '#F4F5FB',
    minHeight: 0,
  },
  appBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #EAECF3',
  },
  brand: {
    fontWeight: 800,
    color: '#0504AA',
    fontSize: 18,
    letterSpacing: '-0.3px',
  },
  appBarActions: { display: 'flex', gap: 4 },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  },
  tabsWrap: {
    display: 'flex',
    gap: 6,
    padding: '12px 16px 10px',
    backgroundColor: '#F4F5FB',
  },
  tabBtn: {
    flex: 1,
    padding: '9px 10px',
    borderRadius: 12,
    border: '1px solid',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.6,
    cursor: 'pointer',
    transition: 'all 0.22s',
    fontFamily: 'inherit',
  },
  // ✅ NEW — active filter strip shown when filters are on
  activeFilters: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 16px 10px',
    flexWrap: 'wrap',
  },
  activeFiltersLabel: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  activeFilterChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px 4px 12px',
    borderRadius: 999,
    background: '#EEF0FF',
    color: '#0504AA',
    fontSize: 12,
    fontWeight: 700,
  },
  activeFilterClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    width: 16,
    height: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFiltersClear: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: 700,
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
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
    height: '100%',
    minHeight: 0,
    boxSizing: 'border-box',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  },
  panelInner: {
    width: '100%',
    padding: '0 16px 16px',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(11,11,26,0.04)',
    overflow: 'hidden',
    cursor: 'pointer',
    width: '100%',
    border: '1px solid #EAECF3',
    padding: 0,
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  image: { display: 'block', width: '100%', height: 'auto' },
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
  providerInitials: { fontSize: 48, fontWeight: 700, color: '#fff' },
  kindBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    padding: '3px 8px',
    borderRadius: 8,
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    backgroundColor: '#0F172A',
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
    padding: '10px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
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
  cardPrice: { color: '#0504AA', fontWeight: 700, fontSize: 13 },
  cardStore: {
    fontSize: 11,
    color: '#64748B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    gap: 8,
    textAlign: 'center',
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    background: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: 800, color: '#334155' },
  emptyBody: {
    fontSize: 13.5,
    color: '#64748B',
    maxWidth: 340,
    lineHeight: 1.5,
  },
  clearFiltersBtn: {
    marginTop: 12,
    padding: '10px 20px',
    borderRadius: 12,
    border: 'none',
    background: '#0504AA',
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  skeletonCard: {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: '1 / 1',
    background: 'linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%)',
    backgroundSize: '800px 100%',
    animation: 'shimmer 1.4s infinite linear',
  },
  skeletonLine: {
    height: 10,
    borderRadius: 6,
    background: 'linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%)',
    backgroundSize: '800px 100%',
    animation: 'shimmer 1.4s infinite linear',
    width: '80%',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(11,11,26,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 1000,
    animation: 'fadeIn 0.18s ease-out',
  },
  filterSheet: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 500,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: '10px 20px 24px',
    maxHeight: '88vh',
    overflowY: 'auto',
  },
  sheetGrabber: {
    width: 40,
    height: 5,
    background: '#E2E8F0',
    borderRadius: 3,
    margin: '0 auto 16px',
  },
  sheetHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.2px',
  },
  sheetClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  filterSection: { marginBottom: 22 },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  filterOptions: { display: 'flex', flexDirection: 'column', gap: 8 },
  filterOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    border: '1px solid',
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  filterOptionText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  filterOptionLabel: {
    fontSize: 14.5,
    fontWeight: 800,
    letterSpacing: '-0.2px',
  },
  filterOptionHint: { fontSize: 12.5, color: '#64748B', lineHeight: 1.4 },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    fontFamily: 'inherit',
  },
  sheetActions: {
    display: 'flex',
    gap: 10,
    marginTop: 8,
  },
  clearBtn: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#fff',
    color: '#334155',
    border: '1px solid #E2E8F0',
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  applyBtn: {
    flex: 2,
    padding: '14px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  refreshIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    padding: 8,
    zIndex: 10,
    pointerEvents: 'none',
  },
  spinner: {
    width: 24,
    height: 24,
    border: '3px solid #E2E8F0',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spotlightFade {
    from { opacity: 0; transform: scale(1.03); }
    to { opacity: 1; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;