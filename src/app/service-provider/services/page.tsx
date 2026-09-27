'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { alertDialog } from '../../../components/ui/dialogs';
import {
  MdAdd,
  MdRefresh,
  MdErrorOutline,
  MdImage,
  MdPlayCircleOutline,
  MdEdit,
  MdDeleteOutline,
  MdPauseCircle,
  MdPlayCircleFilled,
  MdSearch,
  MdClose,
  MdEventNote,
  MdStar,
  MdChevronRight,
} from 'react-icons/md';

// ─── Types ────────────────────────────────────────────────────────────
interface RawService {
  service_id: string;
  title?: string;
  description?: string;
  price?: number | string;
  duration_minutes?: number;
  is_active?: boolean | number;
  image_url?: string | null;
  video_url?: string | null;
  category?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface RawBooking {
  booking_id?: string;
  service_id?: string;
  status?: string;
  [key: string]: unknown;
}

interface ServiceWithStats {
  service_id: string;
  title: string;
  description: string;
  price: number;
  duration: number;
  isActive: boolean;
  imageUrl: string | null;
  videoUrl: string | null;
  category: string;
  bookingsAll: number;
  bookingsCompleted: number;
  bookingsPending: number;
}

type StatusFilter = 'all' | 'active' | 'paused';

// ─── Helpers ──────────────────────────────────────────────────────────
function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '';
  if (!base) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

function fmtNaira(v: number): string {
  return '₦' + Math.round(v).toLocaleString('en-NG');
}

function isServiceActive(raw: boolean | number | undefined): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  return false;
}

