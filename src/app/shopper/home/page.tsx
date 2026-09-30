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

const SPOTLIGHT_INTERVAL_MS = 4200;

const CONTENT_MAX_WIDTH = 1440;

// Aspect ratio bounds — width / height.
const MIN_ASPECT = 9 / 16; // 0.5625 — tallest (reels)
const MAX_ASPECT = 4 / 5; // 0.8 — shortest (Instagram portrait)
const DEFAULT_ASPECT = 3 / 4; // 0.75 — when dims are missing
const SERVICE_ASPECT = 9 / 16; // services are video-only, always 9:16

// Gap between cards, in pixels. Bumped to match Pinterest spacing.
const GRID_GAP_MOBILE = 14;
const GRID_GAP_DESKTOP = 22;

type FeedFilter = 'mixed' | 'items' | 'services';

const FILTER_OPTIONS: { value: FeedFilter; label: string; hint: string }[] = [
  { value: 'mixed', label: 'Mixed', hint: 'Items and services, interleaved' },
  { value: 'items', label: 'Items only', hint: 'Hide the service reels' },
  { value: 'services', label: 'Services only', hint: 'Hide item cards' },
];

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

function computeAspect(
  w: number | null | undefined,
  h: number | null | undefined,
): number {
  const width = Number(w ?? 0);
  const height = Number(h ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return DEFAULT_ASPECT;
  }
  if (width <= 0 || height <= 0) return DEFAULT_ASPECT;
  const raw = width / height;
  if (raw < MIN_ASPECT) return MIN_ASPECT;
  if (raw > MAX_ASPECT) return MAX_ASPECT;
  return raw;
}

function seededAspect(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = ((h >>> 0) % 1000) / 1000;
  return MIN_ASPECT + (MAX_ASPECT - MIN_ASPECT) * n;
}

function interleave<T>(a: T[], b: T[]): T[] {
  if (b.length === 0) return [...a];
  if (a.length === 0) return [...b];

  const out: T[] = [];
  const total = a.length + b.length;
  const step = total / b.length;
  let nextBAt = step / 2;
  let aIdx = 0;
  let bIdx = 0;

  for (let pos = 0; pos < total; pos++) {
    if (bIdx < b.length && pos >= nextBAt) {
      out.push(b[bIdx++]);
      nextBAt += step;
    } else if (aIdx < a.length) {
      out.push(a[aIdx++]);
    } else {
      out.push(b[bIdx++]);
    }
  }
  return out;
}

// ─── Brand icon components ─────────────────────────────────────────────────
function LensIcon({
  size = 18,
  color = 'currentColor',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="2.25"
        y="2.25"
        width="17"
        height="17"
        rx="4.25"
        stroke={color}
        strokeWidth="2.2"
      />
      <circle
        cx="10.75"
        cy="10.75"
        r="5"
        stroke={color}
        strokeWidth="2.2"
      />
      <rect
        x="18.25"
        y="9.25"
        width="3.5"
        height="3"
        rx="1.2"
        stroke={color}
        strokeWidth="2.2"
      />
    </svg>
  );
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
  image_width?: number | null;
  image_height?: number | null;
}
interface StoreLocation {
  store_id: string;
  store_name?: string;
  image_url?: string;
  lat: number;
  lng: number;
  image_width?: number | null;
  image_height?: number | null;
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
  aspect: number;
}
interface Store {
  id: string;
  name: string;
  image: string | null;
  lat: number;
  lng: number;
  aspect: number;
}
interface Provider {
  id: string;
  name: string;
  image: string | null;
  serviceCount: number;
  aspect: number;
}

