'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { alertDialog, confirmDialog } from '../../../components/ui/dialogs';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
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
  MdChevronRight,
} from 'react-icons/md';

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

function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
    return url;
  const base =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
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
    const cur = byService.get(sid) || {
      all: 0,
      completed: 0,
      pending: 0,
    };
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

export default function ServiceProviderServicesPage() {
  useAuthGuard();
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
        err instanceof Error
          ? err.message
          : 'Failed to load your services',
      );
    } finally {
      if (seq === reqSeq.current && isMountedRef.current)
        setLoading(false);
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
    const bookings = services.reduce(
      (sum, s) => sum + s.bookingsAll,
      0,
    );
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
    const confirmed = await confirmDialog({
      title: 'Delete this service?',
      body: `"${service.title}" will be removed from your menu. Existing bookings are kept.`,
      kind: 'danger',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
    });
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

  return (
    <main style={styles.container} className="sp-services-root">
      <style>{PAGE_CSS}</style>

      <div className="sp-services-shell">
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>My Services</h1>
            {!loading && !error && services.length > 0 && (
              <p style={styles.subtitle}>
                {totals.active} active · {totals.bookings} booking
                {totals.bookings === 1 ? '' : 's'} ·{' '}
                {fmtNaira(totals.revenue)} earned
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
              color="var(--brand-primary)"
              style={{
                animation: refreshing
                  ? 'spServicesSpin 0.8s linear infinite'
                  : 'none',
              }}
            />
          </button>
        </header>

        {!loading && !error && services.length > 0 && (
          <>
            <div style={styles.searchWrap}>
              <div style={styles.searchBox}>
                <MdSearch size={18} color="var(--text-muted)" />
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
                    <MdClose size={14} color="var(--text-muted)" />
                  </button>
                )}
              </div>
            </div>

            <div style={styles.pillRow}>
              <Pill
                label="All"
                active={filter === 'all'}
                onClick={() => setFilter('all')}
              />
              <Pill
                label="Active"
                active={filter === 'active'}
                onClick={() => setFilter('active')}
              />
              <Pill
                label="Paused"
                active={filter === 'paused'}
                onClick={() => setFilter('paused')}
              />
            </div>
          </>
        )}

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
                <MdErrorOutline
                  size={34}
                  color="var(--danger-fg)"
                />
              </div>
              <h3 style={styles.stateTitle}>
                Couldn&apos;t load your services
              </h3>
              <p style={styles.stateBody}>{error}</p>
              <button
                onClick={() => loadData()}
                style={styles.retryBtn}
              >
                Try again
              </button>
            </div>
          ) : services.length === 0 ? (
            <div style={styles.center}>
              <div style={styles.emptyHalo}>
                <MdPlayCircleOutline
                  size={34}
                  color="var(--brand-primary)"
                />
              </div>
              <h3 style={styles.stateTitle}>Your menu is empty</h3>
              <p style={styles.stateBody}>
                Add your first service to start receiving bookings.
              </p>
              <button
                onClick={() =>
                  router.push('/service-provider/add-service')
                }
                style={styles.retryBtn}
              >
                <MdAdd size={18} color="var(--brand-on-gradient)" />
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
                      router.push(
                        `/service-provider/edit-service/${s.service_id}`,
                      )
                    }
                    onToggle={() => handleToggleActive(s)}
                    onDelete={() => handleDelete(s)}
                  />
                ))}
              </div>

              <button
                onClick={() =>
                  router.push('/service-provider/add-service')
                }
                style={styles.addBtn}
                className="sp-add-service"
              >
                <MdAdd
                  size={20}
                  color="var(--brand-on-gradient)"
                />
                <span>Add another service</span>
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

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
              <MdImage size={22} color="var(--text-muted)" />
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
            <span style={styles.priceText}>
              {fmtNaira(service.price)}
            </span>
            <span style={styles.priceDot}>·</span>
            <span style={styles.durationText}>
              {service.duration} min
            </span>
          </div>

          <div style={styles.statsLine}>
            <MdEventNote size={12} color="var(--text-tertiary)" />
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

        <MdChevronRight size={18} color="var(--text-muted)" />
      </button>

      <div style={styles.actionsRow}>
        <button
          type="button"
          onClick={onToggle}
          style={styles.actionBtn}
          className="sp-action-btn"
        >
          {service.isActive ? (
            <>
              <MdPauseCircle size={16} color="var(--warning-fg)" />
              <span style={{ color: 'var(--warning-fg)' }}>Pause</span>
            </>
          ) : (
            <>
              <MdPlayCircleFilled
                size={16}
                color="var(--success-fg)"
              />
              <span style={{ color: 'var(--success-fg)' }}>Resume</span>
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
          <MdEdit size={16} color="var(--brand-primary)" />
          <span style={{ color: 'var(--brand-primary)' }}>Edit</span>
        </button>
        <div style={styles.actionsDivider} />
        <button
          type="button"
          onClick={onDelete}
          style={styles.actionBtn}
          className="sp-action-btn"
        >
          <MdDeleteOutline size={16} color="var(--danger-fg)" />
          <span style={{ color: 'var(--danger-fg)' }}>Delete</span>
        </button>
      </div>
    </div>
  );
}

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