function buildStats(
  services: RawService[],
  bookings: RawBooking[],
): ServiceWithStats[] {
  const byService = new Map<
    string,
    { all: number; completed: number; pending: number }
  >();
  for (const b of bookings) {
    const sid = String(b.service_id || '');
    if (!sid) continue;
    const cur = byService.get(sid) || { all: 0, completed: 0, pending: 0 };
    cur.all++;
    const status = (b.status || '').toLowerCase();
    if (status === 'completed') cur.completed++;
    if (status === 'locked' || status === 'accepted') cur.pending++;
    byService.set(sid, cur);
  }

  return services.map((s) => {
    const counts = byService.get(s.service_id) || {
      all: 0,
      completed: 0,
      pending: 0,
    };
    return {
      service_id: s.service_id,
      title: s.title || 'Untitled service',
      description: s.description || '',
      price: Number(s.price ?? 0),
      duration: s.duration_minutes ?? 60,
      isActive: isServiceActive(s.is_active),
      imageUrl: resolveImageUrl(s.image_url),
      videoUrl: resolveImageUrl(s.video_url),
      category: s.category || '',
      bookingsAll: counts.all,
      bookingsCompleted: counts.completed,
      bookingsPending: counts.pending,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────
export default function ServiceProviderServicesPage() {
  const router = useRouter();

  const [services, setServices] = useState<ServiceWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const reqSeq = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async (showSpinner = true) => {
    const seq = ++reqSeq.current;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [rawServices, rawBookings] = await Promise.all([
        api.getProviderServices() as Promise<RawService[]>,
        api.getProviderBookings().catch(() => [] as unknown[]),
      ]);
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      const list = Array.isArray(rawServices) ? rawServices : [];
      const bookings = Array.isArray(rawBookings)
        ? (rawBookings as RawBooking[])
        : [];
      setServices(buildStats(list, bookings));
    } catch (err: unknown) {
      if (seq !== reqSeq.current || !isMountedRef.current) return;
      setError(
        err instanceof Error ? err.message : 'Failed to load your services',
      );
    } finally {
      if (seq === reqSeq.current && isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (filter === 'active' && !s.isActive) return false;
      if (filter === 'paused' && s.isActive) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    });
  }, [services, query, filter]);

  const totals = useMemo(() => {
    const active = services.filter((s) => s.isActive).length;
    const bookings = services.reduce((sum, s) => sum + s.bookingsAll, 0);
    const revenue = services.reduce(
      (sum, s) => sum + s.bookingsCompleted * s.price,
      0,
    );
    return { active, bookings, revenue };
  }, [services]);

  const handleToggleActive = async (service: ServiceWithStats) => {
    if (busyId) return;
    setBusyId(service.service_id);
    try {
      await api.toggleServiceActive(service.service_id);
      setServices((prev) =>
        prev.map((s) =>
          s.service_id === service.service_id
            ? { ...s, isActive: !s.isActive }
            : s,
        ),
      );
    } catch (err) {
      await alertDialog({
        title: "Couldn't update",
        body: err instanceof Error ? err.message : 'Please try again.',
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyId(null);
    }
  };

  const handleDelete = async (service: ServiceWithStats) => {
    const confirmed = await confirmDelete(service.title);
    if (!confirmed) return;
    setBusyId(service.service_id);
    try {
      await api.deleteService(service.service_id);
      setServices((prev) =>
        prev.filter((s) => s.service_id !== service.service_id),
      );
    } catch (err) {
      await alertDialog({
        title: "Couldn't delete",
        body: err instanceof Error ? err.message : 'Please try again.',
        kind: 'danger',
      });
    } finally {
      if (isMountedRef.current) setBusyId(null);
    }
  };

  const confirmDelete = (title: string): Promise<boolean> =>
    new Promise((resolve) => {
      const id = `del-${Date.now()}`;
      const overlay = document.createElement('div');
      overlay.id = id;
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(11,11,26,0.55); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center; padding: 20px;
      `;
      overlay.innerHTML = `
        <div style="
          width: 100%; max-width: 380px; background: #FFF; border-radius: 22px;
          padding: 26px 24px 20px; text-align: center;
          box-shadow: 0 24px 60px rgba(15,23,42,0.24);
          font-family: inherit;
        ">
          <div style="
            width: 60px; height: 60px; margin: 0 auto 16px;
            border-radius: 18px; background: #FEF2F2; border: 1px solid #FECACA;
            display: flex; align-items: center; justify-content: center;
            color: #B91C1C; font-size: 26px;
          ">⚠</div>
          <h3 style="margin: 0; font-size: 19px; font-weight: 800; color: #0B0B1A; letter-spacing: -0.02em;">Delete this service?</h3>
          <p style="margin: 10px 0 0; font-size: 14px; color: #5A6178; line-height: 1.55;">"${title}" will be removed from your menu. Existing bookings are kept.</p>
          <div style="display: flex; gap: 10px; margin-top: 22px;">
            <button id="${id}-keep" style="
              flex: 1; padding: 13px 16px; border-radius: 14px; border: 1px solid #E6E8F0;
              background: #FFF; color: #5A6178; font-size: 14px; font-weight: 700;
              cursor: pointer; font-family: inherit;
            ">Keep</button>
            <button id="${id}-del" style="
              flex: 1; padding: 13px 16px; border-radius: 14px; border: none;
              background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);
              color: #FFF; font-size: 14px; font-weight: 700; cursor: pointer;
              font-family: inherit;
            ">Delete</button>
          </div>
        </div>
      `;
      const cleanup = (v: boolean) => {
        overlay.remove();
        resolve(v);
      };
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });
      document.body.appendChild(overlay);
      overlay.querySelector(`#${id}-keep`)?.addEventListener('click', () => cleanup(false));
      overlay.querySelector(`#${id}-del`)?.addEventListener('click', () => cleanup(true));
    });

  return (
    <main style={styles.container}>
      <style>{PAGE_CSS}</style>

      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>My Services</h1>
          {!loading && !error && services.length > 0 && (
            <p style={styles.subtitle}>
              {totals.active} active · {totals.bookings} booking
              {totals.bookings === 1 ? '' : 's'} · {fmtNaira(totals.revenue)} earned
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          style={styles.refreshBtn}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <MdRefresh
            size={22}
            color="#0504AA"
            style={{
              animation: refreshing ? 'spServicesSpin 0.8s linear infinite' : 'none',
            }}
          />
        </button>
      </header>

      {/* Search */}
      {!loading && !error && services.length > 0 && (
        <>
          <div style={styles.searchWrap}>
            <div style={styles.searchBox}>
              <MdSearch size={18} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search services"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={styles.searchInput}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={styles.searchClear}
                  aria-label="Clear search"
                >
                  <MdClose size={14} color="#94A3B8" />
                </button>
              )}
            </div>
          </div>

          <div style={styles.pillRow}>
            <Pill label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
            <Pill label="Active" active={filter === 'active'} onClick={() => setFilter('active')} />
            <Pill label="Paused" active={filter === 'paused'} onClick={() => setFilter('paused')} />
          </div>
        </>
      )}

      {/* Body */}
      <div style={styles.body}>
        {loading ? (
          <div style={styles.skeletonList}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={styles.skeletonCard} />
            ))}
          </div>
        ) : error ? (
          <div style={styles.center}>
            <div style={styles.errorHalo}>
              <MdErrorOutline size={34} color="#B91C1C" />
            </div>
            <h3 style={styles.stateTitle}>Couldn&apos;t load your services</h3>
            <p style={styles.stateBody}>{error}</p>
            <button onClick={() => loadData()} style={styles.retryBtn}>
              Try again
            </button>
          </div>
        ) : services.length === 0 ? (
          <div style={styles.center}>
            <div style={styles.emptyHalo}>
              <MdPlayCircleOutline size={34} color="#0504AA" />
            </div>
            <h3 style={styles.stateTitle}>Your menu is empty</h3>
            <p style={styles.stateBody}>
              Add your first service to start receiving bookings.
            </p>
            <button
              onClick={() => router.push('/service-provider/add-service')}
              style={styles.retryBtn}
            >
              <MdAdd size={18} color="#fff" />
              <span>Add a service</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.center}>
            <h3 style={styles.stateTitle}>No matches</h3>
            <p style={styles.stateBody}>
              {query
                ? `Nothing matches "${query}"`
                : 'No services in this filter.'}
            </p>
          </div>
        ) : (
          <>
            <div style={styles.list}>
              {filtered.map((s) => (
                <ServiceCard
                  key={s.service_id}
                  service={s}
                  busy={busyId === s.service_id}
                  onEdit={() =>
                    router.push(`/service-provider/edit-service/${s.service_id}`)
                  }
                  onToggle={() => handleToggleActive(s)}
                  onDelete={() => handleDelete(s)}
                />
              ))}
            </div>

            <button
              onClick={() => router.push('/service-provider/add-service')}
              style={styles.addBtn}
              className="sp-add-service"
            >
              <MdAdd size={20} color="#fff" />
              <span>Add another service</span>
            </button>
          </>
        )}
      </div>
    </main>
  );
}

