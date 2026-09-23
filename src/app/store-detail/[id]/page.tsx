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
      // not JSON — fall through
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
              <MdImageNotSupported size={28} />
            ) : (
              <MdImage size={28} />
            )}
          </div>
        )}

        {!item.inStock && <span className="sdp-outBadge">Out</span>}
      </div>

      <div className="sdp-cardBody">
        <h2 className="sdp-itemTitle" title={item.title}>
          {item.title}
        </h2>
        <span className="sdp-price">{item.price}</span>
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
        <div className="sdp-skeleton sdp-skeletonPrice" />
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
          .filter((raw): raw is RawItem => Boolean(raw && raw.listing_id))
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
    !loading &&
    !!store &&
    (!!storeImage || !!store.address || categories.length > 0);

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
          -webkit-tap-highlight-color: transparent;
        }

        /* ═══ Header — compact, app-like ═══ */
        .sdp-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--sdp-border);
          padding-top: env(safe-area-inset-top, 0);
        }

        .sdp-headerInner {
          width: 100%;
          margin: 0 auto;
          min-height: 52px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sdp-backButton,
        .sdp-iconButton {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--sdp-text);
          cursor: pointer;
          transition: background-color 120ms ease, color 120ms ease;
        }

        .sdp-backButton:active,
        .sdp-iconButton:active {
          background: #F1F2F8;
        }

        .sdp-backButton:focus-visible,
        .sdp-iconButton:focus-visible,
        .sdp-search:focus-within,
        .sdp-card:focus-visible {
          outline: 3px solid rgba(5, 4, 170, 0.18);
          outline-offset: 2px;
        }

        .sdp-iconButton.is-active {
          color: var(--sdp-amber);
        }

        .sdp-iconButton:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .sdp-heading {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .sdp-storeName {
          margin: 0;
          font-size: 15px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sdp-storeMeta {
          margin: 0;
          color: var(--sdp-muted);
          font-size: 11.5px;
          font-weight: 500;
        }

        .sdp-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        /* ═══ Shell ═══ */
        .sdp-shell {
          width: 100%;
          margin: 0 auto;
          padding: 12px 12px calc(24px + env(safe-area-inset-bottom, 0));
        }

        /* ═══ Info strip — compact, horizontal ═══ */
        .sdp-infoStrip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border: 1px solid var(--sdp-border);
          border-radius: 14px;
          background: var(--sdp-surface);
          margin-bottom: 14px;
        }

        .sdp-infoAvatar {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          border-radius: 12px;
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
          gap: 4px;
        }

        .sdp-infoAddress {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--sdp-muted);
          font-size: 12px;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sdp-infoAddress svg {
          flex: 0 0 auto;
        }

        .sdp-chips {
          display: flex;
          flex-wrap: nowrap;
          gap: 5px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .sdp-chips::-webkit-scrollbar {
          display: none;
        }

        .sdp-chip {
          display: inline-block;
          flex-shrink: 0;
          padding: 2px 8px;
          border-radius: 999px;
          background: var(--sdp-primarySoft);
          color: var(--sdp-primary);
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        /* ═══ Content header ═══ */
        .sdp-contentHeader {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 4px 2px 12px;
        }

        .sdp-pageTitle {
          margin: 0;
          font-size: 22px;
          line-height: 1.1;
          letter-spacing: -0.03em;
          font-weight: 800;
        }

        .sdp-pageSubtitle {
          margin: 3px 0 0;
          color: var(--sdp-muted);
          font-size: 12.5px;
        }

        .sdp-search {
          width: 100%;
          min-height: 38px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border: 1px solid var(--sdp-border);
          border-radius: 10px;
          background: var(--sdp-surface);
          transition: border-color 140ms ease;
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
          font-size: 13.5px;
        }

        .sdp-search input::placeholder {
          color: #9A9DA6;
        }

        /* ═══ Grid — 2 cols mobile base ═══ */
        .sdp-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        /* ═══ Card ═══ */
        .sdp-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--sdp-border);
          border-radius: 14px;
          background: var(--sdp-surface);
          cursor: pointer;
          transition: transform 140ms ease, border-color 140ms ease;
          -webkit-tap-highlight-color: transparent;
        }

        .sdp-card:active {
          transform: scale(0.985);
          border-color: #C9CBFF;
        }

        .sdp-media {
          position: relative;
          aspect-ratio: 4 / 3;
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
          top: 7px;
          left: 7px;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(12, 12, 17, 0.78);
          color: #fff;
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .sdp-cardBody {
          padding: 9px 10px 11px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sdp-itemTitle {
          margin: 0;
          font-size: 13px;
          line-height: 1.28;
          font-weight: 600;
          letter-spacing: -0.005em;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          min-height: calc(13px * 1.28 * 2);
        }

        .sdp-price {
          color: var(--sdp-primary);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        /* ═══ States ═══ */
        .sdp-center {
          min-height: 50vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .sdp-stateIcon {
          width: 56px;
          height: 56px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: var(--sdp-primarySoft);
          color: var(--sdp-primary);
        }

        .sdp-stateTitle {
          margin: 13px 0 0;
          font-size: 15.5px;
          font-weight: 750;
        }

        .sdp-stateText {
          max-width: 320px;
          margin: 6px 0 0;
          color: var(--sdp-muted);
          font-size: 13px;
          line-height: 1.5;
        }

        .sdp-retry {
          margin-top: 14px;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 16px;
          border: 0;
          border-radius: 11px;
          background: var(--sdp-primary);
          color: #fff;
          font: inherit;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
        }

        .sdp-retry:active {
          filter: brightness(0.94);
        }

        .sdp-noResults {
          grid-column: 1 / -1;
          padding: 40px 16px;
          border: 1px dashed #DADCE6;
          border-radius: 14px;
          text-align: center;
          background: rgba(255, 255, 255, 0.72);
          color: var(--sdp-muted);
          font-size: 13px;
        }

        /* ═══ Skeletons ═══ */
        .sdp-skeletonCard {
          cursor: default;
          pointer-events: none;
        }

        .sdp-skeleton {
          position: relative;
          overflow: hidden;
          background: #ECEEF4;
          border-radius: 6px;
        }

        .sdp-skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.55),
            transparent
          );
          animation: sdpShimmer 1.3s infinite;
        }

        .sdp-skeletonMedia {
          aspect-ratio: 4 / 3;
          border-radius: 0;
        }

        .sdp-skeletonTitle {
          width: 84%;
          height: 12px;
        }

        .sdp-skeletonPrice {
          width: 46%;
          height: 12px;
          margin-top: 4px;
        }

        @keyframes sdpShimmer {
          100% { transform: translateX(100%); }
        }

        /* ═══ Wider screens ═══ */
        @media (min-width: 640px) {
          .sdp-headerInner {
            padding: 10px 18px;
            min-height: 60px;
            gap: 12px;
          }

          .sdp-backButton,
          .sdp-iconButton {
            width: 40px;
            height: 40px;
            flex: 0 0 40px;
          }

          .sdp-storeName {
            font-size: 17px;
          }

          .sdp-storeMeta {
            font-size: 12px;
          }

          .sdp-shell {
            max-width: 720px;
            padding: 16px 18px calc(28px + env(safe-area-inset-bottom, 0));
          }

          .sdp-infoAvatar {
            width: 52px;
            height: 52px;
            flex: 0 0 52px;
            border-radius: 14px;
          }

          .sdp-infoAddress {
            font-size: 13px;
          }

          .sdp-chip {
            font-size: 11px;
            padding: 3px 9px;
          }

          .sdp-contentHeader {
            flex-direction: row;
            align-items: flex-end;
            justify-content: space-between;
            padding: 12px 0 16px;
          }

          .sdp-pageTitle {
            font-size: 28px;
          }

          .sdp-pageSubtitle {
            font-size: 13.5px;
            margin-top: 5px;
          }

          .sdp-search {
            width: min(300px, 100%);
            min-height: 42px;
            border-radius: 12px;
          }

          .sdp-search input {
            font-size: 14px;
          }

          .sdp-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
          }

          .sdp-card {
            border-radius: 16px;
          }

          .sdp-cardBody {
            padding: 11px 12px 13px;
            gap: 5px;
          }

          .sdp-itemTitle {
            font-size: 14px;
            min-height: calc(14px * 1.28 * 2);
          }

          .sdp-price {
            font-size: 14px;
          }
        }

        @media (min-width: 1024px) {
          .sdp-shell {
            max-width: 1180px;
            padding: 20px 18px 32px;
          }

          .sdp-contentHeader {
            padding: 20px 0 18px;
          }

          .sdp-pageTitle {
            font-size: 32px;
          }

          .sdp-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
          }

          .sdp-card {
            border-radius: 18px;
          }

          .sdp-card:hover {
            transform: translateY(-2px);
            border-color: #D9DAFF;
            box-shadow: 0 12px 28px rgba(16, 17, 20, 0.08);
          }

          .sdp-infoStrip {
            padding: 14px 16px;
            gap: 14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sdp-card,
          .sdp-backButton,
          .sdp-iconButton {
            transition: none;
          }

          .sdp-skeleton::after {
            animation: none;
          }
        }
      `}</style>

      <header className="sdp-header">
        <div className="sdp-headerInner">
          <button
            type="button"
            className="sdp-backButton"
            onClick={handleBack}
            aria-label="Go back"
          >
            <MdArrowBack size={20} />
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
            >
              {isFollowing ? <MdStar size={20} /> : <MdStarBorder size={20} />}
            </button>

            <button
              type="button"
              className="sdp-iconButton"
              onClick={shareStore}
              disabled={loading || !store}
              aria-label="Share store"
            >
              <MdShare size={19} />
            </button>
          </div>
        </div>
      </header>

      <div className="sdp-shell">
        {showInfoStrip && (
          <section className="sdp-infoStrip">
            <div className="sdp-infoAvatar" aria-hidden="true">
              {storeImage ? (
                <img src={storeImage} alt="" />
              ) : (
                <MdStorefront size={22} />
              )}
            </div>

            <div className="sdp-infoText">
              {store?.address && (
                <p className="sdp-infoAddress">
                  <MdLocationOn size={14} />
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

        <section className="sdp-contentHeader">
          <div>
            <h2 className="sdp-pageTitle">Items</h2>
            <p className="sdp-pageSubtitle">
              {itemCountLabel} available
            </p>
          </div>

          {!loading && items.length > 0 && (
            <label className="sdp-search">
              <MdSearch size={17} aria-hidden="true" />
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

        {loading ? (
          <div
            className="sdp-grid"
            aria-busy="true"
            aria-label="Loading items"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <ItemSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="sdp-center">
            <div className="sdp-stateIcon" aria-hidden="true">
              <MdStorefront size={26} />
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
              <MdRefresh size={17} />
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="sdp-center">
            <div className="sdp-stateIcon" aria-hidden="true">
              <MdStorefront size={26} />
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