const PAGE_CSS = `
  @keyframes spServicesSpin { to { transform: rotate(360deg); } }
  @keyframes spServicesShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .sp-services-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.18s ease, color 0.18s ease;
    justify-content: center;
  }

  .sp-services-shell {
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .sp-service-card:hover { background-color: var(--bg-hover); }
  .sp-service-card:active { background-color: var(--bg-tertiary); }
  .sp-action-btn:hover { background-color: var(--bg-hover); }
  .sp-add-service:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px
      color-mix(in srgb, var(--brand-primary) 32%, transparent);
  }
  .sp-services-pill:active { transform: scale(0.97); }
`;

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    transition: 'background-color 0.18s ease, color 0.18s ease',
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
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
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
    backgroundColor: 'var(--bg-tertiary)',
    border: '1.5px solid transparent',
    transition: 'background-color 0.18s ease',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 15,
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    minWidth: 0,
  },
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'var(--border-default)',
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
    border: '1px solid var(--border-default)',
    backgroundColor: 'var(--bg-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
    transition:
      'background-color 0.15s, border-color 0.15s, transform 0.12s',
  },
  pillActive: {
    backgroundColor: 'var(--brand-soft)',
    borderColor: 'var(--brand-primary)',
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-tertiary)',
  },
  pillLabelActive: { color: 'var(--brand-primary)' },

  body: { flex: 1, overflowY: 'auto', padding: '0 12px 32px' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },

  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 16,
    border: '1px solid var(--border-default)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
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
    backgroundColor: 'var(--bg-tertiary)',
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
    color: 'var(--text-primary)',
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
    backgroundColor: 'var(--success-bg)',
    color: 'var(--success-fg)',
    borderColor: 'var(--success-strong)',
  },
  statusChipPaused: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderColor: 'var(--border-default)',
  },
  priceLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
  },
  priceText: {
    color: 'var(--brand-primary)',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  priceDot: { color: 'var(--border-strong)' },
  durationText: {
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
  statsLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginTop: 2,
    minWidth: 0,
  },
  statsText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statsDot: { color: 'var(--border-strong)' },
  statsPending: {
    color: 'var(--warning-fg)',
    fontWeight: 700,
    flexShrink: 0,
  },

  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    borderTop: '1px solid var(--border-subtle)',
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
    backgroundColor: 'var(--border-subtle)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: -0.1,
    boxShadow: 'var(--shadow-brand)',
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
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-strong)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHalo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    background: 'var(--brand-soft)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow:
      '0 10px 28px color-mix(in srgb, var(--brand-primary) 10%, transparent)',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.2,
  },
  stateBody: {
    fontSize: 13.5,
    color: 'var(--text-tertiary)',
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
    background: 'var(--brand-gradient)',
    color: 'var(--brand-on-gradient)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-brand)',
  },

  skeletonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  skeletonCard: {
    height: 140,
    borderRadius: 16,
    background: 'var(--skeleton)',
    backgroundSize: '200% 100%',
    animation: 'spServicesShimmer 1.4s linear infinite',
  },
};