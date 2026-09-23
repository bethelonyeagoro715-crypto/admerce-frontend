'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MdArrowBack,
  MdShare,
  MdStar,
  MdStarBorder,
  MdStorefront,
  MdImage,
  MdImageNotSupported,
  MdRefresh,
  MdSearch,
  MdLocationOn,
} from 'react-icons/md';
import api from '../../../services/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '';

interface Store {
  store_id: string;
  name: string;
  store_image_url?: string;
  address?: string;
  category?: string[] | string;
  [key: string]: unknown;
}

interface RawItem {
  listing_id?: string | null;
  title?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  category?: string | null;
  quantity_available?: number | null;
}

interface Item {
  id: string;
  title: string;
  price: string;
  image: string;
  category: string;
  inStock: boolean;
}

function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

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
  return `₦${numeric.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function normalizeCategories(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c).trim()).filter(Boolean);
      }
    } catch {
      // not JSON — fall through to comma split
    }
    return raw
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return [];
}

function ItemCard({
  item,
  onOpen,
}: {
  item: Item;
  onOpen: (itemId: string) => void;
}) {
  const [mediaError, setMediaError] = useState(false);

  const handleOpen = () => onOpen(item.id);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <article
      className="sdp-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${item.title}`}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="sdp-media">
        {!mediaError && item.image ? (
          <img
            className="sdp-mediaAsset"
            src={item.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setMediaError(true)}
          />
        ) : (
          <div className="sdp-mediaFallback" aria-hidden="true">
            {mediaError ? (
              <MdImageNotSupported size={34} />
            ) : (
              <MdImage size={34} />
            )}
          </div>
        )}

        {!item.inStock && (
          <span className="sdp-outBadge">Out of stock</span>
        )}
      </div>

      <div className="sdp-cardBody">
        <div className="sdp-cardTopline">
          <h2 className="sdp-itemTitle" title={item.title}>
            {item.title}
          </h2>
          <span className="sdp-price">{item.price}</span>
        </div>

        {item.category ? (
          <div className="sdp-itemMetaRow">
            <span className="sdp-chip">{item.category}</span>
          </div>
        ) : (
          <p className="sdp-itemMetaMuted">Tap to view details.</p>
        )}

        <span className="sdp-viewHint">View item</span>
      </div>
    </article>
  );
}

