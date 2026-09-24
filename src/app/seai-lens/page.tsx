'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../services/api';
import {
  MdArrowBack,
  MdCameraAlt,
  MdImage,
  MdErrorOutline,
  MdRefresh,
  MdSearch,
  MdClose,
} from 'react-icons/md';

// ─── Types ──────────────────────────────────────────────────────────
interface LensResult {
  listing_id?: string;
  title?: string;
  price?: number | string;
  image_url?: string;
  store_name?: string;
  distance_km?: number;
  score?: number;
  [key: string]: unknown;
}

type LensState =
  | { status: 'idle' }
  | { status: 'loading'; sourceUrl: string }
  | { status: 'success'; sourceUrl: string; results: LensResult[] }
  | { status: 'error'; sourceUrl: string; message: string };

// ─── Helpers ────────────────────────────────────────────────────────
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
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

// Backend returns unknown shape. Handle every common envelope.
function extractResults(data: unknown): LensResult[] {
  if (Array.isArray(data)) return data as LensResult[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['results', 'matches', 'items', 'feed', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as LensResult[];
    }
  }
  return [];
}

// Convert a remote image URL into a File so we can send it to the API.
// Cloudinary and same-origin assets have CORS; cross-origin third-party
// images may fail — we surface that as an error state.
async function urlToFile(url: string, filename = 'lens.jpg'): Promise<File> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) {
    throw new Error(`Could not load source image (${res.status})`);
  }
  const blob = await res.blob();
  const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
  return new File([blob], `${filename}.${ext}`, {
    type: blob.type || 'image/jpeg',
  });
}