// ─── Service card ─────────────────────────────────────────────────────
function ServiceCard({
  service,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  service: ServiceWithStats;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const media = service.videoUrl || service.imageUrl;
  const isVideo = !!service.videoUrl;

  return (
    <div
      style={{
        ...styles.card,
        opacity: busy ? 0.6 : 1,
        pointerEvents: busy ? 'none' : 'auto',
      }}
    >
      {/* Media + info row — tappable to edit */}
      <button
        type="button"
        onClick={onEdit}
        style={styles.cardTap}
        className="sp-service-card"
      >
        <div style={styles.thumb}>
          {media ? (
            isVideo ? (
              <video
                src={media}
                style={styles.thumbMedia}
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media} alt="" style={styles.thumbMedia} />
            )
          ) : (
            <div style={styles.thumbEmpty}>
              <MdImage size={22} color="#94A3B8" />
            </div>
          )}
          {isVideo && (
            <span style={styles.videoBadge}>
              <MdPlayCircleFilled size={11} color="#fff" />
            </span>
          )}
        </div>

        <div style={styles.info}>
          <div style={styles.titleRow}>
            <span style={styles.serviceTitle} title={service.title}>
              {service.title}
            </span>
            <span
              style={{
                ...styles.statusChip,
                ...(service.isActive
                  ? styles.statusChipActive
                  : styles.statusChipPaused),
              }}
            >
              {service.isActive ? 'Live' : 'Paused'}
            </span>
          </div>

          <div style={styles.priceLine}>
            <span style={styles.priceText}>{fmtNaira(service.price)}</span>
            <span style={styles.priceDot}>·</span>
            <span style={styles.durationText}>{service.duration} min</span>
          </div>

          <div style={styles.statsLine}>
            <MdEventNote size={12} color="#64748B" />
            <span style={styles.statsText}>
              {service.bookingsAll === 0
                ? 'No bookings yet'
                : `${service.bookingsAll} booking${
                    service.bookingsAll === 1 ? '' : 's'
                  }`}
            </span>
            {service.bookingsPending > 0 && (
              <>
                <span style={styles.statsDot}>·</span>
                <span style={styles.statsPending}>
                  {service.bookingsPending} pending
                </span>
              </>
            )}
          </div>
        </div>

        <MdChevronRight size={18} color="#94A3B8" />
      </button>

      {/* Actions row */}
      <div style={styles.actionsRow}>
        <button
          type="button"
          onClick={onToggle}
          style={styles.actionBtn}
          className="sp-action-btn"
        >
          {service.isActive ? (
            <>
              <MdPauseCircle size={16} color="#B45309" />
              <span style={{ color: '#B45309' }}>Pause</span>
            </>
          ) : (
            <>
              <MdPlayCircleFilled size={16} color="#16A34A" />
              <span style={{ color: '#16A34A' }}>Resume</span>
            </>
          )}
        </button>
        <div style={styles.actionsDivider} />
        <button
          type="button"
          onClick={onEdit}
          style={styles.actionBtn}
          className="sp-action-btn"
        >
          <MdEdit size={16} color="#0504AA" />
          <span style={{ color: '#0504AA' }}>Edit</span>
        </button>
        <div style={styles.actionsDivider} />
        <button
          type="button"
          onClick={onDelete}
          style={styles.actionBtn}
          className="sp-action-btn"
        >
          <MdDeleteOutline size={16} color="#991B1B" />
          <span style={{ color: '#991B1B' }}>Delete</span>
        </button>
      </div>
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────
function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="sp-services-pill"
      style={{
        ...styles.pill,
        ...(active ? styles.pillActive : null),
      }}
    >
      <span
        style={{
          ...styles.pillLabel,
          ...(active ? styles.pillLabelActive : null),
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────
const PAGE_CSS = `
  @keyframes spServicesSpin { to { transform: rotate(360deg); } }
  @keyframes spServicesShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .sp-service-card:hover { background-color: #F8FAFC; }
  .sp-service-card:active { background-color: #F1F5F9; }
  .sp-action-btn:hover { background-color: #F8FAFC; }
  .sp-add-service:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(5, 4, 170, 0.32); }
  .sp-services-pill:active { transform: scale(0.97); }
`;

// ─── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#FFFFFF',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '16px 16px 8px',
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    margin: '4px 0 0 0',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: 'none',
    background: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    marginTop: 2,
  },

  searchWrap: { padding: '8px 16px 12px' },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 14,
    backgroundColor: '#F4F5FB',
    border: '1.5px solid transparent',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 15,
    color: '#0B0B1A',
    fontFamily: 'inherit',
    minWidth: 0,
  },
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#E2E8F0',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },

  pillRow: {
    display: 'flex',
    gap: 8,
    padding: '0 16px 12px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 14px',
    borderRadius: 999,
    border: '1px solid #E6E8F0',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
    transition: 'background-color 0.15s, border-color 0.15s, transform 0.12s',
  },
  pillActive: { backgroundColor: '#EEF0FF', borderColor: '#C7CCFF' },
  pillLabel: { fontSize: 13, fontWeight: 700, color: '#64748B' },
  pillLabelActive: { color: '#0504AA' },

  body: { flex: 1, overflowY: 'auto', padding: '0 12px 32px' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #EAECF3',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
  },
  cardTap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 14px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  thumb: {
    width: 64,
    height: 64,
    flex: '0 0 64px',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMedia: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbEmpty: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(15,23,42,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0B0B1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: '0 1 auto',
    letterSpacing: -0.1,
  },
  statusChip: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    padding: '3px 7px',
    borderRadius: 999,
    border: '1px solid',
    flexShrink: 0,
  },
  statusChipActive: {
    backgroundColor: '#ECFDF5',
    color: '#065F46',
    borderColor: '#A7F3D0',
  },
  statusChipPaused: {
    backgroundColor: '#F1F5F9',
    color: '#475569',
    borderColor: '#CBD5E1',
  },
  priceLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
  },
  priceText: {
    color: '#0504AA',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  priceDot: { color: '#CBD5E1' },
  durationText: { color: '#64748B', fontWeight: 500 },
  statsLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    minWidth: 0,
  },
  statsText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statsDot: { color: '#CBD5E1' },
  statsPending: {
    color: '#B45309',
    fontWeight: 700,
    flexShrink: 0,
  },

  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    borderTop: '1px solid #F1F5F9',
  },
  actionBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '11px 8px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12.5,
    fontWeight: 700,
    transition: 'background-color 0.14s',
  },
  actionsDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#F1F5F9',
  },

  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '15px 20px',
    marginTop: 16,
    borderRadius: 16,
    border: 'none',
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    boxShadow: '0 10px 24px rgba(5, 4, 170, 0.24)',
    transition: 'transform 0.15s, box-shadow 0.2s',
  },

  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    textAlign: 'center',
  },
  errorHalo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHalo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    background: 'linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0 10px 28px rgba(5, 4, 170, 0.08)',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0B0B1A',
    margin: 0,
    letterSpacing: -0.2,
  },
  stateBody: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 1.5,
    maxWidth: 300,
  },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    padding: '12px 22px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px rgba(5, 4, 170, 0.24)',
  },

  skeletonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  skeletonCard: {
    height: 140,
    borderRadius: 16,
    background:
      'linear-gradient(90deg, #EEF2F6 25%, #F8FAFC 50%, #EEF2F6 75%)',
    backgroundSize: '200% 100%',
    animation: 'spServicesShimmer 1.4s linear infinite',
  },
};