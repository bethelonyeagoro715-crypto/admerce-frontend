'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MdArrowBack, MdBuild, MdPlayArrow, MdRefresh } from 'react-icons/md';
import api from '../../../services/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '';

interface Service {
  id: string;
  title: string;
  price: string;
  image: string;
  video: string | null;
  description: string;
}

interface ProviderServiceResponse {
  service_id?: string | null;
  title?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  video_url?: string | null;
  description?: string | null;
  business_name?: string | null;
  username?: string | null;
}

function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;

  if (API_BASE) {
    return `${API_BASE.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
  }

  return trimmed;
}

function formatPrice(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return 'Free';

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 'Free';

  return `₦${value.toLocaleString('en-NG', {
    maximumFractionDigits: 0,
  })}`;
}

function ProviderServicesContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const providerId = useMemo(() => {
    const rawId = params?.id;
    return Array.isArray(rawId) ? rawId[0] || '' : rawId || '';
  }, [params]);

  const urlName = searchParams.get('name')?.trim() || '';

  const [providerName, setProviderName] = useState(urlName || 'Service Provider');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const loadServices = useCallback(async () => {
    if (!providerId) {
      setServices([]);
      setError('Provider not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const raw = await api.getProviderServicesByUserId(providerId);

      if (!Array.isArray(raw)) {
        console.warn('Provider services response is not an array:', raw);
        setServices([]);
        setError('The provider returned an invalid services response.');
        return;
      }

      const rawList = raw as ProviderServiceResponse[];
      const firstRaw = rawList.find((service) => service?.service_id);

      const list: Service[] = rawList
        .filter(
          (service): service is ProviderServiceResponse =>
            Boolean(service?.service_id),
        )
        .map((service) => ({
          id: String(service.service_id),
          title: service.title?.trim() || 'Service',
          price: formatPrice(service.price),
          image: resolveMediaUrl(service.image_url),
          video: service.video_url?.trim()
            ? resolveMediaUrl(service.video_url)
            : null,
          description: service.description?.trim() || '',
        }));

      setServices(list);

      const apiName =
        firstRaw?.business_name?.trim() ||
        firstRaw?.username?.trim() ||
        '';

      if (apiName) {
        setProviderName(apiName);
      } else if (!urlName) {
        setProviderName('Service Provider');
      }
    } catch (err: unknown) {
      console.error('Failed to load services:', err);

      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not load services. Please try again.';

      setError(message);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [providerId, urlName]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await loadServices();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadServices]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/shopper/home');
  }, [router]);

  const handleOpenService = useCallback(
    (serviceId: string) => {
      router.push(`/service-detail/${serviceId}`);
    },
    [router],
  );

  const handleVideoPlay = useCallback((id: string) => {
    setPlayingIds((previous) => {
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

  const handleVideoPause = useCallback((id: string) => {
    setPlayingIds((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const handleImageError = useCallback((id: string) => {
    setFailedImages((previous) => {
      if (previous.has(id)) return previous;

      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

  return (
    <main className="psp-page" style={styles.container}>
      <style>{`
        @keyframes psp-spin {
          to { transform: rotate(360deg); }
        }

        .psp-scroll {
          scrollbar-width: thin;
          scrollbar-color: #d9dcf3 transparent;
        }

        .psp-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .psp-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .psp-scroll::-webkit-scrollbar-thumb {
          background: #d9dcf3;
          border-radius: 999px;
        }

        .psp-back:hover {
          background: #f1f2ff !important;
          color: #0504AA !important;
        }

        .psp-retry:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(5, 4, 170, 0.18);
        }

        .psp-card {
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            border-color 160ms ease;
        }

        .psp-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.10) !important;
          border-color: #e0e3ff !important;
        }

        .psp-card:focus-visible {
          outline: 3px solid rgba(5, 4, 170, 0.22);
          outline-offset: 3px;
        }

        .psp-media {
          transition: transform 220ms ease;
        }

        .psp-card:hover .psp-media {
          transform: scale(1.025);
        }

        @media (max-width: 520px) {
          .psp-header {
            padding: 10px 12px !important;
          }

          .psp-title {
            font-size: 18px !important;
          }

          .psp-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
            padding: 10px !important;
          }

          .psp-media-wrap {
            height: 128px !important;
          }

          .psp-info {
            padding: 9px 10px !important;
          }
        }

        @media (min-width: 900px) {
          .psp-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            max-width: 1280px;
            margin: 0 auto;
            width: 100%;
          }
        }
      `}</style>

      <header className="psp-header" style={styles.appBar}>
        <button
          className="psp-back"
          type="button"
          onClick={handleBack}
          style={styles.backBtn}
          aria-label="Go back"
        >
          <MdArrowBack size={22} />
        </button>

        <div style={styles.headerText}>
          <h1 className="psp-title" style={styles.title}>
            {providerName}
          </h1>
          {!loading && !error && services.length > 0 && (
            <span style={styles.subtitle}>
              {services.length} {services.length === 1 ? 'service' : 'services'}
            </span>
          )}
        </div>
      </header>

      <section className="psp-scroll" style={styles.content}>
        {loading ? (
          <div style={styles.center}>
            <div style={styles.spinner} aria-label="Loading" />
            <p style={styles.mutedText}>Loading services…</p>
          </div>
        ) : error ? (
          <div style={styles.center}>
            <div style={styles.stateIcon}>
              <MdBuild size={28} />
            </div>

            <h2 style={styles.stateTitle}>Something went wrong</h2>
            <p style={styles.errorText}>{error}</p>

            <button
              className="psp-retry"
              type="button"
              onClick={() => void loadServices()}
              style={styles.retryBtn}
            >
              <MdRefresh size={19} />
              Try again
            </button>
          </div>
        ) : services.length === 0 ? (
          <div style={styles.center}>
            <div style={styles.stateIcon}>
              <MdBuild size={28} />
            </div>

            <h2 style={styles.stateTitle}>No services yet</h2>
            <p style={styles.emptyText}>
              This provider has not added any services yet.
            </p>
          </div>
        ) : (
          <div className="psp-grid" style={styles.grid}>
            {services.map((service) => {
              const isPlaying = playingIds.has(service.id);
              const imageFailed = failedImages.has(service.id);
              const hasMedia = Boolean(service.video || service.image);

              return (
                <article
                  key={service.id}
                  className="psp-card"
                  style={styles.card}
                  onClick={() => handleOpenService(service.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${service.title}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenService(service.id);
                    }
                  }}
                >
                  <div
                    className="psp-media-wrap"
                    style={styles.mediaWrap}
                  >
                    {service.video ? (
                      <>
                        <video
                          className="psp-media"
                          src={service.video}
                          poster={
                            service.image && !imageFailed
                              ? service.image
                              : undefined
                          }
                          controls
                          muted
                          playsInline
                          preload="metadata"
                          onPlay={() => handleVideoPlay(service.id)}
                          onPause={() => handleVideoPause(service.id)}
                          onEnded={() => handleVideoPause(service.id)}
                          onClick={(event) => event.stopPropagation()}
                          style={styles.media}
                        />

                        {!isPlaying && (
                          <span
                            style={styles.playIcon}
                            aria-hidden="true"
                          >
                            <MdPlayArrow size={24} color="#fff" />
                          </span>
                        )}
                      </>
                    ) : service.image && !imageFailed ? (
                      <img
                        className="psp-media"
                        src={service.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => handleImageError(service.id)}
                        style={styles.media}
                      />
                    ) : (
                      <div style={styles.mediaFallback}>
                        <MdBuild size={38} color="#9CA3DB" />
                      </div>
                    )}

                    {hasMedia && (
                      <div style={styles.mediaShade} aria-hidden="true" />
                    )}
                  </div>

                  <div className="psp-info" style={styles.info}>
                    <div
                      style={styles.serviceTitle}
                      title={service.title}
                    >
                      {service.title}
                    </div>

                    {service.description && (
                      <div style={styles.description}>
                        {service.description}
                      </div>
                    )}

                    <div style={styles.bottomRow}>
                      <span style={styles.price}>{service.price}</span>
                      <span style={styles.viewLabel}>View</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default function ProviderServicesPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.pageFallback}>
          <div style={styles.spinner} aria-label="Loading" />
        </div>
      }
    >
      <ProviderServicesContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#F8F9FC',
    color: '#111827',
    overflow: 'hidden',
  },

  appBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 68,
    padding: '10px 16px',
    borderBottom: '1px solid #ECEEF5',
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    flexShrink: 0,
  },

  backBtn: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'transparent',
    border: 'none',
    borderRadius: 12,
    color: '#374151',
    cursor: 'pointer',
    transition: 'background 150ms ease, color 150ms ease',
  },

  headerText: {
    minWidth: 0,
    flex: 1,
  },

  title: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: '-0.02em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  subtitle: {
    display: 'block',
    marginTop: 3,
    color: '#7A8094',
    fontSize: 12,
    fontWeight: 500,
  },

  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  },

  center: {
    minHeight: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    padding: 32,
    gap: 10,
  },

  spinner: {
    width: 34,
    height: 34,
    border: '3px solid #E7E8F5',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'psp-spin 0.75s linear infinite',
  },

  mutedText: {
    margin: 0,
    color: '#8B90A2',
    fontSize: 14,
  },

  stateIcon: {
    width: 64,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    background: '#EEF0FF',
    color: '#0504AA',
    marginBottom: 4,
  },

  stateTitle: {
    margin: 0,
    color: '#171923',
    fontSize: 18,
    fontWeight: 750,
  },

  errorText: {
    maxWidth: 420,
    margin: 0,
    color: '#B42318',
    fontSize: 14,
    lineHeight: 1.55,
  },

  emptyText: {
    maxWidth: 380,
    margin: 0,
    color: '#858A9D',
    fontSize: 14,
    lineHeight: 1.55,
  },

  retryBtn: {
    marginTop: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '10px 17px',
    background: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 11,
    fontSize: 14,
    fontWeight: 650,
    cursor: 'pointer',
    transition: 'transform 150ms ease, box-shadow 150ms ease',
  },

  grid: {
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: 14,
    alignContent: 'start',
    padding: 16,
  },

  card: {
    minWidth: 0,
    background: '#fff',
    border: '1px solid #ECEEF5',
    borderRadius: 18,
    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.045)',
    overflow: 'hidden',
    cursor: 'pointer',
  },

  mediaWrap: {
    height: 148,
    position: 'relative',
    overflow: 'hidden',
    background: '#EEF0FF',
  },

  media: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    position: 'relative',
    zIndex: 1,
  },

  mediaFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'linear-gradient(135deg, #EEF0FF 0%, #F7F7FC 100%)',
  },

  mediaShade: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    pointerEvents: 'none',
    background:
      'linear-gradient(to bottom, rgba(0,0,0,0.02), rgba(0,0,0,0.08))',
  },

  playIcon: {
    position: 'absolute',
    zIndex: 4,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(8, 9, 25, 0.62)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
  },

  info: {
    padding: '11px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },

  serviceTitle: {
    minHeight: 36,
    color: '#171923',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },

  description: {
    color: '#7D8294',
    fontSize: 12,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },

  bottomRow: {
    marginTop: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  price: {
    color: '#0504AA',
    fontSize: 14,
    fontWeight: 800,
  },

  viewLabel: {
    color: '#777C91',
    fontSize: 11,
    fontWeight: 650,
  },

  pageFallback: {
    height: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F8F9FC',
  },
};

