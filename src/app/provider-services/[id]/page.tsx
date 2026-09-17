'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import api from '../../../services/api';
import { MdBuild, MdPlayArrow } from 'react-icons/md';

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

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(data|blob):/i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;

  if (API_BASE) {
    return `${API_BASE}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  }
  return trimmed;
}

function formatPrice(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return 'Free';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function ProviderServicesContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const rawId = params?.id;
  const providerId = Array.isArray(rawId) ? rawId[0] : rawId || '';
  const urlName = searchParams.get('name') || '';

  const [providerName, setProviderName] = useState<string>(
    urlName || 'Service Provider'
  );
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());

  const handleVideoPlay = (id: string) =>
    setPlayingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const handleVideoPause = (id: string) =>
    setPlayingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  useEffect(() => {
    // ✅ Everything the effect does — including the synchronous guard — is
    //    deferred via setTimeout so no setState runs in the effect body.
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      if (!providerId) {
        setError('Provider not found.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const raw = await api.getProviderServicesByUserId(providerId);
        if (cancelled) return;

        if (!Array.isArray(raw)) {
          console.warn('Provider services response is not an array:', raw);
          setServices([]);
          return;
        }

        const rawList = raw as ProviderServiceResponse[];

        // ✅ Capture the raw first item BEFORE mapping, so business_name /
        //    username are still available for the header.
        const firstRaw = rawList.find((s) => s && s.service_id);

        const list: Service[] = rawList
          .filter((s): s is ProviderServiceResponse => !!(s && s.service_id))
          .map((s) => ({
            id: String(s.service_id),
            title: s.title?.trim() || 'Service',
            price: formatPrice(s.price),
            image: resolveMediaUrl(s.image_url),
            video: s.video_url?.trim() ? resolveMediaUrl(s.video_url) : null,
            description: s.description?.trim() || '',
          }));

        setServices(list);

        // ✅ API name wins; URL param only used as an initial placeholder.
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
        if (cancelled) return;
        console.error('Failed to load services:', err);
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not load services. Please try again.';
        setError(msg);
        setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [providerId, urlName]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/shopper/home');
    }
  }, [router]);

  const handleOpenService = (serviceId: string) => {
    router.push(`/service-detail/${serviceId}`);
  };

  return (
    <main className="psp-container" style={styles.container}>
      <style>{`
        .psp-container {
          height: 100vh;
          height: 100dvh;
        }
      `}</style>

      <div style={styles.appBar}>
        <button
          onClick={handleBack}
          style={styles.backBtn}
          aria-label="Back"
        >
          ←
        </button>
        <h1 style={styles.title}>{providerName}</h1>
      </div>

      {loading ? (
        <div style={styles.center}>
          <div style={styles.spinner} />
        </div>
      ) : error ? (
        <div style={styles.center}>
          <MdBuild size={48} color="#ccc" />
          <p style={styles.errorText}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={styles.retryBtn}
          >
            Try again
          </button>
        </div>
      ) : services.length === 0 ? (
        <div style={styles.center}>
          <MdBuild size={48} color="#ccc" />
          <p style={styles.emptyText}>No services offered yet.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {services.map((service) => {
            const isPlaying = playingIds.has(service.id);
            return (
              <div
                key={service.id}
                style={styles.card}
                onClick={() => handleOpenService(service.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenService(service.id);
                  }
                }}
              >
                <div style={styles.mediaWrap}>
                  {service.video ? (
                    <>
                      <video
                        src={service.video}
                        poster={service.image || undefined}
                        controls
                        muted
                        playsInline
                        preload="none"
                        onPlay={() => handleVideoPlay(service.id)}
                        onPause={() => handleVideoPause(service.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={styles.media}
                      />
                      {!isPlaying && (
                        <div style={styles.playIcon} aria-hidden>
                          <MdPlayArrow size={22} color="#fff" />
                        </div>
                      )}
                    </>
                  ) : service.image ? (
                    <img
                      src={service.image}
                      alt={service.title}
                      loading="lazy"
                      decoding="async"
                      style={styles.media}
                    />
                  ) : (
                    <MdBuild size={40} color="#C7D2FE" />
                  )}
                </div>

                <div style={styles.info}>
                  <div style={styles.serviceTitle} title={service.title}>
                    {service.title}
                  </div>
                  <div style={styles.price}>{service.price}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function ProviderServicesPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: '100dvh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          Loading…
        </div>
      }
    >
      <ProviderServicesContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
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
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
    marginRight: 12,
    color: '#333',
    padding: '4px 8px',
    borderRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#888',
    padding: 24,
    gap: 12,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorText: {
    color: '#B71C1C',
    fontSize: 14,
    textAlign: 'center',
    margin: 0,
    maxWidth: 320,
    lineHeight: 1.5,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    margin: 0,
  },
  retryBtn: {
    padding: '10px 20px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
    alignContent: 'start',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 0.15s ease',
  },
  mediaWrap: {
    height: 140,
    backgroundColor: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  info: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  serviceTitle: {
    fontWeight: 600,
    fontSize: 14,
    lineHeight: 1.3,
    color: '#1A1A1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  price: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0504AA',
  },
};

if (typeof document !== 'undefined' && !document.getElementById('psp-kf')) {
  const s = document.createElement('style');
  s.id = 'psp-kf';
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
}