// ─── Result card ────────────────────────────────────────────────────
function ResultCard({
  result,
  onPress,
}: {
  result: LensResult;
  onPress: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = resolveImageUrl(result.image_url ?? null);
  const title = result.title || 'Untitled';
  const price = formatPrice(result.price);

  return (
    <button
      type="button"
      onClick={onPress}
      className="sl-card"
      aria-label={`Open ${title}`}
    >
      <div className="sl-cardMedia">
        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="sl-cardImg"
          />
        ) : (
          <div className="sl-cardFallback" aria-hidden="true">
            <MdImage size={28} color="#94a3b8" />
          </div>
        )}
      </div>
      <div className="sl-cardBody">
        <div className="sl-cardTitle" title={title}>
          {title}
        </div>
        <div className="sl-cardPrice">{price}</div>
        {result.store_name && (
          <div className="sl-cardStore" title={String(result.store_name)}>
            {result.store_name}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────
function ResultSkeleton() {
  return (
    <div className="sl-card sl-skeletonCard" aria-hidden="true">
      <div className="sl-cardMedia sl-skeletonMedia" />
      <div className="sl-cardBody">
        <div className="sl-skelLine" />
        <div className="sl-skelLine" style={{ width: '40%' }} />
      </div>
    </div>
  );
}

// ─── Content ────────────────────────────────────────────────────────
function SeaiLensContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const imageParam = searchParams.get('image') || '';
  const resolvedSource = resolveImageUrl(imageParam);

  const [state, setState] = useState<LensState>({ status: 'idle' });
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualPreview, setManualPreview] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Main: resolve source → fetch as File → call API ─────────────
  const runLens = useCallback(
    async (file: File, sourceUrl: string) => {
      setState({ status: 'loading', sourceUrl });

      let lat = 5.5103;
      let lng = 7.0265;
      try {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { timeout: 6000, maximumAge: 60_000 },
          );
        });
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        // Silent — falls back to defaults
      }

      try {
        const data = await api.seaiLensWithFile(file, lat, lng, 10);
        const results = extractResults(data);
        setState({ status: 'success', sourceUrl, results });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not run the visual search. Please try again.';
        setState({ status: 'error', sourceUrl, message });
      }
    },
    [],
  );

  // Auto-run when an image URL is present
  useEffect(() => {
    if (manualFile) return; // manual upload path owns the state
    if (!resolvedSource) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const file = await urlToFile(resolvedSource, 'lens');
        if (cancelled) return;
        await runLens(file, resolvedSource);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Could not load the source image.';
        setState({ status: 'error', sourceUrl: resolvedSource, message });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSource, retryKey]);

  // ── Manual file selection ───────────────────────────────────────
  const handleManualPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setManualFile(file);
    setManualPreview(preview);
    runLens(file, preview);
  };

  const clearManual = () => {
    if (manualPreview) URL.revokeObjectURL(manualPreview);
    setManualFile(null);
    setManualPreview(null);
    setState({ status: 'idle' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Derived ─────────────────────────────────────────────────────
  const sourceUrl =
    state.status !== 'idle' ? state.sourceUrl : resolvedSource || manualPreview;
  const isLoading = state.status === 'loading';
  const results = state.status === 'success' ? state.results : [];
  const errorMessage = state.status === 'error' ? state.message : null;
  const showIdle = state.status === 'idle';

  return (
    <main className="sl-root">
      <style>{CSS}</style>

      <header className="sl-header">
        <button
          type="button"
          className="sl-backBtn"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <MdArrowBack size={22} color="#0B0B1A" />
        </button>
        <div className="sl-headerText">
          <h1 className="sl-title">SEAI Lens</h1>
          <p className="sl-subtitle">
            {isLoading
              ? 'Looking for matches…'
              : results.length > 0
              ? `${results.length} visually similar`
              : 'Find things that look like this'}
          </p>
        </div>
        {sourceUrl && (
          <button
            type="button"
            className="sl-iconBtn"
            onClick={() => {
              setRetryKey((k) => k + 1);
            }}
            aria-label="Search again"
            title="Search again"
            disabled={isLoading}
          >
            <MdRefresh size={20} color="#0504AA" />
          </button>
        )}
      </header>

      <div className="sl-body">
        {/* Source image preview */}
        {sourceUrl && (
          <div className="sl-source">
            <img
              src={sourceUrl}
              alt="Source"
              className="sl-sourceImg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
              }}
            />
            {isLoading && (
              <div className="sl-sourceOverlay" aria-hidden="true">
                <div className="sl-scanner" />
                <div className="sl-scanLabel">
                  <MdSearch size={16} color="#fff" />
                  <span>Analyzing…</span>
                </div>
              </div>
            )}
            {manualFile && (
              <button
                type="button"
                className="sl-sourceClose"
                onClick={clearManual}
                aria-label="Clear source"
              >
                <MdClose size={16} color="#fff" />
              </button>
            )}
          </div>
        )}

        {/* Results grid */}
        {isLoading && (
          <div className="sl-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <ResultSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="sl-center">
            <div className="sl-stateIcon" aria-hidden="true">
              <MdErrorOutline size={32} color="#DC2626" />
            </div>
            <h2 className="sl-stateTitle">Something went wrong</h2>
            <p className="sl-stateBody">{errorMessage}</p>
            <button
              type="button"
              className="sl-primaryBtn"
              onClick={() => setRetryKey((k) => k + 1)}
            >
              <MdRefresh size={18} color="#fff" />
              Try again
            </button>
            <button
              type="button"
              className="sl-ghostBtn"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload a different image
            </button>
          </div>
        )}

        {!isLoading && !errorMessage && results.length === 0 && showIdle && (
          <div className="sl-center">
            <div className="sl-stateIcon" aria-hidden="true">
              <MdCameraAlt size={32} color="#0504AA" />
            </div>
            <h2 className="sl-stateTitle">Point at anything</h2>
            <p className="sl-stateBody">
              Take a photo or pick one from your gallery. We&apos;ll find what
              you&apos;re looking at on Admerce.
            </p>
            <button
              type="button"
              className="sl-primaryBtn"
              onClick={() => fileInputRef.current?.click()}
            >
              <MdCameraAlt size={18} color="#fff" />
              Choose image
            </button>
          </div>
        )}

        {!isLoading && !errorMessage && results.length === 0 && !showIdle && (
          <div className="sl-center">
            <div className="sl-stateIcon" aria-hidden="true">
              <MdSearch size={32} color="#64748B" />
            </div>
            <h2 className="sl-stateTitle">No matches yet</h2>
            <p className="sl-stateBody">
              We couldn&apos;t find anything visually similar on Admerce. Try a
              clearer photo or a different angle.
            </p>
            <button
              type="button"
              className="sl-primaryBtn"
              onClick={() => fileInputRef.current?.click()}
            >
              <MdCameraAlt size={18} color="#fff" />
              Choose another image
            </button>
          </div>
        )}

        {!isLoading && !errorMessage && results.length > 0 && (
          <div className="sl-grid">
            {results.map((r, i) => (
              <ResultCard
                key={r.listing_id || i}
                result={r}
                onPress={() => {
                  if (r.listing_id) {
                    router.push(`/item-detail/${r.listing_id}`);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleManualPick}
      />
    </main>
  );
}

// ─── Wrapper ────────────────────────────────────────────────────────
export default function SeaiLensPage() {
  return (
    <Suspense
      fallback={
        <main className="sl-root">
          <style>{CSS}</style>
          <div className="sl-center">
            <div className="sl-scanner sl-scannerStandalone" />
          </div>
        </main>
      }
    >
      <SeaiLensContent />
    </Suspense>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes sl-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes sl-scanline {
    0% { top: 0; opacity: 0.9; }
    50% { opacity: 0.5; }
    100% { top: 100%; opacity: 0.9; }
  }
  @keyframes sl-spin { to { transform: rotate(360deg); } }
  @keyframes sl-fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sl-root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #F4F5FB;
  }

  .sl-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: #fff;
    border-bottom: 1px solid #EAECF3;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .sl-backBtn {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .sl-backBtn:hover { background: #F1F3FA; }
  .sl-headerText {
    flex: 1;
    min-width: 0;
  }
  .sl-title {
    font-size: 17px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .sl-subtitle {
    font-size: 12.5px;
    color: #64748B;
    margin: 2px 0 0;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sl-iconBtn {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .sl-iconBtn:hover:not(:disabled) { background: #F1F3FA; }
  .sl-iconBtn:disabled { opacity: 0.5; cursor: not-allowed; }

  .sl-body {
    flex: 1;
    padding: 16px 14px 40px;
  }

  /* Source preview */
  .sl-source {
    position: relative;
    width: 100%;
    max-width: 420px;
    margin: 0 auto 20px;
    aspect-ratio: 1 / 1;
    border-radius: 18px;
    overflow: hidden;
    background: #E5E7EF;
    box-shadow: 0 12px 40px rgba(11, 11, 26, 0.12);
  }
  .sl-sourceImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: opacity 0.2s;
  }
  .sl-sourceOverlay {
    position: absolute;
    inset: 0;
    background: rgba(11, 11, 26, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .sl-scanner {
    position: absolute;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      transparent,
      #0504AA,
      #690096,
      #0504AA,
      transparent
    );
    box-shadow: 0 0 20px 4px rgba(5, 4, 170, 0.6);
    animation: sl-scanline 1.8s ease-in-out infinite;
  }
  .sl-scannerStandalone {
    position: relative;
    width: 200px;
    height: 3px;
    margin: 0 auto;
  }
  .sl-scanLabel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(11, 11, 26, 0.72);
    color: #fff;
    font-size: 12.5px;
    font-weight: 700;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .sl-sourceClose {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(11, 11, 26, 0.6);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 3;
  }

  /* Grid */
  .sl-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    max-width: 720px;
    margin: 0 auto;
  }
  @media (min-width: 640px) {
    .sl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  }
  @media (min-width: 960px) {
    .sl-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }

  /* Result card */
  .sl-card {
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #EAECF3;
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    padding: 0;
    text-align: left;
    font-family: inherit;
    transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
    animation: sl-fadeIn 0.25s ease;
  }
  .sl-card:hover {
    border-color: #C9CBFF;
    box-shadow: 0 8px 24px rgba(5, 4, 170, 0.08);
    transform: translateY(-2px);
  }
  .sl-cardMedia {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    background: #F1F5F9;
    overflow: hidden;
  }
  .sl-cardImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .sl-cardFallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #F1F5F9;
  }
  .sl-cardBody {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .sl-cardTitle {
    font-size: 13px;
    font-weight: 700;
    color: #0B0B1A;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .sl-cardPrice {
    font-size: 13px;
    font-weight: 800;
    color: #0504AA;
  }
  .sl-cardStore {
    font-size: 11.5px;
    color: #64748B;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Skeleton */
  .sl-skeletonCard { cursor: default; pointer-events: none; }
  .sl-skeletonMedia {
    background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
    background-size: 800px 100%;
    animation: sl-shimmer 1.4s infinite linear;
  }
  .sl-skelLine {
    height: 10px;
    border-radius: 6px;
    background: linear-gradient(90deg, #EEF2F6 0%, #F8FAFC 50%, #EEF2F6 100%);
    background-size: 800px 100%;
    animation: sl-shimmer 1.4s infinite linear;
    width: 80%;
  }

  /* Center states */
  .sl-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px 40px;
    gap: 8px;
    text-align: center;
  }
  .sl-stateIcon {
    width: 72px;
    height: 72px;
    border-radius: 24px;
    background: #EEF0FF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .sl-stateTitle {
    font-size: 18px;
    font-weight: 800;
    color: #0B0B1A;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .sl-stateBody {
    font-size: 13.5px;
    color: #64748B;
    margin: 4px 0 18px;
    max-width: 340px;
    line-height: 1.55;
  }
  .sl-primaryBtn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 22px;
    background: #0504AA;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .sl-primaryBtn:hover { opacity: 0.92; }
  .sl-ghostBtn {
    margin-top: 10px;
    padding: 10px 18px;
    background: transparent;
    border: none;
    color: #0504AA;
    font-weight: 700;
    font-size: 13.5px;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    font-family: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;