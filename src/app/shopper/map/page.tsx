'use client';

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdMyLocation,
  MdStorefront,
  MdBuild,
  MdSearch,
  MdClose,
  MdRefresh,
  MdErrorOutline,
  MdChevronRight,
  MdLocationOn,
  MdVerified,
} from 'react-icons/md';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────
interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'store' | 'service';
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'available';
  address?: string;
  image_url?: string;
  verification_status?: string;
  category?: string;
  price?: number;
  listing_count?: number;
  distance_km?: number;
}

type FilterKey = 'all' | 'stores' | 'services' | 'in_stock';
type MapModule = typeof import('leaflet');
type ClusterGroup = ReturnType<MapModule['markerClusterGroup']>;

const DEFAULT_LAT = 5.5103;
const DEFAULT_LNG = 7.0265;
const RADIUS_OPTIONS = [2, 5, 10, 25] as const;

// ─── Helpers ────────────────────────────────────────────────────────
function fmtDistance(km?: number): string {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function fmtNaira(v?: number): string {
  if (v == null || !Number.isFinite(v)) return '';
  return '₦' + Math.round(v).toLocaleString('en-NG');
}

function resolveImageUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

function statusColor(status: string): { bg: string; fg: string; border: string; label: string } {
  switch (status) {
    case 'in_stock':
      return { bg: 'var(--success-bg)', fg: 'var(--success-fg)', border: 'var(--success-strong)', label: 'In stock' };
    case 'low_stock':
      return { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', border: 'var(--warning-strong)', label: 'Low stock' };
    case 'out_of_stock':
      return { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)', border: 'var(--border-strong)', label: 'Out of stock' };
    case 'available':
      return { bg: 'var(--brand-soft)', fg: 'var(--brand-primary)', border: 'var(--brand-soft-strong)', label: 'Available' };
    default:
      return { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)', border: 'var(--border-strong)', label: status };
  }
}

// ─── SVG marker generator ───────────────────────────────────────────
// Marker colors sit on OSM standard tiles, which are always light.
// Keep them vivid and hardcoded — do NOT convert to theme vars.
function markerSvg(type: 'store' | 'service', status: string): string {
  const isService = type === 'service';
  const fill = isService
    ? '#7C3AED'
    : status === 'in_stock'
      ? '#0504AA'
      : status === 'low_stock'
        ? '#D97706'
        : '#64748B';

  const icon = isService
    ? '<path d="M14 15h12v3H14zm2 5h8v9h-8zm-2-8h12l-1.5-3h-9z" fill="#fff"/>'
    : '<path d="M13 16h14v3H13zm0 5h14v3H13zm0 5h14v3H13zm1-13h12l1 3v14a1 1 0 0 1-1 1H13a1 1 0 0 1-1-1V16z" fill="#fff"/>';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <defs>
        <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
        </filter>
      </defs>
      <path d="M20 46c0 0 16-15.2 16-25a16 16 0 1 0-32 0c0 9.8 16 25 16 25z"
            fill="${fill}" stroke="#fff" stroke-width="2" filter="url(#sh)"/>
      ${icon}
    </svg>
  `;
}

// ─── Page ───────────────────────────────────────────────────────────
export default function ShopperMapPage() {
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const clusterRef = useRef<ClusterGroup | null>(null);
  const markersByIdRef = useRef<Map<string, import('leaflet').Marker>>(new Map());
  const leafletRef = useRef<MapModule | null>(null);

  const [leafletReady, setLeafletReady] = useState(false);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MapLocation | null>(null);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);
  const geolocationDoneRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Load Leaflet + markercluster dynamically (SSR-safe) ───────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      const L = ((mod as unknown as { default?: MapModule }).default ?? mod) as MapModule;
      await import('leaflet/dist/leaflet.css');
      await import('leaflet.markercluster');
      await import('leaflet.markercluster/dist/MarkerCluster.css');
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
      if (cancelled) return;
      leafletRef.current = L;
      setLeafletReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Ask for the user's location once ──────────────────────────────
  useEffect(() => {
    if (geolocationDoneRef.current) return;
    geolocationDoneRef.current = true;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        // Silent fallback — map stays on the default centre.
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  // ── Initialize the map once ───────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !containerRef.current || mapRef.current) return;
    const L = leafletRef.current;
    if (!L) return;

    const map = L.map(containerRef.current, {
      center: userLocation ?? [DEFAULT_LAT, DEFAULT_LNG],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });
    mapRef.current = map;

    // OpenStreetMap standard tiles — always light, no dark variant.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const cluster = (L as unknown as {
      markerClusterGroup: (options: Record<string, unknown>) => ClusterGroup;
    })
      .markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (c: { getChildCount: () => number }) => {
          const n = c.getChildCount();
          const size = n < 10 ? 36 : n < 100 ? 44 : 52;
          return L.divIcon({
            // Cluster renders on OSM tiles (always light) — keep the
            // vivid blue gradient so it stays legible in both themes.
            html: `<div style="
              width:${size}px;height:${size}px;border-radius:50%;
              background:linear-gradient(135deg,#0504AA 0%,#3D3BFF 100%);
              color:#fff;font-weight:800;font-size:${n < 100 ? 14 : 12}px;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 6px 18px rgba(5,4,170,0.35);
              border:3px solid #fff;
              letter-spacing:-0.02em;
              font-family:inherit;
            ">${n}</div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        },
      });
    cluster.addTo(map);
    clusterRef.current = cluster;

    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markersByIdRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  // ── Recenter the map when the user's location first lands ────────
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.setView(userLocation, 14, { animate: true });
  }, [userLocation]);

  // ── Fetch locations when radius / user location changes ───────────
  const loadLocations = useCallback(
    async (showSpinner = true) => {
      const seq = ++reqSeq.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const origin = userLocation ?? [DEFAULT_LAT, DEFAULT_LNG];
        const data = (await api.getMapLocations({
          lat: origin[0],
          lng: origin[1],
          radiusKm,
        })) as unknown as MapLocation[];
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setLocations(Array.isArray(data) ? data : []);
      } catch (err) {
        if (seq !== reqSeq.current || !isMountedRef.current) return;
        setError(
          err instanceof Error ? err.message : "Couldn't load nearby places",
        );
      } finally {
        if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
      }
    },
    [radiusKm, userLocation],
  );

  useEffect(() => {
    if (!leafletReady) return;
    const timeoutId = window.setTimeout(() => {
      void loadLocations(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [leafletReady, loadLocations]);

  // ── Filter list ───────────────────────────────────────────────────
  const visibleLocations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locations.filter((loc) => {
      if (filter === 'stores' && loc.type !== 'store') return false;
      if (filter === 'services' && loc.type !== 'service') return false;
      if (filter === 'in_stock' && loc.status !== 'in_stock' && loc.status !== 'available')
        return false;
      if (!q) return true;
      return (
        loc.name.toLowerCase().includes(q) ||
        (loc.address ?? '').toLowerCase().includes(q) ||
        (loc.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [locations, filter, query]);

  // ── Sync markers to the map when visible list changes ────────────
  useEffect(() => {
    const L = leafletRef.current;
    const cluster = clusterRef.current;
    if (!L || !cluster) return;

    cluster.clearLayers();
    markersByIdRef.current.clear();

    for (const loc of visibleLocations) {
      if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) continue;
      const icon = L.divIcon({
        html: markerSvg(loc.type, loc.status),
        className: 'ad-mapPin',
        iconSize: [40, 48],
        iconAnchor: [20, 46],
        popupAnchor: [0, -42],
      });
      const marker = L.marker([loc.lat, loc.lng], {
        icon,
        title: loc.name,
      });
      marker.on('click', () => setSelected(loc));
      markersByIdRef.current.set(loc.id, marker);
      cluster.addLayer(marker);
    }
  }, [visibleLocations]);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    const target = userLocation ?? [DEFAULT_LAT, DEFAULT_LNG];
    mapRef.current.setView(target, 14, { animate: true });
  };

  const handleRefresh = () => {
    void loadLocations(false);
  };

  const handleClearSearch = () => setQuery('');

  return (
    <main className="ad-mapRoot">
      <style>{MAP_CSS}</style>

      <div className="ad-mapTopBar">
        <div className="ad-mapSearch">
          <MdSearch size={18} color="var(--text-muted)" aria-hidden />
          <input
            type="text"
            className="ad-mapSearchInput"
            placeholder="Search places nearby"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search places"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="ad-mapSearchClear"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <MdClose size={14} color="var(--text-tertiary)" />
            </button>
          )}
        </div>

        <div className="ad-mapFilters" role="tablist">
          {(
            [
              ['all', 'All'],
              ['stores', 'Stores'],
              ['services', 'Services'],
              ['in_stock', 'In stock'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              className={
                filter === key ? 'ad-mapPill ad-mapPillOn' : 'ad-mapPill'
              }
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="ad-mapCanvas" />

      {loading && locations.length === 0 && (
        <div className="ad-mapLoading">
          <span className="ad-mapSpinner" />
          <span>Finding places near you…</span>
        </div>
      )}

      {error && !loading && (
        <div className="ad-mapError" role="alert">
          <div className="ad-mapErrorIcon">
            <MdErrorOutline size={26} color="var(--danger-fg)" />
          </div>
          <div className="ad-mapErrorBody">
            <div className="ad-mapErrorTitle">Couldn&apos;t load the map</div>
            <div className="ad-mapErrorSub">{error}</div>
          </div>
          <button
            type="button"
            className="ad-mapErrorRetry"
            onClick={handleRefresh}
            aria-label="Retry"
          >
            <MdRefresh size={16} color="#fff" />
          </button>
        </div>
      )}

      {!loading && !error && visibleLocations.length === 0 && (
        <div className="ad-mapEmpty">
          <div className="ad-mapEmptyIcon">
            <MdLocationOn size={26} color="var(--brand-primary)" />
          </div>
          <div className="ad-mapEmptyTitle">
            {query || filter !== 'all' ? 'No matches' : 'Nothing nearby'}
          </div>
          <div className="ad-mapEmptyBody">
            {query || filter !== 'all'
              ? 'Try a different search or widen your filter.'
              : `No stores or services within ${radiusKm} km. Try a larger radius.`}
          </div>
        </div>
      )}

      <div className="ad-mapRadiusBar" role="group" aria-label="Search radius">
        <span className="ad-mapRadiusLabel">Within</span>
        {RADIUS_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={
              radiusKm === r ? 'ad-mapRadiusBtn ad-mapRadiusBtnOn' : 'ad-mapRadiusBtn'
            }
            onClick={() => setRadiusKm(r)}
          >
            {r} km
          </button>
        ))}
      </div>

      <button
        type="button"
        className="ad-mapFab"
        onClick={handleRecenter}
        aria-label="Center on my location"
        title="Center on my location"
      >
        <MdMyLocation size={22} color="var(--brand-primary)" />
      </button>

      {selected && (
        <div
          className="ad-mapSheetOverlay"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="ad-mapSheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ad-mapSheetHandle" />
            <button
              type="button"
              className="ad-mapSheetClose"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <MdClose size={18} color="var(--text-tertiary)" />
            </button>

            <div className="ad-mapSheetMedia">
              {resolveImageUrl(selected.image_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageUrl(selected.image_url)!}
                  alt=""
                  className="ad-mapSheetImg"
                />
              ) : (
                <div className="ad-mapSheetImgFallback">
                  {selected.type === 'service' ? (
                    <MdBuild size={34} color="var(--purple-fg)" />
                  ) : (
                    <MdStorefront size={34} color="var(--brand-primary)" />
                  )}
                </div>
              )}
              {/* Type badge — semantic category color, sits on the media
                  block, stays vivid in both themes. */}
              <span className="ad-mapSheetTypeBadge" data-type={selected.type}>
                {selected.type === 'service' ? (
                  <>
                    <MdBuild size={11} color="#fff" /> Service
                  </>
                ) : (
                  <>
                    <MdStorefront size={11} color="#fff" /> Store
                  </>
                )}
              </span>
            </div>

            <div className="ad-mapSheetBody">
              <div className="ad-mapSheetTitleRow">
                <h3 className="ad-mapSheetTitle">{selected.name}</h3>
                {selected.verification_status === 'verified' && (
                  <MdVerified size={16} color="var(--brand-primary)" />
                )}
              </div>

              <div className="ad-mapSheetMeta">
                <span
                  className="ad-mapSheetStatus"
                  style={{
                    background: statusColor(selected.status).bg,
                    color: statusColor(selected.status).fg,
                    borderColor: statusColor(selected.status).border,
                  }}
                >
                  {statusColor(selected.status).label}
                </span>
                {selected.distance_km != null && (
                  <span className="ad-mapSheetDistance">
                    {fmtDistance(selected.distance_km)} away
                  </span>
                )}
                {selected.type === 'service' && selected.price != null && (
                  <span className="ad-mapSheetPrice">
                    {fmtNaira(selected.price)}
                  </span>
                )}
              </div>

              {selected.address && (
                <div className="ad-mapSheetAddress">
                  <MdLocationOn size={13} color="var(--text-muted)" />
                  <span>{selected.address}</span>
                </div>
              )}

              {selected.type === 'store' && selected.listing_count != null && (
                <div className="ad-mapSheetListings">
                  {selected.listing_count}{' '}
                  {selected.listing_count === 1 ? 'listing' : 'listings'}
                </div>
              )}

              <button
                type="button"
                className="ad-mapSheetCta"
                onClick={() => {
                  const dest =
                    selected.type === 'service'
                      ? `/service-detail/${selected.id}`
                      : `/store-detail/${selected.id}`;
                  router.push(dest);
                }}
              >
                {selected.type === 'service' ? (
                  <>
                    View service
                    <MdChevronRight size={18} color="var(--brand-on-gradient)" />
                  </>
                ) : (
                  <>
                    Visit store
                    <MdChevronRight size={18} color="var(--brand-on-gradient)" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const MAP_CSS = `
  @keyframes adMapSpin { to { transform: rotate(360deg); } }
  @keyframes adMapFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes adMapSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .ad-mapPin { background: none !important; border: none !important; }

  /* Leaflet controls render on top of OSM tiles (always light) — keep
     them light so they read correctly against the map. */
  .leaflet-container {
    font-family: inherit;
    background: #F4F5FB;
  }
  .leaflet-control-attribution {
    font-size: 10px !important;
    background: rgba(255,255,255,0.85) !important;
    border-radius: 6px !important;
    padding: 2px 6px !important;
  }
  .leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 4px 12px rgba(15,23,42,0.12) !important;
    border-radius: 12px !important;
    overflow: hidden;
  }
  .leaflet-control-zoom a {
    width: 34px !important;
    height: 34px !important;
    line-height: 34px !important;
    font-size: 18px !important;
    color: #0B0B1A !important;
    background: #fff !important;
  }
  .leaflet-control-zoom a:hover {
    background: #F1F5F9 !important;
  }

  .ad-mapRoot {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-primary);
  }
  .ad-mapCanvas {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .ad-mapTopBar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    padding: 14px 14px 10px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 98%, transparent) 0%,
      color-mix(in srgb, var(--bg-primary) 85%, transparent) 70%,
      transparent 100%
    );
    pointer-events: none;
  }
  .ad-mapTopBar > * { pointer-events: auto; }

  .ad-mapSearch {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: 14px;
    box-shadow: var(--shadow-md);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .ad-mapSearch:focus-within {
    border-color: color-mix(in srgb, var(--brand-primary) 40%, transparent);
    box-shadow: var(--shadow-brand);
  }
  .ad-mapSearchInput {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 15px;
    color: var(--text-primary);
    font-family: inherit;
  }
  .ad-mapSearchInput::placeholder { color: var(--text-muted); }
  .ad-mapSearchClear {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    background: var(--bg-pressed);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .ad-mapFilters {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .ad-mapFilters::-webkit-scrollbar { display: none; }
  .ad-mapPill {
    flex-shrink: 0;
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-default);
    background: var(--bg-secondary);
    color: var(--text-tertiary);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    box-shadow: var(--shadow-sm);
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .ad-mapPill:hover {
    border-color: color-mix(in srgb, var(--brand-primary) 40%, transparent);
    color: var(--brand-primary);
  }
  .ad-mapPillOn {
    background: var(--brand-primary);
    border-color: var(--brand-primary);
    color: var(--brand-on-primary);
  }
  .ad-mapPillOn:hover { color: var(--brand-on-primary); }

  .ad-mapLoading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 15;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: 14px;
    box-shadow: var(--shadow-md);
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .ad-mapSpinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2.5px solid var(--border-default);
    border-top-color: var(--brand-primary);
    animation: adMapSpin 0.7s linear infinite;
  }

  .ad-mapError {
    position: absolute;
    top: 130px;
    left: 14px;
    right: 14px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-strong);
    border-radius: 14px;
    box-shadow: var(--shadow-md);
    animation: adMapFadeIn 0.2s ease both;
  }
  .ad-mapErrorIcon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--bg-elevated);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .ad-mapErrorBody { flex: 1; min-width: 0; }
  .ad-mapErrorTitle {
    font-size: 13.5px;
    font-weight: 800;
    color: var(--danger-fg);
    letter-spacing: -0.01em;
  }
  .ad-mapErrorSub {
    font-size: 12px;
    color: var(--danger-fg);
    margin-top: 2px;
    opacity: 0.85;
  }
  .ad-mapErrorRetry {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: none;
    background: #DC2626;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .ad-mapEmpty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    width: min(320px, calc(100% - 40px));
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: 18px;
    padding: 20px 20px 22px;
    box-shadow: var(--shadow-lg);
    text-align: center;
    animation: adMapFadeIn 0.22s ease both;
  }
  .ad-mapEmptyIcon {
    width: 54px;
    height: 54px;
    border-radius: 18px;
    background: linear-gradient(135deg, var(--brand-soft) 0%, var(--brand-soft-strong) 100%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }
  .ad-mapEmptyTitle {
    font-size: 15px;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .ad-mapEmptyBody {
    font-size: 12.5px;
    color: var(--text-tertiary);
    margin-top: 5px;
    line-height: 1.5;
  }

  .ad-mapRadiusBar {
    position: absolute;
    bottom: 84px;
    left: 14px;
    right: 14px;
    z-index: 15;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: 999px;
    box-shadow: var(--shadow-md);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .ad-mapRadiusBar::-webkit-scrollbar { display: none; }
  .ad-mapRadiusLabel {
    padding: 0 6px 0 10px;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-tertiary);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .ad-mapRadiusBtn {
    padding: 8px 14px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .ad-mapRadiusBtn:hover { background: var(--bg-hover); }
  .ad-mapRadiusBtnOn {
    background: var(--brand-soft);
    color: var(--brand-primary);
  }

  .ad-mapFab {
    position: absolute;
    right: 16px;
    bottom: 148px;
    z-index: 16;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    border: 1px solid var(--border-default);
    background: var(--bg-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    transition: transform 0.12s, box-shadow 0.15s;
  }
  .ad-mapFab:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }
  .ad-mapFab:active { transform: translateY(0) scale(0.97); }

  .ad-mapSheetOverlay {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 300;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .ad-mapSheet {
    position: relative;
    width: 100%;
    max-width: 520px;
    background: var(--bg-secondary);
    border-radius: 24px 24px 0 0;
    padding: 10px 0 calc(28px + env(safe-area-inset-bottom));
    box-shadow: var(--shadow-lg);
    animation: adMapSheetUp 0.26s cubic-bezier(0.22, 1, 0.36, 1);
    overflow: hidden;
  }
  .ad-mapSheetHandle {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-strong);
    margin: 0 auto 12px;
  }
  .ad-mapSheetClose {
    position: absolute;
    top: 12px;
    right: 14px;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    border: none;
    background: var(--bg-elevated);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
    box-shadow: var(--shadow-md);
  }
  .ad-mapSheetMedia {
    position: relative;
    margin: 0 20px 14px;
    height: 156px;
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-tertiary);
  }
  .ad-mapSheetImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ad-mapSheetImgFallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--brand-soft) 0%, var(--purple-bg) 100%);
  }
  /* Category badge — semantic (STORE vs SERVICE), stays saturated on
     the media block; do not theme. */
  .ad-mapSheetTypeBadge {
    position: absolute;
    top: 10px;
    left: 10px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #fff;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  .ad-mapSheetTypeBadge[data-type="store"] { background: rgba(5,4,170,0.92); }
  .ad-mapSheetTypeBadge[data-type="service"] { background: rgba(124,58,237,0.92); }

  .ad-mapSheetBody { padding: 0 20px; }
  .ad-mapSheetTitleRow {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .ad-mapSheetTitle {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .ad-mapSheetMeta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .ad-mapSheetStatus {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .ad-mapSheetDistance {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-tertiary);
  }
  .ad-mapSheetPrice {
    font-size: 12.5px;
    font-weight: 800;
    color: var(--brand-primary);
    font-variant-numeric: tabular-nums;
  }
  .ad-mapSheetAddress {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    margin-top: 10px;
    font-size: 12.5px;
    color: var(--text-tertiary);
    line-height: 1.45;
  }
  .ad-mapSheetListings {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 600;
  }
  .ad-mapSheetCta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 14px 18px;
    margin-top: 18px;
    border-radius: 14px;
    border: none;
    background: var(--brand-gradient);
    color: var(--brand-on-gradient);
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    letter-spacing: -0.01em;
    box-shadow: var(--shadow-brand);
    transition: transform 0.12s, box-shadow 0.15s;
  }
  .ad-mapSheetCta:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-brand);
  }
  .ad-mapSheetCta:active { transform: translateY(0) scale(0.985); }

  /* Desktop: sheet becomes a centered modal, top-bar content caps. */
  @media (min-width: 1024px) {
    .ad-mapSearch,
    .ad-mapFilters {
      max-width: 480px;
      margin-left: auto;
      margin-right: auto;
    }
    .ad-mapFilters { justify-content: center; }
    .ad-mapRadiusBar {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      width: auto;
      max-width: 520px;
    }
    .ad-mapSheetOverlay { align-items: center; }
    .ad-mapSheet {
      border-radius: 24px;
      max-width: 480px;
      padding: 0 0 24px;
      animation: none;
    }
    .ad-mapSheetHandle { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;