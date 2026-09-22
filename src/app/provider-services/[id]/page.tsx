'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  MdArrowBack,
  MdBuild,
  MdImageNotSupported,
  MdPlayArrow,
  MdRefresh,
  MdSearch,
} from 'react-icons/md';
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

  // Accept only browser-loadable media schemes.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^blob:/i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;

  const base = API_BASE.replace(/\/+$/, '');

  if (trimmed.startsWith('/')) {
    return base ? `${base}${trimmed}` : trimmed;
  }

  return base ? `${base}/${trimmed}` : trimmed;
}

function formatPrice(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return 'Free';

  const numeric = Number(raw);

  if (!Number.isFinite(numeric) || numeric <= 0) return 'Free';

  return `₦${numeric.toLocaleString('en-NG', {
    maximumFractionDigits: 0,
  })}`;
}

function ServiceCard({
  service,
  onOpen,
}: {
  service: Service;
  onOpen: (serviceId: string) => void;
}) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const hasVideo = Boolean(service.video);
  const mediaSrc = hasVideo ? service.video : service.image;

  const handleOpen = () => {
    onOpen(service.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <article
      className="psp-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${service.title}`}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="psp-media">
        {!mediaError && hasVideo && mediaSrc ? (
          <>
            <video
              className="psp-mediaAsset"
              src={mediaSrc}
              poster={service.image || undefined}
              controls
              muted
              playsInline
              preload="metadata"
              onPlay={() => setVideoPlaying(true)}
              onPause={() => setVideoPlaying(false)}
              onEnded={() => setVideoPlaying(false)}
              onError={() => setMediaError(true)}
              onClick={(event) => event.stopPropagation()}
            />
            {!videoPlaying && (
              <span className="psp-playBadge" aria-hidden="true">
                <MdPlayArrow size={22} />
              </span>
            )}
          </>
        ) : !mediaError && service.image ? (
          <img
            className="psp-mediaAsset"
            src={service.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setMediaError(true)}
          />
        ) : (
          <div className="psp-mediaFallback" aria-hidden="true">
            {mediaError ? (
              <MdImageNotSupported size={34} />
            ) : (
              <MdBuild size={34} />
            )}
          </div>
        )}
      </div>

      <div className="psp-cardBody">
        <div className="psp-cardTopline">
          <h2 className="psp-serviceTitle" title={service.title}>
            {service.title}
          </h2>
          <span className="psp-price">{service.price}</span>
        </div>

        {service.description ? (
          <p className="psp-description">{service.description}</p>
        ) : (
          <p className="psp-description psp-descriptionMuted">
            Tap to view service details.
          </p>
        )}

        <span className="psp-viewHint">View details</span>
      </div>
    </article>
  );
}

function ServiceSkeleton() {
  return (
    <div className="psp-card psp-skeletonCard" aria-hidden="true">
      <div className="psp-skeleton psp-skeletonMedia" />
      <div className="psp-cardBody">
        <div className="psp-skeleton psp-skeletonTitle" />
        <div className="psp-skeleton psp-skeletonLine" />
        <div className="psp-skeleton psp-skeletonLine psp-skeletonLineShort" />
      </div>
    </div>
  );
}

function ProviderServicesContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const rawId = params?.id;
  const providerId = Array.isArray(rawId) ? rawId[0] : rawId || '';
  const urlName = searchParams.get('name')?.trim() || '';

  const [providerName, setProviderName] = useState(
    urlName || 'Service Provider',
  );
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      if (!providerId) {
        setError('Provider not found.');
        setServices([]);
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
        const firstRaw = rawList.find((item) => item?.service_id);

        const list: Service[] = rawList
          .filter(
            (item): item is ProviderServiceResponse =>
              Boolean(item?.service_id),
          )
          .map((item) => ({
            id: String(item.service_id),
            title: item.title?.trim() || 'Service',
            price: formatPrice(item.price),
            image: resolveMediaUrl(item.image_url),
            video: item.video_url?.trim()
              ? resolveMediaUrl(item.video_url)
              : null,
            description: item.description?.trim() || '',
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
        if (cancelled) return;

        console.error('Failed to load services:', err);

        const message =
          err instanceof Error
            ? err.message
            : 'Could not load services. Please try again.';

        setError(message);
        setServices([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadServices();

    return () => {
      cancelled = true;
    };
  }, [providerId, retryKey, urlName]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return services;

    return services.filter((service) => {
      return (
        service.title.toLowerCase().includes(query) ||
        service.description.toLowerCase().includes(query)
      );
    });
  }, [search, services]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/shopper/home');
  }, [router]);

  const handleOpenService = useCallback(
    (serviceId: string) => {
      router.push(`/service-detail/${encodeURIComponent(serviceId)}`);
    },
    [router],
  );

  const handleRetry = () => {
    setRetryKey((current) => current + 1);
  };

  const countLabel = `${services.length} ${
    services.length === 1 ? 'service' : 'services'
  }`;

  return (
    <main className="psp-page">
      <style>{`
        .psp-page {
          --psp-primary: #0504AA;
          --psp-primarySoft: #EEF2FF;
          --psp-text: #101114;
          --psp-muted: #70747D;
          --psp-border: #E8E9ED;
          --psp-surface: #FFFFFF;
          --psp-page: #F7F8FC;
          min-height: 100dvh;
          background: var(--psp-page);
          color: var(--psp-text);
          font-family: inherit;
        }

        .psp-shell {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 0 18px 32px;
        }

        .psp-header {
          position: sticky;
          top: 0;
          z-index: 20;
          border-bottom: 1px solid rgba(232, 233, 237, 0.92);
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(14px);
        }

        .psp-headerInner {
          width: min(1180px, 100%);
          margin: 0 auto;
          min-height: 68px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .psp-backButton {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--psp-border);
          border-radius: 12px;
          background: var(--psp-surface);
          color: var(--psp-text);
          cursor: pointer;
          transition: 160ms ease;
        }

        .psp-backButton:hover {
          border-color: #C9CBFF;
          color: var(--psp-primary);
          transform: translateY(-1px);
        }

        .psp-backButton:focus-visible,
        .psp-search:focus-within,
        .psp-card:focus-visible {
          outline: 3px solid rgba(5, 4, 170, 0.18);
          outline-offset: 2px;
        }

        .psp-heading {
          min-width: 0;
          flex: 1;
        }

        .psp-providerName {
          margin: 0;
          font-size: clamp(17px, 2.4vw, 21px);
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .psp-providerMeta {
          margin: 4px 0 0;
          color: var(--psp-muted);
          font-size: 12px;
          font-weight: 600;
        }

        .psp-contentHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          padding: 24px 0 18px;
        }

        .psp-pageTitle {
          margin: 0;
          font-size: clamp(24px, 4vw, 34px);
          line-height: 1.05;
          letter-spacing: -0.035em;
          font-weight: 850;
        }

        .psp-pageSubtitle {
          margin: 8px 0 0;
          color: var(--psp-muted);
          font-size: 14px;
        }

        .psp-search {
          width: min(320px, 100%);
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 13px;
          border: 1px solid var(--psp-border);
          border-radius: 14px;
          background: var(--psp-surface);
          transition: 160ms ease;
        }

        .psp-search svg {
          color: #858995;
          flex: 0 0 auto;
        }

        .psp-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--psp-text);
          font: inherit;
          font-size: 14px;
        }

        .psp-search input::placeholder {
          color: #9A9DA6;
        }

        .psp-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .psp-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--psp-border);
          border-radius: 18px;
          background: var(--psp-surface);
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(16, 17, 20, 0.045);
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .psp-card:hover {
          transform: translateY(-3px);
          border-color: #D9DAFF;
          box-shadow: 0 16px 34px rgba(16, 17, 20, 0.085);
        }

        .psp-media {
          position: relative;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          background: var(--psp-primarySoft);
        }

        .psp-mediaAsset {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .psp-playBadge {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 46px;
          height: 46px;
          transform: translate(-50%, -50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(12, 12, 17, 0.72);
          color: #fff;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
          pointer-events: none;
        }

        .psp-mediaFallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #A9B1DA;
        }

        .psp-cardBody {
          padding: 13px 14px 14px;
        }

        .psp-cardTopline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .psp-serviceTitle {
          min-width: 0;
          margin: 0;
          font-size: 15px;
          line-height: 1.32;
          font-weight: 750;
          letter-spacing: -0.01em;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .psp-price {
          flex: 0 0 auto;
          color: var(--psp-primary);
          font-size: 14px;
          font-weight: 850;
          white-space: nowrap;
        }

        .psp-description {
          margin: 8px 0 0;
          color: #555A65;
          font-size: 12.5px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .psp-descriptionMuted {
          color: #9A9DA6;
        }

        .psp-viewHint {
          display: inline-block;
          margin-top: 10px;
          color: var(--psp-primary);
          font-size: 12px;
          font-weight: 750;
        }

        .psp-center {
          min-height: 48vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          text-align: center;
        }

        .psp-spinner {
          width: 38px;
          height: 38px;
          border: 3px solid #DFE1F8;
          border-top-color: var(--psp-primary);
          border-radius: 50%;
          animation: pspSpin 700ms linear infinite;
        }

        .psp-stateIcon {
          width: 62px;
          height: 62px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: var(--psp-primarySoft);
          color: var(--psp-primary);
        }

        .psp-stateTitle {
          margin: 15px 0 0;
          font-size: 17px;
          font-weight: 800;
        }

        .psp-stateText {
          max-width: 380px;
          margin: 7px 0 0;
          color: var(--psp-muted);
          font-size: 14px;
          line-height: 1.5;
        }

        .psp-retry {
          margin-top: 15px;
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 15px;
          border: 0;
          border-radius: 12px;
          background: var(--psp-primary);
          color: #fff;
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition: 160ms ease;
        }

        .psp-retry:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
        }

        .psp-noResults {
          grid-column: 1 / -1;
          padding: 52px 18px;
          border: 1px dashed #DADCE6;
          border-radius: 18px;
          text-align: center;
          background: rgba(255, 255, 255, 0.72);
          color: var(--psp-muted);
        }

        .psp-skeletonCard {
          cursor: default;
          pointer-events: none;
        }

        .psp-skeleton {
          position: relative;
          overflow: hidden;
          background: #ECEEF4;
        }

        .psp-skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.52),
            transparent
          );
          animation: pspShimmer 1.25s infinite;
        }

        .psp-skeletonMedia {
          aspect-ratio: 16 / 10;
        }

        .psp-skeletonTitle {
          width: 72%;
          height: 16px;
          border-radius: 6px;
        }

        .psp-skeletonLine {
          width: 100%;
          height: 11px;
          margin-top: 10px;
          border-radius: 6px;
        }

        .psp-skeletonLineShort {
          width: 64%;
        }

        @keyframes pspSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes pspShimmer {
          100% { transform: translateX(100%); }
        }

        @media (max-width: 980px) {
          .psp-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .psp-shell {
            padding: 0 14px 26px;
          }

          .psp-headerInner {
            padding: 9px 14px;
          }

          .psp-contentHeader {
            align-items: stretch;
            flex-direction: column;
            padding-top: 20px;
          }

          .psp-search {
            width: 100%;
          }

          .psp-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .psp-card {
            border-radius: 15px;
          }

          .psp-cardBody {
            padding: 11px 12px 12px;
          }

          .psp-description {
            font-size: 12px;
          }
        }

        @media (max-width: 420px) {
          .psp-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .psp-card,
          .psp-backButton,
          .psp-retry {
            transition: none;
          }

          .psp-spinner,
          .psp-skeleton::after {
            animation: none;
          }
        }
      `}</style>

      <header className="psp-header">
        <div className="psp-headerInner">
          <button
            type="button"
            className="psp-backButton"
            onClick={handleBack}
            aria-label="Go back"
          >
            <MdArrowBack size={21} />
          </button>

          <div className="psp-heading">
            <h1 className="psp-providerName">{providerName}</h1>
            <p className="psp-providerMeta">{countLabel}</p>
          </div>
        </div>
      </header>

      <div className="psp-shell">
        <section className="psp-contentHeader">
          <div>
            <h2 className="psp-pageTitle">Services</h2>
            <p className="psp-pageSubtitle">
              Explore what this provider offers.
            </p>
          </div>

          {!loading && services.length > 0 && (
            <label className="psp-search">
              <MdSearch size={19} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services"
                aria-label="Search services"
                type="search"
              />
            </label>
          )}
        </section>

        {loading ? (
          <div
            className="psp-grid"
            aria-busy="true"
            aria-label="Loading services"
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <ServiceSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="psp-center">
            <div className="psp-stateIcon" aria-hidden="true">
              <MdBuild size={32} />
            </div>
            <h2 className="psp-stateTitle">We couldn&apos;t load these services</h2>
            <p className="psp-stateText">{error}</p>
            <button type="button" className="psp-retry" onClick={handleRetry}>
              <MdRefresh size={18} />
              Try again
            </button>
          </div>
        ) : services.length === 0 ? (
          <div className="psp-center">
            <div className="psp-stateIcon" aria-hidden="true">
              <MdBuild size={32} />
            </div>
            <h2 className="psp-stateTitle">No services yet</h2>
            <p className="psp-stateText">
              This provider hasn&apos;t published any services yet.
            </p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="psp-noResults">
            No services match <strong>&quot;{search.trim()}&quot;</strong>.
          </div>
        ) : (
          <section className="psp-grid" aria-label={`${providerName} services`}>
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onOpen={handleOpenService}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default function ProviderServicesPage() {
  return (
    <Suspense
      fallback={
        <main className="psp-page">
          <div
            style={{
              minHeight: '100dvh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              aria-label="Loading"
              style={{
                width: 36,
                height: 36,
                border: '3px solid #DFE1F8',
                borderTopColor: '#0504AA',
                borderRadius: '50%',
              }}
            />
          </div>
        </main>
      }
    >
      <ProviderServicesContent />
    </Suspense>
  );
}