// ─── Height-balanced masonry ───────────────────────────────────────────────
function MasonryColumns<T>({
  items,
  columns,
  gapPx,
  renderItem,
  keyFor,
  weightOf,
}: {
  items: T[];
  columns: number;
  gapPx: number;
  renderItem: (item: T) => React.ReactNode;
  keyFor: (item: T, index: number) => string;
  weightOf: (item: T) => number;
}) {
  if (items.length === 0) return null;

  const ASSUMED_CARD_WIDTH_PX = 200;
  const gapWeight = gapPx / ASSUMED_CARD_WIDTH_PX;

  const cols: T[][] = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);

  for (const item of items) {
    let target = 0;
    for (let c = 1; c < columns; c++) {
      if (heights[c] < heights[target]) target = c;
    }
    cols[target].push(item);
    heights[target] += weightOf(item) + gapWeight;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: gapPx,
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      {cols.map((col, colIdx) => (
        <div
          key={colIdx}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: gapPx,
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
        background: 'var(--warning-bg)',
        padding: '10px 16px',
        fontSize: 13,
        color: 'var(--warning-fg)',
        borderBottom: '1px solid var(--warning-strong)',
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
          background: 'var(--warning-strong)',
          color: '#FFFFFF',
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

  if (collapsed) {
    return (
      <div className="sh-spotlight-wrap">
        <div className="sh-spotlight-pad">
          <div className="sh-spotlight-collapsed">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="sh-spotlight-collapsed-btn"
              aria-label="Expand featured stores"
            >
              <span className="sh-spotlight-collapsed-label">
                Featured stores
              </span>
              <MdExpandMore size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sh-spotlight-wrap">
      <div className="sh-spotlight-pad">
        <div className="sh-spotlight-rel">
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
            className="sh-spotlight-btn"
            aria-label={`Featured store: ${current.name}`}
          >
            <img
              key={current.id}
              src={current.image!}
              alt=""
              className="sh-spotlight-img"
            />
            <div className="sh-spotlight-overlay" aria-hidden />
            <div className="sh-spotlight-text">
              <div className="sh-spotlight-eyebrow">
                Featured store
              </div>
              <div className="sh-spotlight-title">{current.name}</div>
            </div>
            {withImages.length > 1 && (
              <div className="sh-spotlight-dots" aria-hidden="true">
                {withImages.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i === index
                        ? 'sh-spotlight-dot sh-spotlight-dot-active'
                        : 'sh-spotlight-dot'
                    }
                  />
                ))}
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            className="sh-spotlight-collapse"
            aria-label="Collapse featured stores"
            title="Collapse featured stores"
          >
            <MdExpandLess size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ReelCard ──────────────────────────────────────────────────────────────
function ReelCard({
  image,
  aspect,
  placeholder,
  badge,
  badgeBg,
  onPress,
  onSearch,
  store,
  title,
  price,
  ariaLabel,
}: {
  image: string | null;
  aspect: number;
  placeholder: React.ReactNode;
  badge: string;
  badgeBg: string;
  onPress: () => void;
  onSearch?: () => void;
  store?: string;
  title: string;
  price?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{ ...styles.reelCard, aspectRatio: aspect }}
      aria-label={ariaLabel || title}
      className="sh-reel"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" style={styles.reelImage} />
      ) : (
        <div style={styles.reelPlaceholder}>{placeholder}</div>
      )}

      <div style={styles.reelGradient} aria-hidden />

      <div style={{ ...styles.reelBadge, backgroundColor: badgeBg }}>
        {badge}
      </div>

      {onSearch && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSearch();
          }}
          role="button"
          aria-label="Visual search"
          title="Search by photo"
          style={styles.reelSearch}
        >
          <LensIcon size={18} color="#0504AA" />
        </div>
      )}

      <div style={styles.reelBody}>
        {store && <div style={styles.reelStore}>{store}</div>}
        <div style={styles.reelTitle}>{title}</div>
        {price && <div style={styles.reelPrice}>{price}</div>}
      </div>
    </button>
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
      <div
        className="sh-svc-wrap"
        style={{ aspectRatio: SERVICE_ASPECT }}
      >
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
      </div>
    );
  }

  return (
    <ReelCard
      image={item.image}
      aspect={item.aspect}
      placeholder={<MdImage size={40} color="var(--text-muted)" />}
      badge="ITEM"
      badgeBg="rgba(15,23,42,0.82)"
      onPress={() => onPress(item)}
      onSearch={() => onVisualSearch(item.image)}
      store={item.storeName}
      title={item.title}
      price={item.price}
    />
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
    <ReelCard
      image={store.image}
      aspect={store.aspect}
      placeholder={<MdStorefront size={40} color="var(--text-muted)" />}
      badge="STORE"
      badgeBg="rgba(5,4,170,0.9)"
      onPress={() => onPress(store.id)}
      title={store.name}
    />
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
    <ReelCard
      image={provider.image}
      aspect={provider.aspect}
      placeholder={
        <div style={styles.reelProviderPlaceholder}>
          <span style={styles.reelProviderInitials}>{initials}</span>
        </div>
      }
      badge="PROVIDER"
      badgeBg="rgba(126,34,206,0.9)"
      onPress={() => onPress(provider.id, provider.name)}
      title={provider.name}
      price={`${provider.serviceCount} service${
        provider.serviceCount > 1 ? 's' : ''
      }`}
    />
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
function FeedSkeleton({
  columns,
  gapPx,
}: {
  columns: number;
  gapPx: number;
}) {
  const cards = 8;
  return (
    <div style={{ display: 'flex', gap: gapPx, width: '100%' }}>
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div
          key={colIdx}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: gapPx,
            minWidth: 0,
          }}
        >
          {Array.from({ length: Math.ceil(cards / columns) }).map(
            (_, i) => (
              <div key={i} style={styles.skeletonCard}>
                <div style={styles.skeletonImage} />
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function ShopperHomePage() {
  const router = useRouter();

  const [currentTab, setCurrentTab] = useState(0);
  const [isSpotlightCollapsed, setIsSpotlightCollapsed] =
    useState(false);

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
  const [selectedCategory, setSelectedCategory] = useState<
    string | null
  >(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [columns, setColumns] = useState(2);
  const [gapPx, setGapPx] = useState(GRID_GAP_MOBILE);
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
        ? window.scrollY ||
          document.documentElement.scrollTop ||
          0
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
      else if (w < 1600) setColumns(5);
      else setColumns(6);
      setGapPx(
        w >= 1024 ? GRID_GAP_DESKTOP : GRID_GAP_MOBILE,
      );
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const getCurrentLocation =
    async (): Promise<GeolocationPosition | null> => {
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

        const candidateIds = candidates.map((c) =>
          c.listing_id.toString(),
        );
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

        const newItems: Item[] = feed.map((item) => {
          const id = item.listing_id?.toString() ?? '';
          const aspect = computeAspect(
            item.image_width,
            item.image_height,
          );
          return {
            id,
            kind: 'item' as const,
            image: resolveImageUrl(item.image_url),
            video: null,
            title: item.title ?? 'No Title',
            price: formatPrice(item.price),
            storeName: item.store_name ?? 'Unknown',
            category: item.category ?? null,
            aspect,
          };
        });

        newItems.forEach((item) =>
          sessionItemsShown.current.push(item.id),
        );

        if (loadMore) {
          setListingItems((prev) => [...prev, ...newItems]);
        } else {
          setListingItems(newItems);
          setLoadingItems(false);
        }
      } catch {
        if (mySeq === itemsReqSeq.current && !loadMore)
          setLoadingItems(false);
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
        locations.map((loc) => {
          const backendAspect = computeAspect(
            loc.image_width,
            loc.image_height,
          );
          const aspect =
            loc.image_width && loc.image_height
              ? backendAspect
              : seededAspect(`store-${loc.store_id}`);
          return {
            id: loc.store_id,
            name: loc.store_name ?? 'Store',
            image: resolveImageUrl(loc.image_url),
            lat: loc.lat,
            lng: loc.lng,
            aspect,
          };
        }),
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
      const services =
        (await api.listServices()) as unknown as ServiceItem[];

      if (mySeq !== servicesReqSeq.current) return;

      const svcItems: Item[] = services
        .filter((s) => s && s.service_id)
        .map((s) => ({
          id: s.service_id,
          kind: 'service' as const,
          image: resolveImageUrl(s.image_url),
          video: resolveImageUrl(s.video_url ?? null),
          title: s.title ?? 'Service',
          price: formatPrice(s.price),
          storeName:
            s.business_name ?? s.username ?? 'Service Provider',
          category: s.category ?? null,
          aspect: SERVICE_ASPECT,
        }));
      setServiceItems(svcItems);

      const providerMap = new Map<string, Provider>();
      for (const s of services) {
        if (!s.provider_id) continue;
        if (!providerMap.has(s.provider_id)) {
          providerMap.set(s.provider_id, {
            id: s.provider_id,
            name:
              s.business_name ?? s.username ?? 'Service Provider',
            image:
              resolveImageUrl(s.business_image_url) ??
              resolveImageUrl(s.avatar_url),
            serviceCount: 0,
            aspect: seededAspect(`provider-${s.provider_id}`),
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

  const filteredListingItems = useMemo(() => {
    if (feedFilter === 'services') return [];
    if (!selectedCategory) return listingItems;
    return listingItems.filter(
      (it) => it.category === selectedCategory,
    );
  }, [feedFilter, selectedCategory, listingItems]);

  const filteredServiceItems = useMemo(() => {
    if (feedFilter === 'items') return [];
    if (!selectedCategory) return serviceItems;
    return serviceItems.filter(
      (it) => it.category === selectedCategory,
    );
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
  }, [
    currentTab,
    loadingItems,
    loadingServices,
    feedItems.length,
  ]);

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
        } else if (
          deltaY >
          PULL_DEAD_ZONE_PX + PULL_THRESHOLD_PX
        ) {
          pullTriggered.current = true;
          setIsRefreshing(true);
          onRefresh().finally(() => setIsRefreshing(false));
          return;
        }
      }
    }

    if (dragStartX.current === null || dragStartY.current === null)
      return;
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
  const handleStorePress = (id: string) =>
    router.push(`/store-detail/${id}`);
  const handleProviderPress = (id: string, name: string) =>
    router.push(
      `/provider-services/${id}?name=${encodeURIComponent(name)}`,
    );

  const clearAllFilters = () => {
    setFeedFilter('mixed');
    setSelectedCategory(null);
    setVisibleCount(INITIAL_VISIBLE);
  };

  const hasActiveFilters =
    feedFilter !== 'mixed' || selectedCategory !== null;

  const trackTransform = `translateX(calc(-${
    currentTab * 33.3333
  }% + ${dragOffset}px))`;

  const loadingFeed = loadingItems || loadingServices;
  const hasMoreToReveal = visibleCount < feedItems.length;

  const TAB_LABELS = ['BUYTEMS', 'SHOPNSTORE', 'SERVOOKS'];

  const activeCategoryLabel = selectedCategory
    ? PRODUCT_CATEGORIES.find((c) => c.id === selectedCategory)
        ?.label ||
      SERVICE_CATEGORIES.find((c) => c.id === selectedCategory)
        ?.label ||
      selectedCategory
    : null;

  return (
    <div style={styles.container} className="sh-home">
      <style>{CSS}</style>

      {/* App bar */}
      <div style={styles.appBar}>
        <div style={styles.appBarInner}>
          <div style={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/admerce_symbol.png"
              alt=""
              style={styles.brandLogo}
              aria-hidden="true"
            />
            <span style={styles.brandName}>Admerce</span>
          </div>
          <div style={styles.appBarActions}>
            <button
              style={styles.iconBtn}
              onClick={openSearch}
              aria-label="Search"
              title="Search"
            >
              <MdSearch size={22} color="var(--brand-primary)" />
            </button>
            <button
              style={styles.iconBtn}
              onClick={openBasket}
              aria-label="Basket"
              title="Basket"
            >
              <MdShoppingBasket
                size={22}
                color="var(--brand-primary)"
              />
            </button>
            <button
              style={styles.iconBtn}
              onClick={openNotifications}
              aria-label="Notifications"
              title="Notifications"
            >
              <MdNotificationsNone
                size={22}
                color="var(--brand-primary)"
              />
            </button>
            <button
              style={{
                ...styles.iconBtn,
                backgroundColor: hasActiveFilters
                  ? 'var(--brand-soft)'
                  : 'transparent',
              }}
              onClick={openFilter}
              aria-label="Feed options"
              title="Feed options"
            >
              <MdTune size={22} color="var(--brand-primary)" />
            </button>
          </div>
        </div>
      </div>

      <LocationBanner
        locationDenied={locationDenied}
        onEnableLocation={requestLocationManually}
      />

      <div style={styles.contentColumn}>
        {!loadingStores && (
          <StoreSpotlight
            stores={stores}
            collapsed={isSpotlightCollapsed}
            onToggleCollapsed={() =>
              setIsSpotlightCollapsed((c) => !c)
            }
            onPress={handleStorePress}
          />
        )}

        {/* ── PILL TABS ──────────────────────────────────────── */}
        <div
          style={styles.tabsWrap}
          className="sh-tabs-wrap"
          role="tablist"
        >
          <div style={styles.tabsInner} className="sh-tabs-inner">
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
                    background: active
                      ? 'var(--brand-gradient)'
                      : 'var(--bg-tertiary)',
                    color: active
                      ? 'var(--brand-on-gradient)'
                      : 'var(--text-secondary)',
                    borderColor: active
                      ? 'transparent'
                      : 'var(--border-default)',
                    boxShadow: active
                      ? '0 8px 22px rgba(232,232,236,0.22), inset 0 1px 0 rgba(255,255,255,0.7)'
                      : 'none',
                  }}
                  className="sh-tab-pill"
                >
                  {label}
                </button>
              );
            })}
          </div>
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
                  <MdClose
                    size={12}
                    color="var(--brand-primary)"
                  />
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
                  <MdClose
                    size={12}
                    color="var(--brand-primary)"
                  />
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
              <div
                style={styles.panelInner}
                className="sh-panel-inner"
              >
                {loadingFeed ? (
                  <FeedSkeleton
                    columns={columns}
                    gapPx={gapPx}
                  />
                ) : feedItems.length === 0 ? (
                  hasActiveFilters ? (
                    <FeedEmpty
                      icon={
                        <MdTune
                          size={40}
                          color="var(--text-muted)"
                        />
                      }
                      title="No matches"
                      body="Try a different category or clear the filters."
                      onClear={clearAllFilters}
                    />
                  ) : (
                    <FeedEmpty
                      icon={
                        <MdImage
                          size={40}
                          color="var(--text-muted)"
                        />
                      }
                      title="Nothing to show yet"
                      body="Pull down to refresh, or check back soon."
                    />
                  )
                ) : (
                  <>
                    <MasonryColumns
                      items={displayedFeed}
                      columns={columns}
                      gapPx={gapPx}
                      keyFor={(item) => `${item.kind}-${item.id}`}
                      weightOf={(item) => 1 / item.aspect}
                      renderItem={(item) => (
                        <ItemCard
                          item={item}
                          onPress={handleItemPress}
                          onVisualSearch={handleVisualSearch}
                        />
                      )}
                    />
                    {hasMoreToReveal && (
                      <div
                        ref={sentinelRef}
                        style={{ height: 1 }}
                      />
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
              <div
                style={styles.panelInner}
                className="sh-panel-inner"
              >
                {loadingStores ? (
                  <FeedSkeleton
                    columns={columns}
                    gapPx={gapPx}
                  />
                ) : stores.length === 0 ? (
                  <FeedEmpty
                    icon={
                      <MdStorefront
                        size={40}
                        color="var(--text-muted)"
                      />
                    }
                    title="No stores yet"
                    body="Stores will appear here as storekeepers open them."
                  />
                ) : (
                  <MasonryColumns
                    items={stores}
                    columns={columns}
                    gapPx={gapPx}
                    keyFor={(store) => store.id}
                    weightOf={(store) => 1 / store.aspect}
                    renderItem={(store) => (
                      <StoreCard
                        store={store}
                        onPress={handleStorePress}
                      />
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
              <div
                style={styles.panelInner}
                className="sh-panel-inner"
              >
                {loadingServices ? (
                  <FeedSkeleton
                    columns={columns}
                    gapPx={gapPx}
                  />
                ) : providers.length === 0 ? (
                  <FeedEmpty
                    icon={
                      <MdStorefront
                        size={40}
                        color="var(--text-muted)"
                      />
                    }
                    title="No service providers yet"
                    body="Providers will appear here as they list services."
                  />
                ) : (
                  <MasonryColumns
                    items={providers}
                    columns={columns}
                    gapPx={gapPx}
                    keyFor={(provider) => provider.id}
                    weightOf={(provider) => 1 / provider.aspect}
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
      </div>

      {/* Feed options sheet */}
      {showFilter && (
        <div
          style={styles.modalOverlay}
          className="sh-modal-overlay"
          onClick={closeFilter}
        >
          <div
            style={styles.filterSheet}
            className="sh-filter-sheet"
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
                <MdClose
                  size={20}
                  color="var(--text-tertiary)"
                />
              </button>
            </div>

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
                        background: active
                          ? 'var(--brand-soft)'
                          : 'var(--bg-secondary)',
                        borderColor: active
                          ? 'var(--brand-primary)'
                          : 'var(--border-default)',
                      }}
                    >
                      <span style={styles.filterOptionText}>
                        <span
                          style={{
                            ...styles.filterOptionLabel,
                            color: active
                              ? 'var(--brand-primary)'
                              : 'var(--text-primary)',
                          }}
                        >
                          {opt.label}
                        </span>
                        <span style={styles.filterOptionHint}>
                          {opt.hint}
                        </span>
                      </span>
                      {active && (
                        <MdCheckCircle
                          size={20}
                          color="var(--brand-primary)"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

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
                    background: !selectedCategory
                      ? 'var(--brand-primary)'
                      : 'var(--bg-secondary)',
                    borderColor: !selectedCategory
                      ? 'var(--brand-primary)'
                      : 'var(--border-default)',
                    color: !selectedCategory
                      ? 'var(--brand-on-primary)'
                      : 'var(--text-secondary)',
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
                        setSelectedCategory(
                          active ? null : cat.id,
                        );
                        setVisibleCount(INITIAL_VISIBLE);
                      }}
                      style={{
                        ...styles.categoryChip,
                        background: active
                          ? 'var(--brand-primary)'
                          : 'var(--bg-secondary)',
                        borderColor: active
                          ? 'var(--brand-primary)'
                          : 'var(--border-default)',
                        color: active
                          ? 'var(--brand-on-primary)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      <span aria-hidden="true">{cat.emoji}</span>
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

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
                        setSelectedCategory(
                          active ? null : cat.id,
                        );
                        setVisibleCount(INITIAL_VISIBLE);
                      }}
                      style={{
                        ...styles.categoryChip,
                        background: active
                          ? 'var(--brand-primary)'
                          : 'var(--bg-secondary)',
                        borderColor: active
                          ? 'var(--brand-primary)'
                          : 'var(--border-default)',
                        color: active
                          ? 'var(--brand-on-primary)'
                          : 'var(--text-secondary)',
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
    backgroundColor: 'var(--bg-primary)',
    minHeight: 0,
    transition: 'background-color 0.18s ease',
  },
  appBar: {
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-default)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  appBarInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    maxWidth: CONTENT_MAX_WIDTH,
    margin: '0 auto',
    width: '100%',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  brandLogo: {
    width: 28,
    height: 28,
    objectFit: 'contain',
    display: 'block',
    flexShrink: 0,
  },
  brandName: {
    fontWeight: 800,
    color: 'var(--brand-primary)',
    fontSize: 18,
    letterSpacing: '-0.3px',
    lineHeight: 1,
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
  contentColumn: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    margin: '0 auto',
    alignSelf: 'center',
  },
  tabsWrap: {
    backgroundColor: 'var(--bg-primary)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
  },
  tabsInner: {
    display: 'flex',
    gap: 8,
    width: '100%',
  },
  tabBtn: {
    borderRadius: 999,
    border: '1px solid',
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0.6,
    cursor: 'pointer',
    transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'inherit',
  },
  activeFilters: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 16px 10px',
    flexWrap: 'wrap',
  },
  activeFiltersLabel: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
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
    background: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
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
    color: 'var(--text-muted)',
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
    width: '100%',
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
    boxSizing: 'border-box',
  },

  // ── Reel card ────────────────────────────────────────────────
  reelCard: {
    position: 'relative',
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    border: 'none',
    padding: 0,
    backgroundColor: '#0F172A',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    display: 'block',
    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
    transition: 'transform 0.16s ease, box-shadow 0.22s ease',
  },
  reelImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  reelPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-tertiary)',
  },
  reelProviderPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #7B1FA2 0%, #9C27B0 100%)',
  },
  reelProviderInitials: {
    fontSize: 56,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: -1,
  },
  reelGradient: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.28) 38%, transparent 68%)',
    pointerEvents: 'none',
  },
  reelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    padding: '4px 9px',
    borderRadius: 8,
    color: '#fff',
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
    pointerEvents: 'none',
  },
  reelSearch: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(0,0,0,0.24)',
  },
  reelBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '16px 14px 16px',
    paddingRight: 54,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    pointerEvents: 'none',
  },
  reelStore: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.82)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: 0.1,
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  },
  reelTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.25,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    letterSpacing: -0.2,
    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
  },
  reelPrice: {
    fontSize: 15.5,
    fontWeight: 800,
    color: '#E8E8EC',
    letterSpacing: -0.2,
    fontVariantNumeric: 'tabular-nums',
    textShadow: '0 1px 3px rgba(0,0,0,0.65)',
    marginTop: 2,
  },

  // ── Empty states ────────────────────────────────────────────
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
    background: 'var(--brand-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  emptyBody: {
    fontSize: 13.5,
    color: 'var(--text-tertiary)',
    maxWidth: 340,
    lineHeight: 1.5,
  },
  clearFiltersBtn: {
    marginTop: 12,
    padding: '10px 20px',
    borderRadius: 12,
    border: 'none',
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // ── Skeleton ────────────────────────────────────────────────
  skeletonCard: {
    width: '100%',
    aspectRatio: '3 / 4',
    borderRadius: 18,
    border: '1px solid var(--border-default)',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  },
  skeletonImage: {
    width: '100%',
    height: '100%',
    background: 'var(--skeleton)',
    backgroundSize: '800px 100%',
    animation: 'shimmer 1.4s infinite linear',
  },

  // ── Filter sheet ────────────────────────────────────────────
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--overlay)',
    display: 'flex',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.18s ease-out',
  },
  filterSheet: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    width: '100%',
    maxWidth: 560,
    padding: '10px 20px 24px',
    overflowY: 'auto',
    transition: 'background-color 0.18s ease',
  },
  sheetGrabber: {
    width: 40,
    height: 5,
    background: 'var(--border-strong)',
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
    color: 'var(--text-primary)',
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
    color: 'var(--text-muted)',
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
  filterOptionHint: {
    fontSize: 12.5,
    color: 'var(--text-tertiary)',
    lineHeight: 1.4,
  },
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
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  applyBtn: {
    flex: 2,
    padding: '14px',
    backgroundImage: 'var(--brand-gradient)',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--brand-on-gradient)',
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
    border: '3px solid var(--border-default)',
    borderTopColor: 'var(--brand-primary)',
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
  @keyframes fadeIn { from { opacity: 1; } to { opacity: 1; } }
  @keyframes spotlightFade {
    from { opacity: 0; transform: scale(1.03); }
    to { opacity: 1; transform: scale(1); }
  }

  .sh-home,
  .sh-home *,
  .sh-home *::before,
  .sh-home *::after {
    box-sizing: border-box;
  }

  .sh-reel:active {
    transform: scale(0.985);
  }
  .sh-reel:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.20);
  }

  /* ─── Service wrapper — forces ServiceReelCard into 9:16 ──── */
  .sh-svc-wrap {
    position: relative;
    width: 100%;
    border-radius: 18px;
    overflow: hidden;
    background: var(--bg-tertiary);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    transition: transform 0.16s ease, box-shadow 0.22s ease;
  }
  .sh-svc-wrap:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.20);
  }
  .sh-svc-wrap:active {
    transform: scale(0.985);
  }
  .sh-svc-wrap > * {
    width: 100% !important;
    height: 100% !important;
    border-radius: 18px !important;
    overflow: hidden !important;
    display: block !important;
  }

  /* ─── Pill tabs ───────────────────────────────────────── */
  .sh-tab-pill {
    flex: 1;
    padding: 11px 10px;
  }

  /* ─── Spotlight ──────────────────────────────────────── */
  .sh-spotlight-wrap { margin-bottom: 8px; }
  .sh-spotlight-pad { padding: 0 16px; }
  .sh-spotlight-rel {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
  }
  .sh-spotlight-btn {
    display: block;
    width: 100%;
    height: 160px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 20px;
    overflow: hidden;
    position: relative;
    text-align: left;
    font-family: inherit;
  }
  .sh-spotlight-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    animation: spotlightFade 0.9s ease;
  }
  .sh-spotlight-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.72) 0%,
      rgba(0, 0, 0, 0.05) 55%,
      transparent 100%
    );
    pointer-events: none;
  }
  .sh-spotlight-text {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 14px 16px;
    color: #fff;
    pointer-events: none;
  }
  .sh-spotlight-eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.5px;
    opacity: 0.75;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .sh-spotlight-title {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.3px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sh-spotlight-dots {
    position: absolute;
    bottom: 12px;
    right: 14px;
    display: flex;
    gap: 5px;
    pointer-events: none;
  }
  .sh-spotlight-dot {
    width: 6px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.45);
    transition: width 0.25s, background 0.25s;
  }
  .sh-spotlight-dot-active {
    width: 16px;
    background: #fff;
  }
  .sh-spotlight-collapse {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 3;
    transition: background 0.15s;
  }
  .sh-spotlight-collapse:hover {
    background: rgba(0, 0, 0, 0.72);
  }
  .sh-spotlight-collapse:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 2px;
  }
  .sh-spotlight-collapsed {
    display: flex;
    justify-content: flex-end;
  }
  .sh-spotlight-collapsed-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-default);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-weight: 700;
    font-size: 12.5px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .sh-spotlight-collapsed-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  /* ─── Pill tab hover ─────────────────────────────────── */
  .sh-tab-pill:hover:not([aria-selected="true"]) {
    background-color: var(--bg-hover) !important;
    border-color: var(--border-strong) !important;
    transform: translateY(-1px);
  }
  .sh-tab-pill {
    transition: transform 0.14s ease, box-shadow 0.22s ease,
      background 0.22s ease !important;
  }
  .sh-tab-pill:active {
    transform: scale(0.97);
  }

  /* ─── Mobile panel padding ───────────────────────────── */
  .sh-panel-inner {
    padding: 14px 16px 32px;
  }
  .sh-tabs-inner {
    padding: 10px 16px 8px;
  }

  .sh-modal-overlay {
    align-items: flex-end;
  }
  .sh-filter-sheet {
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    max-height: 88vh;
  }

  /* ─── Desktop ────────────────────────────────────────── */
  @media (min-width: 1024px) {
    .sh-modal-overlay {
      align-items: center;
      padding: 24px;
    }
    .sh-filter-sheet {
      border-radius: 24px;
      max-height: 80vh;
    }
    .sh-panel-inner {
      padding: 20px 24px 48px;
    }

    .sh-spotlight-wrap { margin-bottom: 12px; }
    .sh-spotlight-pad {
      padding: 0 24px;
    }
    .sh-spotlight-btn {
      height: 180px;
      border-radius: 18px;
    }
    .sh-spotlight-rel {
      border-radius: 18px;
    }
    .sh-spotlight-title {
      font-size: 22px;
    }

    /* Tab strip: more vertical breathing room, larger gap between pills */
    .sh-tabs-wrap {
      border-bottom: 1px solid var(--border-default);
    }
    .sh-tabs-inner {
      padding: 22px 24px 20px;
      gap: 14px;
    }
    .sh-tab-pill {
      flex: 1;
      padding: 16px 24px;
      font-size: 14px;
      letter-spacing: 0.8px;
      min-height: 52px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;