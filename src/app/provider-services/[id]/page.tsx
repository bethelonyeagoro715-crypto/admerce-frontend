'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MdArrowBack, MdBuild, MdRefresh, MdSearch } from 'react-icons/md';
import api from '../../../services/api';
import ServiceReelCard, { ServiceReel } from '../../../components/ServiceReelCard';

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

function formatPrice(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return 'Free';
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Free';
  return `₦${numeric.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function ServiceSkeleton() {
  return <div className="psp-skeletonCard" aria-hidden="true" />;
}

function ProviderServicesContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const rawId = params?.id;
  const providerId = Array.isArray(rawId) ? rawId[0] : rawId || '';
  const urlName = searchParams.get('name')?.trim() || '';

  const [providerName, setProviderName] = useState(urlName || 'Service Provider');
  const [services, setServices] = useState<ServiceReel[]>([]);
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
        const apiName =
          firstRaw?.business_name?.trim() || firstRaw?.username?.trim() || '';

        const list: ServiceReel[] = rawList
          .filter(
            (item): item is ProviderServiceResponse => Boolean(item?.service_id),
          )
          .map((item) => ({
            id: String(item.service_id),
            title: item.title?.trim() || 'Service',
            price: formatPrice(item.price),
            videoUrl: item.video_url?.trim() ? item.video_url : null,
            imageUrl: item.image_url?.trim() ? item.image_url : null,
            providerName: apiName || undefined,
          }));

        setServices(list);

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
        if (!cancelled) setLoading(false);
      }
    }

    void loadServices();

    return () => {
      cancelled = true;
    };
  }, [providerId, retryKey, urlName]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.providerName ?? '').toLowerCase().includes(q),
    );
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

  const handleRetry = () => setRetryKey((n) => n + 1);

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
          /* ✅ Never allow horizontal scroll on the page */
          overflow-x: hidden;
        }

        .psp-shell {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 0 18px 32px;
          /* ✅ Padding never widens the shell past the viewport */
          box-sizing: border-box;
        }

        .psp-header {
          position: sticky;
          top: 0;
          z-index: 20;
          border-bottom: 1px solid rgba(232, 233, 237, 0.92);
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .psp-headerInner {
          width: min(1180px, 100%);
          margin: 0 auto;
          min-height: 68px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          /* ✅ Belt-and-suspenders */
          box-sizing: border-box;
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
        .psp-search:focus-within {
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
          /* ✅ */
          box-sizing: border-box;
          min-width: 0;
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
          /* ✅ */
          box-sizing: border-box;
        }
        .psp-search svg { color: #858995; flex: 0 0 auto; }
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
        .psp-search input::placeholder { color: #9A9DA6; }

        /* ✅ Reels grid — narrower columns because cards are tall 9:16. */
        .psp-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          /* ✅ minmax(0,1fr) above + min-width here = no column ever
             grows past its slot, so the row can't overflow */
          min-width: 0;
        }

        /* ✅ Skeleton sized to match the reel card. */
        .psp-skeletonCard {
          position: relative;
          width: 100%;
          aspect-ratio: 9 / 16;
          border-radius: 16px;
          background: #ECEEF4;
          overflow: hidden;
        }
        .psp-skeletonCard::after {
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
          /* ✅ Long error text wraps, doesn't push width */
          word-break: break-word;
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
          /* ✅ */
          word-break: break-word;
        }

        @keyframes pspSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes pspShimmer {
          100% { transform: translateX(100%); }
        }

        @media (max-width: 980px) {
          .psp-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        }

        @media (max-width: 720px) {
          .psp-shell { padding: 0 14px 26px; }
          .psp-headerInner { padding: 9px 14px; }
          .psp-contentHeader {
            align-items: stretch;
            flex-direction: column;
            padding-top: 20px;
          }
          .psp-search { width: 100%; }
          /* ✅ Two columns on mobile — matches IG/TikTok grid feel. */
          .psp-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .psp-backButton, .psp-retry { transition: none; }
          .psp-spinner, .psp-skeletonCard::after { animation: none; }
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
              Tap any reel to book this provider.
            </p>
          </div>

          {!loading && services.length > 0 && (
            <label className="psp-search">
              <MdSearch size={19} aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services"
                aria-label="Search services"
                type="search"
              />
            </label>
          )}
        </section>

        {loading ? (
          <div className="psp-grid" aria-busy="true" aria-label="Loading services">
            {Array.from({ length: 6 }).map((_, i) => (
              <ServiceSkeleton key={i} />
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
              <ServiceReelCard
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