function ItemSkeleton() {
  return (
    <div className="sdp-card sdp-skeletonCard" aria-hidden="true">
      <div className="sdp-skeleton sdp-skeletonMedia" />
      <div className="sdp-cardBody">
        <div className="sdp-skeleton sdp-skeletonTitle" />
        <div className="sdp-skeleton sdp-skeletonLine" />
        <div className="sdp-skeleton sdp-skeletonLine sdp-skeletonLineShort" />
      </div>
    </div>
  );
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const rawId = params?.id;
  const storeId = Array.isArray(rawId) ? rawId[0] : rawId || '';

  const [store, setStore] = useState<Store | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // ─── Fetch store, items, follow status ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadStore() {
      if (!storeId) {
        setError('Store not found.');
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [storeData, itemsData, followStatus] = await Promise.all([
          api.getStoreById(storeId) as unknown as Store,
          api.getStoreItems(storeId) as unknown as RawItem[],
          api.getFollowStatus(storeId).catch(() => false),
        ]);

        if (cancelled) return;

        setStore(storeData);
        setIsFollowing(Boolean(followStatus));

        if (!Array.isArray(itemsData)) {
          console.warn('Store items response is not an array:', itemsData);
          setItems([]);
          return;
        }

        const list: Item[] = itemsData
          .filter(
            (raw): raw is RawItem => Boolean(raw && raw.listing_id),
          )
          .map((raw) => {
            const id = String(raw.listing_id);
            const title = (raw.title || '').trim() || 'Item';
            const qty =
              typeof raw.quantity_available === 'number'
                ? raw.quantity_available
                : null;

            return {
              id,
              title,
              price: formatPrice(raw.price),
              image: resolveMediaUrl(raw.image_url),
              category: (raw.category || '').trim(),
              inStock: qty === null ? true : qty > 0,
            };
          });

        setItems(list);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error('Failed to load store:', err);
        const message =
          err instanceof Error
            ? err.message
            : 'Could not load this store. Please try again.';
        setError(message);
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStore();

    return () => {
      cancelled = true;
    };
  }, [storeId, retryKey]);

  // ─── Derived ─────────────────────────────────────────────────────
  const storeImage = store ? resolveMediaUrl(store.store_image_url) : '';
  const categories = useMemo(
    () => (store ? normalizeCategories(store.category) : []),
    [store],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q),
    );
  }, [search, items]);

  // ─── Actions ─────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/shopper/home');
  }, [router]);

  const handleOpenItem = useCallback(
    (itemId: string) => {
      router.push(`/item-detail/${encodeURIComponent(itemId)}`);
    },
    [router],
  );

  const handleRetry = () => setRetryKey((k) => k + 1);

  const toggleFollow = async () => {
    if (followLoading || !storeId) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowStore(storeId);
      } else {
        await api.followStore(storeId);
      }
      setIsFollowing((v) => !v);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setFollowLoading(false);
    }
  };

  const shareStore = async () => {
    if (!store) return;
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://admerce.com/store/${storeId}`;
    const message = `Check out ${store.name} on Admerce!\n\n${
      store.address ?? ''
    }`.trim();

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Check out ${store.name} on Admerce!`,
          text: message,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(`${message}\n${url}`);
      alert('Store link copied to clipboard!');
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const storeName = store?.name?.trim() || 'Store';
  const itemCountLabel = `${items.length} ${
    items.length === 1 ? 'item' : 'items'
  }`;

  const showInfoStrip =
    !loading && !!store && (!!storeImage || !!store.address || categories.length > 0);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <main className="sdp-page">
      <style>{`
        .sdp-page {
          --sdp-primary: #0504AA;
          --sdp-primarySoft: #EEF2FF;
          --sdp-text: #101114;
          --sdp-muted: #70747D;
          --sdp-border: #E8E9ED;
          --sdp-surface: #FFFFFF;
          --sdp-page: #F7F8FC;
          --sdp-amber: #FFA000;
          min-height: 100dvh;
          background: var(--sdp-page);
          color: var(--sdp-text);
          font-family: inherit;
        }

        .sdp-header {
          position: sticky;
          top: 0;
          z-index: 20;
          border-bottom: 1px solid rgba(232, 233, 237, 0.92);
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .sdp-headerInner {
          width: min(1180px, 100%);
          margin: 0 auto;
          min-height: 68px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sdp-backButton,
        .sdp-iconButton {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--sdp-border);
          border-radius: 12px;
          background: var(--sdp-surface);
          color: var(--sdp-text);
          cursor: pointer;
          transition: 160ms ease;
        }

        .sdp-backButton:hover,
        .sdp-iconButton:hover {
          border-color: #C9CBFF;
          color: var(--sdp-primary);
          transform: translateY(-1px);
        }

        .sdp-iconButton.is-active {
          color: var(--sdp-amber);
          border-color: #FFE0B2;
        }

        .sdp-backButton:focus-visible,
        .sdp-iconButton:focus-visible,
        .sdp-search:focus-within,
        .sdp-card:focus-visible {
          outline: 3px solid rgba(5, 4, 170, 0.18);
          outline-offset: 2px;
        }

        .sdp-heading {
          min-width: 0;
          flex: 1;
        }

        .sdp-storeName {
          margin: 0;
          font-size: clamp(17px, 2.4vw, 21px);
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sdp-storeMeta {
          margin: 4px 0 0;
          color: var(--sdp-muted);
          font-size: 12px;
          font-weight: 600;
        }

        .sdp-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sdp-shell {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 0 18px 32px;
        }

        /* ─── Info strip ──────────────────────────────────── */
        .sdp-infoStrip {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 18px 0 0;
          padding: 14px 16px;
          border: 1px solid var(--sdp-border);
          border-radius: 18px;
          background: var(--sdp-surface);
          box-shadow: 0 6px 20px rgba(16, 17, 20, 0.04);
        }

        .sdp-infoAvatar {
          width: 56px;
          height: 56px;
          flex: 0 0 56px;
          border-radius: 14px;
          overflow: hidden;
          background: var(--sdp-primarySoft);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--sdp-primary);
        }

        .sdp-infoAvatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .sdp-infoText {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sdp-infoAddress {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--sdp-muted);
          font-size: 13px;
          line-height: 1.4;
        }

        .sdp-infoAddress svg {
          flex: 0 0 auto;
        }

        .sdp-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .sdp-chip {
          display: inline-block;
          padding: 3px 9px;
          border-radius: 999px;
          background: var(--sdp-primarySoft);
          color: var(--sdp-primary);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        /* ─── Content header ─────────────────────────────── */
        .sdp-contentHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          padding: 24px 0 18px;
        }

        .sdp-pageTitle {
          margin: 0;
          font-size: clamp(24px, 4vw, 34px);
          line-height: 1.05;
          letter-spacing: -0.035em;
          font-weight: 850;
        }

        .sdp-pageSubtitle {
          margin: 8px 0 0;
          color: var(--sdp-muted);
          font-size: 14px;
        }

        .sdp-search {
          width: min(320px, 100%);
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 13px;
          border: 1px solid var(--sdp-border);
          border-radius: 14px;
          background: var(--sdp-surface);
          transition: 160ms ease;
        }

        .sdp-search svg {
          color: #858995;
          flex: 0 0 auto;
        }

        .sdp-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--sdp-text);
          font: inherit;
          font-size: 14px;
        }

        .sdp-search input::placeholder {
          color: #9A9DA6;
        }

        /* ─── Grid + cards ──────────────────────────────── */
        .sdp-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .sdp-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--sdp-border);
          border-radius: 18px;
          background: var(--sdp-surface);
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(16, 17, 20, 0.045);
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .sdp-card:hover {
          transform: translateY(-3px);
          border-color: #D9DAFF;
          box-shadow: 0 16px 34px rgba(16, 17, 20, 0.085);
        }

        .sdp-media {
          position: relative;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          background: var(--sdp-primarySoft);
        }

        .sdp-mediaAsset {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .sdp-mediaFallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #A9B1DA;
        }

        .sdp-outBadge {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 4px 9px;
          border-radius: 8px;
          background: rgba(12, 12, 17, 0.78);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .sdp-cardBody {
          padding: 13px 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sdp-cardTopline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .sdp-itemTitle {
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

        .sdp-price {
          flex: 0 0 auto;
          color: var(--sdp-primary);
          font-size: 14px;
          font-weight: 850;
          white-space: nowrap;
        }

        .sdp-itemMetaRow {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .sdp-itemMetaMuted {
          margin: 0;
          color: #9A9DA6;
          font-size: 12.5px;
          line-height: 1.5;
        }

        .sdp-viewHint {
          display: inline-block;
          color: var(--sdp-primary);
          font-size: 12px;
          font-weight: 750;
        }

        /* ─── States ─────────────────────────────────────── */
        .sdp-center {
          min-height: 48vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          text-align: center;
        }

        .sdp-spinner {
          width: 38px;
          height: 38px;
          border: 3px solid #DFE1F8;
          border-top-color: var(--sdp-primary);
          border-radius: 50%;
          animation: sdpSpin 700ms linear infinite;
        }

        .sdp-stateIcon {
          width: 62px;
          height: 62px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: var(--sdp-primarySoft);
          color: var(--sdp-primary);
        }

        .sdp-stateTitle {
          margin: 15px 0 0;
          font-size: 17px;
          font-weight: 800;
        }

        .sdp-stateText {
          max-width: 380px;
          margin: 7px 0 0;
          color: var(--sdp-muted);
          font-size: 14px;
          line-height: 1.5;
        }

        .sdp-retry {
          margin-top: 15px;
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 15px;
          border: 0;
          border-radius: 12px;
          background: var(--sdp-primary);
          color: #fff;
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition: 160ms ease;
        }

        .sdp-retry:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
        }

        .sdp-noResults {
          grid-column: 1 / -1;
          padding: 52px 18px;
          border: 1px dashed #DADCE6;
          border-radius: 18px;
          text-align: center;
          background: rgba(255, 255, 255, 0.72);
          color: var(--sdp-muted);
        }

        /* ─── Skeletons ─────────────────────────────────── */
        .sdp-skeletonCard {
          cursor: default;
          pointer-events: none;
        }

        .sdp-skeleton {
          position: relative;
          overflow: hidden;
          background: #ECEEF4;
        }

        .sdp-skeleton::after {
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
          animation: sdpShimmer 1.25s infinite;
        }

        .sdp-skeletonMedia {
          aspect-ratio: 1 / 1;
        }

        .sdp-skeletonTitle {
          width: 72%;
          height: 16px;
          border-radius: 6px;
        }

        .sdp-skeletonLine {
          width: 100%;
          height: 11px;
          border-radius: 6px;
        }

        .sdp-skeletonLineShort {
          width: 64%;
        }

        @keyframes sdpSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes sdpShimmer {
          100% { transform: translateX(100%); }
        }

        /* ─── Responsive ─────────────────────────────────── */
        @media (max-width: 980px) {
          .sdp-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .sdp-shell {
            padding: 0 14px 26px;
          }

          .sdp-headerInner {
            padding: 9px 14px;
          }

          .sdp-contentHeader {
            align-items: stretch;
            flex-direction: column;
            padding-top: 20px;
          }

          .sdp-search {
            width: 100%;
          }

          .sdp-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .sdp-card {
            border-radius: 15px;
          }

          .sdp-cardBody {
            padding: 11px 12px 12px;
          }

          .sdp-infoStrip {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 420px) {
          .sdp-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sdp-card,
          .sdp-backButton,
          .sdp-iconButton,
          .sdp-retry {
            transition: none;
          }

          .sdp-spinner,
          .sdp-skeleton::after {
            animation: none;
          }
        }
      `}</style>

      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="sdp-header">
        <div className="sdp-headerInner">
          <button
            type="button"
            className="sdp-backButton"
            onClick={handleBack}
            aria-label="Go back"
          >
            <MdArrowBack size={21} />
          </button>

          <div className="sdp-heading">
            <h1 className="sdp-storeName">{storeName}</h1>
            <p className="sdp-storeMeta">
              {loading ? 'Loading…' : itemCountLabel}
            </p>
          </div>

          <div className="sdp-actions">
            <button
              type="button"
              className={`sdp-iconButton${isFollowing ? ' is-active' : ''}`}
              onClick={toggleFollow}
              disabled={followLoading || loading || !store}
              aria-label={isFollowing ? 'Unfollow store' : 'Follow store'}
              title={isFollowing ? 'Unfollow' : 'Follow'}
            >
              {isFollowing ? <MdStar size={21} /> : <MdStarBorder size={21} />}
            </button>

            <button
              type="button"
              className="sdp-iconButton"
              onClick={shareStore}
              disabled={loading || !store}
              aria-label="Share store"
              title="Share"
            >
              <MdShare size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="sdp-shell">
        {/* ─── Info strip (avatar, address, categories) ─── */}
        {showInfoStrip && (
          <section className="sdp-infoStrip">
            <div className="sdp-infoAvatar" aria-hidden="true">
              {storeImage ? (
                <img src={storeImage} alt="" />
              ) : (
                <MdStorefront size={26} />
              )}
            </div>

            <div className="sdp-infoText">
              {store?.address && (
                <p className="sdp-infoAddress">
                  <MdLocationOn size={15} />
                  {store.address}
                </p>
              )}

              {categories.length > 0 && (
                <div className="sdp-chips">
                  {categories.map((cat, idx) => (
                    <span key={`${cat}-${idx}`} className="sdp-chip">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── Content header ──────────────────────────────── */}
        <section className="sdp-contentHeader">
          <div>
            <h2 className="sdp-pageTitle">Items</h2>
            <p className="sdp-pageSubtitle">
              Explore what this store sells.
            </p>
          </div>

          {!loading && items.length > 0 && (
            <label className="sdp-search">
              <MdSearch size={19} aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items"
                aria-label="Search items"
                type="search"
              />
            </label>
          )}
        </section>

        {/* ─── Body: loading / error / empty / no-results / grid ─ */}
        {loading ? (
          <div
            className="sdp-grid"
            aria-busy="true"
            aria-label="Loading items"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <ItemSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="sdp-center">
            <div className="sdp-stateIcon" aria-hidden="true">
              <MdStorefront size={32} />
            </div>
            <h2 className="sdp-stateTitle">
              We couldn&apos;t load this store
            </h2>
            <p className="sdp-stateText">{error}</p>
            <button
              type="button"
              className="sdp-retry"
              onClick={handleRetry}
            >
              <MdRefresh size={18} />
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="sdp-center">
            <div className="sdp-stateIcon" aria-hidden="true">
              <MdStorefront size={32} />
            </div>
            <h2 className="sdp-stateTitle">No items yet</h2>
            <p className="sdp-stateText">
              This store hasn&apos;t listed any items yet.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="sdp-noResults">
            No items match <strong>&quot;{search.trim()}&quot;</strong>.
          </div>
        ) : (
          <section className="sdp-grid" aria-label={`${storeName} items`}>
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={handleOpenItem} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}